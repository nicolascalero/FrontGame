



export class Game extends Phaser.Scene {

    constructor() {
        super({ key: 'GameScene' });
        this.player = {};
        this.teamBlue = {};
        this.otherTeam = {};
        this.otherPlayers = {};
        this.playerRole = null;
        this.playerId = this.generateUUID();
        this.targetDestinations = new Map();
        this.redTeamInitialized = false;
        this.blueTeamInitialized = false;
        this.selectedCircle = false;
        this.isShooting = false;
    }

    preload() {

        this.load.image('tilesetImage', '../../assets/Mapa2.png'); // Asume que 'assets' está al mismo nivel que tu index.html
        this.load.image('tilesetImage2', '../../assets/Mapa3.png'); // Carga el mapa
        this.load.tilemapTiledJSON('map', '../../assets/mapa.json'); // Carga el mapa
        this.load.image('droneSprite', '../../assets/drone.png'); // Cargar sprite del dron
        this.load.image('balaSprite', '../../assets/bala.png'); // Cargar sprite del dron


    }

    create() {
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('Mapa2', 'tilesetImage');
        const tileset3 = map.addTilesetImage('Mapa3', 'tilesetImage2');
        const layer1 = map.createLayer('Capa de patrones 1', tileset, 0, 0);
        const layer2 = map.createLayer('Capa de patrones 2', tileset, 0, 0);
        this.player = this.add.group();
        this.teamBlue = this.add.group();

        this.cursors = this.input.keyboard.createCursorKeys();

        this.input.on('gameobjectdown', this.onGameClick, this);

        this.input.on('pointerdown', (pointer) => {
            this.playerRole == "red" ? this.moveSelectedDrones(pointer) : this.moveSelectedCircle(this.selectedCircle, pointer);
        });

        this.setupWebSocketListeners();


    }

    setupWebSocketListeners() {
        const socket = new SockJS('http://localhost:8080/gs-guide-websocket');
        this.stompClient = Stomp.over(socket);
        this.stompClient.debug = () => { };

        this.stompClient.connect({}, (frame) => {
            console.log('Conectado: ' + frame);

            this.stompClient.send("/app/register", {}, JSON.stringify({ playerId: this.playerId, x: this.player.x, y: this.player.y }));

            this.stompClient.subscribe('/topic/playerMoves', (message) => {
                const players = JSON.parse(message.body);
                this.initializePlayers(players);
                players.forEach(player => {
                    this.updateOtherPlayerPosition(player);
                });
            });

            this.stompClient.subscribe('/topic/playerRole', (message) => {
                const playerInfo = JSON.parse(message.body);
                // Verificar si el mensaje es para este cliente
                if (playerInfo.playerId === this.playerId) {
                    this.playerRole = playerInfo.role;
                }
            });

            this.stompClient.subscribe('/topic/playerDisconnected', (message) => {
                const disconnectedPlayerId = JSON.parse(message.body);
                this.removePlayer(disconnectedPlayerId);
            });

            this.stompClient.subscribe('/topic/shoots', (message) => {
                const shootInfo = JSON.parse(message.body);
                if (shootInfo.playerId !== this.playerId) {
                    this.shootUpdateOther(shootInfo)
                }
            });


        });
    }

    initializePlayers(players) {
        if (!this.redTeamInitialized) {
            this.createRedTeam();
            this.redTeamInitialized = true;
        }
        if (players.length > 1 && !this.blueTeamInitialized) {
            this.createBlueTeam();
            this.blueTeamInitialized = true;
        }
    }


    createRedTeam() {
        const mapHeight = this.game.config.height - 50;
        let droneId = 0;

        for (let i = 0; i < 6; i++) {
            let drone = this.physics.add.sprite(410 + i * 50, mapHeight - 80, 'droneSprite');
            drone.setInteractive();
            drone.isSelected = false;
            drone.team = 'red';
            drone.id = `drone-${droneId++}`;
            drone.life = 3;
            drone.text = this.add.text(drone.x, drone.y - 20, `${drone.life}`, {
                fontSize: '16px',
                fill: '#000000',
                fontFamily: 'Arial',
                stroke: '#ffffff',
                strokeThickness: 4
            }).setOrigin(0.5); this.player.add(drone);
        }
    }


    createBlueTeam() {
        let deffense = 0;

        for (let i = 0; i < 3; i++) {
            let circle = this.add.circle(480 + i * 50, 80, 15, 0x0000ff);
            this.physics.add.existing(circle);
            circle.body.setCircle(20);
            circle.setInteractive();
            circle.isSelected = false;
            circle.team = 'blue';
            circle.id = `deffense-${deffense++}`;
            circle.life = 3;
            this.teamBlue.add(circle);
        }
    }



