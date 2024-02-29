import eventsCenter from "./eventsCenter.js";

export class SideView extends Phaser.Scene {
    constructor() {
        super({ key: 'SideView' });
        this.titleText = null;
        this.eventsCenter = eventsCenter;
    }

    preload() {
        this.load.image('tilesetImage', '../../assets/mapa.png');
        this.load.image('skyImage', '../../assets/sky.png');
        this.load.tilemapTiledJSON('map', '../../assets/mapSideView.json');

    }
    create() {
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('Mapa2', 'tilesetImage');
        const skyTileset = map.addTilesetImage('sky', 'skyImage');
        const layer1 = map.createLayer('Capa de patrones 1', [tileset, skyTileset], 0, 0);

        this.cameras.main.setViewport(0, 0, 450, 350);
        this.cameras.main.setBackgroundColor('#333');

        // Inicializa titleText una vez
        // this.titleText = this.add.text(225, 175, 'DroneShoot', {
        //     font: '26px Arial', fill: '#fff'
        // }).setOrigin(0.5, 0.5);


        this.eventsCenter.on('changeTitle', (data) => {
            this.updateContent(data.mensaje);
        });

    }

    updateContent(data) {
        alert(data.mensaje)
    }
}
