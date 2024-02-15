function createGame() {
    const userName = localStorage.getItem('userName');
    localStorage.setItem('isOwner', true);
    window.location.href = '/game/game.html';

}

function joinGame() {
    window.location.href = '/join-game/index.html';

}

function listGames() {
    window.location.href = '../list-game/index.html'
}