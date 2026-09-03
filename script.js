const STORAGE_KEY = "rng-vault-v2";

const RARITIES = [
  { name: "TRASH", min: 0 },
  { name: "COMMON", min: 100 },
  { name: "UNCOMMON", min: 300 },
  { name: "RARE", min: 800 },
  { name: "EPIC", min: 2000 },
  { name: "ANOMALY", min: 6000 },
  { name: "MYTHIC", min: 15000 }
];

/*
  50 original badges.
  These are NOT copied from a live game's internal scoring.
*/
const BADGE_DEFS = [
  ["single", "Single Digit", 10000],
  ["zero", "Zero", 2500],
  ["even", "Even", 200],
  ["odd", "Odd", 200],
  ["prime", "Prime Number", 1274],
  ["pal", "Palindrome", 500],
  ["repeat", "Repeating Digits", 5000],
  ["asc", "Ascending Sequence", 2500],
  ["desc", "Descending Sequence", 2500],
  ["neighbors", "Neighbors", 350],
  ["echo", "Echo", 1200],
  ["hetero", "Heterogeneous", 593],
  ["harshad", "Harshad", 1048],
  ["spy", "Spy Number", 1030],
  ["fibo", "Fibonacci", 3333],
  ["square", "Perfect Square", 1500],
  ["power2", "Power of Two", 2500],
  ["power3", "Power of Three", 7692],
  ["factorial", "Factorial", 4000],
  ["pair", "Pair", 300],
  ["twopair", "Two Pair", 700],
  ["triple", "Three of a Kind", 900],
  ["quad", "Four of a Kind", 3000],
  ["m69", "Meme 69", 900],
  ["m420", "Meme 420", 900],
  ["seven", "Lucky Seven", 213],
  ["seq123", "123 Sequence", 800],
  ["framed", "Framed", 400],
  ["spacing", "Even Spacing", 700],
  ["answer", "The Answer", 5000],
  ["beast", "Beast Number", 6666],
  ["ultra", "Ultra Lucky", 12000],
  ["double", "Double Double", 1100],
  ["mirror3", "Triple Mirror", 1800],
  ["center", "Center Zero", 700],
  ["endszero", "Zero Ending", 300],
  ["doublezero", "Double Zero", 900],
  ["alllow", "Low Digits", 450],
  ["allhigh", "High Digits", 450],
  ["alternating", "Alternating", 850],
  ["stairs", "Digit Stairs", 1400],
  ["sum10", "Digit Sum 10", 500],
  ["sum20", "Digit Sum 20", 1000],
  ["lucky13", "Lucky 13", 1300],
  ["lucky7", "Lucky 7", 700],
  ["perfect10", "Round Ten", 350],
  ["perfect100", "Century", 1000],
  ["sixdigits", "Six Digits", 111],
  ["fivezeros", "Zero Storm", 3000]
];

let state = loadState();

function $(id) {
  return document.getElementById(id);
}

function defaultState() {
  return {
    username: null,
    totalEp: 0,
    totalRolls: 0,
    bestEp: 0,
    bestNumber: null,
    mythics: 0,
    anomalies: 0,
    epics: 0,
    rarityCounts: Array(7).fill(0),
    foundBadges: [],
    history: []
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return defaultState();
    }

    return {
      ...defaultState(),
      ...JSON.parse(saved)
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );
}

function digits(number) {
  return String(Math.abs(number));
}

function digitSum(s) {
  return [...s].reduce(
    (total, digit) => total + Number(digit),
    0
  );
}

function digitProduct(s) {
  return [...s].reduce(
    (total, digit) => total * Number(digit),
    1
  );
}

function sameDigits(s) {
  return s.length > 1 &&
    /^(\d)\1+$/.test(s);
}

function palindrome(s) {
  return s ===
    s.split("").reverse().join("");
}

function prime(n) {
  if (n < 2) return false;

  if (n === 2) return true;

  if (n % 2 === 0) return false;

  for (
    let i = 3;
    i * i <= n;
    i += 2
  ) {
    if (n % i === 0) {
      return false;
    }
  }

  return true;
}

function fibonacci(n) {
  const square = x =>
    Number.isInteger(Math.sqrt(x));

  return (
    square(5 * n * n + 4) ||
    square(5 * n * n - 4)
  );
}

function perfectSquare(n) {
  return (
    n >= 0 &&
    Number.isInteger(Math.sqrt(n))
  );
}

