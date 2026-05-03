# ⚔️ Word Duel

A fast-paced two-player word chain game playable in the browser. Built with vanilla HTML, CSS, and JavaScript.

🔗 **Live Demo: [wordduels.vercel.app](https://wordduels.vercel.app)**

---

## 🎮 How to Play

- Two players take turns entering words on the same device
- Each word must **start with the last letter** of the previous word
  - Example: `tiger` → `rabbit` → `thorn` → `night`
- You **lose instantly** if you:
  - Use the wrong starting letter
  - Repeat a word that was already played
  - Enter a word that isn't real English
  - Run out of time

---

## ✨ Features

- 🔴 **Countdown timer** — choose 15, 20, 30, or 45 seconds per turn. Bar turns red as time runs low
- 📖 **Dictionary validation** — every word is checked against a real English dictionary API
- 💀 **Instant loss conditions** — wrong letter, repeated word, fake word, or timeout all end the game immediately
- 🎨 **Retro arcade theme** — dark UI with neon colors and glowing effects
- 📜 **Word log** — see every word played, color-coded by player
- 🏆 **Game over screen** — shows winner, final scores, reason for loss, and full word history
- 🔁 **Rematch** — replay instantly without re-entering names

---

## 🛠️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Dictionary | [Free Dictionary API](https://dictionaryapi.dev) |
| Hosting | [Vercel](https://vercel.com) |
| Fonts | [Google Fonts](https://fonts.google.com) — Press Start 2P, VT323 |

---

## 🚀 Run Locally

No build steps needed.

```bash
git clone https://github.com/YOUR_USERNAME/wordduel.git
cd wordduel
```

Then just open `index.html` in any browser.

> ⚠️ The dictionary check requires an internet connection since it calls an external API.

---

## 📁 Project Structure

```
wordduel/
└── index.html    # entire game — markup, styles, and logic in one file
```

---

## 🧠 Origin

This project started as a **Java command-line mini project** for a first-year programming course, then was rebuilt as a browser game. The core game logic is the same. The web version adds a live timer, real-time dictionary validation, and a visual interface.

---

## 🤝 Contributing

Pull requests are welcome! Some ideas for contributions:

- [ ] Single player mode vs a bot
- [ ] Difficulty levels (shorter timer, harder dictionary)
- [ ] Mobile touch improvements
- [ ] Sound effects
- [ ] Leaderboard / high score tracking
- [ ] Custom word categories (only animals, only countries, etc.)

---

## 📜 License

MIT License — free to use, modify, and distribute.

---

<p align="center">⚠️ Made with Claude Sonnet 4.6</p>
