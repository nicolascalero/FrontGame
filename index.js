document.getElementById('loginButton').addEventListener('click', function () {
    const usernameInput = document.getElementById('username');
    const username = usernameInput.value.trim(); // Obtén el valor del nombre de usuario sin espacios en blanco al inicio y al final

    if (username !== '') {
        localStorage.setItem("name", username);
        // Redirige al usuario a la página "game.html" antes de limpiar el campo
        window.location.href = '/game/game.html';

        // Limpia el campo de entrada después de la redirección
        usernameInput.value = '';
    } else {
        // El campo de nombre de usuario está vacío, muestra un mensaje de error y mantén el texto ingresado
        alert('Por favor, ingresa un nombre de usuario válido.');
    }
});
