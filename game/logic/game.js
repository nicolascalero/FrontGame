
import elementsGame from "../models/elementsGame.js";


export class Game extends Phaser.Scene {

    constructor() {
        super({ key: 'GameScene' });
        this.player = {};
        this.teamBlue = {};
        this.playerRole = null;
        this.playerId = this.generateUUID();
        this.targetDestinations = new Map();
        this.redTeamInitialized = false;
        this.blueTeamInitialized = false;
        this.selectedCircle = false;
        this.isShooting = false;
        this.code = null;
        this.joinMethod = false;
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
        this.elementsGame = elementsGame;
        this.reloadText = "";
        this.realoadComplete = false;
        this.selectedEntity = null;
        this.gameTime = 0;
        this.timerText = null;
        this.budget = 0;
        this.fuelConsumption = 0;
        this.budgetText = null;
        this.timeConsumeCentral = 1000;
        this.ckeckVictory = false;
    }

    preload() {
        this.load.image('tilesetImage', '../../assets/mapa.png');
        this.load.tilemapTiledJSON('map', '../../assets/mapa.json');
        this.load.image('droneSprite', '../../assets/drone.png');
        this.load.image('BOFORS', '../../assets/bofors.png');
        this.load.image('LASER', '../../assets/canonLaser.png');
        this.load.image('CENTRAL', '../../assets/centralElectrica.png');
        this.load.image('RADAR', '../../assets/radar.png');
        this.load.image('MOBILE_RADAR', '../../assets/radarMovible.png');
        this.load.image('MOBILE_CONNECTION', '../../assets/conexion.png');
        this.load.image('LASER_CONNECTION', '../../assets/conexion.png');
        this.load.image('MISSILE_BATTERY', '../../assets/bateriaMisiles.png');
        this.load.image('droneSpriteSelect', '../../assets/droneSelect.png');
        this.load.image('balaSprite', '../../assets/bala.png');
        this.load.audio('fightSound', '../../assets/fightSound.mp3');
        this.load.audio('shootSound', '../../assets/shootDrone.mp3');
        this.load.audio('explosionSound', '../../assets/explosionSound.mp3');
        this.load.audio('emptyGun', '../../assets/emptyGun.mp3');
        this.load.audio('reloadBullet', '../../assets/reloadBullet.mp3');
        this.load.audio('laserShoot', '../../assets/laserSoud.mp3');
        this.load.audio('lost', '../../assets/lost.wav');
        this.load.audio('win', '../../assets/win.wav');

        for (let i = 4; i <= 7; i++) {
            this.load.image(`explosion${i}`, `../../assets/explosion${i}.png`);
        }
    }

    create() {

        this.intializeMap();

        this.intializePlayersAndBullets();

        this.loadingHandler();

        this.getInformationGame();

        this.inputHandlers();

        this.collidersHanlders();

        this.setupWebSocketListeners();

        this.anims.create({
            key: 'explode',
            frames: [
                { key: 'explosion0' },
                { key: 'explosion1' },
                { key: 'explosion2' },
                { key: 'explosion3' },
                { key: 'explosion4' },
                { key: 'explosion5' },
                { key: 'explosion6' },
                { key: 'explosion7' },
                { key: 'explosion8' }
            ],
            frameRate: 10,
            repeat: 0
        });

        let keyT = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);

        keyT.on('down', () => {
            if (!this.scene.isPaused('SideViewScene')) {
                this.scene.launch('SideViewScene');
                this.scene.pause();
            }
        });

