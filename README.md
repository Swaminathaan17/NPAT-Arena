# 🎮 NPAT Arena

> **A fast, strategic, offline multiplayer take on the classic Name–Place–Animal–Thing game.**

NPAT Arena transforms the traditional pen-and-paper game into a polished multiplayer experience with **advanced scoring, multiple game modes, challenges, achievements, persistent statistics, and responsive gameplay** — all running locally in the browser.

No backend. No API keys. No accounts. No external services.

Just open the game, add players, choose your rules, and play.

---

## ✨ Features

### 🎯 Flexible Gameplay

* Local multiplayer support
* Custom player setup
* Configurable number of rounds
* Configurable round timer
* Custom categories
* Difficulty configuration
* Three game modes:

  * **Classic**
  * **Speed Round**
  * **Sudden Death**

### 🧠 Smart Answer Validation

* Case-insensitive answer validation
* Duplicate answer detection
* Category conflict detection
* Player answer locking
* Challenge system for questionable answers
* Group voting for challenged answers
* Protected re-scoring to prevent duplicate score changes

### 🏆 Advanced Scoring

NPAT Arena goes beyond simple correct/incorrect scoring.

Scores can include:

* Base answer points
* Speed bonuses
* Unique-answer bonuses
* Streak bonuses
* Tough-letter bonuses
* Rare-category bonuses

Each round provides a detailed score breakdown so players can understand **exactly why they earned their points**.

### 📊 Statistics & Progress

The game keeps track of player performance locally.

Includes:

* Game history
* Player statistics
* Career progress
* Win tracking
* High scores
* Comebacks
* Rank changes
* Round performance
* Final game recap

Game history is stored locally and remains available between sessions.

### 🔊 Immersive Feedback

* Round-start sounds
* Valid-answer feedback
* Movement/gameplay sounds
* Timer urgency sounds
* Achievement sounds
* Tie notifications
* Reduced-motion support

### ⚡ Performance Focused

NPAT Arena is designed to remain responsive even while the timer is running.

Performance optimizations include:

* Isolated timer rendering
* Memoized answer board
* Memoized derived values
* Controlled localStorage writes
* Bounded game-history storage
* No unnecessary dependencies

---

## 🎮 Game Modes

| Mode             | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| **Classic**      | The standard NPAT experience with configurable rounds and timer                  |
| **Speed Round**  | Faster gameplay focused on quick thinking and rapid answers                      |
| **Sudden Death** | Competitive elimination-style gameplay where players fight to survive each round |

---

## 🧮 Scoring System

NPAT Arena uses layered scoring rather than a single fixed score.

| Bonus                   | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| **Base Score**          | Rewards a valid answer                                 |
| **Speed Bonus**         | Rewards answering quickly                              |
| **Uniqueness Bonus**    | Rewards answers that other players did not use         |
| **Streak Bonus**        | Rewards consistent performance across rounds           |
| **Tough Letter Bonus**  | Rewards success with harder starting letters           |
| **Rare Category Bonus** | Rewards difficult or less commonly answered categories |

This creates more strategic gameplay: **speed matters, but so does originality and consistency.**

---

## 🕹️ How to Play

1. Launch NPAT Arena.
2. Add the players.
3. Select the game mode.
4. Configure rounds and timer.
5. Choose categories and difficulty.
6. Start the game.
7. A letter is selected for the round.
8. Players enter answers for each category.
9. Players lock and submit their answers.
10. Answers are reviewed and challenged when necessary.
11. Scores are calculated with bonuses.
12. Standings are updated.
13. Continue until the game ends.
14. Review the final recap, statistics, achievements, and highlights.

---

## 🏗️ Project Structure

```text
NPAT-Arena/
│
├── index.html
├── vite.config.js
├── package.json
├── package-lock.json
├── .gitignore
├── README.md
│
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── styles.css
    │
    ├── components/
    │   ├── Avatar.jsx
    │   ├── Button.jsx
    │   ├── Modal.jsx
    │   ├── RoundTimer.jsx
    │   └── Shell.jsx
    │
    ├── game/
    │   ├── game.js
    │   ├── stats.js
    │   └── validation.js
    │
    ├── utils/
    │   ├── achievements.js
    │   ├── sounds.js
    │   ├── storage.js
    │   └── useTimer.js
    │
    └── tests/
        ├── achievements.test.js
        ├── phase4.test.js
        ├── storage.test.js
        └── validation.test.js
```

### Folder Responsibilities

**`components/`**
Reusable UI components such as buttons, modals, avatars, the application shell, and timer components.

**`game/`**
Core game logic including scoring, validation, statistics, and gameplay rules.

**`utils/`**
Supporting systems such as persistence, sound effects, achievements, and timer utilities.

**`tests/`**
Automated tests covering validation, achievements, storage.

---

## 🛠️ Tech Stack

* **React**
* **Vite**
* **JavaScript**
* **CSS**
* **Web Audio API**
* **localStorage**
* **Node.js test runner**

The application is intentionally client-side and does not require a backend.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Swaminathaan17/NPAT-Arena.git
cd NPAT-Arena
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Open the local URL shown by Vite in your browser.

---

## 🧪 Testing

Run the complete test suite:

```bash
npm test
```

The project currently includes **46 automated tests** covering core game functionality and supporting systems.

---

## 📦 Production Build

Create an optimized production build:

```bash
npm run build
```

The production build has been verified successfully.

---

## 💾 Data & Privacy

NPAT Arena is designed as a completely local experience.

* No account required
* No external API
* No API keys
* No personal data sent to external services

Game history, statistics, settings, and progress are stored using the browser's **localStorage**.

---

## ⚡ Engineering Highlights

NPAT Arena has been developed with a focus on both gameplay and maintainability.

### Performance

* Timer rendering isolated from the main game tree
* Memoized components and derived values
* Stable callbacks
* Controlled persistence

### Reliability

* Idempotent score submission
* Guarded challenge re-scoring
* Safe timer completion handling
* StrictMode-safe game recording
* Deterministic challenge outcomes

### Accessibility

* Responsive layout
* Reduced-motion support
* Keyboard-friendly controls
* Clear answer states
* Visual score feedback
* Accessible modal behavior

---

## 📈 Project Status

**Current status:**

The project has progressed from a basic local NPAT game into a feature-rich multiplayer application with:

* Advanced scoring
* Multiple competitive modes
* Challenge and voting mechanics
* Player statistics
* Career progression
* Achievements
* Persistent game history
* Performance optimizations
* Responsive UI
* Automated testing

---

## 👨‍💻 Author

**Swaminathaan M**
Built as a personal software project to explore **React, game-state architecture, validation systems, local persistence, performance optimization, and interactive UI design**.
---
