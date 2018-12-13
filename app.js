var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
const AI_MM = require('AI-MM');
var AI_MM_ID = 0;
//const ai_mm = new AI_MM('AI-MM');

server.listen(process.env.PORT || 3000);
console.log('server started');

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});
app.use('/js', express.static(__dirname + '/js'));
app.use('/css', express.static(__dirname + '/css'));
app.use('/img', express.static(__dirname + '/img'));

GAME_ID = 0;
PLAYER_ID = 0;
SIZE = {x:15, y:15};

class Game {
	constructor(size){
		this.id = GAME_ID++;
		this.size = size; // {x, y}
		this.players = [];
		this.num_of_players = 0;
		this.spectators = [];
		this.pieces = [];
		this.turn = 0;
		Game.list[this.id] = this;
		this.status = 0; // -1 black, 1 white
		this.conceder = undefined; // the one who concedes
		this.create_time = Date.now();
		this.time_limit = 300000;
		this.time_left = this.time_limit;
		this.timeUpdate();
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
	watch(player){
		this.spectators.push(player.name);
		console.log('Watching game 10' + this.id + '.');
		player.socket.emit('watchGameResponse', {
			success: true,
			id: this.id,
			players: this.players
		});
	}
	put(piece){
		this.pieces.push(piece);
		this.turn++;
	}
	undo(turn){
		for (let i in this.pieces) {
			if (this.pieces[i].turn >= turn-1) {
				delete this.pieces[i];
			}
		}
	}
	update(){
		if (this.status === 0) this.status = this.checkBoard();
		var matrix = [];
		this.turn = 0;
		for (let i in this.pieces) {
			var pie = this.pieces[i];
			matrix.push({
				turn: pie.turn,
				position: {
					x: pie.position.x,
					y: pie.position.y
				}
			});
			this.turn++;
		}
		for (let i in this.players) {
			let p = Player.list[this.players[i]];
			if (p) {
				p.update();
				p.socket.emit('updateBoard', {
					id: this.id,
					pieces: matrix,
					status: this.status,
					players: this.players,
					lock: p.lock,
					conceder: this.conceder
				});
			}
		}
		for (let i in this.spectators) {
			let p = Player.list[this.spectators[i]];
			if (p) {
				p.lock = true;
				var sides = [];
				for (let i in this.players) {
					sides.push(Player.list[this.players[i]].side);
				}
				p.socket.emit('updateBoard', {
					id: this.id,
					pieces: matrix,
					status: this.status,
					players: this.players,
					sides: sides,
					lock: p.lock,
					conceder: this.conceder
				});
			}
		}
	}
	timeUpdate(){
		var that = this;
		var tick = setTimeout(function(){
			if (that.time_left <= 0) {
				clearTimeout(tick);
				Game.endGame(that.id);
				return;
			}
			that.time_left = that.time_limit - (Date.now() - that.create_time);
			//console.log(that.time_left);
			for (let i in that.players) {
				var p = Player.list[that.players[i]];
				p.socket.emit('updateTime', {time: that.time_left});
			}
			for (let i in that.spectators) {
				var p = Player.list[that.spectators[i]];
				p.socket.emit('updateTime', {time: that.time_left});
			}
			that.timeUpdate();
		}, 1000);
		if (that.time_left <= 0) {
			Game.endGame(this.id);
		}
	}
	isFull(){
		return this.num_of_players>=2;
	}
	isInGame(position){
		for (let i in this.pieces) {
			var piece = this.pieces[i];
			if (position.x===piece.position.x&&position.y===piece.position.y)
				return true;
		}
		return false;
	}
	removePlayer(name){
		for (let i in this.players) {
			if (this.players[i] === name) {
				this.players.splice(i, 1);
				this.num_of_players--;
					if (this.num_of_players==0) {
						Game.endGame(this.id);
					}
				break;
			}
		}
		this.update();
	}
	removeSpectator(name){
		for (let i in this.spectators) {
			if (this.spectators[i] === name) {
				this.spectators.splice(i, 1);
				break;
			}
		}
	}
	checkBoard(){
		var matrix = [];
		for (let x=0;x<SIZE.x;x++) {
			for (let y=0;y<SIZE.y;y++) {
				matrix[x*SIZE.x + y] = 0;
			}
		}
		for (let i in this.pieces) {
			var pie = this.pieces[i];
			matrix[pie.position.x*SIZE.x + pie.position.y] = (pie.turn%2) * 2 - 1;
		}
		for (let x=0;x<SIZE.x;x++) {
			var temp = 0;
			for (let y=0;y<SIZE.y;y++) {
				temp += matrix[x*SIZE.x + y];
				if (temp*matrix[x*SIZE.x + y] <= 0)
					temp = matrix[x*SIZE.x + y];
				if (temp <= -5) return -1;
				if (temp >= 5) return 1;
			}
		}
		for (let y=0;y<SIZE.y;y++) {
			var temp = 0;
			for (let x=0;x<SIZE.x;x++) {
				temp += matrix[x*SIZE.x + y];
				if (temp*matrix[x*SIZE.x + y] <= 0)
					temp = matrix[x*SIZE.x + y];
				if (temp <= -5) return -1;
				if (temp >= 5) return 1;
			}
		}
		for (let x=0;x<SIZE.x;x++) {
			var temp = 0;
			for (let c=0;c<x;c++) {	
				temp += matrix[c*SIZE.x + x-c];
				if (temp*matrix[c*SIZE.x + x-c] <= 0)
					temp = matrix[c*SIZE.x + x-c];
				if (temp <= -5) return -1;
				if (temp >= 5) return 1;
			}
		}
		for (let x=SIZE.x;x<SIZE.x*2-1;x++) {
			var temp = 0;
			for (let c=x-SIZE.x+1;c<SIZE.x;c++) {	
				temp += matrix[c*SIZE.x + x-c];
				if (temp*matrix[c*SIZE.x + x-c] <= 0)
					temp = matrix[c*SIZE.x + x-c];
				if (temp <= -5) return -1;
				if (temp >= 5) return 1;
			}
		}
		for (let x=0;x<SIZE.x;x++) {
			var temp = 0;
			for (let c=0;c<x;c++) {	
				temp += matrix[c*SIZE.x + SIZE.x-1-x+c];
				if (temp*matrix[c*SIZE.x + SIZE.x-1-x+c] <= 0)
					temp = matrix[c*SIZE.x + SIZE.x-1-x+c];
				if (temp <= -5) return -1;
				if (temp >= 5) return 1;
			}
		}
		for (let x=0;x<SIZE.x-1;x++) {
			var temp = 0;
			for (let c=0;c<x;c++) {	
				temp += matrix[c + (SIZE.x-1-x+c)*SIZE.x];
				if (temp*matrix[c + (SIZE.x-1-x+c)*SIZE.x] <= 0)
					temp = matrix[c + (SIZE.x-1-x+c)*SIZE.x];
				if (temp <= -5) return -1;
				if (temp >= 5) return 1;
			}
		}
		return 0;
	}
	restart(){
		this.pieces = [];
		this.turn = 0;
		this.status = 0;
		this.conceder = undefined;
		this.update();
		this.create_time = Date.now();
		this.time_limit = 300000;
		this.time_left = this.time_limit;
		this.timeUpdate();
	}
	reset(){
		for (let i in this.players) {
			var p = Player.list[this.players[i]];
			p.game = undefined;
		}
		this.players = [];
		this.num_of_players = 0;
		this.spectators = [];
		this.pieces = [];
		this.turn = 0;
		this.status = 0;
		this.conceder = undefined;
		this.create_time = Date.now();
		this.time_limit = 300000;
		this.time_left = this.time_limit;
		this.timeUpdate();
	}
	static join(player){
		var game = Game.list[GAME_ID-1];
		if (!game) {
			Game.createGame(SIZE);
			game = Game.list[GAME_ID-1];
		}
		if (game.isFull()) {
			Game.createGame(SIZE);
			Game.list[GAME_ID-1].join(player);
			player.game = GAME_ID-1;
		} else {
			for (let i in game.players) {
				player.side = -Player.list[game.players[i]].side;
			}
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
	static getGames(){
		var games = [];
		for (let i in Game.list) {
			games.push(Game.list[i].id);
		}
		return games;
	}
	static endGame(id){
		if (id===0) {
			Game.list[id].reset();
			console.log('0 reset.');
			return;
		}
		if (Game.list[id])
			Game.list[id].time_left = 0;
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
		this.opponent = undefined;
		this.lock = false;
		this.side = 0;
		this.watching = false;
		this.isConnected = true;
		Player.list[this.name] = this;
	}
	joinGame(){
		Game.join(this);
	}
	update(){
		// lock
		if (this.game!==undefined&&this.side!==0) {
			this.lock = ((Game.list[this.game].turn%2)*2-1 !== this.side);
		}
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
		game.removeSpectator(name);
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
	// sign up - create player
	// reconnect if disconnected
	socket.on('signUp', data => {
		data.name = data.name.trim();
		if (!data.name || data.name.length == 0)
			socket.emit('signUpResponse', {success:false, msg:'Name invalid, empty name is not accepted.'}); 
		else if (data.name in Player.list)
			// reconnect
			if (!Player.list[data.name].isConnected){
				var p = Player.list[data.name];
				p.isConnected = true;
				Object.defineProperty(socket, 'name', {value:data.name});
				p.socket = socket;
				socket.broadcast.emit('playerReconnected', {
					username: data.name
				});
				console.log('Player ' + data.name + ' reconnected.');
				socket.emit('signUpResponse', {
					success: true, 
					username: data.name,
					id: p.game,
					watching: p.watching
				});
			}
			else
				socket.emit('signUpResponse', {success:false, msg:'Name exists, please try another one.'}); 
		else {
			Player.addPlayer(data.name, socket); 
			socket.broadcast.emit('playerJoined', {
				username: data.name
			});
		}
	});
	
	socket.on('joinGame', data => {
		// get Player
		var p = Player.list[socket.name];
		if (!p) {
			socket.emit('err', {
				msg: 'Player does not exist.'
			});
			return;
		}
		if (!data) data = [];
		// if given game id
		if (data.id!==undefined) {
			// check that game exists
			var game = Game.list[data.id];	
			if (game===undefined) {
				socket.emit('err', {
					msg: 'Game does not exist.'
				});
				return;
			}
			// check game not full
			if (game.isFull()) {
				socket.emit('err', {
					msg: 'Game already full.'
				});
				return;
			}
			// check game status
			if (game.status!==0) {
				socket.emit('err', {
					msg: 'Game already ended.'
				});
				return;
			}
			// remove from previous game
			if (p.game!==undefined) {
				// if same game
				if (p.game===data.id) {
					socket.emit('err', {
						msg: 'Already in game.'
					});
					return;
				}
				var pregame = Game.list[p.game];
				if (pregame) {
					pregame.removePlayer(p);
					pregame.removeSpectator(p);
				}
			}
			// join game
			game.join(p);
			socket.emit('joinGameResponse', {
				success: true,
				id: p.game
			});
			Game.list[p.game].update();
		}
		// if id not given
		// if previous game exists
		else if (p.game!==undefined) {
			socket.emit('joinGameResponse', {
				success: true,
				id: p.game
			});
			Game.list[p.game].update();
		}
		// system assignment
		else
			p.joinGame();
	});
	
	socket.on('getCurrentGames', data => {
		var games = Game.getGames();
		socket.emit('currentGames', {
			games: games
		});
	})
	
	socket.on('watchGame', data => {
		// get Player
		var p = Player.list[socket.name];
		if (!p) {
			socket.emit('err', {
				msg: 'Player does not exist.'
			});
			return;
		}
		// check data
		if (!data) data = [];
		// get Game
		var game = Game.list[data.id];
		if (game===undefined) {
			socket.emit('err', {
				msg: 'Game does not exist.'
			});
			return;
		}
		if (data.id === p.game) {
			socket.emit('err', {
				msg: 'Cannot watch your own game!'
			});
			return;
		}
		if (game) {
			game.watch(p);
			p.watching = true;
			if (p.game!==undefined) {
				var g = Game.list[p.game];
				g.removePlayer(p.name);
				g.removeSpectator(p.name);
			}
			p.game = data.id;
		}
		game.update();
	});
	// not ready
	socket.on('addAI', data => {
		// get Player
		var p = Player.list[socket.name];
		if (!p) {
			socket.emit('err', {
				msg: 'Player does not exist.'
			});
			return;
		}
		// get Game
		if (p.game===undefined) {
			socket.emit('err', {
				msg: 'No game joined.'
			});
			return;
		}
		var game = Game.list[p.game];
		if (game===undefined) {
			socket.emit('err', {
				msg: 'Game does not exist.'
			});
			return;
		}
		// check game status
		if (game.status !== 0) {
			socket.emit('err', {
				msg: 'Game ended.'
			});
			return;
		}
		if (game.players.length >= 2) {
			socket.emit('err', {
				msg: 'Player already exists.'
			});
			return;
		}
		console.log('ai added.');
		let ai = new AI_MM('AI-MM' + AI_MM_ID++);
		ai.connect(game);
		ai.run();
	});
	
	socket.on('put', data => {
		// get Player
		var p = Player.list[socket.name];
		if (!p) {
			socket.emit('err', {
				msg: 'Player does not exist.'
			});
			return;
		}
		// get Game
		if (p.game===undefined) {
			socket.emit('err', {
				msg: 'No game joined.'
			});
			return;
		}
		var game = Game.list[p.game];
		if (game===undefined) {
			socket.emit('err', {
				msg: 'Game does not exist.'
			});
			return;
		}
		// set side
		if (p.side === 0) {
			p.side = (game.turn%2)*2 - 1;
		}
		// check permission/turn
		if (p.lock) {
			socket.emit('err', {
				msg: 'Put failed. Not player\'s turn.'
			});
			game.update();
			return;
		}
		// check game status
		if (game.status !== 0) {
			socket.emit('err', {
				msg: 'Game ended.'
			});
			return;
		}
		// check piece position
		var x = data.position.x,
			y = data.position.y;
		if (x===undefined||y===undefined) {
			socket.emit('err', {
				msg: 'Put failed. Position undefined.'
			});
			return;
		}
		if (x < 0 || x >= SIZE.x || y < 0 || y >= SIZE.y) {
			socket.emit('err', {
				msg: 'Put failed. Position out of bound.'
			});
			return;
		}
		if (game.isInGame({x:x, y:y})) {
			socket.emit('err', {
				msg: 'Put failed. Position not empty.'
			});
			return;
		}
		// put piece
		var piece = new Piece(game, {x:x, y:y}, p, game.turn);
		game.put(piece);
		p.lock = true;
		game.update();
	});
	
	socket.on('undo', data => {
		// get Player
		var p = Player.list[socket.name];
		if (!p) {
			socket.emit('err', {
				msg: 'Player does not exist.'
			});
			return;
		}
		// get Game
		if (p.game===undefined) {
			socket.emit('err', {
				msg: 'No game joined.'
			});
			return;
		}
		var game = Game.list[p.game];
		if (game===undefined) {
			socket.emit('err', {
				msg: 'Game does not exist.'
			});
			return;
		}
		// check game status
		if (game.status !== 0) {
			socket.emit('err', {
				msg: 'Game ended.'
			});
			return;
		}
		if (p.side === 0) {
			socket.emit('err', {
				msg: 'Nothing to undo.'
			});
			return;
		}
		// undo
		var turn = game.turn;
		turn -= p.lock ? 0 : 1;
		game.undo(turn);
		game.update();
	});
	
	socket.on('concede', data => {
		// get Player
		var p = Player.list[socket.name];
		if (!p) {
			socket.emit('err', {
				msg: 'Player does not exist.'
			});
			return;
		}
		// get Game
		if (p.game===undefined) {
			socket.emit('err', {
				msg: 'No game joined.'
			});
			return;
		}
		var game = Game.list[p.game];
		if (game===undefined) {
			socket.emit('err', {
				msg: 'Game does not exist.'
			});
			return;
		}
		// check game status
		if (game.players.length <= 1||p.side === 0) {
			socket.emit('err', {
				msg: 'Game not started.'
			});
			return;
		}
		if (game.status !== 0) {
			socket.emit('err', {
				msg: 'Game ended.'
			});
			return;
		}
		// concede
		game.status = - p.side;
		game.conceder = socket.name;
		game.update();
	});
	
	socket.on('rematch', data => {
		// get Player
		var p = Player.list[socket.name];
		if (!p) {
			socket.emit('err', {
				msg: 'Player does not exist.'
			});
			return;
		}
		// get Game
		if (p.game===undefined) {
			socket.emit('err', {
				msg: 'No game joined.'
			});
			return;
		}
		var game = Game.list[p.game];
		if (game===undefined) {
			socket.emit('err', {
				msg: 'Game does not exist.'
			});
			return;
		}
		game.restart();
	});
	
	socket.on('update', data => {
		// get Player
		var p = Player.list[socket.name];
		if (!p) {
			socket.emit('err', {
				msg: 'Player does not exist.'
			});
			return;
		}
		// get Game
		if (p.game===undefined) {
			socket.emit('err', {
				msg: 'No game joined.'
			});
			return;
		}
		var game = Game.list[p.game];
		if (game===undefined) {
			socket.emit('err', {
				msg: 'Game does not exist.'
			});
			return;
		}
		// update
		game.update();
	});
	
	// when the client emits 'newMessage', this listens and executes
	socket.on('newMessage', (data) => {
		// we tell the client to execute 'new message'
		socket.broadcast.emit('newMessage', {
			username: socket.name,
			message: data
		});
		
		// interesting features
		// get Player
		var p = Player.list[socket.name];
		if (!p) {
			return;
		}
		// get Game
		if (p.game===undefined) {
			return;
		}
		var game = Game.list[p.game];
		if (game===undefined) {
			return;
		}
		if (data==='+1s') {
			game.create_time += 1000;
		}
		
	});
	
	socket.on('error', () => {});
	
});

process.on('uncaughtException', function (exception) {
	// handle or ignore error
	console.log(exception);
});



// keep the server up.....
var reqTimer = setTimeout(function wakeUp() {
   require('http').request("http://namabilly-gomoku.herokuapp.com/", function() {
      console.log("WAKE UP DYNO");
   });
   return reqTimer = setTimeout(wakeUp, 1200000);
}, 1200000);


