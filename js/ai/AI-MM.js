const gomoku = require('gomoku');

const directions = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 1], [-1, -1], [0, -1], [-1, 0]];

class AI {
	constructor(name){
		this.g = gomoku.game;
		this.name = name;
		this.init();
		this.count = 0;
		this.weights = {
			op2: 10,
			cl2: 1,
			op3: 100,
			cl3: 10,
			op4: 1000,
			cl4: 100,
			op5: 10000,
			cl5: 10000,
			just5: 10000
		};
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
			
			if (that.g.status!==0) {
				//return that.g.status;
				that.g.side = 0;
				that.g.turn = 0;
				that.g.matrix = [];
			}
			if (that.g.turn%2*2-1===that.g.side) {
				console.log('My turn. Current board score: ' + that.score(that.g.matrix));
				if (that.g.turn===0) {
					that.g.put({
						x: 7,
						y: 7
					})
				}
				/*
				else if (that.g.turn===1) {
					var d = directions[Math.floor(Math.random()*8)];
					that.g.put({
						x: 7+d[0],
						y: 7+d[1]
					})
				}
				*/
				else {
					//var val = that.score(that.g.matrix);
					//console.log(val);
					var move = that.choose();
					console.log(move);
					that.g.put({x:move.x, y:move.y});
					that.lastMove = {
						x: move.x,
						y: move.y,
						side: that.g.side
					};
					that.count = 0;
				}
			}
			else {
				var score = that.score(that.g.matrix);
				console.log('Enemy\'s turn. Current board score: ' + score);
				if (that.count < 1 && score >= 800) {
					console.log('^_^');
					gomoku.socket.emit('newMessage', '^_^');
					that.count++;
				}
				if (that.count < 1 && score <= -100) {
					gomoku.socket.emit('concede');
					gomoku.socket.emit('newMessage', 'I had you, it\'s just so that you can play with me more.');
					that.count++;
				}
			}
			
			//that.testminimax();
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
			cl5: 0,
			just5: 0
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
							if (matrix[xx+d[0]]===undefined)
								flag++;
							else if (matrix[xx+d[0]]&&matrix[xx+d[0]][yy+d[1]]===-side)
								flag++;
							else if (!tt[xx+d[0]][yy+d[1]]) {
								continue;
							}
							/*
							else if (matrix[xx+d[0]*2]&&matrix[xx+d[0]*2][yy+d[1]*2]===side) {
								if (len < 4) {
									len++;
									flag = 'cl';
								}
							}
							*/
							//console.log(xx+d[0]+' '+yy+d[1]+' '+matrix[xx+d[0]][yy+d[1]]);
							xx = x;
							yy = y;
							d = directions[7-i];
							while (matrix[xx+d[0]]&&tt[xx+d[0]][yy+d[1]]&&matrix[xx+d[0]][yy+d[1]]===side) {
								len++;
								xx += d[0];
								yy += d[1];
							}
							if (matrix[xx+d[0]]===undefined) {
								if(flag!=='cl') flag++;
							}
							else if (matrix[xx+d[0]]&&matrix[xx+d[0]][yy+d[1]]===-side) {
								if(flag!=='cl') flag++;
							}
							else if (!tt[xx+d[0]][yy+d[1]]) {
								continue;
							}
							/*
							else if (matrix[xx+d[0]*2]&&matrix[xx+d[0]*2][yy+d[1]*2]===side) {
								if (flag!=='cl'&&len<4) {
									len++;
									flag = 'cl';
								}
							}
							*/
							if (len >= 5) {
								patterns['just5']++;
							}
							if (flag===0) flag = 'op';
							else if (flag===1) flag = 'cl';
							else continue;
							if (len > 5) len = 5;
							/*
							if (this.g.turn%2*2-1===-this.g.side) {
								console.log(x, y, flag, len);
							}
							*/
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
			val += patterns[i]*this.weights[i];
		}
		// adjust value
		if (patterns['cl4']>=2) val += 800;
		else if (patterns['op3']>=2) {
			if (patterns['cl4']===1) val += 1000;
			else val += 500;
		}
		else if (patterns['op3']+patterns['cl4']>=2) val += 800;
		if (this.g.turn%2*2-1===-this.g.side || val > 1000) {
			console.log(side, patterns);
		}
		return val;
	}
	score(matrix){
		return this.evaluate(this.g.side, matrix) - this.evaluate(-this.g.side, matrix);
	}
	scoreM(move, matrix){
		return this.scoreP(move, matrix) + this.scoreP({x:move.x, y:move.y, side:-move.side}, matrix);
	}
	scoreP(move, matrix){
		var x = move.x,
			y = move.y,
			side = move.side,
			patterns = {
				op2: 0,
				cl2: 0,
				op3: 0,
				cl3: 0,
				op4: 0,
				cl4: 0,
				op5: 0,
				cl5: 0,
				just5: 0
			};
		for (let i in directions) {
			var d = directions[i],
				xx = x,
				yy = y,
				len = 1,
				flag = 0;
			if (!matrix[xx+d[0]]||matrix[xx+d[0]][yy+d[1]]!==side)
				continue;
			while (matrix[xx+d[0]]&&matrix[xx+d[0]][yy+d[1]]===side) {
				len++;
				xx += d[0];
				yy += d[y];
			}
			if (matrix[xx+d[0]]===undefined) {
				flag++;
			}
			else if (matrix[xx+d[0]][yy+d[1]]===-side) {
				flag++;
			}
			// jump to be added
			
			d = directions[7-i];
			xx = x;
			yy = y;
			while (matrix[xx+d[0]]&&matrix[xx+d[0]][yy+d[1]]===side) {
				len++;
				xx += d[0];
				yy += d[y];
			}
			if (matrix[xx+d[0]]===undefined) {
				flag++;
			}
			else if (matrix[xx+d[0]][yy+d[1]]===-side) {
				flag++;
			}
			if (len >= 5) return 100000;
			if (flag===0) flag = 'op';
			else if (flag===1) flag = 'cl';
			else continue;
			patterns[flag+len]++;
		}
		var val = 0;
		for (let i in patterns) {
			val += patterns[i]*this.weights[i];
		}
		return val;
	}
	choose(){
		/*
		var node = new Node({
			x: 0,
			y: 0,
			side: this.g.matrix[0][0]
		});
		*/
		if (!this.lastMove) {
			this.lastMove = {
				x: 7,
				y: 7,
				side: this.g.matrix[7][7]
			};
		}
		var node = {
			val: 0,
			move: this.lastMove,
			level: 0
		};
		//node.level = 0;
		this.counter = 0;
		var depth = 4;
		//if (this.g.turn >= 16) depth = 3;
		//this.generate(node, this.g.side, depth, this.g.matrix);
		this.minimax(node, depth, -Infinity, Infinity, this.g.matrix);
		console.log('Node count:' ,this.counter);
		var val = node.val;
		console.log(val);
		for (let i in node.child) {
			if (node.child[i].val===val)
				return node.child[i].move;
		}
		return val;
	}
	
	minimax(node, depth, alpha, beta, matrix){
		if (alpha===beta){
			node.val = alpha;
			return alpha;
		}
		if (depth===0) {
			node.val = this.score(matrix);
			return node.val;
		}
		// max
		if (depth%2===1/*node.level%2===0*/) {
			var move = node.move;
			matrix[move.x][move.y] = move.side;
			this.generate(node, this.g.side, depth, matrix);
			var v = alpha;
			for (let i in node.child) {
				node.child[i].val = this.minimax(node.child[i], depth-1, v, beta, matrix);
				if (node.child[i].val > v) {
					v = node.child[i].val;
				}
				if (v >= beta) {
					matrix[move.x][move.y] = 0;
					node.val = beta;
					return beta;
				}
			}
			matrix[move.x][move.y] = 0;
			node.val = v;
			return v;
		}
		// min
		if (depth%2===0/*node.level%2===1*/) {
			var move = node.move;
			matrix[move.x][move.y] = move.side;
			this.generate(node, -this.g.side, depth, matrix);
			var v = beta;
			for (let i in node.child) {
				node.child[i].val = this.minimax(node.child[i], depth-1, alpha, v, matrix);
				if (node.child[i].val < v) {
					v = node.child[i].val;
				}
				if (v <= alpha) {
					matrix[move.x][move.y] = 0;
					node.val = alpha;
					return alpha;
				}
			}
			matrix[move.x][move.y] = 0;
			node.val = v;
			return v;
		}
		return 0;
	}
	generate(node, side, depth, matrix){
		this.counter++;
		//var wl = [];
		if (depth > 0) {
			for (let x=0;x<15;x++) {
				for (let y=0;y<15;y++) {
					if (matrix[x][y]===0) {
						var flag = false;
						for (let i in directions) {
							var d = directions[i];
							/*
							if (x+d[0]===this.lastMove.x&&y+d[1]===this.lastMove.y) {
								if (node.child===undefined) node.child = [];
								node.child.push({
									val: undefined,
									move: {
										x: x,
										y: y,
										side: side
									},
									level: node.level + 1
								});
								break;
							}
							*/
							if (matrix[x+d[0]]&&matrix[x+d[0]][y+d[1]]) {
								flag = true;
								break;
							}
						}
						/*
						if (!flag) continue;
						flag = false;
						for (let i in directions) {
							var d = directions[i];
							if (matrix[x+d[0]]&&matrix[x+d[0]][y+d[1]]===side) {
								flag = true;
								break;
							}
						}
						*/
						if (flag===true) {
							
							var move = {
								x: x,
								y: y,
								side: side
							};
							/*
							var score = this.scoreM(move, matrix);
							if (score < 50){
								console.log(score);
								wl.push(move);
								continue;
							}
							*/
							//console.log(move);
							//matrix[x][y] = side;
							//node.addChild(new Node({x:x, y:y, side:side}));
							if (node.child===undefined) node.child = [];
							node.child.push({
								val: undefined,
								move: {
									x: x,
									y: y,
									side: side
								}//,
								//level: node.level + 1
							});
							//matrix[x][y] = 0;
						}
					}
				}
			}
		}
		/*
		if (!node.child||!node.child.length) {
			node.child = [];
			console.log('here');
			for (let i in wl) {
				node.child.push({
					val: undefined,
					move: wl[i],
					level: node.level + 1
				});
			}
		}
		*/
		
		/*
		var comp = (a, b) => {
			return this.scoreM(a.move, matrix) - this.scoreM(b.move, matrix);
		};
		if (node.level%2===1) comp = -comp;
		node.child.sort(comp);
		/*
		if (depth > 0) {
			for (let i in node.child) {
				this.generate(node.child[i], -side, depth-1, node.child[i].applyMove(matrix));
			}
		}
		if (depth === 0) {
			node.val = this.evaluate(this.g.side, node.applyMove(matrix)) - 
						this.evaluate(-this.g.side, node.applyMove(matrix));
		}
		*/
	}
	
	testminimax(){
		if (!this.lastMove) {
			this.lastMove = {
				x: 0,
				y: 0,
				side: this.g.matrix[0][0]
			};
		}
		var node = {
			val: 0,
			move: this.lastMove,
			level: 0
		};
		this.counter = 0;
		this.minimax(node, 2, -Infinity, Infinity, this.g.matrix);
		console.log(this.counter);
	}
	
}

class Node {
	constructor(move){
		this.val = 0;
		this.move = move;
		//this.moves = [move];
		this.level;
		this.child;
		//this.parent;
	}
	addChild(node){
		if (this.child===undefined) this.child = [];
		this.child.push(node);
		//node.parent = this;
		node.level = this.level+1;
		//node.updateMoves;
	}
	/*
	updateMoves(){
		this.moves = this.moves.concat(this.parent.moves);
	}
	/*
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
	*/
}

var ai = new AI('AI-MM');
ai.run();

