document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('createGame').addEventListener('click', function () {
        const username = document.getElementById('name').value;
        if (username) {
            fetch('http://localhost:8080/partidas/crear_partida', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: username })
            })

                .then(response => response.json())
                .then(data => {
                    console.log('Partida creada con éxito, código de partida:', data.gameCode);
                    window.location.href = '/game/game.html';
                })
                .catch((error) => {
                    console.error('Error al crear partida:', error);
                });
        }
    });
});
