// connect
var socket = io();

// sign up
var signUpDiv = document.getElementById("signUpDiv"); 
var signUpName = document.getElementById("signUpName"); 
var $signUpName = $('#signUpName');

const signUp = () => {
	var message = signUpName.value;
	message = cleanInput(message);
	if (message) {
		socket.emit('signUp', {name: message}); 
	}
};


// rooms
var watch = document.getElementById("watch");
var play = document.getElementById("play");
var roomDiv = document.getElementById("roomDiv");
var mode = '';
// back button
var back = document.createElement("a");
back.classList.add("back");
back.href = "#";
// back arrow
var inback = document.createElement("a");
inback.href = "#";
back.appendChild(inback);
// create button +
var create = document.createElement("BUTTON");
create.classList.add("btn");
create.classList.add("btn-primary");
create.classList.add("gameRoom");
var createText = document.createTextNode('New');
create.appendChild(createText);

watch.onclick = () => {
	goBack();
	mode = 'watch';
	socket.emit('getCurrentGames', {});
};

play.onclick = () => {
	goBack();
	mode = 'join';
	socket.emit('getCurrentGames', {});
};

create.onclick = () => {
	createGame();
	goBack();
};

const goBack = () => {
	while (roomDiv.firstChild) {
		roomDiv.removeChild(roomDiv.firstChild);
	}
	roomDiv.style.width = "0px";
	roomDiv.style.paddingLeft = "0px";
	mode = '';
};

back.onclick = goBack;

const showRooms = (data) => {
	var games = data.games;
	console.log(games);
	var list = document.createElement("UL");
	for (let i in games) {
		var node = document.createElement("LI");
		node.classList.add("gameRoom");
		var btn = document.createElement("BUTTON");
		btn.classList.add("btn");
		btn.classList.add("btn-primary");
		btn.classList.add("gameRoom");
		var info = document.createTextNode(100 + games[i] + "");
		btn.appendChild(info);
		if (mode === 'join')
			btn.onclick = () => {
				joinGame(games[i]);
			};
		else if (mode === 'watch')
			btn.onclick = () => {
				watchGame(games[i]);
			};		
		node.appendChild(btn);
		list.appendChild(node);
	}
	if (mode === 'join') list.appendChild(create);
	roomDiv.appendChild(list);
	roomDiv.appendChild(back);
	roomDiv.style.width = "100%";
	roomDiv.style.paddingLeft = "40px";
	
}

const watchGame = (id) => {
	socket.emit('watchGame', {
		id: id
	});
	goBack();
}

const joinGame = (id) => {
	socket.emit('joinGame', {
		id: id
	});
	goBack();
}

const createGame = () => {
	socket.emit('createGame');
};