function powerOf(n, base) {
  if (n < 1) return false;

  while (n % base === 0) {
    n /= base;
  }

  return n === 1;
}

function factorial(n) {
  if (n < 1) return false;

  let value = 1;

  for (
    let i = 2;
    value <= n;
    i++
  ) {
    value *= i;

    if (value === n) {
      return true;
    }
  }

  return false;
}

function ascending(s) {
  if (s.length < 3) return false;

  for (
    let i = 1;
    i < s.length;
    i++
  ) {
    if (
      Number(s[i]) !==
      Number(s[i - 1]) + 1
    ) {
      return false;
    }
  }

  return true;
}

function descending(s) {
  if (s.length < 3) return false;

  for (
    let i = 1;
    i < s.length;
    i++
  ) {
    if (
      Number(s[i]) !==
      Number(s[i - 1]) - 1
    ) {
      return false;
    }
  }

  return true;
}

function neighbors(s) {
  if (s.length < 2) return false;

  for (
    let i = 1;
    i < s.length;
    i++
  ) {
    if (
      Math.abs(
        Number(s[i]) -
        Number(s[i - 1])
      ) !== 1
    ) {
      return false;
    }
  }

  return true;
}

function alternatingParity(s) {
  if (s.length < 3) return false;

  for (
    let i = 1;
    i < s.length;
    i++
  ) {
    if (
      Number(s[i]) % 2 ===
      Number(s[i - 1]) % 2
    ) {
      return false;
    }
  }

  return true;
}

function constantSpacing(s) {
  if (s.length < 3) return false;

  const difference =
    Number(s[1]) -
    Number(s[0]);

  for (
    let i = 2;
    i < s.length;
    i++
  ) {
    if (
      Number(s[i]) -
      Number(s[i - 1]) !==
      difference
    ) {
      return false;
    }
  }

  return true;
}

function countDigits(s) {
  const counts = {};

  for (const digit of s) {
    counts[digit] =
      (counts[digit] || 0) + 1;
  }

  return counts;
}

function getBadgeIds(number) {
  const s = digits(number);
  const counts = countDigits(s);
  const values = Object.values(counts);
  const sum = digitSum(s);

  const ids = [];

  const add = (id, condition) => {
    if (condition) {
      ids.push(id);
    }
  };

  add("single", s.length === 1);
  add("zero", number === 0);

  add("even", number % 2 === 0);
  add("odd", number % 2 !== 0);

  add("prime", prime(number));

  add(
    "pal",
    s.length >= 2 &&
    palindrome(s)
  );

  add(
    "repeat",
    sameDigits(s)
  );

  add("asc", ascending(s));
  add("desc", descending(s));

  add(
    "neighbors",
    neighbors(s)
  );

  add(
    "echo",
    s.length >= 4 &&
    s.length % 2 === 0 &&
    s.slice(0, s.length / 2) ===
    s.slice(s.length / 2)
  );

  add(
    "hetero",
    new Set(s).size === s.length
  );

  add(
    "harshad",
    number > 0 &&
    sum > 0 &&
    number % sum === 0
  );

  add(
    "spy",
    number !== 1 &&
    number !== 2 &&
    sum === digitProduct(s)
  );

  add("fibo", fibonacci(number));
  add("square", perfectSquare(number));

  add(
    "power2",
    powerOf(number, 2)
  );

  add(
    "power3",
    powerOf(number, 3)
  );

  add(
    "factorial",
    factorial(number)
  );

  const pairs =
    values.filter(
      x => x === 2
    ).length;

  add("pair", pairs === 1);
  add("twopair", pairs >= 2);

  add(
    "triple",
    values.some(x => x === 3)
  );

  add(
    "quad",
    values.some(x => x === 4)
  );

  add("m69", s.includes("69"));
  add("m420", s.includes("420"));
  add("seven", s.includes("777"));
  add("seq123", s.includes("123"));

  add(
    "framed",
    s.length >= 3 &&
    s[0] === s[s.length - 1]
  );

  add(
    "spacing",
    constantSpacing(s)
  );

  add("answer", number === 42);
  add("beast", number === 666);
  add("ultra", number === 777777);

  add("double", pairs >= 2);

  add(
    "mirror3",
    s.length === 3 &&
    palindrome(s)
  );

  add(
    "center",
    s.length % 2 === 1 &&
    s[Math.floor(s.length / 2)] === "0"
  );

  add(
    "endszero",
    s.length > 1 &&
    s.endsWith("0")
  );

  add(
    "doublezero",
    s.includes("00")
  );

  add(
    "alllow",
    [...s].every(d => Number(d) <= 4)
  );

  add(
    "allhigh",
    [...s].every(d => Number(d) >= 5)
  );

  add(
    "alternating",
    alternatingParity(s)
  );

  add(
    "stairs",
    ascending(s) ||
    descending(s)
  );

  add("sum10", sum === 10);
  add("sum20", sum === 20);

  add("lucky13", s.includes("13"));
  add("lucky7", s.includes("7"));

  add(
    "perfect10",
    number !== 0 &&
    number % 10 === 0
  );

  add(
    "perfect100",
    number !== 0 &&
    number % 100 === 0
  );

  add(
    "sixdigits",
    s.length === 6
  );

  add(
    "fivezeros",
    (s.match(/0/g) || []).length >= 5
  );

  return ids;
}

