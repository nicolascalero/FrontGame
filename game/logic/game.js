



export class Game extends Phaser.Scene {

    constructor() {
        super({ key: 'GameScene' });
        this.player = {};
        this.teamBlue = {};
        this.playerRole = null;
        this.playerId = this.generateUUID();
        this.targetDestinations = new Map();
        this.redTeamInitialized = false;
        this.selectedCircle = false;
        this.isShooting = false;
        this.code = null;
        this.name = null;
        this.isOwner = false;
        this.militaryEquipmentsBlue = [];
        this.militaryEquipmentsRed = [];
        this.notSelect = ['CENTRAL', 'LASER', 'RADAR', 'MOBILE_CONNECTION', 'LASER_CONNECTION'];
        this.bullets = null;
        this.startGame = false;
        this.loadingText = null;
        this.spinnerGraphic = null;
        this.loadingBars = [];
        this.currentBar = 0;
        this.barUpdateTimer = 0;
        this.barUpdateInterval = 100;
        this.darkenRectangle = null;
        this.fightTextShown = null;
        this.unitVisionRanges = {};
    }

    preload() {
        this.load.image('tilesetImage', '../../assets/mapa.png');
        this.load.tilemapTiledJSON('map', '../../assets/mapa.json');
        this.load.image('droneSprite', '../../assets/drone.png');
        this.load.image('balaSprite', '../../assets/bala.png');
        this.load.audio('fightSound', '../../assets/fightSound.mp3');
        this.load.audio('shootDrone', '../../assets/shootDrone.mp3');
    }

    create() {

        this.intializeMap();

        this.intializePlayersAndBullets();

        this.loadingHandler();

        this.getInformationGame();

        this.inputHandlers();

        this.collidersHanlders();

        this.setupWebSocketListeners();


    }

    intializeMap() {
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('Mapa2', 'tilesetImage');
        const layer1 = map.createLayer('Capa de patrones 1', tileset, 0, 0);
        const layer2 = map.createLayer('Capa de patrones 2', tileset, 0, 0);
    }

