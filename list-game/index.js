let stompClient = null;
const gameContainer = document.getElementById('game-container');
const gameEmptyContainer = document.getElementById('game-empty-container');
const paginateContainer = document.getElementById('paginate');
let userName = localStorage.getItem('userName');

function connectAndFetchData(offset, limit) {
    const socket = new SockJS('http://localhost:8080/gs-guide-websocket');
    stompClient = Stomp.over(socket);
    stompClient.debug = () => { };
    stompClient.connect({}, function () {
        stompClient.subscribe('/topic/listInstance', function (response) {
            const data = JSON.parse(response.body);
            data.records = getFirstRecordOfEachGameId(data.records);
            console.log('data', data);
            if (isOwner(data.records)) {
                this.loadInMemory(data.records)
                updateUI(data.records, data.totalRecords, data.pageSize, data.pageNumber);
            }
        });

        stompClient.send("/app/listInstance", {}, JSON.stringify({ name: userName, offset: offset, limit: limit }));
    });
}


function getFirstRecordOfEachGameId(records) {
    const firstRecords = {};
    records.forEach(record => {
        if (!firstRecords[record.gameId]) {
            firstRecords[record.gameId] = record;
        }
    });
    return Object.values(firstRecords);
}

function isOwner(records) {
    return records.some(record => record.owner === userName);
}

function loadInMemory(records) {
    const socket = new SockJS('http://localhost:8080/gs-guide-websocket');
    stompClient = Stomp.over(socket);
    stompClient.debug = () => { };
    stompClient.connect({}, function () {
        stompClient.subscribe('/topic/loadGame', function (response) {
            const data = JSON.parse(response.body);
        });

        records.forEach(element => {
            stompClient.send("/app/loadGame", {}, JSON.stringify({ gameInstanceId: element.gameInstanceId }));
        });
    });
}

function updateUI(games, totalRecords, pageSize, pageNumber) {
    if (games.length === 0) {
        gameEmptyContainer.innerHTML = '<div class="no-games">No existen partidas guardadas</div>';
    } else {
        // Si hay juegos, proceder como antes
        gameContainer.innerHTML = games.map(game => `
            <div class="card">
                <div class="card-header">
                    <h3>JUGADOR: ${game.owner}</h3>
                </div>
                <div class="card-body">
                    <div class="info-line">
                        <p><strong>Código:</strong> ${game.gameId}</p>
                        <span class="separator">|</span>
                        <p><strong>Fecha:</strong> ${dateFormat(game.createdAt)}</p>
                    </div>
                </div>
                <div class="card-footer">
                    <button onclick="joinGame('${game.gameId}')">Unirse al Juego</button>
                </div>
            </div>
        `).join('');
    }
    generatePagination(totalRecords, pageSize, pageNumber);
}


function joinGame(gameId) {
    localStorage.setItem('gameCode', gameId);
    localStorage.setItem('isOwner', false);
    localStorage.setItem('isMethodJoin', true);
    window.location.href = '/game/game.html';
}

function dateFormat(dateISO) {
    const date = new Date(dateISO);
    const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('es', options).replace(',', ' -');
}

function generatePagination(totalRecords, pageSize, pageNumber) {
    const totalPages = Math.ceil(totalRecords / pageSize);
    paginateContainer.innerHTML = '';

    for (let i = 0; i < totalPages; i++) {
        const page = document.createElement('div');
        page.className = 'page' + (i === pageNumber ? ' active' : '');
        page.innerText = i + 1;
        page.onclick = () => connectAndFetchData(i, pageSize);
        paginateContainer.appendChild(page);
    }
}



document.addEventListener('DOMContentLoaded', (event) => {
    connectAndFetchData(0, 5);
});