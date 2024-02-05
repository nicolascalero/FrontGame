export class Game extends Phaser.Scene {
    constructor() {
        super({ key: 'game' });
        this.player = null;
        this.socket = new WebSocket('ws://127.0.0.1:3000');
        this.otherPlayers = {};
        this.cursors = null;
        this.playerNameText = {};
        this.isSecondPlayer = false;
    }

    create() {
        this.setupWebSocketListeners();
        this.initializeControls();
    }

    createPlayer() {
        console.log("holap")
        let startPosition;
        if (!this.isSecondPlayer) {
            startPosition = { x: 450, y: 150 };
        } else {
            startPosition = { x: 450, y: 750 };
        }

        this.player = this.physics.add.sprite(startPosition.x, startPosition.y, 'playerSprite');

        this.initializeVisionRange();
        this.initializeControls();
        this.setupWebSocketListeners();
    }



    initializeVisionRange() {
        this.graphics = this.add.graphics({ lineStyle: { width: 2, color: 0xff0000 } });
        this.rangoDeVision = new Phaser.Geom.Circle(this.player.x, this.player.y, 100);
        this.graphics.strokeCircleShape(this.rangoDeVision);
    }

    initializeControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.on('pointerdown', () => this.movePlayer());
    }

    setupWebSocketListeners() {
        this.socket.onopen = () => {
            this.sendPlayerPosition(this.player.x, this.player.y);
        };

        this.socket.onmessage = event => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'playerId':
                    if (!this.player) {
                        this.playerId = data.id;
                        this.isSecondPlayer = data.isSecondPlayer;
                        let startPosition;
                        if (!this.isSecondPlayer) {
                            startPosition = { x: 450, y: 150 };
                        } else {
                            startPosition = { x: 450, y: 750 };
                        }
                        this.createPlayer(startPosition);
                    }
                    break;
                case 'playerPositionUpdate':
                    this.updateOtherPlayerPosition(data.playerId, data.position);
                    break;
                case 'playerDisconnected':
                    this.handlePlayerDisconnected(data.id);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        };
    }

    movePlayer() {
        this.sendPlayerPosition(this.player.x, this.player.y);
    }

    sendPlayerPosition(x, y) {
        if (this.socket.readyState === WebSocket.OPEN) {
            const data = {
                type: 'playerPositionUpdate',
                playerId: this.playerId,
                position: { x, y }
            };
            this.socket.send(JSON.stringify(data));
        } else {
            console.log('WebSocket no está en estado OPEN');
        }
    }


    updateOtherPlayerPosition(playerId, position) {
        if (!this.otherPlayers[playerId]) {
            this.otherPlayers[playerId] = this.physics.add.sprite(position.x, position.y, 'playerSprite').setVisible(false);
        } else {
            this.otherPlayers[playerId].x = position.x;
            this.otherPlayers[playerId].y = position.y;
        }
        this.otherPlayers[playerId].setVisible(true);
    }



    handlePlayerDisconnected(playerId) {
        if (this.otherPlayers[playerId]) {
            this.otherPlayers[playerId].destroy();
            delete this.otherPlayers[playerId];
        }
    }

    update() {
        this.updateVisionRange();
        this.handlePlayerMovement();
        this.handleVisibilityOfOtherPlayers();
        if (this.playerNameText[this.playerId]) {
            this.playerNameText[this.playerId].setPosition(this.player.x, this.player.y - 20);
        }
    }

    updateVisionRange() {
        if (this.player) {
            // Elimina el círculo anterior si existe
            if (this.graphics) {
                this.graphics.clear();
            }

            // Crea un nuevo círculo en la posición actual del jugador
            this.rangoDeVision = new Phaser.Geom.Circle(this.player.x, this.player.y, 100);

            // Dibuja el nuevo círculo
            this.graphics = this.add.graphics({ lineStyle: { width: 2, color: 0xff0000 } });
            this.graphics.strokeCircleShape(this.rangoDeVision);

            // Asegurémonos de que this.playerNameText[this.playerId] esté definido
            if (this.playerNameText[this.playerId]) {
                this.playerNameText[this.playerId].setPosition(this.player.x, this.player.y - 20);
                this.playerNameText[this.playerId].setText(this.playerId);
            }
        }
    }



    handlePlayerMovement() {
        let velocityX = 0;
        let velocityY = 0;

        if (this.cursors.left.isDown) {
            velocityX = -200;
        } else if (this.cursors.right.isDown) {
            velocityX = 200;
        }

        if (this.cursors.up.isDown) {
            velocityY = -200;
        } else if (this.cursors.down.isDown) {
            velocityY = 200;
        }

        if (this.player) {
            this.player.setVelocityX(velocityX);
            this.player.setVelocityY(velocityY);

            this.sendPlayerPosition(this.player.x, this.player.y);
        }


    }

    handleVisibilityOfOtherPlayers() {
        Object.keys(this.otherPlayers).forEach(id => {
            const otherPlayer = this.otherPlayers[id];
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, otherPlayer.x, otherPlayer.y);
            otherPlayer.setVisible(distance <= 100);
        });
    }

}