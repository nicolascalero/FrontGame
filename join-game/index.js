function joinGame() {
    const code = document.getElementById('code').value;
    if (code === "") {
        alertErrorCode();
    } else {
        localStorage.setItem('isOwner', false);
        localStorage.setItem('gameCode', code);
        window.location.href = '/game/game.html';
    }
}

function alertErrorCode() {
    Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "¡El codigo es necesario!",
        showCloseButton: true
    });
}

