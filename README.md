# ⚔️ Word Duel

A fast-paced **real-time multiplayer** word chain game playable in the browser. Each player plays from their own phone. Built with vanilla HTML, CSS, JavaScript, and Node.js.

🔗 **Live Demo: [wordduels.vercel.app](https://wordduels.vercel.app)**

---

## 🎮 How to Play

- One player creates a room and shares the **5-letter room code**
- The other player joins from their own phone
- Players take turns entering real English words
- Each word must **start with the last letter** of the previous word
  - Example: `tiger` → `rabbit` → `thorn` → `night`
- The game ends when the **timer runs out** — highest score wins
- You **lose points or get eliminated** if you:
  - Use the wrong starting letter
  - Repeat a word that was already played
  - Enter a word that isn't real English
  - Run out of time on your turn

---

## ✨ Features

- 🌐 **Real-time multiplayer** — each player on their own device, synced live via WebSockets
- 🏠 **Room system** — create a room, get a code, share it with your opponent
- ⏱️ **Turn timer** — 10, 15, 20, or 30 seconds per turn. Bar turns red as time runs low
- 🕐 **Game duration** — choose 2, 5, or 10 minutes (or custom). Game ends by score when time runs out
- 🏆 **Points-based scoring** — longer and rarer words score more points
- ☠️ **Two mistake modes** — Elimination (one mistake ends the game) or Penalty (−3 points, game continues)
- 🤝 **Mutual end game** — either player can request to end early; opponent must agree
- 📖 **Dictionary validation** — every word checked against the Datamuse API
- 🎨 **Retro arcade theme** — dark UI with neon colors and glowing effects
- 📜 **Word log** — every word played shown with points, color-coded by player
- 📱 **Mobile friendly** — designed to work on any phone browser

---

## 🏅 Scoring

| Word length | Points |
|---|---|
| 1–3 letters | 1 pt |
| 4 letters | 1 pt |
| 5–6 letters | 2 pts (+1 bonus) |
| 7+ letters | length − 3 + 3 bonus |

Longer words = more points. Use big words to dominate.

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Backend | Node.js + Express + Socket.io |
| Dictionary | [Datamuse API](https://api.datamuse.com) |
| Frontend Hosting | [Vercel](https://vercel.com) |
| Backend Hosting | [Railway](https://railway.app) |
| Fonts | [Google Fonts](https://fonts.google.com) — Press Start 2P, VT323 |

---

## 🚀 Run Locally

### Frontend
No build steps needed — just open the file.

```bash
git clone https://github.com/YOUR_USERNAME/wordduel.git
cd wordduel
```

Open `index.html` in any browser.

### Backend
```bash
cd wordduel
npm install
node server.js
```

Then update `SERVER_URL` in `index.html` to `http://localhost:3001`.

> ⚠️ Multiplayer requires both the frontend and backend to be running. Dictionary checks require an internet connection.

---

## 📁 Project Structure

```
wordduel/
├── index.html     # frontend — markup, styles, and client-side logic
├── server.js      # backend — rooms, game logic, real-time sync
├── package.json   # Node.js dependencies
└── README.md
```

---

## 🧠 Origin

This project started as a **Java command-line mini project** for a first-year programming course, then was rebuilt as a browser game, and then upgraded to full real-time multiplayer. The core game logic is the same across all versions — the web version adds live sync, rooms, a points system, and a visual interface.

The original Java version uses:
- `Scanner` for keyboard input
- `HashSet` to track used words
- `while` loop for the game loop
- Static methods for modular structure

---

## 🤝 Contributing

Pull requests are welcome! Some ideas:

- [ ] More than 2 players per room
- [ ] Spectator mode
- [ ] Single player vs a bot
- [ ] Sound effects
- [ ] Global leaderboard
- [ ] Custom word categories (animals only, countries only, etc.)
- [ ] Rematch without leaving the room

---

## 📜 License

MIT License — free to use, modify, and distribute.

---

<p align="center">⚠️ Made with Claude Sonnet 4.6</p>
