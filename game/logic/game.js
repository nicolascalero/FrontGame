export class Game extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.otherPlayers = {};
        this.playerId = this.generateUUID();
    }

    preload() {
    }

    create() {
        this.player = this.add.sprite(100, 100, 'player');

        this.cursors = this.input.keyboard.createCursorKeys();

        this.setupWebSocketListeners();
    }

    setupWebSocketListeners() {
        const socket = new SockJS('http://localhost:8080/gs-guide-websocket');
        this.stompClient = Stomp.over(socket);
        this.stompClient.debug = () => { };

        this.stompClient.connect({}, (frame) => {
            console.log('Conectado: ' + frame);

            // Registro  para obtener el estado actual
            this.stompClient.send("/app/register", {}, JSON.stringify({ playerId: this.playerId, x: this.player.x, y: this.player.y }));

            // Suscribirse para recibir actualizaciones de posición de los jugadores
            this.stompClient.subscribe('/topic/playerMoves', (message) => {
                const players = JSON.parse(message.body);
                players.forEach(player => {
                    this.updateOtherPlayerPosition(player);
                });
            });

            // Suscribirse para recibir notificaciones cuando un jugador se desconecta
            this.stompClient.subscribe('/topic/playerDisconnected', (message) => {
                const disconnectedPlayerId = JSON.parse(message.body);
                this.removePlayer(disconnectedPlayerId);
            });

        });
    }



    updateOtherPlayerPosition(playerUpdate) {
        if (playerUpdate.playerId !== this.playerId) {
            if (!this.otherPlayers[playerUpdate.playerId]) {
                // Crear un nuevo sprite para otro jugador si aún no existe
                this.otherPlayers[playerUpdate.playerId] = this.add.sprite(playerUpdate.x, playerUpdate.y, 'player');
            } else {
                // Actualizar la posición del sprite de otro jugador
                this.otherPlayers[playerUpdate.playerId].setPosition(playerUpdate.x, playerUpdate.y);
            }
        }
    }

    update() {
        let moved = false;
        if (this.cursors.left.isDown) {
            this.player.x -= 5;
            moved = true;
        } else if (this.cursors.right.isDown) {
            this.player.x += 5;
            moved = true;
        }

        if (this.cursors.up.isDown) {
            this.player.y -= 5;
            moved = true;
        } else if (this.cursors.down.isDown) {
            this.player.y += 5;
            moved = true;
        }

        if (moved) {
            this.sendPlayerPosition();
        }
    }

    sendPlayerPosition() {
        if (this.stompClient && this.stompClient.connected) {
            const message = { playerId: this.playerId, x: this.player.x, y: this.player.y };
            this.stompClient.send("/app/playerMove", {}, JSON.stringify(message));
        }
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    removePlayer(disconnectedPlayerId) {
        if (this.otherPlayers[disconnectedPlayerId])
            this.otherPlayers[disconnectedPlayerId].destroy();
        delete this.otherPlayers[disconnectedPlayerId];

    }

}