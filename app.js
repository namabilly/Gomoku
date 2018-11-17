var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(process.env.PORT || 3000);
console.log('server started');

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});
app.use('/js', express.static(__dirname + '/js'));
app.use('/css', express.static(__dirname + '/css'));

GAME_ID = 0;
PLAYER_ID = 0;

class Game {
	constructor(size){
		this.id = GAME_ID++;
		this.size = size; // {x, y}
		this.players = [];
		this.num_of_players = 0;
		this.pieces = [];
		Game.list[id] = this;
	}
	join(player){
		if (this.num_of_players==2) {
			console.log('Join failed, game full');
			return 1;
		}
		this.players.push(player);
		console.log('Joined game ' + this.id + ' successfully.');
		return 0;
	}
	
	static createGame(size){
		new Game(size);
		console.log('New game created.');
	}
	
}
Game.list = {};

class Player {
	constructor(socket){
		this.name = socket.name; 
		this.socket = socket;
		this.id = PLAYER_ID++;
		this.game = undefined;
		this.color = undefined;
		this.isConnected = true;
		Player.list[this.name] = this;
	}
	joinGame(id){
		return Game.list[id].join(this);
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
		socket.emit('signUpResponse', {success:true, username:name});
	}
	static removePlayer(name){
		delete Player.list[name];
		console.log('Player ' + name + ' left.');
	}
}
Player.list = {};

io.sockets.on('connection', function (socket) {
	console.log('New Connection');
	
	socket.on('disconnect', () => {
		if (Player.list[socket.name]){
			console.log('Player ' + socket.name + ' disconnected.');
			Player.list[socket.name].isConnected = false;
			setTimeout(function(){
				if(!Player.list[socket.name].isConnected){
					Player.removePlayer(socket.name);
				}
			}, 3000);
		}
		else
			console.log('One disconnection');
	});
	
	socket.on('signUp', data => {
		if (data.name in Player.list)
			// reconnect
			if (!Player.list[data.name].isConnected){
				Player.list[data.name].isConnected = true;
				Object.defineProperty(socket, 'name', {value:data.name});
				Player.list[data.name].socket = socket;
				console.log('Player ' + data.name + ' reconnected.');
				socket.emit('signUpResponse', {success:true, username:data.name});
			}
			else
				socket.emit('signUpResponse', {success:false, msg:'name exists, please try another one.'}); 
		else 
			Player.addPlayer(data.name, socket); 
	});
	
	socket.on('put', data => {
		// update game info
		
	});
	
	
	
	// when the client emits 'newMessage', this listens and executes
	socket.on('newMessage', (data) => {
		// we tell the client to execute 'new message'
		socket.broadcast.emit('newMessage', {
			username: socket.name,
			message: data
		});
	});
	
});

