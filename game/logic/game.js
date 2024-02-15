



export class Game extends Phaser.Scene {

    constructor() {
        super({ key: 'GameScene' });
        this.player = {};
        this.teamBlue = {};
        this.otherPlayers = {};
        this.playerRole = null;
        this.playerId = this.generateUUID();
        this.targetDestinations = new Map();
        this.redTeamInitialized = false;
        this.blueTeamInitialized = false;
        this.selectedCircle = false;
        this.isShooting = false;
        this.code = null;
        this.name = null;
        this.isOwner = false;
        this.unity = ['MOBILE_RADAR', 'MISSILE_BATTERY', 'CENTRAL', 'BOFORS', "LASER", "RADAR", "MOBILE_CONNECTION", "LASER_CONNECTION"];
        this.notSelect = ['CENTRAL', 'LASER', 'RADAR', 'MOBILE_CONNECTION', 'LASER_CONNECTION'];
        this.bullets = null;
    }

    preload() {
        this.load.image('tilesetImage', '../../assets/Mapa2.png');
        this.load.image('tilesetImage2', '../../assets/Mapa3.png');
        this.load.tilemapTiledJSON('map', '../../assets/mapa.json');
        this.load.image('droneSprite', '../../assets/drone.png');
        this.load.image('balaSprite', '../../assets/bala.png');


    }