    hitTest(x, y) {
        let hitEntity = null;
        const tolerance = 5; // Margen de tolerancia en píxeles

        // Selecciona el grupo correcto basado en el rol del jugador
        let entitiesGroup = this.player;

        entitiesGroup.getChildren().forEach((entity) => {
            const bounds = entity.getBounds();

            // Ajusta los límites para la tolerancia
            const expandedBounds = new Phaser.Geom.Rectangle(bounds.x - tolerance, bounds.y - tolerance, bounds.width + 2 * tolerance, bounds.height + 2 * tolerance);

            if (expandedBounds.contains(x, y)) {
                hitEntity = entity;
            }
        });

        return hitEntity;
    }

    hitTestBlueCircles(x, y) {
        let hitCircle = null;
        const tolerance = 5; // Margen de tolerancia en píxeles

        this.teamBlue.getChildren().forEach(circle => {
            const bounds = circle.getBounds();

            // Ajusta los límites para la tolerancia
            const expandedBounds = new Phaser.Geom.Rectangle(bounds.x - tolerance, bounds.y - tolerance, bounds.width + 2 * tolerance, bounds.height + 2 * tolerance);

            if (expandedBounds.contains(x, y)) {
                hitCircle = circle;
            }
        });

        return hitCircle;
    }


    onGameClick(pointer) {
        // Intenta seleccionar un aliado basado en el equipo del jugador.
        let hitAlly;
        if (this.playerRole === 'red') {
            hitAlly = this.hitTest(pointer.x, pointer.y);
            if (hitAlly && hitAlly.team === this.playerRole) {
                this.toggleDroneSelection(hitAlly);
            } else {
                // Si no se selecciona un aliado y el jugador es del equipo rojo, intenta seleccionar un enemigo azul.
                let hitEnemy = this.hitTestBlueCircles(pointer.x, pointer.y);
                if (this.selectedEntity && hitEnemy && hitEnemy.team !== this.playerRole) {
                    this.shootBullets(this.selectedEntity, hitEnemy);
                }
            }
        } else if (this.playerRole === 'blue') {
            hitAlly = this.hitTestBlueCircles(pointer.x, pointer.y);
            if (hitAlly && hitAlly.team === this.playerRole) {
                this.selectedCircle = hitAlly; // Actualiza la selección para el equipo azul.
                this.toggleDroneSelection(hitAlly);
            } else {
                // Si no se selecciona un aliado y el jugador es del equipo azul, intenta seleccionar un enemigo rojo.
                let hitEnemy = this.hitTest(pointer.x, pointer.y);
                if (this.selectedCircle && hitEnemy && hitEnemy.team !== this.playerRole) {
                    this.shootBullets(this.selectedCircle, hitEnemy);
                }
            }
        }
    }

    moveSelectedCircle(selectedCircle, pointer) {
        if (this.isShooting) {
            this.isShooting = false;
            return;
        }

        if (selectedCircle && selectedCircle.team === 'blue' && !selectedCircle.isMoving) {
            const angle = Phaser.Math.Angle.Between(selectedCircle.x, selectedCircle.y, pointer.x, pointer.y);
            const distance = Phaser.Math.Distance.Between(selectedCircle.x, selectedCircle.y, pointer.x, pointer.y);
            const speed = 200;

            // Establece la velocidad hacia el destino
            selectedCircle.body.setVelocityX(Math.cos(angle) * speed);
            selectedCircle.body.setVelocityY(Math.sin(angle) * speed);

            // Almacena el destino y la distancia inicial para su uso en el método update
            selectedCircle.targetDestination = { x: pointer.x, y: pointer.y, distance: distance };
            selectedCircle.isMoving = true; // Marca el círculo como en movimiento
        }
    }

    toggleDroneSelection(selectedDrone) {
        this.player.getChildren().forEach(drone => {
            drone.isSelected = false;
            drone.isFirstSelect = false;
        });

        selectedDrone.isSelected = true;
        selectedDrone.isFirstSelect = true;
        this.selectedEntity = selectedDrone;
    }


