import { Game } from './logic/game.js';
import { SideView } from './logic/sideView.js';


const gameConfig = {
    type: Phaser.AUTO,
    width: 1040,
    height: 1040,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0, x: 0 },
            debug: false,
            fps: 60
        },
        fps: {
            max: 60,
            min: 20,
            target: 60,
        }
    },
    scene: [Game]
};


const sideViewConfig = {
    type: Phaser.AUTO,
    parent: 'side-view-container',
    width: 448, // Ajusta según tus necesidades
    height: 352,
    scene: [SideView],

};

// Crear las instancias de juego
const game = new Phaser.Game(gameConfig);
const sideView = new Phaser.Game(sideViewConfig);

