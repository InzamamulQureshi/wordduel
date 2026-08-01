const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.get('/', (_, res) => res.send('WordDuel server running'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─────────────────────────────────────────
// ROOMS  { [code]: Room }
// ─────────────────────────────────────────
const rooms = {};

function makeCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

// ─────────────────────────────────────────
// SCORING
// rare English words list (5-letter+ uncommon)
// We use two signals:
//   length  — 1 pt per letter above 3
//   rarity  — bonus if word length >= 7 (+3), >=5 (+1)
// Total max ~15 pts per word
// ─────────────────────────────────────────
function scoreWord(word) {
  const len = word.length;
  let pts = Math.max(0, len - 3);          // 0 for <=3 letters, 1 per extra letter
  if (len >= 7) pts += 3;                  // rarity bonus for long words
  else if (len >= 5) pts += 1;
  return Math.max(1, pts);                 // minimum 1 point
}

// ─────────────────────────────────────────
// DICTIONARY CHECK (free API call from server)
// ─────────────────────────────────────────
async function isRealWord(word) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    return res.ok;
  } catch {
    return true; // fail open if API down
  }
}

// ─────────────────────────────────────────
// TIMER helpers
// ─────────────────────────────────────────
function clearRoomTimer(room) {
  if (room.timerRef) {
    clearTimeout(room.timerRef);
    room.timerRef = null;
  }
}

function startTurnTimer(room) {
  clearRoomTimer(room);
  if (!room.timerSeconds) return;
  room.turnStartedAt = Date.now();
  room.timerRef = setTimeout(() => {
    handleMistake(room, room.currentPlayer, 'timeout');
  }, room.timerSeconds * 1000);
}

// ─────────────────────────────────────────
// MISTAKE handler (elimination or penalty)
// ─────────────────────────────────────────
function handleMistake(room, loserSocketId, reason) {
  clearRoomTimer(room);
  const loser = room.players.find(p => p.id === loserSocketId);
  if (!loser || room.phase !== 'playing') return;

  if (room.mode === 'elimination') {
    // Game over — other player wins
    room.phase = 'over';
    const winner = room.players.find(p => p.id !== loserSocketId);
    io.to(room.code).emit('gameOver', {
      reason,
      loser: loser.name,
      winner: winner ? winner.name : '?',
      scores: room.players.map(p => ({ name: p.name, score: p.score }))
    });
  } else {
    // Penalty mode — deduct 3 pts, switch turn, keep playing
    loser.score = Math.max(0, loser.score - 3);
    room.currentPlayer = room.players.find(p => p.id !== loserSocketId)?.id;
    io.to(room.code).emit('penalty', {
      penalisedPlayer: loser.name,
      reason,
      scores: room.players.map(p => ({ name: p.name, score: p.score })),
      currentPlayer: room.currentPlayer,
      lastWord: room.lastWord,
      expectedStart: room.expectedStart,
    });
    startTurnTimer(room);
  }
}

// ─────────────────────────────────────────
// SOCKET EVENTS
// ─────────────────────────────────────────
io.on('connection', socket => {
  console.log('connect', socket.id);

  // ── CREATE ROOM ──
  socket.on('createRoom', ({ name, timerSeconds, mode }) => {
    const code = makeCode();
    rooms[code] = {
      code,
      phase: 'waiting',       // waiting | playing | over
      mode: mode || 'elimination', // elimination | penalty
      timerSeconds: timerSeconds || 15,
      players: [{ id: socket.id, name, score: 0 }],
      usedWords: new Set(),
      lastWord: null,
      expectedStart: null,
      currentPlayer: null,
      timerRef: null,
      turnStartedAt: null,
    };
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('roomCreated', { code, mode, timerSeconds: rooms[code].timerSeconds });
    console.log(`Room ${code} created by ${name}`);
  });

  // ── JOIN ROOM ──
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

    // Both players in — start the game
    room.phase = 'playing';
    room.currentPlayer = room.players[0].id; // creator goes first

    io.to(room.code).emit('gameStart', {
      players: room.players.map(p => ({ name: p.name, score: p.score, id: p.id })),
      currentPlayer: room.currentPlayer,
      mode: room.mode,
      timerSeconds: room.timerSeconds,
    });

    startTurnTimer(room);
    console.log(`Room ${code} started`);
  });

  // ── SUBMIT WORD ──
  socket.on('submitWord', async ({ word: rawWord }) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.phase !== 'playing') return;
    if (room.currentPlayer !== socket.id) {
      socket.emit('error', 'Not your turn.'); return;
    }

    const word = rawWord.trim().toLowerCase();

    // letters only
    if (!/^[a-z]+$/.test(word)) {
      socket.emit('wordError', 'Letters only!'); return;
    }

    // wrong starting letter → mistake
    if (room.expectedStart && word[0] !== room.expectedStart) {
      handleMistake(room, socket.id, `"${word}" doesn't start with "${room.expectedStart.toUpperCase()}"`);
      return;
    }

    // repeated word → mistake
    if (room.usedWords.has(word)) {
      handleMistake(room, socket.id, `"${word}" was already used`);
      return;
    }

    // dictionary check
    socket.emit('checking'); // tell client to show spinner
    const valid = await isRealWord(word);
    if (!valid) {
      handleMistake(room, socket.id, `"${word}" is not a real word`);
      return;
    }

    // ✅ valid — accept
    clearRoomTimer(room);
    const pts = scoreWord(word);
    const player = room.players.find(p => p.id === socket.id);
    player.score += pts;
    room.usedWords.add(word);
    room.lastWord = word;
    room.expectedStart = word[word.length - 1];
    room.currentPlayer = room.players.find(p => p.id !== socket.id)?.id;

    io.to(room.code).emit('wordAccepted', {
      word,
      pts,
      playedBy: player.name,
      scores: room.players.map(p => ({ name: p.name, score: p.score })),
      currentPlayer: room.currentPlayer,
      expectedStart: room.expectedStart,
    });

    startTurnTimer(room);
  });

  // ── GIVE UP ──
  socket.on('giveUp', () => {
    const room = rooms[socket.data.roomCode];
    if (!room || room.phase !== 'playing') return;
    handleMistake(room, socket.id, `${room.players.find(p=>p.id===socket.id)?.name} gave up`);
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;
    clearRoomTimer(room);
    if (room.phase === 'playing') {
      const other = room.players.find(p => p.id !== socket.id);
      room.phase = 'over';
      if (other) {
        io.to(code).emit('gameOver', {
          reason: 'opponent disconnected',
          winner: other.name,
          loser: room.players.find(p => p.id === socket.id)?.name || '?',
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
