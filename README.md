# 🎮 NPAT Arena

> **Real-time multiplayer battles in the classic Name–Place–Animal–Thing game.**

NPAT Arena is a full-stack multiplayer game. Players join a room with a 5-letter code, race the clock to fill answers for **Name · Place · Animal · Thing**, and watch the scores tally server-side — live, on any device.

---

## ✨ Features

- **Online multiplayer** over WebSockets (Socket.IO) — no accounts needed, just a room code.
- **Exactly four categories** — Name, Place, Animal, Thing (no food, drink or jobs).
- **Server-authoritative rules**: rooms, timers, letters, validation, duplicates, scoring and round flow are all owned by the server. Clients never send scores.
- **Exact scoring**:
  - Valid unique answer → **+10**
  - Valid duplicate answer → **+5**
  - Blank / invalid / wrong letter → **+0**
  - Max **40 points per round**
- **Rooms up to 20 players**; the host configures rounds (1–15) and timer (30/60/90 s) and starts each round.
- **Resilient sessions**: reconnect with the same player on any device and rejoin the room; the host role transfers automatically if the host leaves.
- **Round deadline + auto-complete**: a round ends when the timer expires *or* when every connected player has submitted.
- **Recent games** remembered locally in `localStorage`.

---

## 🧮 Scoring

One letter per round, four categories per player. Answers are normalized (case, accents, punctuation, plurals) before comparison.

| Result | Points |
| ------ | ------ |
| Valid answer, no one else used it | **10** |
| Valid answer, shared verbatim after normalization | **5** |
| Blank answer | **0** |
| Doesn't start with the round letter | **0** |
| Not recognized / wrong category | **0** |

Duplicates are always scoped **within a category** — sharing `Tiger` in *Animal* only affects the Animal column.

---

## 🕹️ How to Play

1. Open the app and enter a name on any device.
2. **Create a room** (you become the host) or **join with a 5-letter code**.
3. Host picks rounds and timer, then starts the game.
4. A letter is chosen for the round; everyone sees the same synchronized countdown.
5. Fill all four categories and submit before time runs out.
6. Scores and round results appear immediately for everyone.
7. The host starts the next round; when all rounds finish, the leaderboard crowns a winner.
8. **Play again** or head back to the lobby with the same room.

---

## 🏗️ Project Structure

```text
NPAT-Arena/
├── index.html
├── vite.config.js
├── package.json
│
├── src/                    # React frontend (Vite)
│   ├── App.jsx             # Screens: home, lobby, game, results, final
│   ├── main.jsx
│   ├── styles.css
│   ├── components/         # Avatar, Button, Shell
│   ├── game/
│   │   ├── categories.js   # Exactly Name, Place, Animal, Thing
│   │   ├── validation.js   # Answer validation & normalization
│   │   └── scoring.js      # scoreRound: unique 10 / duplicate 5 / 0
│   ├── net/
│   │   └── socket.js       # Socket.IO client + API URL resolution
│   ├── utils/              # storage, sounds
│   └── tests/              # validation + storage unit tests
│
└── server/                 # Node + Express + Socket.IO backend
    ├── index.js            # Production entry point
    ├── app.js              # createApp(): Express app, Socket.IO wiring
    ├── room.js             # RoomManager, RoomError, in-memory rooms
    ├── room.test.js        # Room manager unit tests
    └── integration.test.js # Multi-client end-to-end flow test
```

### Folder responsibilities

- **`src/game/`** — shared game model. `validation.js` and `scoring.js` are imported by **both** the frontend (live hints) and the server (authoritative scoring).
- **`server/room.js`** — authoritative in-memory room state: players, submissions, rounds, deadlines, scoring, host transfer, idle-room cleanup.
- **`server/app.js`** — Express/Socket.IO wiring and event handlers (`room:create`, `room:join`, `room:settings`, `room:start`, `round:submit`, `round:next`, `room:playAgain`, `room:leave`, `room:state`).

---

## 🛠️ Tech Stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Frontend | React, Vite, Socket.IO client               |
| Backend  | Node.js, Express, Socket.IO                  |
| Tests    | Node.js built-in test runner                 |
| Storage  | `localStorage` (identity + recent games only) |

Deployment targets: **Vercel** (frontend static build) + **Render** (Node server).

---

## 🚀 Local Development

### 1. Clone & install

```bash
git clone https://github.com/Swaminathaan17/NPAT-Arena.git
cd NPAT-Arena
npm install
```

### 2. Run the backend

```bash
npm run dev:server
```

Listens on `http://localhost:3001`.

### 3. Run the frontend

In a second terminal:

```bash
npm run dev
```

The dev client points at `http://localhost:3001` unless `VITE_API_URL` is set:

```bash
# Optional: point the client at a different server
VITE_API_URL=https://your-server.example npm run dev
```

Open the Vite URL and create/join a room — test with two browser windows or devices.

---

## ☁️ Deployment

### Backend (Render / any Node host)

- Build command: `npm install`
- Start command: `npm start` (runs `node server/index.js`)
- Environment:
  - `PORT` (Render injects this automatically)
  - `CORS_ORIGINS` (optional, comma-separated, e.g. `https://npat-arena.vercel.app,http://localhost:5173`; defaults to the Vercel domain + localhost)

The server needs **WebSockets**, so keep it on a platform that supports them (Render free tier does). Expect traffic on **port 3001** by default.

### Frontend (Vercel)

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Environment:
  - `VITE_API_URL` → your backend URL, e.g. `https://npat-arena-server.onrender.com`
  - `VITE_SOCKET_URL` → optional fallback used by `src/net/socket.js` when `VITE_API_URL` is unset

### Env files

Copy `.env.example` and fill in your server URL. `.env` files are git-ignored.

---

## 🧪 Testing

Run the complete suite (unit + room + multi-client integration):

```bash
npm test
```

The **multi-client integration test** boots the real server on an ephemeral port and drives two simulated devices through a full game: create room → join → settings → start → synchronized timer → submit → duplicate scoring → next round → final leaderboard → play again → host handover.

There are currently **44 tests**.

---

## 💾 Data & Privacy

- No accounts, no passwords, no external databases; rooms live in memory on the server and expire when idle.
- The only thing stored on the device is a `localStorage` identity (player id + name + last room code) and a small list of recent games.
- Nothing is sold or logged beyond runtime error reporting.

---

## 👨‍💻 Author

**Swaminathaan M** — built as a personal full-stack project to explore React, Socket.IO, real-time game state, server-authoritative validation and end-to-end testing.