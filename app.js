var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
//const AI_MM = require('AI-MM');
//var AI_MM_ID = 0;
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
//PLAYER_ID = 0;
const SIZE = {x:15, y:15};

class Game {
	constructor(size){
		this.id = GAME_ID++;
		this.size = size; // {x, y}
		this.players = [];
		this.num_of_players = 0;
		this.spectators = [];
		this.pieces = [];
		this.turn = 0;
		this.status = 0; // -1 black, 1 white
		this.conceder = undefined; // the one who concedes
		this.create_time = Date.now();
		this.time_limit = 300000; // 5 min
		this.time_left = this.time_limit;
		this.timeUpdate();
		Game.list[this.id] = this;
	}
	// player join game - by Player
	join(player){
		// game full
		if (this.isFull()) {
			console.log('Join failed, game full');
			return 1;
		}
		// add player
		this.players.push(player.name);
		this.num_of_players++;
		player.socket.emit('joinGameResponse', {
			success: true,
			id: this.id,
			players: this.players
		});
		console.log('Joined game ' + (100+this.id) + ' successfully.');
		// set opponent
		if (this.num_of_players === 2) {
			Player.list[this.players[0]].opponent = this.players[1];
			Player.list[this.players[1]].opponent = this.players[0];
		}
		return 0;
	}
	// player watch game - by Player
	watch(player){
		// add player
		this.spectators.push(player.name);
		player.socket.emit('watchGameResponse', {
			success: true,
			id: this.id,
			players: this.players
		});
		console.log('Watching game ' + (100+this.id) + '.');
		return 0;
	}
	// put piece - by Piece
	put(piece){
		this.pieces.push(piece);
		this.turn++;
	}
	// undo - turn to be returned to
	undo(turn){
		for (let i in this.pieces) {
			if (this.pieces[i].turn >= turn-1) {
				delete this.pieces[i];
			}
		}
	}
	// update game
	update(){
		// check game status - if someone wins
		if (this.status === 0) this.status = this.checkBoard();
		// convert Piece to passable variables
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
		// update players in game
		for (let i in this.players) {
			let p = Player.list[this.players[i]];
			if (p) {
				p.update();
				p.socket.emit('updateBoard', {
					id: this.id,
					pieces: matrix,
					status: this.status,
					players: this.players,
					side: p.side,
					lock: p.lock,
					conceder: this.conceder
				});
			}
		}
		// update spectators watching
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
	// update time - once per sec
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
	// check whether the game is full - 2 or more players
	isFull(){
		return this.num_of_players>=2;
	}
	// check whether a position has already been put
	isInGame(position){
		for (let i in this.pieces) {
			var piece = this.pieces[i];
			if (position.x===piece.position.x&&position.y===piece.position.y)
				return true;
		}
		return false;
	}
	// check game status - if anyone wins
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
	// remove player - by name
	removePlayer(name){
		for (let i in this.players) {
			if (this.players[i] === name) {
				this.players.splice(i, 1);
				this.num_of_players--;
				if (this.num_of_players === 0) {
					Game.endGame(this.id);
				}
				// opponent
				else {
					Player.list[this.players[0]].opponent = undefined;
				}
				break;
			}
		}
		this.update();
	}
	// remove spectator - by name
	removeSpectator(name){
		for (let i in this.spectators) {
			if (this.spectators[i] === name) {
				this.spectators.splice(i, 1);
				break;
			}
		}
	}
	// restart the game *
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
	// reset the game *
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
	// static - join - system assign game *
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
		console.log('Player ' + player.name + ' joined game ' + (100+GAME_ID-1) + '.');
		player.socket.emit('joinGameResponse', {
			success: true,
			id: GAME_ID-1
		});
		game.update();
	}
	// static - create game
	static createGame(size){
		new Game(size);
		console.log('New game ' + (100+GAME_ID-1) + ' created.');
	}
	// static - get all valid game ids
	static getGames(){
		var games = [];
		for (let i in Game.list) {
			games.push(Game.list[i].id);
		}
		return games;
	}
	// static - end game - by id
	static endGame(id){
		if (id === 0) {
			Game.list[id].reset();
			console.log('0 reset.');
			return;
		}
		if (Game.list[id])
			Game.list[id].time_left = 0;
		delete Game.list[id];
		console.log('Game ' + (100+id) + ' ended.')
	}
	
}
Game.list = {};
Game.createGame(SIZE);