    create() {
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('Mapa2', 'tilesetImage');
        const tileset3 = map.addTilesetImage('Mapa3', 'tilesetImage2');
        const layer1 = map.createLayer('Capa de patrones 1', tileset, 0, 0);
        const layer2 = map.createLayer('Capa de patrones 2', tileset, 0, 0);
        this.player = this.add.group();
        this.teamBlue = this.add.group();
        this.bullets = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite
        });
        this.name = localStorage.getItem('userName');
        this.isOwner = localStorage.getItem('isOwner') === 'true';
        this.code = localStorage.getItem('gameCode');

        this.cursors = this.input.keyboard.createCursorKeys();

        this.input.on('gameobjectdown', this.onGameClick, this);

        this.input.on('pointerdown', (pointer) => {
            this.playerRole == "RED" ? this.moveSelectedDrones(pointer) : this.moveSelectedCircle(this.selectedCircle, pointer);
        });

        this.physics.add.collider(this.player, this.bullets, this.handleBulletCollision, null, this);
        this.physics.add.collider(this.teamBlue, this.bullets, this.handleBulletCollision, null, this);


        this.setupWebSocketListeners();


    }

    setupWebSocketListeners() {
        const socket = new SockJS('http://localhost:8080/gs-guide-websocket');
        this.stompClient = Stomp.over(socket);
        this.stompClient.debug = () => { };

        this.stompClient.connect({}, (frame) => {

            if (this.isOwner) {
                this.stompClient.send("/app/createGame", {}, JSON.stringify({ name: this.name }));

            } else {
                this.stompClient.send("/app/register", {}, JSON.stringify({ gameId: this.code, nickName: this.name }));
            }


            this.stompClient.subscribe('/topic/createGame', (message) => {
                const code = JSON.parse(message.body);
                this.code = code.gameId;
                this.addTextCode();
                this.initializePlayers();
                this.playerRole = 'RED';
            });

            this.stompClient.subscribe('/topic/playerRole', (message) => {
                console.log(JSON.parse(message.body))
                if (!this.isOwner) {
                    const playerInfo = JSON.parse(message.body);
                    this.addTextCode();
                    this.playerRole = playerInfo.side;
                    this.initializePlayers();
                }
            });

            this.stompClient.subscribe('/topic/playerMoves', (message) => {
                const player = JSON.parse(message.body);
                this.updateOtherPlayerPosition(player);
            });



            this.stompClient.subscribe('/topic/playerDisconnected', (message) => {
                const disconnectedPlayerId = JSON.parse(message.body);
                this.removePlayer(disconnectedPlayerId);
            });

            this.stompClient.subscribe('/topic/shoots', (message) => {
                const shootInfo = JSON.parse(message.body);
                if (this.name != shootInfo.nickName) {
                    this.shootUpdateOther(shootInfo)
                }
            });

            this.stompClient.subscribe('/topic/collision', (message) => {
                const hitInfo = JSON.parse(message.body);
                console.log(hitInfo)
                console.log(this.bullet)
                if (hitInfo.gameId === this.code) {
                    // Encuentra el equipo o unidad afectada por el ID
                    let affectedUnit;
                    if (this.playerRole === 'RED') {
                        // Buscar en el grupo del jugador si el rol es 'RED'
                        affectedUnit = this.player.getChildren().find(unit => unit.id === hitInfo.militaryEquipmentId);
                    } else {
                        // Buscar en el grupo del equipo azul si el rol es 'BLUE'
                        affectedUnit = this.teamBlue.getChildren().find(unit => unit.id === hitInfo.militaryEquipmentId);
                    }

                    if (affectedUnit) {
                        // Actualiza la vida del objeto afectado
                        affectedUnit.life = hitInfo.life;

                        // Actualizar visualmente la vida
                        if (affectedUnit.text) affectedUnit.text.setText(`${affectedUnit.life}`);

                        // Manejar la "muerte" del objeto si su vida es 0 o menos
                        if (affectedUnit.life <= 0) {
                            if (affectedUnit.text) affectedUnit.text.destroy(); // Destruye el texto asociado si existe
                            affectedUnit.destroy(); // Destruye el objeto afectado
                        }
                    }

                    let bullet = this.bullets.getChildren().find(b => b.data.get('id') === hitInfo.bulletId);
                    if (bullet) {
                        bullet.destroy();
                    }
                }
            });



        });
    }

    handleBulletCollision(player, bullet) {
        const bulletId = bullet.data.get('id'); // Obtiene el ID de la bala.
        bullet.destroy(); // Destruye la bala
        console.log('Colisión detectada con el objeto:', player);

        if (player.life !== undefined && player.text) {
            const hitInfo = {
                gameId: this.code,
                nickName: this.name,
                militaryEquipmentId: player.id,
                life: player.life - 1,
                bulletId: bulletId
            };
            this.stompClient.send("/app/collision", {}, JSON.stringify(hitInfo));
            player.life -= 1;
            player.text.setText(`${player.life}`);
            if (player.life <= 0) {
                player.text.destroy();
                player.destroy();
            }

        } else {
            console.error("El objeto 'player' no tiene las propiedades 'life' o 'text'.", player);
        }
    }

    addTextCode() {
        this.add.text(890, 50, `CODIGO: ${this.code}`, {
            fontSize: '1.8em',
            color: '#000000',
            fontStyle: 'bold'
        });
    }

    initializePlayers() {
        if (!this.redTeamInitialized) {
            this.createRedTeam();
            this.redTeamInitialized = true;
        }
        if (!this.blueTeamInitialized) {
            this.createBlueTeam();
            this.blueTeamInitialized = true;
        }
    }


    createRedTeam() {
        const mapHeight = this.game.config.height - 50;
        let droneId = 1;

        for (let i = 0; i < 6; i++) {
            let drone = this.physics.add.sprite(410 + i * 50, mapHeight - 80, 'droneSprite');
            drone.setInteractive();
            drone.isSelected = false;
            drone.team = 'RED';
            drone.id = `DRONE${droneId++}`;
            drone.life = 3;
            drone.body.setImmovable(true);
            drone.text = this.add.text(drone.x, drone.y - 20, `${drone.life}`, {
                fontSize: '16px',
                fill: '#000000',
                fontFamily: 'Arial',
                stroke: '#ffffff',
                strokeThickness: 4
            }).setOrigin(0.5);
            this.player.add(drone);
        }
    }


    createBlueTeam() {
        let deffense = 0;

        let i = 0;
        // Iterar sobre todas las entidades del equipo azul
        this.unity.forEach(entity => {
            i++;
            let circle = this.add.circle(340 + i * 50, 80, 15, 0x0000ff);
            this.physics.add.existing(circle);
            circle.body.setCircle(20);
            circle.setInteractive();
            circle.isSelected = false;
            circle.body.setImmovable(true);
            circle.team = 'BLUE';
            circle.id = `${entity}`;
            circle.life = 3;
            circle.text = this.add.text(circle.x, circle.y - 20, `${circle.life}`, {
                fontSize: '16px',
                fill: '#000000',
                fontFamily: 'Arial',
                stroke: '#ffffff',
                strokeThickness: 4
            }).setOrigin(0.5);
            this.teamBlue.add(circle);
        });
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
        if (this.playerRole === 'RED') {
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
        } else if (this.playerRole === 'BLUE') {
            hitAlly = this.hitTestBlueCircles(pointer.x, pointer.y);
            if (hitAlly && hitAlly.team === this.playerRole) {
                this.selectedCircle = hitAlly; // Actualiza la selección para el equipo azul.
                this.toggleDroneSelection(hitAlly);
            } else {
                // Si no se selecciona un aliado y el jugador es del equipo azul, intenta seleccionar un enemigo rojo.
                let hitEnemy = this.hitTest(pointer.x, pointer.y);
                if (this.selectedCircle && hitEnemy && hitEnemy.team !== this.playerRole) {
                    if (!this.notSelect.includes(this.selectedCircle.id)) {
                        this.shootBullets(this.selectedCircle, hitEnemy);
                    }
                }
            }
        }
    }

    moveSelectedCircle(selectedCircle, pointer) {
        if (this.isShooting || this.notSelect.includes(selectedCircle.id)) {
            this.isShooting = false;
            return;
        }

        if (selectedCircle && selectedCircle.team === 'BLUE') {
            const angle = Phaser.Math.Angle.Between(selectedCircle.x, selectedCircle.y, pointer.x, pointer.y);
            const distance = Phaser.Math.Distance.Between(selectedCircle.x, selectedCircle.y, pointer.x, pointer.y);
            const speed = 200;

            // Establece la velocidad hacia el destino actualizado
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
            if (this.name !== playerUpdate.nickName) {
                const group = playerUpdate.side === 'RED' ? this.player : this.teamBlue;
                let entity = group.getChildren().find(e => e.id === playerUpdate.militaryEquipmentId);

                if (!entity) {
                    return;
                }

                // Mueve la entidad hacia la posición actualizada usando interpolación o directamente
                this.startInterpolation(entity, playerUpdate.position.x, playerUpdate.position.y);
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
                // console.log(drone)
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
            if (circle && circle.text) {
                circle.text.setPosition(circle.x, circle.y - 20);
                circle.text.setText(`${circle.life}`);
            }
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

        this.bullets.getChildren().forEach(bullet => {
            let originX = bullet.data.get('originX');
            let originY = bullet.data.get('originY');
            let distance = Phaser.Math.Distance.Between(bullet.x, bullet.y, originX, originY);
            let maxDistance = 300;

            if (distance > maxDistance) {
                bullet.destroy();
            }
        });
    }





    sendPlayerPosition(entity) {
        if (this.stompClient && this.stompClient.connected && entity.team === this.playerRole) {
            const message = {
                gameId: this.code,
                nickName: this.name,
                militaryEquipmentId: entity.id,
                position: { x: entity.x, y: entity.y }
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
        let bulletId = this.generateUUID();
        let bullet = this.bullets.create(shooter.x, shooter.y, 'balaSprite');
        bullet.setData('id', bulletId);

        this.physics.moveTo(bullet, target.x, target.y, 500);

        if (!bullet.data) {
            bullet.setDataEnabled();
        }

        bullet.data.set('originX', shooter.x);
        bullet.data.set('originY', shooter.y);

        const shootInfo = {
            gameId: this.code,
            nickName: this.name,
            origin: { x: shooter.x, y: shooter.y },
            target: { x: target.x, y: target.y },
            bulletId: bulletId
        };
        this.stompClient.send("/app/shoot", {}, JSON.stringify(shootInfo));
        bullet.body.onWorldBounds = true;
    }



    shootUpdateOther(shootInfo) {
        console.log(shootInfo)
        let bullet = this.bullets.create(shootInfo.origin.x, shootInfo.origin.y, 'balaSprite');
        bullet.setData('id', shootInfo.bulletId);
        this.physics.moveTo(bullet, shootInfo.target.x, shootInfo.target.y, 500);
    }



    removePlayer(disconnectedPlayerId) {
        if (this.otherPlayers[disconnectedPlayerId])
            this.otherPlayers[disconnectedPlayerId].destroy();
        delete this.otherPlayers[disconnectedPlayerId];

    }

}