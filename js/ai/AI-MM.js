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
		setTimeout(function(){
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
				var val = that.evaluate(that.g.side, that.g.matrix) - that.evaluate(-that.g.side, that.g.matrix);
				console.log(val);
				var move = that.choose();
				console.log(move);
				
				that.g.put({x:move.x, y:move.y});
			}
			that.run();
		}, 1000);
		
		
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
								flag++;
							else if (matrix[xx+d[0]][yy+d[1]]!==0)
								flag++;
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
	
	
	choose(){
		var matrix = this.g.matrix;
		var max = this.evaluate(this.g.side, matrix) - this.evaluate(-this.g.side, matrix);
		var maxmove = {
			x: 0,
			y: 0
		}
		for (let x=0;x<15;x++) {
			for (let y=0;y<15;y++) {
				if (matrix[x][y]===0) {
					matrix[x][y] = this.g.side;
					var val = this.evaluate(this.g.side, matrix) - this.evaluate(-this.g.side, matrix);
					if (val > max) {
						max = val;
						maxmove.x = x;
						maxmove.y = y;
					}
					matrix[x][y] = 0;
				}
			}
		}
		return maxmove;
	}
	
}

var ai = new AI('AI-MM');
ai.run();