function getRarity(ep) {
  let rarity = 0;

  for (
    let i = 0;
    i < RARITIES.length;
    i++
  ) {
    if (
      ep >= RARITIES[i].min
    ) {
      rarity = i;
    }
  }

  return rarity;
}

function analyze(number) {
  const ids =
    getBadgeIds(number);

  const badges =
    BADGE_DEFS.filter(
      badge => ids.includes(badge[0])
    );

  let ep =
    badges.reduce(
      (total, badge) =>
        total + badge[2],
      0
    );

  let effect = "";

  /*
    Offline-only bonus events.
  */

  const luck = Math.random();

  if (luck < 0.001) {

    ep += 25000;

    effect =
      "🌌 COSMIC LUCK — +25,000 bonus EP!";

  } else if (luck < 0.01) {

    ep += 6000;

    effect =
      "⚡ LUCKY BURST — +6,000 bonus EP!";
  }

  if (number === 1) {

    ep += 50000;

    effect =
      "👑 PERFECT ONE — INSANELY LUCKY!";
  }

  const rarity =
    getRarity(ep);

  return {
    number,
    badges,
    ep,
    rarity,
    effect
  };
}

function randomInt(min, max) {
  return Math.floor(
    Math.random() *
    (max - min + 1)
  ) + min;
}

function roll() {
  const min =
    Math.ceil(
      Number($("minNumber").value)
    );

  const max =
    Math.floor(
      Number($("maxNumber").value)
    );

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min > max ||
    min < 0 ||
    max > 1000000
  ) {
    alert(
      "Use a range between 0 and 1,000,000."
    );

    return;
  }

  const result =
    analyze(
      randomInt(min, max)
    );

  state.totalRolls++;
  state.totalEp += result.ep;

  if (
    result.ep >
    state.bestEp
  ) {
    state.bestEp =
      result.ep;

    state.bestNumber =
      result.number;
  }

  state.rarityCounts[
    result.rarity
  ]++;

  if (result.rarity === 6)
    state.mythics++;

  if (result.rarity === 5)
    state.anomalies++;

  if (result.rarity === 4)
    state.epics++;

  for (
    const badge of result.badges
  ) {
    if (
      !state.foundBadges.includes(
        badge[0]
      )
    ) {
      state.foundBadges.push(
        badge[0]
      );
    }
  }

  state.history.unshift({
    number: result.number,
    ep: result.ep,
    rarity: result.rarity,
    badges:
      result.badges.map(
        badge => badge[0]
      )
  });

  state.history =
    state.history.slice(0, 100);

  saveState();

  renderResult(result);
  renderAll();
}

function renderResult(result) {
  $("resultNumber")
    .textContent =
    result.number.toLocaleString();

  $("resultRarity")
    .textContent =
    RARITIES[
      result.rarity
    ].name;

  $("resultRarity")
    .className =
    "rarity";

  $("resultEp")
    .textContent =
    result.ep.toLocaleString() +
    " EP";

  const effect =
    $("resultEffect");

  if (result.effect) {

    effect.textContent =
      result.effect;

    effect.classList.remove(
      "hidden"
    );

  } else {

    effect.classList.add(
      "hidden"
    );
  }
}

function renderStats() {
  $("totalEp")
    .textContent =
    state.totalEp.toLocaleString();

  $("totalRolls")
    .textContent =
    state.totalRolls.toLocaleString();

  $("bestEp")
    .textContent =
    state.bestEp.toLocaleString();

  $("bestNumber")
    .textContent =
    state.bestNumber === null
      ? "—"
      : state.bestNumber.toLocaleString();

  $("mythicCount")
    .textContent =
    state.mythics.toLocaleString();

  $("badgesFound")
    .textContent =
    state.foundBadges.length;
}

