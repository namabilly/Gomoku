var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(3000);
console.log('server started');

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});
app.use('/js', express.static(__dirname + '/js'));

GAME_ID = 0;
PLAYER_ID = 0;

class Game {
	constructor(size){
		this.id = GAME_ID++;
		this.size = size; // {x, y}
		this.players = undefined;
		this.num_of_players = 0;
		this.pieces = [];
	}
	join(player){
		
	}
	
}

class Player {
	constructor(socket){
		this.name = socket.name; 
		this.socket = socket;
		this.id = PLAYER_ID++;
		this.color = undefined;
		Player.list[this.name] = this;
	}
	joinGame(id){
		
	}
	static update(){
		for (let name in Player.list) {
			Player.list[name].update(); 
		}
	}
	static addPlayer(name, socket){
		Object.defineProperty(socket, 'name', {value:name});
		new Player(socket);
		console.log('New player ' + name + ' joined.');
		socket.emit('signUpResponse', {success:true});
	}
	static removePlayer(name){
		delete Player.list[name];
		console.log('Player ' + name + ' leaved.');
	}
}
Player.list = {};

io.sockets.on('connection', function (socket) {
	console.log('New Connection');
	
	socket.on('disconnect', () => Player.removePlayer(socket.name));
	
	socket.on('signUp', data => {
		if (data.name in Player.list) 
			socket.emit('signUpResponse', {success:false, msg:'name exists, please try another one.'}); 
		else 
			Player.addPlayer(data.name, socket); 
	});
	
	socket.on('put', data => {
		// update game info
	});
	
});

