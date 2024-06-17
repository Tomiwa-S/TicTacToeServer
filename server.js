const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

const PORT = process.env.PORT || 8080;

let games = {};

 const winningCombinations= [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  const checkWinner = (board, invert)=> {
    for (const combination of winningCombinations) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        let className = "";
        if (a === 0 && b === 1 && c === 2) {
        className = "h1";
      } else if (a === 3 && b === 4 && c === 5) {
        className = "h2";
      } else if (a === 6 && b === 7 && c === 8) {
        className = "h3";
      } else if (a === 0 && b === 3 && c === 6) {
        className = "v1";
      } else if (a === 1 && b === 4 && c === 7) {
        className = "v2";
      } else if (a === 2 && b === 5 && c === 8) {
        className = "v3";
      } else if (a === 0 && b === 4 && c === 8) {
        className = "x1";
      } else if (a === 2 && b === 4 && c === 6) {
        className = "x2";
      }
        if(invert){
            if(board[a]=='x'){
                return {winner:'o', className:className};
            }
            return {winner:'x', className:className};
        }
        return {winner:board[a], className:className};
      }
    }
    return false;
  };


io.on('connection', (socket) => {
 

    socket.on('createGame', () => {
        const gameId = generateGameId();
        games[gameId] = {
            players: [socket],
            cell: new Array(9).fill(""),
            isXNext: true,
            x:0,
            o:0
        };
        socket.join(gameId);

        socket.emit('gameCreated', gameId);
    });

    socket.on('joinGame', (gameId) => {
        const game = games[gameId];
        if (game && game.players.length < 2) {
            const {x,o} = games[gameId];
            game.players.push(socket);
            socket.join(gameId);
            io.to(gameId).emit('gameState', {
                cell: game.cell,
                isXNext: game.isXNext,
                x: x??0,
                o:o??0
            });
        } else {
            socket.emit('error', 'Game is full or does not exist');
        }
    });

    socket.on('makeMove', ({ gameId, index, reset=false, invert }) => {
      
        const game = games[gameId];
        let {x, o} = games[gameId] ?? 0;
        if (game) {
            if (game.cell[index] === "" && !reset) {
                game.cell[index] = game.isXNext ? "x":"o";
                game.isXNext = !game.isXNext;
                const winner = checkWinner(game.cell, invert);
                if(winner){
                    if(winner.winner=='x'){
                        games[gameId].x = x+1;
                    }else{
                        games[gameId].o = o+1;
                    }
                }
                io.to(gameId).emit('gameState', {
                    cell: game.cell,
                    isXNext: game.isXNext,
                    checkWinner: winner,
                    reset:false,
                    x: games[gameId].x,
                    o: games[gameId].o
                });
            }
            if(reset){
                game.cell = new Array(9).fill('');
                game.isXNext = !game.isXNext;
                
                io.to(gameId).emit('gameState', {
                    cell: game.cell,
                    isXNext: game.isXNext,
                    checkWinner:false,
                    reset:true,
                    x: games[gameId].x,
                    o: games[gameId].o
                });
            }
        }
    });
    socket.on('skipTurn',(data)=>{
        games[data.gameId].isXNext = data.isXNext;
        io.to(data.gameId).emit('gameState', {
                    cell: new Array(9).fill(""),
                    isXNext: data.isXNext,
                    checkWinner: false,
                    // checkWinner:checkWinner(game.cell),
                    reset:false,
                    x: 0,
                    o: 0
                });
        io.to(data.gameId).emit('turnSkipped')
    })

    socket.on('clear',(info)=>{
        io.to(info.gameId).emit(
            "confirmClear", info.player
        )
    });

    socket.on('changeRules',(info)=>{
        io.to(info.gameId).emit(
            "confirmChange", info.player
        )
    })
    socket.on("changeRulesConfirm",(id)=>{
        io.to(id).emit("rulesChanged");
    })

    socket.on("newGame",(gameId)=>{
        games[gameId] = {
            players: [socket],
            cell: new Array(9).fill(""),
            isXNext: true
        };
        const game = games[gameId];
        io.to(gameId).emit('setNewGame', {
            cell: game.cell,
            isXNext: game.isXNext,
            checkWinner:false
        });
    })
    socket.on("send-message",(data)=>{
        io.to(data.gameId).emit('broadcast',{
            message: data.message,
            host: data.host
        })
    })
    socket.on('disconnect', () => {

        for (const [gameId, game] of Object.entries(games)) {
            game.players = game.players.filter(player => player !== socket);
            if (game.players.length === 0) {
                delete games[gameId];
            }
        }
    });


});

const generateGameId = () =>  Math.random().toString(36).substring(2,9);


server.listen(PORT, '0.0.0.0' () => {
    console.log('listening on *:8080');
});
