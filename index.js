document.addEventListener("DOMContentLoaded", function () {
    localStorage.clear();
});


function goToGameMenu() {
    const name = document.getElementById('nameInput').value;

    if (name === "") {
        alertErrorName();
    } else {
        localStorage.setItem('userName', name);
        document.getElementById('nameInput').value = "";
        window.location.href = './menu-game/index.html';
    }
}

function alertErrorName() {
    Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "¡El nombre es necesario!",
        showCloseButton: true
    });
}

