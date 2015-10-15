'use strict';


var wsConnection = new WebSocket("ws://localhost:3000");

// this method is not in the official API, but it's very useful.
wsConnection.sendJSON = function (data) {
    this.send(JSON.stringify(data));
};

wsConnection.onopen = function (eventInfo) {
    console.log("Socket connection is open!");
};

wsConnection.onmessage = function(message){
    console.log(message);
}

