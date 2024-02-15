
var stompClient = null;


function connect() {
    console.log("jola2")
    var socket = new SockJS('http://localhost:8080/gs-guide-websocket');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        setConnected(true);
        console.log('Connected: ' + frame);
        stompClient.subscribe('/topic/greetings', function (greeting) {
            console.log(greeting)
            showGreeting(JSON.parse(greeting.body).content);
        });
    });
}

function setConnected(connected) {
    console.log("jola")
    document.getElementById("connect").disabled = connected;
    document.getElementById("disconnect").disabled = !connected;
    document.getElementById("conversation").style.display = connected ? "block" : "none";
    if (!connected) {
        document.getElementById("greetings").innerHTML = "";
    }
}


function disconnect() {
    if (stompClient !== null) {
        stompClient.disconnect();
    }
    setConnected(false);
    console.log("Disconnected");
}

function sendName() {
    var name = document.getElementById("name").value;
    stompClient.send("/app/hello", {}, JSON.stringify({ 'name': name }));
}

function showGreeting(message) {
    var greetings = document.getElementById("greetings");
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.appendChild(document.createTextNode(message));
    tr.appendChild(td);
    greetings.appendChild(tr);
}

document.getElementById("connect").addEventListener("click", connect);
document.getElementById("disconnect").addEventListener("click", disconnect);
document.getElementById("send").addEventListener("click", sendName);

document.querySelectorAll("form").forEach(function (form) {
    form.addEventListener("submit", function (event) {
        event.preventDefault();
    });
});