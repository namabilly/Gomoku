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
SIZE = {x:15, y:15};

class Game {
	constructor(size){
		this.id = GAME_ID++;
		this.size = size; // {x, y}
		this.players = [];
		this.num_of_players = 0;
		this.pieces = [];
		Game.list[this.id] = this;
	}
	join(player){
		if (this.isFull()) {
			console.log('Join failed, game full');
			return 1;
		}
		this.players.push(player.name);
		this.num_of_players++;
		console.log('Joined game 10' + this.id + ' successfully.');
		return 0;
	}
	put(piece){
		this.pieces.push(piece);
	}
	update(){
		var matrix = [];
		for (let i=0;i<this.pieces.length;i++) {
			var pie = this.pieces[i];
			matrix.push({
				turn: pie.turn,
				position: {
					x: pie.position.x,
					y: pie.position.y
				}
			});
		}
		for (let i=0;i<this.players.length;i++) {
			Player.list[this.players[i]].socket.emit('updateBoard', {
				id: this.id,
				pieces: matrix
			});
		}
	}
	isFull(){
		return this.num_of_players>=2;
	}
	removePlayer(name){
		this.players.pop(name);
		this.num_of_players--;
		if (this.num_of_players==0) {
			Game.endGame(this.id);
		}
	}
	static join(player){
		var game = Game.list[GAME_ID-1];
		if (game.isFull()) {
			Game.createGame(SIZE);
			Game.list[GAME_ID-1].join(player);
			player.game = GAME_ID-1;
		} else {
			game.join(player);
			player.game = GAME_ID-1;
		}
		console.log('Player ' + player.name + ' joined game 10' + (GAME_ID-1) + '.');
		player.socket.emit('joinGameResponse', {
			success: true,
			id: GAME_ID-1
		});
		game.update();
	}
	static createGame(size){
		new Game(size);
		console.log('New game 10' + (GAME_ID-1) + ' created.');
	}
	static endGame(id){
		delete Game.list[id];
		console.log('Game 10' + id + ' ended.')
	}
	
}
Game.list = {};
Game.createGame(SIZE);

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
	joinGame(){
		Game.join(this);
	}
	update(){
		// nothing
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
		var game = Game.list[Player.list[name].game];
		game.removePlayer(name);
		Player.list[name].socket.broadcast.emit('playerLeft', {
			username: name
		});
		delete Player.list[name];
		console.log('Player ' + name + ' left.');
	}
}
Player.list = {};

class Piece {
	constructor(game, position, player, turn){
		this.game = game;
		this.position = position;
		this.owner = player;
		this.turn = turn;
	}
	put(){
		
	}
}


io.sockets.on('connection', function (socket) {
	console.log('New Connection');
	
	socket.on('disconnect', () => {
		if (Player.list[socket.name]){
			console.log('Player ' + socket.name + ' disconnected.');
			socket.broadcast.emit('playerDisconnected', {
				username: socket.name
			});
			Player.list[socket.name].isConnected = false;
			setTimeout(function(){
				if(!Player.list[socket.name].isConnected){
					Player.removePlayer(socket.name);
				}
			}, 3000);
		}
		else {
			console.log('One disconnection');
		}
	});
	
	socket.on('signUp', data => {
		data.name = data.name.trim();
		if (!data.name || data.name.length == 0)
			socket.emit('signUpResponse', {success:false, msg:'name invalid, empty name is not accepted.'}); 
		else if (data.name in Player.list)
			// reconnect
			if (!Player.list[data.name].isConnected){
				Player.list[data.name].isConnected = true;
				Object.defineProperty(socket, 'name', {value:data.name});
				Player.list[data.name].socket = socket;
				socket.broadcast.emit('playerReconnected', {
					username: data.name
				});
				console.log('Player ' + data.name + ' reconnected.');
				socket.emit('signUpResponse', {success:true, username:data.name});
			}
			else
				socket.emit('signUpResponse', {success:false, msg:'name exists, please try another one.'}); 
		else {
			Player.addPlayer(data.name, socket); 
			socket.broadcast.emit('playerJoined', {
				username: data.name
			});
		}
	});
	
	socket.on('joinGame', data => {
		var p = Player.list[data.name];
		p.joinGame();
	});
	
	socket.on('put', data => {
		var game = Game.list[data.id];
		var p = Player.list[data.name];
		var piece = new Piece(game, {x:data.position.x, y:data.position.y}, p, data.turn);
		game.put(piece);
		game.update();
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



// keep the server up.....
var reqTimer = setTimeout(function wakeUp() {
   request("https://namabilly-gomoku.herokuapp.com/", function() {
      console.log("WAKE UP DYNO");
   });
   return reqTimer = setTimeout(wakeUp, 1200000);
}, 1200000);