class Player {
	constructor(socket){
		this.name = socket.name; 
		this.socket = socket;
		this.game = undefined; // id
		this.lock = false;
		this.side = 0; // -1 black, 1 white
		this.opponent = undefined;
		this.watching = false;
		this.isConnected = true;
		Player.list[this.name] = this;
	}
	// join game *
	joinGame(){
		Game.join(this);
	}
	// update player info *
	update(){
		// side
		if (this.opponent && this.side === 0) {
			this.side = -Player.list[this.opponent].side;
		} 
		// lock
		if (this.game !== undefined && this.side !== 0) {
			this.lock = ((Game.list[this.game].turn%2)*2-1 !== this.side);
		}
	}
	// reset player info *
	reset(){
		this.lock = false;
		this.side = 0;
		this.watching = false;
	}
	// static - update all players *
	static update(){
		for (let name in Player.list) {
			Player.list[name].update(); 
		}
	}
	// static - create player - by name and socket
	static addPlayer(name, socket){
		Object.defineProperty(socket, 'name', {value:name});
		new Player(socket);
		console.log('New player ' + name + ' joined.');
		socket.emit('signUpResponse', {success:true, username:name});
	}
	// static - remove player - by name
	static removePlayer(name){
		// find the game
		var game = Game.list[Player.list[name].game];
		if (game) {
			game.removePlayer(name);
			game.removeSpectator(name);
		}
		if (Player.list[name]) {
			Player.list[name].socket.broadcast.emit('playerLeft', {
				username: name
			});
		}
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
}


io.sockets.on('connection', function (socket) {
	console.log('New Connection');
	// disconnect
	// remove player if no attempt to reconnect
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
		// check data
		if (!data) data = [];
		// trim name
		data.name = data.name.trim();
		// invalid names
		if (!data.name || data.name.length == 0)
			socket.emit('signUpResponse', {success:false, msg:'Name invalid, empty name is not accepted.'}); 
		// name exists
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
				if (p.game !== undefined) {
					var game = Game.list[p.game];
					if (game) game.update();
				}
			}
			// name exists
			else
				socket.emit('signUpResponse', {success:false, msg:'Name exists, please try another one.'}); 
		// create player
		else {
			Player.addPlayer(data.name, socket); 
			socket.broadcast.emit('playerJoined', {
				username: data.name
			});
		}
	});
	// join game
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
			// previous game exists
			if (p.game!==undefined) {
				// if same game
				if (p.game===data.id) {
					socket.emit('err', {
						msg: 'Already in game.'
					});
					return;
				}
				// remove from previous game
				var pregame = Game.list[p.game];
				if (pregame) {
					pregame.removePlayer(p.name);
					pregame.removeSpectator(p.name);
				}
			}
			// join game
			p.reset();
			game.join(p);
			p.game = data.id;
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
	// get game list
	socket.on('getCurrentGames', data => {
		var games = Game.getGames();
		socket.emit('currentGames', {
			games: games
		});
	})
	// watch game
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
		if (game === undefined) {
			socket.emit('err', {
				msg: 'Game does not exist.'
			});
			return;
		}
		// if same game
		if (data.id === p.game) {
			socket.emit('err', {
				msg: 'Cannot watch your own game!'
			});
			return;
		}
		// watch game
		if (game) {
			game.watch(p);
			p.watching = true;
			if (p.game !== undefined) {
				var g = Game.list[p.game];
				g.removePlayer(p.name);
				g.removeSpectator(p.name);
			}
			p.game = data.id;
			game.update();
		}
	});
	// not ready *
	/*socket.on('addAI', data => {
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
	});*/
	// put piece
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
		if (p.game === undefined) {
			socket.emit('err', {
				msg: 'No game joined.'
			});
			return;
		}
		var game = Game.list[p.game];
		if (game === undefined) {
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
		// check data
		if (!data) data = [];
		// check piece position
		var x = data.position.x,
			y = data.position.y;
		if (x === undefined || y === undefined) {
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
	// undo
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
		if (p.game === undefined) {
			socket.emit('err', {
				msg: 'No game joined.'
			});
			return;
		}
		var game = Game.list[p.game];
		if (game === undefined) {
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
	// concede
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
		if (p.game === undefined) {
			socket.emit('err', {
				msg: 'No game joined.'
			});
			return;
		}
		var game = Game.list[p.game];
		if (game === undefined) {
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
	// not robust *
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
	// debug method update *
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
	
	// chat content
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


