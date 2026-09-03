# ✦ RNG Vault

RNG Vault is an original random-number simulator focused on collecting badges,
earning EP, finding rare numbers, completing milestones and hunting for
extremely unusual rolls.

## 🌐 Website

The live website is hosted with GitHub Pages:

**https://occtoberr.github.io/justrng/**

## ✨ Features

- Random numbers from 0 to 1,000,000
- Custom minimum and maximum range
- Rarity system
- 100+ collectible badges
- Extremely rare exact-number badges
- Total EP
- Total rolls
- Best EP
- Best number
- Anomaly counter
- Mythic counter
- Clickable Anomaly history
- Clickable Mythic history
- Recent-roll history
- Milestone progression
- Auto Roll
- Spacebar rolling
- Mythic sound effect
- Three-second Mythic pause
- Local progress saving
- Optional cloud accounts
- Cross-device progress through Supabase
- Responsive dark UI
- No external game client required

## 🎯 Collection

RNG Vault is designed around long-term collection.

Some badges are common and can be found quickly.

Others are based on highly specific number patterns or exact numbers, making
them dramatically harder to obtain.

The goal is for completing the entire collection to be a long-term project
rather than something that happens immediately.

## ☁️ Accounts

Guest Mode uses browser localStorage.

Optional accounts use:

- Supabase Auth
- Supabase PostgreSQL
- Row Level Security

When cloud accounts are configured, progress can be loaded on another device
by signing into the same account.

Passwords are handled by Supabase Auth and are never stored inside the
RNG Vault save data.

## 🔐 Security

The browser only needs the Supabase project URL and public/publishable key.

A Supabase secret/service-role key must NEVER be placed inside this project.

The database uses Row Level Security so authenticated users can only access
their own save.

## 🤖 AI Disclosure

This project was created and refined with assistance from AI.

AI assistance was used for:

- HTML structure
- CSS styling
- JavaScript logic
- Badge-system ideas
- UI features
- Cloud-save integration
- Debugging
- Documentation

The project was developed with OpenAI ChatGPT using the
GPT-5.6 Luna model.

The final project was reviewed and adjusted for use as a standalone
GitHub Pages website.

## 📚 Inspiration & Credits

RNG Vault is an original project and is not affiliated with RNGdle.

RNGdle was used as inspiration for the general idea of random-number rarity,
badges and EP-style progression.

Sources consulted during development included:

- RNGdle — official About page
- CubityFirst/rngdle-ep-calculator — public reverse-engineering/reference
  project used for research into RNGdle's publicly observable scoring concepts
- Supabase official documentation — authentication, JavaScript client and
  Row Level Security
- GitHub Pages official documentation

RNG Vault does not use RNGdle's proprietary source code, backend, account
system or daily-roll mechanism.

## ⚠️ Disclaimer

RNG Vault is a standalone simulator.

It does not automate RNGdle, bypass RNGdle's daily limits, interact with
RNGdle's backend, or modify RNGdle.

All rolling in RNG Vault happens locally in the browser.

## 🧩 Version

**RNG Vault v3.0.0**

## 🛠️ Technology

- HTML
- CSS
- JavaScript
- Browser localStorage
- Web Audio API
- Supabase (optional)
- GitHub Pages

## 📄 License

This project can be used and modified for personal projects.

If you redistribute a modified version, keeping the original project
attribution and AI disclosure is appreciated.# ✦ RNG Vault

RNG Vault is an offline/online random-number simulator inspired by
random-number games.

The project contains random number rolling, rarity tiers, EP,
badges, milestones, Mythic/Anomaly history, local saving and
optional online account synchronization.

---

## Features

- Random numbers from 0 to 1,000,000
- Rarity system
- EP system
- Large badge collection
- Extremely rare number-specific badges
- Mythic discoveries
- Anomaly discoveries
- Clickable Mythic history
- Clickable Anomaly history
- Badge collection
- EP milestones
- Recent roll history
- Mythic visual effect
- Mythic sound effect
- 3-second Mythic pause
- Local browser saving
- Online account saving
- Cross-device synchronization
- Email/password authentication

---

## Online Accounts

RNG Vault uses Supabase for:

- Authentication
- Account sessions
- Cloud saves
- Cross-device synchronization

Passwords are handled by Supabase Auth and are not stored
inside RNG Vault's database.

The website only stores the game's save data in the database.

---

## Setup

### 1. Create a Supabase project

Create a Supabase project.

Then open the SQL Editor and run the contents of:

`supabase.sql`

This creates the `game_saves` table and its security policies.

---

### 2. Configure the website

Open:

`script.js`

Find:

```javascript
const SUPABASE_URL =
    "YOUR_SUPABASE_PROJECT_URL";

const SUPABASE_KEY =
    "YOUR_SUPABASE_PUBLISHABLE_KEY";# justrng
just rng