    moveSelectedDrones(pointer) {
        if (this.isShooting) {
            this.isShooting = false;
            return;
        }

        this.player.getChildren().forEach(drone => {
            if (drone.isSelected) {
                // Calcula la dirección y la distancia al destino
                const angle = Phaser.Math.Angle.Between(drone.x, drone.y, pointer.x, pointer.y);
                const distance = Phaser.Math.Distance.Between(drone.x, drone.y, pointer.x, pointer.y);

                // Establece una velocidad hacia el destino
                const speed = 200;
                drone.body.setVelocityX(Math.cos(angle) * speed);
                drone.body.setVelocityY(Math.sin(angle) * speed);

                // Almacena el destino y la distancia inicial para su uso en el método update
                this.targetDestinations.set(drone, { x: pointer.x, y: pointer.y, distance: distance });
            }
        });

        this.player.getChildren().forEach(drone => {
            if (drone.prevX !== undefined && drone.prevY !== undefined) {
                // Determinar la dirección del movimiento
                if (Math.abs(drone.x - drone.prevX) > Math.abs(drone.y - drone.prevY)) {
                    // Movimiento principal en X
                    if (drone.x > drone.prevX) {
                        // Movimiento a la derecha
                        drone.angle = 90;
                    } else {
                        // Movimiento a la izquierda
                        drone.angle = -90;
                    }
                } else {
                    // Movimiento principal en Y
                    if (drone.y > drone.prevY) {
                        // Movimiento hacia abajo
                        drone.angle = 180;
                    } else {
                        // Movimiento hacia arriba
                        drone.angle = 0;
                    }
                }
            }

            // Actualiza las posiciones previas para el próximo frame
            drone.prevX = drone.x;
            drone.prevY = drone.y;
        });
    }




    updateOtherPlayerPosition(playerUpdate) {
        if (playerUpdate) {
            if (playerUpdate.playerId !== this.playerId) {
                const group = playerUpdate.entityType === 'red' ? this.player : this.teamBlue;
                let entity = group.getChildren().find(e => e.id === playerUpdate.entityId);

                if (!entity) {
                    return;
                }

                // Mueve la entidad hacia la posición actualizada usando interpolación o directamente
                this.startInterpolation(entity, playerUpdate.x, playerUpdate.y);
            }
        }
    }


    startInterpolation(entity, targetX, targetY) {
        const distance = Phaser.Math.Distance.Between(entity.x, entity.y, targetX, targetY);
        const duration = distance / 100;

        this.tweens.add({
            targets: entity,
            x: targetX,
            y: targetY,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                // Opcional: Realizar acciones al completar la interpolación
            }
        });
    }



    update(time, delta) {
        this.lastUpdateTime = 0;
        this.updateFrequency = 100;
        this.player.getChildren().forEach(drone => {
            if (drone && drone.text) {
                drone.text.setPosition(drone.x, drone.y - 20);
                drone.text.setText(`${drone.life}`);
            }

            if (this.targetDestinations.has(drone)) {
                const target = this.targetDestinations.get(drone);
                const distance = Phaser.Math.Distance.Between(drone.x, drone.y, target.x, target.y);
                if (distance < 10) {
                    drone.body.setVelocity(0, 0); // Detiene el dron
                    this.targetDestinations.delete(drone); // Elimina el destino
                } else if (time - this.lastUpdateTime > this.updateFrequency) {
                    // Solo envía la actualización si ha pasado suficiente tiempo desde la última actualización
                    this.sendPlayerPosition(drone);
                    this.lastUpdateTime = time; // Actualiza el tiempo de la última actualización
                }
            }
        });

        this.teamBlue.getChildren().forEach(circle => {
            if (circle.isMoving) {
                const target = circle.targetDestination;
                const distance = Phaser.Math.Distance.Between(circle.x, circle.y, target.x, target.y);
                if (distance < 10) {
                    circle.body.setVelocity(0, 0);
                    circle.isMoving = false;
                }
                this.sendPlayerPosition(circle);
            }
        });
    }





    sendPlayerPosition(entity) {
        if (this.stompClient && this.stompClient.connected && entity.team === this.playerRole) {
            const message = {
                playerId: this.playerId,
                entityId: entity.id,
                entityType: entity.team,
                x: entity.x,
                y: entity.y
            };
            this.stompClient.send("/app/playerMove", {}, JSON.stringify(message));
        }
    }



    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    shootBullets(shooter, target) {
        this.isShooting = true;
        let bullet = this.physics.add.sprite(shooter.x, shooter.y, 'balaSprite');
        this.physics.moveTo(bullet, target.x, target.y, 600); // Velocidad de la bala.

        // Información del disparo para enviar a otros jugadores.
        const shootInfo = {
            playerId: this.playerId,
            fromX: shooter.x,
            fromY: shooter.y,
            x: target.x,
            y: target.y
        };
        console.log(shootInfo)
        this.stompClient.send("/app/shoot", {}, JSON.stringify(shootInfo));
    }


    shootUpdateOther(shootInfo) {
        let bullet = this.add.sprite(shootInfo.fromX, shootInfo.fromY, 'balaSprite');
        this.physics.add.existing(bullet);
        this.physics.moveTo(bullet, shootInfo.x, shootInfo.y, 600);
    }



    removePlayer(disconnectedPlayerId) {
        if (this.otherPlayers[disconnectedPlayerId])
            this.otherPlayers[disconnectedPlayerId].destroy();
        delete this.otherPlayers[disconnectedPlayerId];

    }

}