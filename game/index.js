import { Game } from './logic/game.js';



const config = {
    type: Phaser.AUTO,
    width: 900,
    height: 900,
    backgroundColor: "#ddd",
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [Game],
    scale: {
        mode: Phaser.Scale.Center,
        autoCenter: Phaser.Scale.Center
    }
};

const game = new Phaser.Game(config);