    intializePlayersAndBullets() {
        this.player = this.add.group();
        this.teamBlue = this.add.group();
        this.bullets = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite
        });
        this.bullets.children.iterate((bullet) => {
            bullet.setData('travelledDistance', 0); // Inicializa la distancia recorrida por la bala
        });
    }

    getInformationGame() {
        this.name = localStorage.getItem('userName');
        this.isOwner = localStorage.getItem('isOwner') === 'true';
        this.code = localStorage.getItem('gameCode');
    }

    inputHandlers() {
        this.cursors = this.input.keyboard.createCursorKeys();

        this.input.on('gameobjectdown', this.onGameClick, this);

        this.input.on('pointerdown', (pointer) => {
            if (this.startGame) {
                this.playerRole == "RED" ? this.moveSelectedDrones(pointer) : this.moveSelectedCircle(this.selectedCircle, pointer);
            }
        });
    }

    collidersHanlders() {
        this.physics.add.collider(this.player, this.bullets, this.handleBulletCollision, null, this);
        this.physics.add.collider(this.teamBlue, this.bullets, this.handleBulletCollision, null, this);
    }

    loadingHandler() {
        this.darkenRectangle = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.5
        ).setDepth(0);

        this.loadingText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 20, 'ESPERANDO AL RIVAL', {
            fontSize: '30px',
            fill: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1);

        if (!this.startGame) {
            this.darkenRectangle.setVisible(true);
            this.loadingText.setVisible(true);
            this.loadingText.setDepth(1);
        }

        this.createLoadingAnimation();
    }


    createLoadingAnimation() {
        const bars = [];
        const radius = 32;
        const height = radius * 0.25;
        const width = 10;
        const cx = this.cameras.main.centerX;
        const cy = this.cameras.main.centerY + 60;
        let angle = -90;

        for (let i = 0; i < 12; ++i) {
            const { x, y } = Phaser.Math.RotateAround({ x: cx, y: cy - (radius - (height * 0.5)) }, cx, cy, Phaser.Math.DEG_TO_RAD * angle);
            const bar = this.add.rectangle(x, y, width, height, 0xffffff, 1)
                .setAngle(angle)
                .setAlpha(0.2);
            bars.push(bar);
            angle += 30;
        }

        this.loadingBars = bars;
    }

    setupWebSocketListeners() {
        const socket = new SockJS('http://localhost:8080/gs-guide-websocket');
        this.stompClient = Stomp.over(socket);
        this.stompClient.debug = () => { };

        this.stompClient.connect({}, () => {

            if (this.isOwner) {
                this.stompClient.send("/app/createGame", {}, JSON.stringify({ name: this.name }));

            } else {
                this.stompClient.send("/app/register", {}, JSON.stringify({ gameId: this.code, nickName: this.name }));
            }

            this.stompClient.subscribe('/topic/createGame', (message) => {
                const code = JSON.parse(message.body);
                this.code = code.gameId;
                this.stompClient.send("/app/register", {}, JSON.stringify({ gameId: this.code, nickName: this.name }));
                this.playerRole = 'RED';
            });

            this.stompClient.subscribe('/topic/playerRole', (message) => {
                const playerInfo = JSON.parse(message.body);
                console.log(playerInfo)
                this.setMilitaryEquipments(playerInfo);

                this.processVisionInformation(playerInfo.parameters);

                this.addTextCode();

                this.playerRole = this.playerRole ? this.playerRole : playerInfo.side;

                this.prepareForFigth(playerInfo);

                this.initializePlayers(playerInfo.side);


            });


            this.stompClient.subscribe('/topic/playerMoves', (message) => {
                const player = JSON.parse(message.body);
                this.updateOtherPlayerPosition(player);
            });

            this.stompClient.subscribe('/topic/playerDisconnected', (message) => { });

            this.stompClient.subscribe('/topic/shoots', (message) => {
                const shootInfo = JSON.parse(message.body);
                if (this.name != shootInfo.nickName) {
                    this.shootUpdateOther(shootInfo)
                }
            });

            this.stompClient.subscribe('/topic/collision', (message) => {
                const hitInfo = JSON.parse(message.body);
                this.updateLifeMlitaryEquipment(hitInfo);
            });
        });
    }

    setMilitaryEquipments(data) {
        this.militaryEquipmentsBlue = data.militaryEquipments.filter(equipment => equipment.side === 'BLUE');
        this.militaryEquipmentsRed = data.militaryEquipments.filter(equipment => equipment.side === 'RED');
    }

    processVisionInformation(parameters) {
        parameters.forEach(param => {
            if (param.type === "VISION") {
                this.unitVisionRanges[param.target] = parseInt(param.value, 10);
            }
        });
    }

    addTextCode() {
        this.add.text(890, 50, `CODIGO: ${this.code}`, {
            fontSize: '1.8em',
            color: '#000000',
            fontStyle: 'bold'
        });
    }

    prepareForFigth(playerInfo) {
        if (playerInfo.side === 'BLUE' && !this.fightTextShown) {
            this.darkenRectangle.setVisible(false);
            this.loadingText.setVisible(false);
            this.cameras.main.setAlpha(1);
            this.loadingBars.forEach(bar => bar.setVisible(false));

            //Reproducir el sonido
            //const fightSound = this.sound.add('fightSound');
            //  fightSound.play();

            // Mostrar el conteo antes de "FIGHT!"
            const countdownText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, '3', {
                fontSize: '64px',
                fill: '#ff0000',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Crear una secuencia para el conteo
            this.time.delayedCall(1000, () => { countdownText.setText('2'); });
            this.time.delayedCall(2000, () => { countdownText.setText('1'); });
            this.time.delayedCall(3000, () => { countdownText.setText('FIGHT!'); });
            this.time.delayedCall(4000, () => {
                //fightSound.stop();

                // Hacer que el texto de "FIGHT!" se desvanezca después
                this.tweens.add({
                    targets: countdownText,
                    alpha: 0,
                    ease: 'Cubic.easeOut',
                    duration: 1000,
                    onComplete: () => {
                        countdownText.destroy()
                        this.startGame = true;
                    }
                });
            });

            this.fightTextShown = true;
        }
    }

    initializePlayers(playerSide) {
        this.createRedTeam();

        if (playerSide === 'BLUE' || this.startGame) {
            this.createBlueTeam();
        }
    }

    createRedTeam() {
        if (this.redTeamInitialized) {
            return;
        }
        const mapHeight = this.game.config.height - 50;
        let droneId = 1;

        for (let i = 0; i < 6; i++) {
            let drone = this.physics.add.sprite(410 + i * 50, mapHeight - 80, 'droneSprite');
            this.physics.add.existing(drone);
            drone.setInteractive();
            drone.isSelected = false;
            drone.team = 'RED';
            drone.id = `DRONE${droneId++}`;
            drone.life = 3;
            drone.visionRange = this.unitVisionRanges[drone.id] || 100;
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


        this.redTeamInitialized = true;
    }


    createBlueTeam() {

        let i = 0;
        this.militaryEquipmentsBlue.forEach(entity => {
            i++;
            let circle = this.add.circle(340 + i * 50, 80, 15, 0x0000ff);
            this.physics.add.existing(circle);
            circle.setInteractive();
            circle.isSelected = false;
            circle.body.setImmovable(true);
            circle.body.mass = 1;
            circle.team = 'BLUE';
            circle.id = `${entity.id}`;
            circle.life = 3;
            circle.visionRange = this.unitVisionRanges[circle.id] || 100;
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

    updateLifeMlitaryEquipment(hitInfo) {
        let affectedUnit = this.findAffectedUnit(hitInfo.militaryEquipmentId);
        if (affectedUnit) {
            affectedUnit.life = hitInfo.life;
            if (affectedUnit.life <= 0) {
                affectedUnit.text?.destroy();
                affectedUnit.destroy();
            } else {
                affectedUnit.text.setText(`${affectedUnit.life}`);
            }
        }
    }


    findAffectedUnit(militaryEquipmentId) {
        return this.player.getChildren().find(unit => unit.id === militaryEquipmentId) ||
            this.teamBlue.getChildren().find(unit => unit.id === militaryEquipmentId);
    }

    updateUnitDisplay(unit) {
        if (unit.text) unit.text.setText(`${unit.life}`);
        if (unit.life <= 0) {
            if (unit.text) unit.text.destroy();
            unit.destroy();
        }
    }

    handleBulletCollision(player, bullet) {
        if (player.team !== bullet.getData('team')) {
            const collisionData = {
                gameId: this.code,
                militaryEquipmentId: player.id,
                bulletId: bullet.data.get('id'),
                life: Math.max(0, player.life - 1)
            };

            if (bullet.data.get('shooterId') === this.playerId) {
                this.stompClient.send("/app/collision", {}, JSON.stringify(collisionData));
            }

            bullet.destroy();
        }
    }

    hitTest(x, y) {
        let hitEntity = null;
        const tolerance = 5; // Margen de tolerancia en píxeles

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
        if (this.startGame) {
            let hitAlly;
            if (this.playerRole === 'RED') {
                hitAlly = this.hitTest(pointer.x, pointer.y);
                if (hitAlly && hitAlly.team === this.playerRole) {
                    this.toggleDroneSelection(hitAlly);
                } else {
                    // Si no se selecciona un aliado y el jugador es del equipo rojo, intenta seleccionar un enemigo azul.
                    let hitEnemy = this.hitTestBlueCircles(pointer.x, pointer.y);
                    if (this.selectedEntity && this.selectedEntity.life > 0 && hitEnemy && hitEnemy.team !== this.playerRole) {
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
                    if (this.selectedCircle && this.selectedEntity.life > 0 && hitEnemy && hitEnemy.team !== this.playerRole) {
                        if (!this.notSelect.includes(this.selectedCircle.id)) {
                            this.shootBullets(this.selectedCircle, hitEnemy);
                        }
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

        if (selectedCircle && selectedCircle.team === 'BLUE' && selectedCircle.life > 0) {
            const angle = Phaser.Math.Angle.Between(selectedCircle.x, selectedCircle.y, pointer.x, pointer.y);
            const distance = Phaser.Math.Distance.Between(selectedCircle.x, selectedCircle.y, pointer.x, pointer.y);
            const speed = 200;

            // Establece la velocidad hacia el destino actualizado
            selectedCircle.body.setVelocityX(Math.cos(angle) * speed);
            selectedCircle.body.setVelocityY(Math.sin(angle) * speed);

            // Almacena el destino y la distancia inicial para su uso en el update
            selectedCircle.targetDestination = { x: pointer.x, y: pointer.y, distance: distance };
            selectedCircle.isMoving = true;
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

        // this.player.getChildren().forEach(drone => {
        //     if (drone.prevX !== undefined && drone.prevY !== undefined) {
        //         // Determinar la dirección del movimiento
        //         if (Math.abs(drone.x - drone.prevX) > Math.abs(drone.y - drone.prevY)) {
        //             // Movimiento principal en X
        //             if (drone.x > drone.prevX) {
        //                 // Movimiento a la derecha
        //                 drone.angle = 90;
        //             } else {
        //                 // Movimiento a la izquierda
        //                 drone.angle = -90;
        //             }
        //         } else {
        //             // Movimiento principal en Y
        //             if (drone.y > drone.prevY) {
        //                 // Movimiento hacia abajo
        //                 drone.angle = 180;
        //             } else {
        //                 // Movimiento hacia arriba
        //                 drone.angle = 0;
        //             }
        //         }
        //     }

        //     // Actualiza las posiciones previas para el próximo frame
        //     drone.prevX = drone.x;
        //     drone.prevY = drone.y;
        // });
    }




    updateOtherPlayerPosition(playerUpdate) {
        if (playerUpdate) {
            if (this.name !== playerUpdate.nickName && playerUpdate.gameId === this.code) {
                const group = this.militaryEquipmentsRed.some(equipment => equipment.id === playerUpdate.militaryEquipmentId) ? this.player : this.teamBlue;
                let entity = group.getChildren().find(e => e.id === playerUpdate.militaryEquipmentId);

                if (!entity) {
                    return;
                }

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
        this.updateLoadingBarAnimation(delta);

        this.updateDroneMovements(time);

        this.updateDefenseMovements();

        this.bullets.getChildren().forEach((bullet) => {
            // Calcula la distancia recorrida desde el origen hasta su posición actual
            let distanceFromOrigin = Phaser.Math.Distance.Between(
                bullet.data.get('originX'),
                bullet.data.get('originY'),
                bullet.x,
                bullet.y
            );

            // console.log(distanceFromOrigin)
            // console.log(bullet.data.get('maxDistance'))

            // Verifica si la bala ha recorrido su distancia máxima
            if (distanceFromOrigin > bullet.data.get('maxDistance')) {
                bullet.destroy(); // Destruye la bala
            }
        });

        this.updateBullets();

        this.updateVisibility();
        this.updateBulletsVisibility();
    }


    updateLoadingBarAnimation(delta) {
        this.barUpdateTimer += delta;
        if (this.barUpdateTimer > this.barUpdateInterval) {
            this.barUpdateTimer = 0;
            this.loadingBars.forEach((bar, index) => {
                bar.setAlpha(index === this.currentBar ? 1 : 0.2);
            });
            this.currentBar = (this.currentBar + 1) % this.loadingBars.length;
        }
    }

    updateDroneMovements(time) {
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
                    drone.body.setVelocity(0, 0);
                    this.targetDestinations.delete(drone);
                } else if (time - this.lastUpdateTime > this.updateFrequency) {
                    this.sendPlayerPosition(drone);
                    this.lastUpdateTime = time;
                }
            }
        });
    }

    updateDefenseMovements() {
        this.teamBlue.getChildren().forEach(defense => {
            if (defense && defense.text) {
                defense.text.setPosition(defense.x, defense.y - 20);
                defense.text.setText(`${defense.life}`);
            }
            if (defense.isMoving) {
                const target = defense.targetDestination;
                const distance = Phaser.Math.Distance.Between(defense.x, defense.y, target.x, target.y);
                if (distance < 10) {
                    defense.body.setVelocity(0, 0);
                    defense.isMoving = false;
                }
                this.sendPlayerPosition(defense);
            }
        });
    }

    updateBullets() {
        this.bullets.getChildren().forEach(bullet => {
            let originX = bullet.data.get('originX');
            let originY = bullet.data.get('originY');
            let maxDistance = bullet.data.get('maxDistance');
            let distance = Phaser.Math.Distance.Between(bullet.x, bullet.y, originX, originY);

            if (distance > maxDistance) {
                bullet.destroy();
            }
        });
    }

    updateVisibility() {
        // Asegura que cada unidad tenga un visionRange definido.
        const friendlyUnits = this.playerRole === 'RED' ? this.player.getChildren() : this.teamBlue.getChildren();
        const enemyUnits = this.playerRole === 'RED' ? this.teamBlue.getChildren() : this.player.getChildren();

        // Hace todas las unidades enemigas inicialmente no visibles.
        enemyUnits.forEach(unit => {
            unit.setVisible(false);
            if (unit.text) unit.text.setVisible(false); // También hace invisible el texto de la vida.
        });

        // Verifica la visibilidad para cada unidad amiga contra todas las unidades enemigas.
        friendlyUnits.forEach(friendlyUnit => {
            // Asegura que las unidades amigas sean siempre visibles entre sí.
            friendlyUnits.forEach(friendly => {
                friendly.setVisible(true);
                if (friendly.text) friendly.text.setVisible(true); // Asegura que el texto de la vida también sea visible.
            });

            // Comprueba la visibilidad basada en el rango de visión para las unidades enemigas.
            enemyUnits.forEach(enemy => {
                const distance = Phaser.Math.Distance.Between(friendlyUnit.x, friendlyUnit.y, enemy.x, enemy.y);
                if (distance <= friendlyUnit.visionRange) {
                    enemy.setVisible(true); // Hace visible al enemigo si está dentro del rango de visión.
                    if (enemy.text) enemy.text.setVisible(true); // Hace visible el texto de la vida del enemigo.
                }
            });
        });
    }

    updateBulletsVisibility() {
        this.bullets.getChildren().forEach(bullet => {
            // Obtiene el equipo del tirador basado en la información almacenada en la bala
            const shooterTeam = bullet.getData('team');
            const shooterUnits = shooterTeam === 'RED' ? this.player.getChildren() : this.teamBlue.getChildren();

            // Determina si al menos una unidad del equipo del tirador está dentro del rango de visión del punto de disparo
            const isShooterVisible = shooterUnits.some(unit => {
                return this.isShooterVisible(unit, bullet.getData('originX'), bullet.getData('originY'));
            });

            // Establece la visibilidad de la bala basada en la visibilidad del tirador
            bullet.setVisible(isShooterVisible);
        });
    }

    isShooterVisible(shooterUnit, bulletOriginX, bulletOriginY) {
        // Asumiendo que 'visionRange' es un valor que representa qué tan lejos puede ver la unidad
        const distance = Phaser.Math.Distance.Between(shooterUnit.x, shooterUnit.y, bulletOriginX, bulletOriginY);
        return distance <= shooterUnit.visionRange; // Verifica si la unidad puede "ver" el origen de la bala
    }


    findUnitById(id) {
        // Primero busca en el grupo del jugador (equipo rojo)
        let foundUnit = this.player.getChildren().find(unit => unit.id === id);
        if (foundUnit) {
            return foundUnit;
        }

        // Si no se encontró en el equipo rojo, busca en el equipo azul
        foundUnit = this.teamBlue.getChildren().find(unit => unit.id === id);
        return foundUnit; // Esto puede ser `undefined` si no se encuentra ninguna unidad con ese ID
    }


    // Esta función verifica si una unidad debería ser visible basada en tu lógica específica
    isUnitVisible(unit) {
        // Suponiendo que tienes una forma de verificar la visibilidad basada en la proximidad de las unidades enemigas
        // Aquí solo es un esquema, necesitarás adaptarlo a tu implementación específica
        const enemyUnits = unit.team === 'RED' ? this.teamBlue.getChildren() : this.player.getChildren();
        return enemyUnits.some(enemy => {
            const distance = Phaser.Math.Distance.Between(unit.x, unit.y, enemy.x, enemy.y);
            console.log("distance", distance, unit.visionRange)
            return distance <= unit.visionRange;
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
        let maxDistance = 300;
        let bulletId = this.generateUUID();
        let bullet = this.bullets.create(shooter.x, shooter.y, 'balaSprite');
        bullet.setData('id', bulletId);
        bullet.setData('originX', shooter.x);
        bullet.setData('originY', shooter.y);
        bullet.setData('team', this.playerRole);
        bullet.setData('shooterId', this.playerId);
        bullet.setData({ id: bulletId, originX: shooter.x, originY: shooter.y, maxDistance, team: this.playerRole, shooterId: this.playerId });

        this.physics.moveTo(bullet, target.x, target.y, 500);

        const shootInfo = {
            gameId: this.code,
            nickName: this.name,
            origin: { x: shooter.x, y: shooter.y },
            target: { x: target.x, y: target.y },
            bulletId: bulletId,
            maxDistance: maxDistance,
            shooterId: this.playerId,
        };

        this.sound.play('shootDrone');
        this.stompClient.send("/app/shoot", {}, JSON.stringify(shootInfo));
        bullet.body.onWorldBounds = true;
    }



    shootUpdateOther(shootInfo) {
        let bullet = this.bullets.create(shootInfo.origin.x, shootInfo.origin.y, 'balaSprite');
        bullet.setData({
            id: shootInfo.bulletId,
            originX: shootInfo.origin.x,
            originY: shootInfo.origin.y,
            maxDistance: shootInfo.maxDistance,
            team: shootInfo.nickName === this.name ? this.playerRole : this.playerRole === 'RED' ? 'BLUE' : 'RED',
            shooterId: shootInfo.shooterId
        });

        // Asegúrate de imprimir la información dentro del forEach
        this.bullets.getChildren().forEach(bullet => {
            console.log(bullet);
            console.log(`Bullet ID: ${bullet.getData('id')}, Origin: (${bullet.getData('originX')}, ${bullet.getData('originY')}), MaxDistance: ${bullet.getData('maxDistance')}`);
        });

        this.physics.moveTo(bullet, shootInfo.target.x, shootInfo.target.y, 500);
    }
}