        this.input.keyboard.on('keydown-ESC', () => {
            if (this.startGame) {
                Swal.fire({
                    title: '¿Qué deseas hacer?',
                    showDenyButton: true,
                    showCancelButton: true,
                    confirmButtonText: 'Guardar partida',
                    denyButtonText: `Salir de partida`,
                }).then((result) => {
                    if (result.isConfirmed) {
                        this.stompClient.send("/app/saveGame", {}, JSON.stringify({ gameId: this.code, nickName: this.name }));
                        Swal.fire('Partida guardada', '', 'success');
                    } else if (result.isDenied) {
                        window.location.href = '/menu-game/index.html';
                    }
                });
            }
        });



    }

    reloadBullets() {
        if (this.selectedEntity) {
            const shooterData = this.elementsGame[this.selectedEntity.id];
            if (shooterData && shooterData.hasCharger) {
                shooterData.countShoot = shooterData.maxCountShoot; // Asumiendo que este es el máximo de balas

                //this.sound.play('reloadBullet');
            }
        }
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
        this.physics.add.collider(this.teamBlue, this.teamBlue, this.handleDefenseCollision, null, this);
        // Evitar que las unidades pasen una sobre otra
        this.physics.add.collider(this.player, this.player); // Drones con drones
        this.physics.add.collider(this.teamBlue, this.teamBlue); // Defensas con defensas
        this.physics.add.collider(this.player, this.teamBlue); // Drones con defensas
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
                let code = localStorage.getItem('gameCode');
                this.stompClient.send("/app/register", {}, JSON.stringify({ gameId: code, nickName: this.name }));
            }

            this.stompClient.subscribe('/topic/createGame', (message) => {
                const code = JSON.parse(message.body);
                let gameId = code.gameId;
                this.stompClient.send("/app/register", {}, JSON.stringify({ gameId: gameId, nickName: this.name }));
                this.playerRole = 'RED';
            });

            //DISCONECT
            window.addEventListener("beforeunload", (event) => {
                this.stompClient.send("/app/disconnect", {}, JSON.stringify({ gameId: this.code, nickName: this.name }));
                console.log('disconnect')
            });

            this.stompClient.subscribe('/topic/disconnect', (message) => {
                this.fightTextShown = false;
                this.startGame = false;
                this.loadingHandler();
            });



            this.stompClient.subscribe('/topic/playerRole', (message) => {

                this.joinMethod = localStorage.getItem('isMethodJoin') === 'true';

                if (this.joinMethod == null) {
                    this.joinMethod = false
                } else {
                    localStorage.removeItem('isMethodJoin');
                }

                const playerInfo = JSON.parse(message.body);

                this.addTextCode(playerInfo.gameId);


                this.setMilitaryEquipments(playerInfo);
                this.prepareForFight(playerInfo);

                this.processVisionInformation(playerInfo.parameters);

                this.playerRole = this.playerRole ? this.playerRole : playerInfo.side;

                this.initializePlayers(playerInfo.isFullUsers);

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

    initialBudget(playerInfo) {

        const gameTimeParameter = playerInfo.parameters.find(param => param.type === "GAME_TIME");
        if (gameTimeParameter) {
            this.gameTime = parseInt(gameTimeParameter.value, 10);

            this.timerBackground = this.add.rectangle(20, 30, 150, 50, 0x000000).setOrigin(0, 0);

            this.timerText = this.add.text(10 + 5, 10 + 10, this.formatTime(this.gameTime), {
                fontSize: '20px',
                fill: '#ff0000',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }).setOrigin(0, 0);
        }

        this.timerText.setX(this.timerBackground.x + (this.timerBackground.width / 2) - (this.timerText.width / 2));
        this.timerText.setY(this.timerBackground.y + (this.timerBackground.height / 2) - (this.timerText.height / 2));


        const budgetParameter = playerInfo.parameters.find(param => param.type === "BUDGET" && param.target === this.playerRole);
        if (budgetParameter) {
            this.budget = parseInt(budgetParameter.value, 10);
        } else {
            this.budget = 0;
        }

        if (this.playerRole === 'BLUE') {
            const fuelConsumptionParameter = playerInfo.parameters.find(param => param.type === "FUEL_CONSUMPTION" && param.target === "CENTRAL");
            this.fuelConsumption = fuelConsumptionParameter ? parseInt(fuelConsumptionParameter.value, 10) : 0;
        } else {
            this.fuelConsumption = 0;
        }

        this.initBudgetUpdater();
    }

    initBudgetUpdater() {
        this.budgetText = this.add.text(20, 90, `Saldo: ${this.budget}`, {
            fontSize: '20px',
            fill: '#ff0000',
            backgroundColor: '#000000',
            padding: { x: 20, y: 10 },
            fontStyle: 'bold'
        }).setOrigin(0, 0);

        if (this.playerRole === 'BLUE') {
            this.time.addEvent({
                delay: this.timeConsumeCentral,
                callback: () => {
                    this.budget -= this.fuelConsumption;
                    this.budgetText.setText(`Saldo: ${this.budget}`);
                },
                callbackScope: this,
                loop: true
            });
        }
    }


    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const partInSeconds = seconds % 60;
        return `${minutes}:${partInSeconds.toString().padStart(2, '0')}`;
    }


    processVisionInformation(parameters) {
        parameters.forEach(param => {
            if (param.type === "VISION") {
                this.unitVisionRanges[param.target] = parseInt(param.value, 10);
            }
        });
    }

    addTextCode(code) {
        this.add.text(890, 50, `CODIGO: ${code}`, {
            fontSize: '1.8em',
            color: '#000000',
            fontStyle: 'bold'
        });

        this.code = code;
    }

    prepareForFight(playerInfo) {
        if (playerInfo.isFullUsers && !this.joinMethod && !this.fightTextShown) {
            this.darkenRectangle.setVisible(false);
            this.loadingText.setVisible(false);
            this.cameras.main.setAlpha(1);
            this.loadingBars.forEach(bar => bar.setVisible(false));

            // Mostrar el conteo antes de "FIGHT!"
            const countdownText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, '3', {
                fontSize: '64px',
                fill: '#ff0000',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Crear una secuencia para el conteo
            this.time.delayedCall(1000, () => { countdownText.setText('2'); });
            this.time.delayedCall(2000, () => { countdownText.setText('1'); });
            this.time.delayedCall(3000, () => {
                countdownText.setText('FIGHT!');
            });
            this.time.delayedCall(4000, () => {
                countdownText.destroy();
                this.startGame = true;
                this.initialBudget(playerInfo); // Asegúrate de que esta llamada esté correctamente referenciada y que initBudgetUpdater esté definido para manejar el presupuesto correctamente.
                if (this.playerRole === 'RED') {
                    this.stompClient.send("/app/startGame", {}, JSON.stringify({ gameId: this.code, nickName: this.name }));
                }
                // La partida comienza oficialmente aquí, por lo que cualquier lógica adicional que deba ejecutarse al inicio del juego puede ser colocada aquí.
            });

            this.fightTextShown = true;
        }
    }


    initializePlayers(playerSide) {
        this.createRedTeam();

        if (playerSide && !this.joinMethod) {
            this.createBlueTeam();
        }
    }

    createRedTeam() {
        if (this.redTeamInitialized) {
            return;
        }
        const mapHeight = this.game.config.height - 50;
        let droneId = 1;

        this.militaryEquipmentsRed.forEach(entity => {
            if (entity.life != 0) {
                let drone = this.physics.add.sprite(entity.position.x, entity.position.y, 'droneSprite');
                this.physics.add.existing(drone);
                drone.setInteractive();
                drone.isSelected = false;
                drone.team = 'RED';
                drone.id = `DRONE${droneId++}`;
                drone.life = entity.life == null ? this.elementsGame[entity.id].life : entity.life;
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
        });


        this.redTeamInitialized = true;
    }


    createBlueTeam() {

        if (this.blueTeamInitialized) {
            return;
        }
        let i = 0;
        this.militaryEquipmentsBlue.forEach(entity => {
            console.log(entity)
            if (entity.life != 0) {

                let circle = this.physics.add.sprite(entity.position.x, entity.position.y, entity.id);

                this.physics.add.existing(circle);
                circle.setInteractive();
                circle.isSelected = false;
                circle.body.setImmovable(true);
                circle.body.mass = 1;
                circle.team = 'BLUE';
                circle.id = `${entity.id}`;
                circle.life = entity.life == null ? this.elementsGame[entity.id].life : entity.life;
                circle.visionRange = this.unitVisionRanges[circle.id] || 100;
                circle.text = this.add.text(circle.x, circle.y - 20, `${circle.life}`, {
                    fontSize: '16px',
                    fill: '#000000',
                    fontFamily: 'Arial',
                    stroke: '#ffffff',
                    strokeThickness: 4
                }).setOrigin(0.5);
                this.teamBlue.add(circle);
            }
        });

        this.blueTeamInitialized = true;
    }

    updateLifeMlitaryEquipment(hitInfo) {
        let affectedUnit = this.findAffectedUnit(hitInfo.militaryEquipmentId);
        console.log(affectedUnit);
        if (affectedUnit) {
            affectedUnit.life = hitInfo.life;
            if (affectedUnit.life <= 0) {
                this.showExplosion(affectedUnit.x, affectedUnit.y);
                //this.sound.play('explosionSound');
                affectedUnit.text?.destroy();
                affectedUnit.destroy();
                if (affectedUnit.id == "CENTRAL" || affectedUnit.id == "LASER_CONNECTION") {
                    this.elementsGame['LASER'].countShoot = 0;
                }

                this.checkForEndGame();

            } else {
                affectedUnit.text.setText(`${affectedUnit.life}`);
            }
        }
    }

    checkForEndGame() {
        // Primero revisa si el tiempo se ha acabado.
        if (this.gameTime <= 0) {
            this.checkForWinCondition();
        } else {
            // Si el tiempo aún no se ha acabado, revisa el estado de las unidades.
            let blueTeamAlive = this.teamBlue.getChildren().filter(unit => unit.active).length > 0;
            let redTeamAlive = this.player.getChildren().filter(unit => unit.active).length > 0;

            if (!blueTeamAlive || !redTeamAlive) {
                this.checkForWinCondition();
            }
        }
    }


    checkForWinCondition() {
        if (!this.ckeckVictory) {
            const blueTeamAlive = this.teamBlue.getChildren().filter(member => member.active).length;
            const redTeamAlive = this.player.getChildren().filter(drone => drone.active).length;

            const totalBlueTeam = this.militaryEquipmentsBlue.length;
            const totalRedTeam = this.militaryEquipmentsRed.length;

            console.log(blueTeamAlive, redTeamAlive, totalBlueTeam, totalRedTeam)


            // Calcula el porcentaje de unidades vivas
            const blueTeamAlivePercentage = (blueTeamAlive / totalBlueTeam) * 100;
            const redTeamAlivePercentage = (redTeamAlive / totalRedTeam) * 100;

            let title, text;

            // Manejar caso de empate o fin de tiempo
            if ((blueTeamAlive === 0 && redTeamAlive === 0) || this.gameTime === 0) {
                // Si ambos equipos destruyen sus últimas unidades al mismo tiempo o el tiempo se agota
                if (blueTeamAlivePercentage > redTeamAlivePercentage) {
                    title = this.playerRole === 'BLUE' ? '¡Victoria!' : 'Has perdido...';
                    text = this.playerRole === 'BLUE' ? '¡Felicidades, has ganado la partida!' : 'No te desanimes, ¡inténtalo de nuevo!';
                } else if (redTeamAlivePercentage > blueTeamAlivePercentage) {
                    title = this.playerRole === 'RED' ? '¡Victoria!' : 'Has perdido...';
                    text = this.playerRole === 'RED' ? '¡Felicidades, has ganado la partida!' : 'No te desanimes, ¡inténtalo de nuevo!';
                } else {
                    title = 'Empate';
                    text = 'Ambos equipos tienen el mismo porcentaje de supervivencia. ¡Intenten de nuevo!';
                }
            } else {
                // Lógica existente para victorias/derrotas no basadas en tiempo
                if (this.playerRole === 'BLUE' && !blueTeamAlive) {
                    title = 'Has perdido...';
                    text = 'No te desanimes';
                } else if (this.playerRole === 'BLUE' && !redTeamAlive) {
                    title = '¡Victoria!';
                    text = '¡Felicidades, has ganado la partida!';
                } else if (this.playerRole === 'RED' && !redTeamAlive) {
                    title = 'Has perdido...';
                    text = 'No te desanimes, ¡inténtalo de nuevo!';
                } else if (this.playerRole === 'RED' && !blueTeamAlive) {
                    title = '¡Victoria!';
                    text = '¡Felicidades, has ganado la partida!';
                }
            }

            console.log(title)

            // Mostrar resultado
            if (title) {
                Swal.fire({
                    title: title,
                    text: text,
                    icon: title === 'Empate' ? 'info' : (title.includes('Victoria') ? 'success' : 'error'),
                    width: 600,
                    padding: "3em",
                    confirmButtonText: "Continuar",
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = '/menu-game/index.html';
                    }
                });
            }
            this.ckeckVictory = true;
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
        // if (player.team !== bullet.getData('team')) {
        const collisionData = {
            gameId: this.code,
            militaryEquipmentId: player.id,
            bulletId: bullet.data.get('id'),
            life: Math.max(0, player.life - 1)
        };


        if (bullet.data.get('team') === this.playerRole) {
            this.stompClient.send("/app/collision", {}, JSON.stringify(collisionData));
        }

        bullet.destroy();
        // }
    }


    showExplosion(x, y) {
        let explosionSprite = this.add.sprite(x, y, 'explosion0').play('explode');
        explosionSprite.on('animationcomplete', () => {
            explosionSprite.destroy(); // Destruye el sprite una vez que la animación haya terminado
        });
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
                        if (!this.elementsGame[this.selectedCircle?.id]?.isSelected) {
                            this.shootBullets(this.selectedCircle, hitEnemy);
                        }
                    }
                }
            }
        }
    }


    moveSelectedCircle(selectedCircle, pointer) {
        if (this.isShooting || this.elementsGame[selectedCircle?.id].isSelected) {
            this.isShooting = false;
            return;
        }

        if (selectedCircle && selectedCircle.team === 'BLUE' && selectedCircle.life > 0 && this.elementsGame[selectedCircle.id]?.move) {
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
        if (this.playerRole == "RED") {
            this.player.getChildren().forEach(drone => {
                drone.isSelected = false;
                drone.isFirstSelect = false;
                drone.setTexture('droneSprite');
            });

            selectedDrone.isSelected = true;
            selectedDrone.isFirstSelect = true;
            selectedDrone.setTexture('droneSpriteSelect');
        }


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
                // Determinar si el equipamiento pertenece al equipo rojo o azul
                const isRedTeam = this.militaryEquipmentsRed.some(equipment => equipment.id === playerUpdate.militaryEquipmentId);
                const group = isRedTeam ? this.player : this.teamBlue;
                let entity = group.getChildren().find(e => e.id === playerUpdate.militaryEquipmentId);

                if (!entity) {
                    return;
                }

                // Actualiza la posición en la entidad visual/gráfica
                this.startInterpolation(entity, playerUpdate.position.x, playerUpdate.position.y);

                // También actualiza la posición en la estructura de datos correspondiente
                const equipments = isRedTeam ? this.militaryEquipmentsRed : this.militaryEquipmentsBlue;
                const equipmentToUpdate = equipments.find(equipment => equipment.id === playerUpdate.militaryEquipmentId);
                if (equipmentToUpdate) {
                    equipmentToUpdate.position = playerUpdate.position; // Asegúrate de que esta asignación refleje cómo almacenas la posición
                }
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

        this.teamBlue.getChildren().forEach((member) => {
            if (member.id === 'MOBILE_RADAR') {
                // Aquí aplicas la lógica de volteo basada en la velocidad en el eje X
                if (member.body.velocity.x > 0) {
                    member.scaleX = -1; // Hacia la derecha
                } else if (member.body.velocity.x < 0) {
                    member.scaleX = 1; // Hacia la izquierda
                }
            } else {
                if (member.id === 'BOFORS') {
                    if (member.prevX === undefined || member.prevY === undefined) {
                        member.prevX = member.x;
                        member.prevY = member.y;
                    }

                    // Determinar la dirección del movimiento
                    let deltaX = member.x - member.prevX;
                    let deltaY = member.y - member.prevY;

                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        // Movimiento principal en X
                        if (deltaX > 0) {
                            // Movimiento a la derecha
                            member.angle = -90;
                        } else {
                            // Movimiento a la izquierda
                            member.angle = 90;
                        }
                    } else if (Math.abs(deltaY) > Math.abs(deltaX)) {
                        // Movimiento principal en Y
                        if (deltaY > 0) {
                            // Movimiento hacia abajo
                            member.angle = 0;
                        } else {
                            // Movimiento hacia arriba
                            member.angle = 180;
                        }
                    }

                    // Actualiza las posiciones previas para el próximo frame
                    member.prevX = member.x;
                    member.prevY = member.y;
                }
            }
        });

        if (this.startGame && this.gameTime > 0) {
            // Convierte `delta` a segundos y resta del tiempo restante
            this.gameTime -= delta / 1000;

            // Actualiza el texto del contador
            this.timerText.setText(this.formatTime(Math.round(this.gameTime)));

            // Cuando el contador llegue a 0, puedes hacer algo especial aquí
            if (this.gameTime <= 0) {
                this.handleTimerEnd();
            }
        }

        this.updateBullets();

        this.updateVisibility();
        this.updateBulletsVisibility();

        if (this.gameTime <= 0 && this.startGame) { // Asegúrate de que la partida haya empezado
            this.checkForWinCondition();
            this.gameTime = 0;
        }

    }

    handleTimerEnd() {
        // Aquí manejas el evento de cuando el tiempo se agote
        console.log("El tiempo se ha agotado!");
        this.gameTime = 0;
        // Por ejemplo, podrías finalizar el juego o cambiar a una escena diferente
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
        const shooterData = this.elementsGame[shooter.id];
        this.isShooting = true;
        if (shooterData.countShoot > 0) {
            shooterData.countShoot -= 1;
            let maxDistance = 300;
            let bulletId = this.generateUUID();
            let bullet = this.bullets.create(shooter.x, shooter.y, 'balaSprite');
            bullet.setData('id', bulletId);
            bullet.setData('originX', shooter.x);
            bullet.setData('originY', shooter.y);
            bullet.setData('team', this.playerRole);
            //bullet.setData('shooterId', this.playerId);
            bullet.setData({ id: bulletId, originX: shooter.x, originY: shooter.y, maxDistance, team: this.playerRole });

            this.physics.moveTo(bullet, target.x, target.y, 500);

            const shootInfo = {
                gameId: this.code,
                nickName: this.name,
                //origin: { x: shooter.x, y: shooter.y },
                equipmentMilitaryId: shooter.id,
                target: { x: target.x, y: target.y },
                bulletCount: shooterData.countShoot,
                bulletId: bulletId,
                maxDistance: maxDistance,
                //shooterId: this.playerId,
            };

            if (shooter.id == 'LASER') {
                // this.sound.play('laserShoot');
            } else {
                //this.sound.play('shootSound');
            }

            this.stompClient.send("/app/shoot", {}, JSON.stringify(shootInfo));
            bullet.body.onWorldBounds = true;
        } else {
            if ((!this.reloadText || !this.reloadComplete) && shooterData.hasCharger) {
                // this.sound.play('emptyGun');
                // let startPositionX, endPositionX, targetPositionY, textColor;

                // // Ajustes para el jugador del equipo rojo
                // if (this.playerRole === 'RED') {
                //     startPositionX = -200; // Fuera de la pantalla a la izquierda
                //     endPositionX = this.cameras.main.centerX - 450; // Mover hacia el centro (ajustar según sea necesario)
                //     targetPositionY = this.cameras.main.centerY + 400; // createPosición más baja en la pantalla
                //     textColor = '#ff0000'; // Texto rojo
                // } else if (this.playerRole === 'BLUE') {
                //     // Ajustes para el jugador del equipo azul
                //     startPositionX = this.cameras.main.width - 100; // Fuera de la pantalla a la derecha
                //     endPositionX = this.cameras.main.width - 250; // Mover hacia una posición más a la derecha en la pantalla
                //     targetPositionY = 50; // Posición más alta en la pantalla
                //     textColor = '#0000ff'; // Texto azul
                // }

                // this.reloadText = this.add.text(startPositionX, targetPositionY, '¡RECARGA CON LA R!', {
                //     fontSize: '20px',
                //     fill: textColor,
                //     backgroundColor: '#000',
                //     padding: { x: 20, y: 10 },
                //     fontStyle: 'bold',
                //     stroke: '#ffffff', // Define el color del borde como blanco
                //     strokeThickness: 4
                // }).setDepth(200);

                // this.reloadComplete = true; // Asegúrate de que el control del tween esté activo

                // // Tween para mover el texto desde fuera de la pantalla hacia su posición final
                // this.tweens.add({
                //     targets: this.reloadText,
                //     x: endPositionX,
                //     duration: 1000,
                //     ease: 'Power2',
                //     onStart: () => {
                //         this.reloadText.setAlpha(1);
                //     },
                //     onComplete: () => {
                //         // Inicia el parpadeo una vez que el texto está en su posición final
                //         this.tweens.add({
                //             targets: this.reloadText,
                //             alpha: 0.2,
                //             yoyo: true,
                //             repeat: 3,
                //             duration: 500,
                //             onComplete: () => {
                //                 // Desvanecimiento después del parpadeo
                //                 this.tweens.add({
                //                     targets: this.reloadText,
                //                     alpha: 0,
                //                     duration: 1000,
                //                     onComplete: () => {
                //                         this.reloadComplete = false;
                //                     }
                //                 });
                //             }
                //         });
                //     }
                // });
            }

        }
    }



    shootUpdateOther(shootInfo) {
        // Encuentra el equipamiento militar por ID para obtener su posición
        const equipment = this.militaryEquipmentsRed.concat(this.militaryEquipmentsBlue).find(e => e.id === shootInfo.equipmentMilitaryId);

        if (!equipment || !equipment.position) {
            console.error("Equipamiento militar no encontrado o sin posición.");
            return;
        }

        let bullet = this.bullets.create(equipment.position.x, equipment.position.y, 'balaSprite');
        bullet.setData({
            id: shootInfo.bulletId,
            originX: equipment.position.x,
            originY: equipment.position.y,
            maxDistance: shootInfo.maxDistance,
            team: shootInfo.nickName === this.name ? this.playerRole : this.playerRole === 'RED' ? 'BLUE' : 'RED',
            shooterId: shootInfo.equipmentMilitaryId
        });

        this.physics.moveTo(bullet, shootInfo.target.x, shootInfo.target.y, 500);
    }



}



export class VistaLateral extends Phaser.Scene {
    constructor() {
        super({ key: 'VistaLateral' });
    }

    preload() {
        // Cargar recursos si es necesario
    }

    create() {
        // Dentro de create() en VistaLateral
        // this.input.keyboard.on('keyup-T', () => {
        //     this.scene.stop();
        //     this.scene.resume('Game');
        // });

        // // Crear elementos de la escena, como textos, imágenes, etc.
        // this.add.text(100, 100, 'Vista Lateral', { fontSize: '32px', fill: '#fff' });
    }
}
