var mongoose    = require('mongoose');
var express     = require('express');
var session     = require('express-session');
var path        = require('path');
var bodyParser  = require('body-parser');
var http        = require('http');
var ws          = require('ws');

var app = express();
var httpServer      = http.createServer(app);

var theWebSocketServer = new ws.Server({
    server: httpServer
});

app.use(bodyParser.json());
app.use(session({resave: true, saveUninitialized: true, secret: 'ngio24ng24hg57341pngEAG6G13g31'}));


var dbName = 'quizzerDB';
var Room = require('./models/Room');
var Question = require('./models/Question');

theWebSocketServer.on('connection', function(ws){
    console.log('connected')
        ws.on('message', function (message) {
            for(var i = 0; i < theWebSocketServer.clients.length;i++) {
                var receivedData = JSON.parse(message);
                console.log('receivedData: ', receivedData);
                switch (receivedData.messageType) {
                    case 'joinRequest':
                        if(theWebSocketServer.clients[i] === ws) {
                            theWebSocketServer.clients[i].role = 'participant';
                            theWebSocketServer.clients[i].roomId = receivedData.roomId;
                            theWebSocketServer.clients[i].teamName = receivedData.teamName;

                            console.log(theWebSocketServer.clients[i].role, theWebSocketServer.clients[i].roomId);

                            var dataToSend = {
                                messageType: 'processRequest',
                                teamName: receivedData.teamName,
                                roomId: receivedData.roomId
                            };
                            for (var i = 0; i < theWebSocketServer.clients.length; i++) {
                                if (theWebSocketServer.clients[i].role === 'host' && theWebSocketServer.clients[i].roomId === receivedData.roomId) {
                                    theWebSocketServer.clients[i].send(JSON.stringify(dataToSend));
                                }
                            }
                        }
                    break;
                    case 'becomeHost':
                        if(theWebSocketServer.clients[i] === ws) {
                            theWebSocketServer.clients[i].role = 'host';
                            theWebSocketServer.clients[i].roomId = receivedData.roomId;
                            var sendData = {
                                roomId: receivedData.roomId,
                                messageType: 'hostAccept'
                            }
                            for(var i = 0; i < theWebSocketServer.clients.length;i++){
                                if(theWebSocketServer.clients[i].role === 'host' && theWebSocketServer.clients[i].roomId === receivedData.roomId){
                                    theWebSocketServer.clients[i].send(JSON.stringify(sendData));
                                }
                            }
                        }
                    break;
                    case 'processAcceptTeam':
                        if(theWebSocketServer.clients[i] === ws){
                            Room.findOne({_id: receivedData.roomId}, function(err, result){
                                if(result.teams.length < 6){
                                    Room.find({_id: receivedData.roomId}, function (err, result) {
                                        Room.update({_id: receivedData.roomId}, {
                                            $push: {
                                                teams: {
                                                    teamName: receivedData.teamName,
                                                    score: 0
                                                }
                                            }
                                        }, {upsert: true}, function (err, data) {
                                            for (var i = 0; i < theWebSocketServer.clients.length; i++) {
                                                if (theWebSocketServer.clients[i].role === 'participant' && theWebSocketServer.clients[i].roomId === receivedData.roomId && theWebSocketServer.clients[i].teamName === receivedData.teamName) {
                                                    var client = theWebSocketServer.clients[i];
                                                    Room.findOne({_id: receivedData.roomId}, function (err, result) {
                                                        client.send(JSON.stringify({
                                                            messageType: 'acceptedTeam',
                                                            teamList: result.teams
                                                        }))
                                                    })
                                                }
                                            }
                                        })
                                    });
                                }
                                else{
                                   ws.send(JSON.stringify({messageType: 'roomFull'}));
                                }
                            })
                        }
                    break;
                    case 'rejectTeam':
                        for (var i = 0; i < theWebSocketServer.clients.length; i++) {
                            if (theWebSocketServer.clients[i].role === 'participant' && theWebSocketServer.clients[i].roomId === receivedData.roomId && theWebSocketServer.clients[i].teamName === receivedData.teamName) {
                                theWebSocketServer.clients[i].send(JSON.stringify({messageType: 'rejectedTeam'}))
                                return;
                            }
                        }
                    break;
                    case "selectedCategories":
                        console.log('hi!');
                        if(theWebSocketServer.clients[i] === ws) {
                                for (var i = 0; i < receivedData.categories.length; i++) {
                                    Question.find({category: receivedData.categories[i]}, function (err, result) {
                                        theWebSocketServer.clients[i].send(result);
                                    })
                                }
                        }
                    break;
                    case 'questionStart':
                        if(theWebSocketServer.clients[i] === ws) {
                            var dataToSend = {
                                messageType: 'processStartQuestion',
                                roomId: receivedData.roomId,
                                question: receivedData.question
                            }
                            console.log(dataToSend);
                            for (var i = 0; i < theWebSocketServer.clients.length; i++) {
                                if (theWebSocketServer.clients[i].role === 'participant' && theWebSocketServer.clients[i].roomId === receivedData.roomId) {
                                    theWebSocketServer.clients[i].send(JSON.stringify(dataToSend));
                                }
                            }
                        }
                    break;
                    case 'answeredQuestion':
                        if(theWebSocketServer.clients[i] === ws){
                            var dataToSend = {
                                messageType: 'teamAnswer',
                                answer: receivedData.answer,
                                teamName: receivedData.teamName,
                                roomId: receivedData.roomId
                            }
                            for(var j = 0; j < theWebSocketServer.clients.length;j++){
                                if(theWebSocketServer.clients[j].role === 'host' && theWebSocketServer.clients[j].roomId === receivedData.roomId){
                                    theWebSocketServer.clients[j].send(JSON.stringify(dataToSend));
                                }
                            }
                        }
                    break
                }
            }
        })
});