// game
class Board {
	constructor(position, size, format, color){
		this.position = position; // {x, y}
		this.size = size; // {width, height}
		this.format = format; // {spacing, lineWidth}
		this.color = color;
		this.pieces = [];
		this.turn = 0;
		this.id = -1;
	}
	draw(){
		ctx.setTransform(1, 0, 0, 1, this.position.x, this.position.y);
		ctx.fillStyle = this.color;
		ctx.fillRect(-60, -60, 720, 720); // arbitary
		ctx.fillStyle = "#FFFFFF";
		ctx.fillRect(-this.format.lineWidth, -this.format.lineWidth, 
			(this.size.width-1)*this.format.spacing+this.format.lineWidth,
			(this.size.height-1)*this.format.spacing+this.format.lineWidth);
		ctx.fillStyle = "#000000";
		ctx.font = "30px Arial";
		ctx.fillText(this.id+100, 275, -25);
		ctx.fillStyle = this.color;
		for(var x=0;x<this.size.width;x++){
			for(var y=0;y<this.size.height;y++){
				ctx.fillRect(x*this.format.spacing, y*this.format.spacing, 
					this.format.spacing-this.format.lineWidth, this.format.spacing-this.format.lineWidth);
				if(x==3||x==this.size.width-4||x==(this.size.width-1)/2){
					if(y==x||y==this.size.height-1-x){
						ctx.fillStyle = "#000000";
						ctx.fillRect(x*this.format.spacing-this.format.lineWidth*5/2, 
							y*this.format.spacing-this.format.lineWidth*5/2,
							this.format.lineWidth*4, this.format.lineWidth*4);
						ctx.fillStyle = this.color;
					}
				}
			}
		}
		for(var i=0;i<this.pieces.length;i++){
			this.pieces[i].draw();
			if (this.pieces[i].turn==this.turn-1)
				this.pieces[i].showLatest();
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
	put(position, player, turn){
		for(var i=0;i<this.pieces.length;i++){
			if(position.x==this.pieces[i].position.x&&position.y==this.pieces[i].position.y){
				console.log("Already exists");
				return 2;
			}
		}
		var piece = new Piece(this, position, player, turn);
		this.pieces.push(piece);
		piece.draw();
		return 0;
	}
	show(position, player){
		for(var i=0;i<this.pieces.length;i++){
			if(position.x==this.pieces[i].position.x&&position.y==this.pieces[i].position.y){
				console.log("Already exists");
				return 2;
			}
		}
		new Piece(this, position, player, this.turn).show();
		return 0;
	}
	clearBoard(){
		this.pieces = [];
		this.draw();
	}
	load(pieces){
		//lock = (pieces.length-this.turn)%2==0 && lock;
		console.log(lock);
		this.turn = pieces.length;
		for (let i=0;i<pieces.length;i++) {
			var p0 = (pieces[i].turn%2==0) ? p1 : p2;
			this.put(pieces[i].position, p0, i);
		}
		this.draw();
	}
	isInBoard(position){
		if (position.x < this.position.x-this.format.spacing/2||
			position.y < this.position.y-this.format.spacing/2||
			position.x > this.position.x+(this.size.width-1)*(this.format.spacing+this.format.lineWidth)-this.format.spacing/2||
			position.y > this.position.y+(this.size.height-1)*(this.format.spacing+this.format.lineWidth)-this.format.spacing/2){
			return false;
		}
		return true;
	}
	onClick(position, player){
		if (!this.isInBoard(position)){
			console.log("Out of bound");
			return 1;
		}
		var pos = {
			x: Math.floor((position.x-this.position.x)/this.format.spacing+1/2),
			y: Math.floor((position.y-this.position.y)/this.format.spacing+1/2)
		};
		var res = this.put(pos, player, this.turn);
		if (res==0) {
			if (gid!=-1) {
				socket.emit('put', {
					position: {
						x: pos.x,
						y: pos.y
					}
				});
				lock = !lock;
			}
			this.turn++;
		}
		return res;
	}
	onMouseMove(position, player){
		if (!this.isInBoard(position)){
			return;
		}
		var pos = {
			x: Math.floor((position.x-this.position.x)/this.format.spacing+1/2),
			y: Math.floor((position.y-this.position.y)/this.format.spacing+1/2)
		};
		return this.show(pos, player);
	}
}

class Player {
	constructor(color){
		this.color = color;
	}
}

class Piece {
	constructor(board, position, player, turn){
		this.board = board;
		this.position = position; // {x, y} index on board
		this.owner = player;
		this.turn = turn;
	}
	draw(){
		ctx.setTransform(1, 0, 0, 1, this.board.position.x, this.board.position.y);
		ctx.fillStyle = this.owner.color;
		ctx.beginPath();
		ctx.arc(this.position.x*this.board.format.spacing-this.board.format.lineWidth/2, 
			this.position.y*this.board.format.spacing-this.board.format.lineWidth/2, 
			this.board.format.spacing/2-this.board.format.lineWidth, 0, 2*Math.PI);
		ctx.fill();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
	show(){
		ctx.setTransform(1, 0, 0, 1, this.board.position.x, this.board.position.y);
		ctx.fillStyle = this.owner.color;
		ctx.globalAlpha = 0.5;
		ctx.beginPath();
		ctx.arc(this.position.x*this.board.format.spacing-this.board.format.lineWidth/2, 
			this.position.y*this.board.format.spacing-this.board.format.lineWidth/2, 
			this.board.format.spacing/2-this.board.format.lineWidth, 0, 2*Math.PI);
		ctx.fill();
		ctx.globalAlpha = 1;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
	showLatest(){
		ctx.setTransform(1, 0, 0, 1, this.board.position.x, this.board.position.y);
		ctx.strokeStyle = '#2222BB';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(this.position.x*this.board.format.spacing-this.board.format.lineWidth/2, 
			this.position.y*this.board.format.spacing-this.board.format.lineWidth/2, 
			this.board.format.spacing/2-this.board.format.lineWidth, 0, 2*Math.PI);
		ctx.stroke();
		ctx.lineWidth = 1;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
}


// game canvas
var c = document.getElementById("game");
var ctx = c.getContext("2d");
c.width = "800";
c.height = "800";
c.style.border = "1px solid #DDDDDD";

ctx.fillStyle = "#FFFFFF";
ctx.fillRect(0, 0, 800, 800);

var board = new Board({x:100, y:100}, {width:15, height:15}, {spacing:43, lineWidth:2}, "#AADDAA");
board.draw();

var p1 = new Player("#000000");
var p2 = new Player("#FFFFFF");
//board.put({x:7, y:7}, p1);
//board.put({x:7, y:8}, p2);
ctx.strokeStyle = "#000000";
var lock = false;
var watching = false;

const getMousePos = function (canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
}

c.onclick = function(data, e){
	var p = board.turn%2==0 ? p1 : p2;
	if (!lock)
		board.onClick({x:data.offsetX, y:data.offsetY}, p);	
	board.draw();
}

c.onmousemove = function(data, e){
	if (lock) {
		$('#game').addClass('not-allowed');
		board.draw();
	}
	else {
		$('#game').removeClass('not-allowed');
		board.draw();
		var p = board.turn%2==0 ? p1 : p2;
		board.onMouseMove(getMousePos(c, data), p);
	}
}

const updateBoard = data => {
	console.log('updating');
	if (data.id === gid) {
		lock = data.lock;
		side = data.side;
		board.clearBoard();
		board.id = data.id;
		board.load(data.pieces);
		mySide.classList.remove("black");
		oppoSide.classList.remove("black");
		mySide.classList.remove("white");
		oppoSide.classList.remove("white");
		mySide.classList.remove("blink");
		oppoSide.classList.remove("blink");
		if (!watching && data.players.length > 1) {
			for (let i in data.players) {
				if (data.players[i]!=username) {
					opponent = data.players[i];
					oppoName.innerHTML = opponent;
				}
			}
		} else if (data.players.length<=1) {
			oppoName.innerHTML = "";
		}
		if (side !== 0) {
			if (side === -1) {
				mySide.classList.add("black");
				oppoSide.classList.add("white");
			} else {
				mySide.classList.add("white");
				oppoSide.classList.add("black");
			}
			if (lock) {
				mySide.classList.remove("blink");
				oppoSide.classList.add("blink");
			} else {
				mySide.classList.add("blink");
				oppoSide.classList.remove("blink");
			}
				
		}
		if (data.status !== 0) {
			mySide.classList.remove("blink");
			oppoSide.classList.remove("blink");
			var temp = '';
			if (data.conceder)
				if (data.conceder === username)
					temp += 'You conceded.\n<br />';
				else temp += data.conceder + ' conceded.\n<br />';
			var winner = (data.status === -1) ? 'Black' : 'White';
			alert(temp + winner + ' wins.');
			lock = true;
		}
	}
	if (watching) {
		lock = data.lock;
		board.clearBoard();
		board.id = data.id;
		board.load(data.pieces);
		myName.innerHTML = data.players.shift() || "";
		oppoName.innerHTML = data.players.shift() || "";
		mySide.classList.remove("black");
		oppoSide.classList.remove("black");
		mySide.classList.remove("white");
		oppoSide.classList.remove("white");
		mySide.classList.remove("blink");
		oppoSide.classList.remove("blink");
		var myside = data.sides.shift();
		if (myside === -1) {
			mySide.classList.add("black");
			oppoSide.classList.add("white");
		} else if (myside === 1) {
			mySide.classList.add("white");
			oppoSide.classList.add("black");
		} else {
			mySide.classList.remove("black");
			mySide.classList.remove("white");
			mySide.classList.remove("blink");
			oppoSide.classList.remove("black");
			oppoSide.classList.remove("white");
			oppoSide.classList.remove("blink");
		}
		if ((board.turn%2 === 0 || myside === 1) && (board.turn%2 === 1 || myside === -1)) {
			mySide.classList.add("blink");
			oppoSide.classList.remove("blink");
		} else {
			mySide.classList.remove("blink");
			oppoSide.classList.add("blink");
		}
		if (data.status !== 0) {
			mySide.classList.remove("blink");
			oppoSide.classList.remove("blink");
			var temp = '';
			if (data.conceder)
				temp += data.conceder + ' conceded.\n<br />';
			var winner = (data.status === -1) ? 'Black' : 'White';
			alert(temp + winner + ' wins.');
			lock = true;
		}
	}
	
};

const updateTime = data => {
	var time = data.time;
	if(time < 0) time = 0;
	time = time/1000;
	time = Math.floor(time);
	var min = Math.floor(time/60);
	var sec = time%60;
	if (min < 10) {
		min = '0' + min;
	}
	if (sec < 10) {
		sec = '0' + sec;
	}
	gt.innerHTML = min + ' : ' + sec;
};

// game ui
var uiDiv = document.getElementById("uiDiv");
var myInfo = document.getElementById("myInfo");
var myName = document.getElementById("myName");
var mySide = document.getElementById("mySide");
var oppoInfo = document.getElementById("oppoInfo");
var oppoName = document.getElementById("oppoName");
var oppoSide = document.getElementById("oppoSide");
var gt = document.getElementById("gametime");
var undo = document.getElementById("undo");
var concede = document.getElementById("concede");
var undoremain = document.getElementById("undoremain");
var UNDO_LIMIT = 3;
var undo_remain = UNDO_LIMIT;

var opponent;

undo.onclick = function(data, e){
	if (undo_remain == 0) return;
	confirm("Are you sure you want to undo?", doUndo);
};

const doUndo = () => {
	if (undo_remain > 0) {
		undo_remain--;
		undoremain.innerHTML = undo_remain;
		var turn = board.turn;
		turn -= (lock) ? 0 : 1;
		socket.emit('undo', {});
	}
	if (undo_remain == 0) 
		undoremain.style.backgroundColor = '#DDDDDD';
	
};

concede.onclick = function(data, e){
	confirm("Are you sure you want to concede?", doConcede);
};

const doConcede = () => {
	socket.emit('concede', {});
}

// nav
var navBar = document.getElementsByClassName("navBar")[0];
var usernum = document.getElementById("usernumber");

// dialog
var dialogoverlay = document.getElementById("dialogoverlay");
var dialogbox = document.getElementById("dialogbox");
var head = document.getElementById("dialoghead");
var body = document.getElementById("dialogbody");
var foot = document.getElementById("dialogfoot");

const alert = (msg) => {
	dialogoverlay.style.display = "block";
	dialogbox.style.display = "block";
	dialoghead.innerHTML = "!";
	dialogbody.innerHTML = msg;
	dialogfoot.innerHTML = '<button class="btn btn-primary ok" onclick="ok();">OK</button>';
}

const confirm = (msg, task, b1='YES', b2='NO') => {
	dialogoverlay.style.display = "block";
	dialogbox.style.display = "block";
	dialoghead.innerHTML = "";
	dialogbody.innerHTML = msg;
	dialogfoot.innerHTML = '<button class="btn btn-primary ok" onclick="ok('+task+');">'+b1+'</button>     '
							+ '<button class="btn btn-primary no" onclick="no();">'+b2+'</button>';
}

const ok = (task=foo) => {
	dialogoverlay.style.display = "none";
	dialogbox.style.display = "none";
	task();
	return true;
}

const no = () => {
	dialogoverlay.style.display = "none";
	dialogbox.style.display = "none";
	return false;
}

const foo = () => {};

// chat

var $window = $(window);
var $messages = $('.messages'); // Messages area
var $inputMessage = $('.inputMessage'); // Input message input box
var $chatPage = $('.chat.page'); // The chatroom page

var username;
var connected = false;
var typing = false;
var lastTypingTime;
var $currentInput = $signUpName.focus();

const addParticipantsMessage = (data) => {
	var message = '';
	if (data.numUsers === 1) {
		message += "there's 1 player";
	} else {
		message += "there are " + data.numUsers + " players";
	}
	log(message);
}
// sends a chat message
const sendMessage = () => {
	var message = $inputMessage.val();
	// Prevent markup from being injected into the message
	message = cleanInput(message);
	// if there is a non-empty message and a socket connection
	if (message && connected) {
		$inputMessage.val('');
		addChatMessage({
			username: username,
			message: message
		});
		// tell server to execute 'newMessage' and send along one parameter
		socket.emit('newMessage', message);
	}
}
// prevents input from having injected markup
const cleanInput = (input) => {
	return $('<div/>').text(input).html();
}
// log a message
const log = (message) => {
	var $el = $('<li>').addClass('log').text(message);
	addMessageElement($el);
}
// adds the visual chat message to the message list
const addChatMessage = (data) => {
	
	var $usernameDiv = $('<span class="username"/>')
		.text(data.username)
		.css('color', getUsernameColor(data.username));
	var $messageBodyDiv = $('<span class="messageBody">')
		.text(data.message);

	var typingClass = data.typing ? 'typing' : '';
	var $messageDiv = $('<li class="message"/>')
		.data('username', data.username)
		.addClass(typingClass)
		.append($usernameDiv, $messageBodyDiv);

	addMessageElement($messageDiv);
}
// adds a message element to the messages and scrolls to the bottom
// el - The element to add as a message
// options.fade - If the element should fade-in (default = true)
// options.prepend - If the element should prepend
// all other messages (default = false)
const addMessageElement = (el) => {
	var $el = $(el);
	$messages.append($el);
	$messages[0].scrollTop = $messages[0].scrollHeight;
}

var COLORS = [
	'#e21400', '#91580f', '#f8a700', '#f78b00',
	'#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
	'#3b88eb', '#3824aa', '#a700ff', '#d300e7'
];
// gets the color of a username through our hash function
const getUsernameColor = (username) => {
	// compute hash code
	var hash = 7;
	for (var i = 0; i < username.length; i++) {
		hash = username.charCodeAt(i) + (hash << 5) - hash;
	}
	// calculate color
	var index = Math.abs(hash % COLORS.length);
	return COLORS[index];
}



// keyboard events

$window.keydown(event => {
// auto-focus the current input when a key is typed
	if (!(event.ctrlKey || event.metaKey || event.altKey)) {
		$currentInput.focus();
	}
	// when the client hits ENTER on their keyboard
	if (event.which === 13) {
		if (username) {
			sendMessage();
			typing = false;
		} else {
			//alert("Please join first!");
			signUp();
		}
	}
});


// click events

// focus input when clicking on the message input's border
$inputMessage.click(() => {
	$inputMessage.focus();
	$currentInput = $inputMessage.focus();
});
$signUpName.click(() => {
	$signUpName.focus();
	$currentInput = $signUpName.focus();
});


// socket events

// client
var p = undefined;
var gid = -1;
var side;
socket.on('signUpResponse', (data) => {
	if (data.success){
		$('#signUpDiv').fadeOut('slow');
		$currentInput = $inputMessage.focus();
		navBar.style.display = "inline-block";
		username = data.username;
		connected = true;
		if (data.id !== undefined) {
			gid = data.id;
		}
		if (data.watching){
			watching = true;
			uiDiv.style.display = "inline-block";
		}
		else {
			socket.emit('joinGame');
		}
		log('Welcome to Gomoku');
		setTimeout(function(){
			document.getElementById('chatbtn').click();
		}, 500);
	}
	else {
		alert(data.msg);
	}
});

socket.on('joinGameResponse', (data) => {
	if (data.success){
		myName.innerHTML = username;
		gid = data.id;
		watching = false;
		uiDiv.style.display = "inline-block";
		undo.style.display = "inline-block";
		concede.style.display = "inline-block";
		board.clearBoard();
	}
	else {
		alert(data.msg);
	}
});

socket.on('currentGames', (data) => {
	showRooms(data);
});

socket.on('watchGameResponse', (data) => {
	if (data.success){
		myName.innerHTML = data.players.pop();
		oppoName.innerHTML = data.players.pop() || "";
		uiDiv.style.display = "inline-block";
		undo.style.display = "none";
		concede.style.display = "none";
		board.clearBoard();
		watching = true;
	}
	else {
		alert(data.msg);
	}
});

socket.on('playerJoined', (data) => {
	log(data.username + ' joined.');
});

socket.on('playerDisconnected', (data) => {
	log(data.username + ' disconnected.');
});

socket.on('playerLeft', (data) => {
	log(data.username + ' left.');
});

socket.on('playerReconnected', (data) => {
	log(data.username + ' reconnected.');
});

socket.on('updateBoard', (data) => {
	updateBoard(data);
});

socket.on('updateTime', (data) => {
	updateTime(data);
	usernum.innerHTML = data.num + " online";
});

socket.on('newMessage', (data) => {
	addChatMessage(data);
});

socket.on('err', (data) => {
	alert(data.msg);
});

