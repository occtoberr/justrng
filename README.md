# ✦ RNG Vault

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
