const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.get('/', (_, res) => res.send('WordDuel server running'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const rooms = {};

function makeCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

// ── SCORING ──
function scoreWord(word) {
  const len = word.length;
  let pts = Math.max(0, len - 3);
  if (len >= 7) pts += 3;
  else if (len >= 5) pts += 1;
  return Math.max(1, pts);
}

// ── DICTIONARY — Datamuse API (much more permissive than dictionaryapi.dev) ──
async function isRealWord(word) {
  try {
    // Datamuse returns words that match — if the exact word is in results it's valid
    const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&max=1`);
    if (!res.ok) return true; // fail open
    const data = await res.json();
    // Check the first result is an exact match
    return Array.isArray(data) && data.length > 0 && data[0].word === word;
  } catch {
    return true; // fail open if API down
  }
}

// ── TURN TIMER ──
function clearRoomTimer(room) {
  if (room.timerRef) { clearTimeout(room.timerRef); room.timerRef = null; }
}

function startTurnTimer(room) {
  clearRoomTimer(room);
  if (!room.turnSeconds) return;
  room.timerRef = setTimeout(() => {
    handleMistake(room, room.currentPlayer, 'ran out of time');
  }, room.turnSeconds * 1000);
}

// ── GAME CLOCK (total game duration) ──
function startGameClock(room) {
  if (!room.gameDuration) return; // 0 = no limit
  room.gameEndsAt = Date.now() + room.gameDuration * 1000;
  room.gameClockRef = setTimeout(() => {
    endGameByTime(room);
  }, room.gameDuration * 1000);
}

function clearGameClock(room) {
  if (room.gameClockRef) { clearTimeout(room.gameClockRef); room.gameClockRef = null; }
}

function endGameByTime(room) {
  if (room.phase !== 'playing') return;
  clearRoomTimer(room);
  clearGameClock(room);
  room.phase = 'over';
  const scores = room.players.map(p => ({ name: p.name, score: p.score }));
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  const winner = sorted[0].score === sorted[1].score ? null : sorted[0];
  io.to(room.code).emit('gameOver', {
    reason: "Time's up!",
    winner: winner ? winner.name : null,
    draw: !winner,
    scores,
  });
}

// ── MISTAKE HANDLER ──
function handleMistake(room, loserSocketId, reason) {
  clearRoomTimer(room);
  const loser = room.players.find(p => p.id === loserSocketId);
  if (!loser || room.phase !== 'playing') return;

  if (room.mode === 'elimination') {
    clearGameClock(room);
    room.phase = 'over';
    const winner = room.players.find(p => p.id !== loserSocketId);
    io.to(room.code).emit('gameOver', {
      reason: `${loser.name} ${reason}`,
      winner: winner ? winner.name : '?',
      draw: false,
      scores: room.players.map(p => ({ name: p.name, score: p.score }))
    });
  } else {
    loser.score = Math.max(0, loser.score - 3);
    room.currentPlayer = room.players.find(p => p.id !== loserSocketId)?.id;
    io.to(room.code).emit('penalty', {
      penalisedPlayer: loser.name,
      reason,
      scores: room.players.map(p => ({ name: p.name, score: p.score })),
      currentPlayer: room.currentPlayer,
      lastWord: room.lastWord,
      expectedStart: room.expectedStart,
      gameEndsAt: room.gameEndsAt || null,
    });
    startTurnTimer(room);
  }
}

// ── SOCKET EVENTS ──
io.on('connection', socket => {
  console.log('connect', socket.id);

  // CREATE ROOM
  socket.on('createRoom', ({ name, turnSeconds, gameDuration, mode }) => {
    const code = makeCode();
    rooms[code] = {
      code,
      phase: 'waiting',
      mode: mode || 'elimination',
      turnSeconds: turnSeconds || 15,
      gameDuration: gameDuration || 0, // seconds, 0 = no limit
      players: [{ id: socket.id, name, score: 0 }],
      usedWords: new Set(),
      lastWord: null,
      expectedStart: null,
      currentPlayer: null,
      timerRef: null,
      gameClockRef: null,
      gameEndsAt: null,
      endVotes: new Set(), // tracks who voted to end
    };
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('roomCreated', { code, mode, turnSeconds: rooms[code].turnSeconds, gameDuration: rooms[code].gameDuration });
    console.log(`Room ${code} created by ${name}`);
  });

  // JOIN ROOM
  socket.on('joinRoom', ({ name, code }) => {
    const room = rooms[code.toUpperCase()];
    if (!room) { socket.emit('error', 'Room not found.'); return; }
    if (room.phase !== 'waiting') { socket.emit('error', 'Game already started.'); return; }
    if (room.players.length >= 2) { socket.emit('error', 'Room is full.'); return; }
    if (room.players[0].name.toLowerCase() === name.toLowerCase()) {
      socket.emit('error', 'That name is taken in this room.'); return;
    }
    room.players.push({ id: socket.id, name, score: 0 });
    socket.join(code.toUpperCase());
    socket.data.roomCode = code.toUpperCase();
    room.phase = 'playing';
    room.currentPlayer = room.players[0].id;
    startGameClock(room);
    io.to(room.code).emit('gameStart', {
      players: room.players.map(p => ({ name: p.name, score: p.score, id: p.id })),
      currentPlayer: room.currentPlayer,
      mode: room.mode,
      turnSeconds: room.turnSeconds,
      gameDuration: room.gameDuration,
      gameEndsAt: room.gameEndsAt,
    });
    startTurnTimer(room);
    console.log(`Room ${code} started`);
  });

  // SUBMIT WORD
  socket.on('submitWord', async ({ word: rawWord }) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.phase !== 'playing') return;
    if (room.currentPlayer !== socket.id) { socket.emit('error', 'Not your turn.'); return; }
    const word = rawWord.trim().toLowerCase();
    if (!/^[a-z]+$/.test(word)) { socket.emit('wordError', 'Letters only!'); return; }
    if (room.expectedStart && word[0] !== room.expectedStart) {
      handleMistake(room, socket.id, `used "${word}" — wrong starting letter`); return;
    }
    if (room.usedWords.has(word)) {
      handleMistake(room, socket.id, `repeated "${word}"`); return;
    }
    socket.emit('checking');
    const valid = await isRealWord(word);
    if (!valid) {
      handleMistake(room, socket.id, `"${word}" is not a valid word`); return;
    }
    clearRoomTimer(room);
    const pts = scoreWord(word);
    const player = room.players.find(p => p.id === socket.id);
    player.score += pts;
    room.usedWords.add(word);
    room.lastWord = word;
    room.expectedStart = word[word.length - 1];
    room.currentPlayer = room.players.find(p => p.id !== socket.id)?.id;
    io.to(room.code).emit('wordAccepted', {
      word, pts,
      playedBy: player.name,
      scores: room.players.map(p => ({ name: p.name, score: p.score })),
      currentPlayer: room.currentPlayer,
      expectedStart: room.expectedStart,
      gameEndsAt: room.gameEndsAt || null,
    });
    startTurnTimer(room);
  });

  // GIVE UP
  socket.on('giveUp', () => {
    const room = rooms[socket.data.roomCode];
    if (!room || room.phase !== 'playing') return;
    const name = room.players.find(p => p.id === socket.id)?.name;
    handleMistake(room, socket.id, `${name} gave up`);
  });

  // REQUEST END GAME (mutual agreement)
  socket.on('requestEndGame', () => {
    const room = rooms[socket.data.roomCode];
    if (!room || room.phase !== 'playing') return;
    const requester = room.players.find(p => p.id === socket.id);
    if (!requester) return;
    room.endVotes.add(socket.id);
    // Tell the OTHER player someone wants to end
    const other = room.players.find(p => p.id !== socket.id);
    if (other) {
      io.to(other.id).emit('endGameRequest', { from: requester.name });
    }
  });

  // ACCEPT END GAME
  socket.on('acceptEndGame', () => {
    const room = rooms[socket.data.roomCode];
    if (!room || room.phase !== 'playing') return;
    room.endVotes.add(socket.id);
    if (room.endVotes.size >= 2) {
      endGameByTime(room); // reuse the "end by score" logic
    }
  });

  // DECLINE END GAME
  socket.on('declineEndGame', () => {
    const room = rooms[socket.data.roomCode];
    if (!room) return;
    room.endVotes.clear();
    const decliner = room.players.find(p => p.id === socket.id);
    io.to(room.code).emit('endGameDeclined', { by: decliner?.name });
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;
    clearRoomTimer(room);
    clearGameClock(room);
    if (room.phase === 'playing') {
      const other = room.players.find(p => p.id !== socket.id);
      room.phase = 'over';
      if (other) {
        io.to(code).emit('gameOver', {
          reason: 'Opponent disconnected',
          winner: other.name,
          draw: false,
          scores: room.players.map(p => ({ name: p.name, score: p.score }))
        });
      }
    }
    delete rooms[code];
    console.log(`Room ${code} cleaned up`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`WordDuel server on port ${PORT}`));
