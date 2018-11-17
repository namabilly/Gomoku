// connect
var socket = io();

// sign up
var signUpDiv = document.getElementById("signUpDiv"); 
var signUpName = document.getElementById("signUpName"); 
var signUpButton = document.getElementById("signUpButton"); 
signUpButton.onclick = function(){
	socket.emit('signUp', {name:signUpName.value}); 
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
	}
	draw(){
		ctx.setTransform(1, 0, 0, 1, this.position.x, this.position.y);
		ctx.fillStyle = this.color;
		ctx.fillRect(-60, -60, 720, 720); // arbitary
		ctx.fillStyle = "#FFFFFF";
		ctx.fillRect(-this.format.lineWidth, -this.format.lineWidth, 
			(this.size.width-1)*this.format.spacing+this.format.lineWidth,
			(this.size.height-1)*this.format.spacing+this.format.lineWidth);
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
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
	put(position, player){
		for(var i=0;i<this.pieces.length;i++){
			if(position.x==this.pieces[i].position.x&&position.y==this.pieces[i].position.y){
				console.log("Already exists");
				return 2;
			}
		}
		this.turn++;
		var piece = new Piece(this, position, player, this.turn);
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
		return this.put(pos, player);
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

var turn = 0;

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
}

c.onclick = function(data, e){
	var p = turn%2==0 ? p1 : p2;
	if(board.onClick({x:data.offsetX, y:data.offsetY}, p)==0)
		turn++;
	
}

c.onmousemove = function(data, e){
	board.draw();
	var p = turn%2==0 ? p1 : p2;
	board.onMouseMove(getMousePos(c, data), p);
}

socket.on('news', function (data) {
	console.log(data);
	
});