function renderRarities() {
  $("rarityStats")
    .innerHTML =
    RARITIES.map(
      (rarity, index) => `
        <div class="rarity-stat">
          <div class="name">
            ${rarity.name}
          </div>

          <div class="count">
            ${state.rarityCounts[index] || 0}
          </div>
        </div>
      `
    ).join("");
}

function renderBadges() {
  $("badgeCountLabel")
    .textContent =
    `${state.foundBadges.length} / ${BADGE_DEFS.length}`;

  $("badgeCollection")
    .innerHTML =
    BADGE_DEFS.map(
      badge => {

        const found =
          state.foundBadges.includes(
            badge[0]
          );

        return `
          <div
            class="badge ${found ? "" : "locked"}"
            title="${found ? "Discovered" : "Not discovered yet"}"
          >
            <span class="badge-name">
              ${found ? "🏅" : "🔒"}
              ${badge[1]}
            </span>

            <span class="badge-ep">
              +${badge[2].toLocaleString()}
            </span>
          </div>
        `;
      }
    ).join("");
}

function renderHistory() {
  if (!state.history.length) {

    $("history").innerHTML =
      `<div class="empty">
        No rolls yet.
      </div>`;

    return;
  }

  $("history").innerHTML =
    state.history.map(
      result => `
        <div class="history-row">

          <strong>
            ${result.number.toLocaleString()}
          </strong>

          <strong>
            ${RARITIES[result.rarity].name}
          </strong>

          <span class="muted">
            ${result.badges.length}
            badge${result.badges.length === 1 ? "" : "s"}
          </span>

          <strong>
            ${result.ep.toLocaleString()} EP
          </strong>

        </div>
      `
    ).join("");
}

function renderAccount() {
  $("accountStatus")
    .textContent =
    state.username
      ? `👤 ${state.username}`
      : "Guest";
}

function renderAll() {
  renderStats();
  renderRarities();
  renderBadges();
  renderHistory();
  renderAccount();
}

function resetStats() {
  if (
    !confirm(
      "Reset all local progress?"
    )
  ) {
    return;
  }

  const username =
    state.username;

  state =
    defaultState();

  state.username =
    username;

  saveState();

  renderAll();

  $("resultNumber")
    .textContent = "—";

  $("resultRarity")
    .textContent = "READY";

  $("resultRarity")
    .className =
    "rarity ready";

  $("resultEp")
    .textContent = "0 EP";

  $("resultEffect")
    .classList.add("hidden");
}

function clearHistory() {
  state.history = [];

  saveState();

  renderHistory();
}


/* =========================
   ACCOUNT
========================= */

function openAccount() {
  const dialog =
    $("authDialog");

  $("usernameInput")
    .value =
    state.username || "";

  $("authMessage")
    .textContent =
    state.username
      ? `Currently signed in locally as ${state.username}.`
      : "No local account set.";

  if (
    typeof dialog.showModal ===
    "function"
  ) {
    dialog.showModal();
  }
}

function saveAccount(event) {
  event.preventDefault();

  const username =
    $("usernameInput")
      .value
      .trim();

  if (!username) {

    $("authMessage")
      .textContent =
      "Enter a username first.";

    return;
  }

  state.username =
    username;

  saveState();
  renderAccount();

  $("authMessage")
    .textContent =
    "Account saved locally.";

  setTimeout(() => {
    $("authDialog").close();
  }, 500);
}

function continueGuest() {
  state.username = null;

  saveState();
  renderAccount();

  $("authDialog").close();
}


/* =========================
   EVENTS
========================= */

$("rollButton")
  .addEventListener(
    "click",
    roll
  );

$("clearButton")
  .addEventListener(
    "click",
    resetStats
  );

$("clearHistoryButton")
  .addEventListener(
    "click",
    clearHistory
  );

$("authButton")
  .addEventListener(
    "click",
    openAccount
  );

$("authForm")
  .addEventListener(
    "submit",
    saveAccount
  );

$("guestButton")
  .addEventListener(
    "click",
    continueGuest
  );

$("closeAuth")
  .addEventListener(
    "click",
    () => $("authDialog").close()
  );

document.addEventListener(
  "keydown",
  event => {

    if (
      event.code === "Space" &&
      document.activeElement.tagName !==
      "INPUT"
    ) {

      event.preventDefault();

      roll();
    }
  }
);


/* Initial render */
renderAll();
