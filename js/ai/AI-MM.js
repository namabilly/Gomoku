const gomoku = require('gomoku');

const directions = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 1], [-1, -1], [0, -1], [-1, 0]];

class AI {
	constructor(name){
		this.g = gomoku.game;
		this.name = name;
		this.init();
	}
	init(){
		this.g.joinGame(this.name);
	}
	run(){
		var that = this;
		var myDelay = 1000;
		var thisDelay = 1000;
		var start = Date.now();
		setTimeout(function(){
			if (that.g.turn%2*2-1===that.g.side) {
				console.log('My turn. Current board score: ' + that.score(that.g.matrix));
				if (that.g.turn===0) {
					that.g.put({
						x: 7,
						y: 7
					})
				}
				else if (that.g.turn===1) {
					var d = directions[Math.floor(Math.random()*8)];
					that.g.put({
						x: 7+d[0],
						y: 7+d[1]
					})
				}
				else {
					//var val = that.score(that.g.matrix);
					//console.log(val);
					var move = that.choose();
					console.log(move);
					that.g.put({x:move.x, y:move.y});
				}
			}
			var actual = Date.now() - start;
			thisDelay = myDelay - (actual - myDelay);
			console.log(thisDelay);
			start = Date.now();
			that.run();
		}, thisDelay);
		
		
	}
	evaluate(side, matrix){
		if (side===0) return 0;
		var val = 0;
		var patterns = {
			op2: 0,
			cl2: 0,
			op3: 0,
			cl3: 0,
			op4: 0,
			cl4: 0,
			op5: 0,
			cl5: 0
		};
		var weights = {
			op2: 10,
			cl2: 1,
			op3: 100,
			cl3: 10,
			op4: 1000,
			cl4: 100,
			op5: 10000,
			cl5: 10000
		};
		var tt = [];
		for (let x=0;x<15;x++) {
			tt[x] = [];
			for (let y=0;y<15;y++) {
				tt[x][y] = true;
			}
		}
		// find patterns
		for (let x=0;x<15;x++) {
			for (let y=0;y<15;y++) {
				if (matrix[x][y]===side) {
					for (let i in directions) {
						var d = directions[i];
						if (matrix[x+d[0]]&&tt[x+d[0]][y+d[1]]&&matrix[x+d[0]][y+d[1]]===side) {
							var len = 2,
								flag = 0,
								xx = x+d[0],
								yy = y+d[1];
							while (matrix[xx+d[0]]&&tt[xx+d[0]][yy+d[1]]&&matrix[xx+d[0]][yy+d[1]]===side) {
								len++;
								xx += d[0];
								yy += d[1];
							}
							if (!matrix[xx+d[0]])
								flag++;
							else if (matrix[xx+d[0]][yy+d[1]]!==0)
								flag++;
							else if (matrix[xx+d[0]*2]&&matrix[xx+d[0]*2][yy+d[1]*2]===side) {
								if (len < 4) {
									len++;
									flag = 'cl';
								}
							}
							//console.log(xx+d[0]+' '+yy+d[1]+' '+matrix[xx+d[0]][yy+d[1]]);
							xx = x;
							yy = y;
							d = directions[7-i];
							while (matrix[xx+d[0]]&&tt[xx+d[0]][yy+d[1]]&&matrix[xx+d[0]][yy+d[1]]===side) {
								len++;
								xx += d[0];
								yy += d[1];
							}
							if (!matrix[xx+d[0]])
								if(flag!=='cl') flag++;
							else if (matrix[xx+d[0]][yy+d[1]]!==0)
								if(flag!=='cl') flag++;
							else if (matrix[xx+d[0]*2]&&matrix[xx+d[0]*2][yy+d[1]*2]===side) {
								if (flag!=='cl'&&len<4) {
									len++;
									flag = 'cl';
								}
							}
							if (flag===0) flag = 'op';
							else if (flag===1) flag = 'cl';
							else continue;
							if (len > 5) len = 5;
							patterns[flag+len]++;
						}
					}
					tt[x][y] = false;
				}
			}
		}
		//console.log(side, patterns);
		// calculate value with weights
		for (let i in patterns) {
			val += patterns[i]*weights[i];
		}
		// adjust value
		if (patterns['op3']+patterns['cl4']>=2) val += 800;
		else {
			if (patterns['op3']>=2) val += 500;
			if (patterns['cl4']>=2) val += 800;  
		}
		return val;
	}
	score(matrix){
		return this.evaluate(this.g.side, matrix) - this.evaluate(-this.g.side, matrix);
	}
	choose(){
		var node = new Node();
		node.level = 0;
		this.counter = 0;
		this.generate(node, this.g.side, 2, this.g.matrix);
		console.log('Node count:' ,this.counter);
		this.minimax(node);
		var val = node.val;
		console.log(val);
		for (let i in node.child) {
			if (node.child[i].val===val)
				return node.child[i].move;
		}
		return val;
	}
	
	minimax(node){
		if (node.child===undefined) return node.val;
		if (node.level%2===0) {
			var v = -Infinity;
			for (let i in node.child) {
				node.child[i].val = this.minimax(node.child[i]);
				if (node.child[i].val > v) {
					v = node.child[i].val;
				}
			}
			node.val = v;
			return v;
		}
		if (node.level%2===1) {
			var v = Infinity;
			for (let i in node.child) {
				node.child[i].val = this.minimax(node.child[i]);
				if (node.child[i].val < v) {
					v = node.child[i].val;
				}
			}
			node.val = v;
			return v;
		}
		return 0;
	}
	generate(node, side, depth, matrix){
		this.counter++;
		if (depth > 0) {
			for (let x=0;x<15;x++) {
				for (let y=0;y<15;y++) {
					if (matrix[x][y]===0) {
						var flag = false;
						for (let i in directions) {
							var d = directions[i];
							if (matrix[x+d[0]]&&matrix[x+d[0]][y+d[1]]&&matrix[x+d[0]][y+d[1]]!==0) {
								flag = true;
								break;
							}
						}
						if (flag===true) {
							matrix[x][y] = side;
							node.addChild(new Node({x:x, y:y, side:side}));
							matrix[x][y] = 0;
						}
					}
				}
			}
		}
		if (depth > 0) {
			for (let i in node.child) {
				this.generate(node.child[i], -side, depth-1, node.child[i].applyMove(matrix));
			}
		}
		if (depth === 0) {
			node.val = this.evaluate(this.g.side, node.applyMove(matrix)) - 
						this.evaluate(-this.g.side, node.applyMove(matrix));
		}
	}
	
}

class Node {
	constructor(move){
		this.val = 0;
		this.move = move;
		this.moves = [move];
		this.level;
		this.child;
		this.parent;
	}
	addChild(node){
		if (this.child===undefined) this.child = [];
		this.child.push(node);
		node.parent = this;
		node.level = this.level+1;
		node.updateMoves;
	}
	updateMoves(){
		this.moves = this.moves.concat(this.parent.moves);
	}
	applyMove(matrix){
		var m = [];
		for (let x=0;x<matrix.length;x++) {
			m[x] = [];
			for (let y=0;y<matrix[0].length;y++) {
				m[x][y] = matrix[x][y];
			}
		}
		m[this.move.x][this.move.y] = this.move.side;
		return m;
	}
	applyMoves(matrix){
		for (let i in this.moves) {
			var m = this.moves[i];
			matrix[m.x][m.y] = m.side;
		}
		return matrix;
	}
}

var ai = new AI('AI-MM');
ai.run();

