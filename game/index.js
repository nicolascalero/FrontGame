import { Game } from './logic/game.js';



const config = {
    type: Phaser.AUTO,
    width: 1040,
    height: 1040,
    backgroundColor: "#ddd",
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0, x: 0 },
            debug: false,
            fps: 60
        },
        fps: { // not sure if this is even doing anything
            max: 60,
            min: 20,
            target: 60,
        }
    },
    scene: [Game],
    scale: {
        mode: Phaser.Scale.Center,
        autoCenter: Phaser.Scale.Center
    }
};

const game = new Phaser.Game(config);