app.use(express.static(path.join(__dirname, 'client-side')));


var hostRouter = express.Router();
var participantRouter  = express.Router();
var globalRouter = express.Router();

participantRouter.get('/getRooms', function(req, res){
    Room.find({}, function(err, result){
        res.send(result);
    });
});

hostRouter.post('/getRoom', function(req, res){
    Room.findOne({_id: req.body.roomName}, function(err, result){
        res.send(result);
    });

})

participantRouter.post('/joinRoom', function(req, res){
    Room.findOne({_id: req.body.roomId}, function(err, result){
        console.log(req.body.roomPass);
        console.log(result.password);
        if(req.body.roomPass === result.password){
            res.send(req.body);
        }
        else{
            res.send('the password was incorrect!');
        }
    })
});

hostRouter.post('/addRoom', function(req, res){
    Room.count({_id: req.body._id}, function(err, result){
       if(result > 0) {
           res.send('this room name is already taken!');
       }
        else{
           session.host = {
               isHost: true,
               roomName: req.body._id,
               teams: []
           };
           Room.create(req.body, function(err){
               if(err) console.log(err);
               res.json(req.body);
           });
       }
    });
});

hostRouter.post('/hostAuthentication', function(req, res){
    Room.count({_id: req.body.roomName}, function(err, result){
            if(result === 0) {
            res.status(404);
            res.send('this room name doesn\'t exist');
        }
        else{
            session.host = {
                isHost: true,
                roomName: null
            }
            if (session.host.roomName === req.body.roomName) {
                res.send('you are now the host!');
            } else {
                res.send('you are not the host!');
            }
        }
    })
});

hostRouter.post('/becomeHost', function(req,res){
    Room.findOne({_id: req.body.roomName}, function(err, result){
        if(req.body.adminPass === result.adminPass){
            session.host = {
                isHost: true,
                roomName: req.body.roomName,
                teams: []
            }
            res.send('allowed!');
        }
        else{
          res.status(403);
          res.send('the adminPass was incorrect!');
        }
    })
})

hostRouter.post('/deleteRooms', function(req, res){
    Room.remove(function(){

    });
    res.send('rooms deleted!');
});

globalRouter.get('/getQuestions', function(req, res){
    Question.find({}, function(err, result){
        res.send(result);
    });
});




app.use('/host', hostRouter);
app.use('/participant', participantRouter);
app.use('/global', globalRouter);

mongoose.connect('mongodb://127.0.0.1:27017/' + dbName, function(err, db) {

    httpServer.listen(3000, function () {
        console.log('Listening on ' + httpServer.address().port)
    });
});



module.exports = app;
