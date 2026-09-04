'use strict';

/*
==================================================
RNG VAULT
Version 4.4.0
==================================================
SUPABASE CLOUD SAVES + LOCAL FALLBACK
OPTIMIZED BUILD
==================================================
*/


/* ==================================================
   SUPABASE
================================================== */

const SUPABASE_URL =
    'https://clwbdsfvirozyqhkfmjl.supabase.co';

const SUPABASE_KEY =
    'sb_publishable_BuEhPoAmHKSJtkZjoSh2sw__DCF63z8';

const SUPABASE_CONFIGURED =
    /^https:\/\/[^\s]+$/.test(SUPABASE_URL) &&
    SUPABASE_KEY.length > 20;

let supabaseClient = null;
let currentUser = null;
let cloudSaveTimer = null;


/* ==================================================
   SETTINGS
================================================== */

const STORAGE_KEY = 'rng-vault-v3';
const MAX_NUMBER = 1000000;
const MAX_HISTORY = 60;
const MAX_RARE_HISTORY = 150;


/* ==================================================
   DOM
================================================== */

const $ = id => document.getElementById(id);


/* ==================================================
   RARITIES
================================================== */

const RARITIES = [
    ['TRASH', 0, 99],
    ['COMMON', 100, 999],
    ['UNCOMMON', 1000, 9999],
    ['RARE', 10000, 49999],
    ['EPIC', 50000, 149999],
    ['ANOMALY', 150000, 499999],
    ['MYTHIC', 500000, 799999],
    ['HOLY', 800000, Infinity]
].map(([id, min, max]) => ({
    id,
    label: id,
    min,
    max
}));


const DEFAULT_STATE = {
    version: 4,
    username: 'Guest',
    totalEp: 0,
    totalRolls: 0,
    bestEp: 0,
    bestNumber: null,
    mythics: 0,
    holys: 0,
    anomalies: 0,
    epics: 0,
    rarityCounts: Object.fromEntries(
        RARITIES.map(r => [r.id, 0])
    ),
    foundBadges: {},
    history: [],
    rareHistory: [],
    milestonesClaimed: []
};


let state;
let rollLocked = false;
let autoRunning = false;
let audioContext = null;


/* ==================================================
   STATE
================================================== */

function cloneDefaultState() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
}


function normalizeState(data) {
    const base = cloneDefaultState();

    if (!data || typeof data !== 'object') {
        return base;
    }

    Object.assign(base, data);

    base.version = 4;
    base.username =
        typeof base.username === 'string' &&
        base.username.trim()
            ? base.username
            : 'Guest';

    for (const key of [
        'totalEp',
        'totalRolls',
        'bestEp',
        'mythics',
        'holys',
        'anomalies',
        'epics'
    ]) {
        base[key] = Number(base[key]) || 0;
    }

    if (base.bestNumber !== null) {
        const n = Number(base.bestNumber);
        base.bestNumber = Number.isFinite(n) ? n : null;
    }

    if (!base.rarityCounts ||
        typeof base.rarityCounts !== 'object') {
        base.rarityCounts = {};
    }

    for (const rarity of RARITIES) {
        base.rarityCounts[rarity.id] =
            Number(base.rarityCounts[rarity.id]) || 0;
    }

    if (!base.foundBadges ||
        typeof base.foundBadges !== 'object') {
        base.foundBadges = {};
    }

    for (const key of [
        'history',
        'rareHistory',
        'milestonesClaimed'
    ]) {
        if (!Array.isArray(base[key])) {
            base[key] = [];
        }
    }

    base.history = base.history.slice(0, MAX_HISTORY);
    base.rareHistory =
        base.rareHistory.slice(0, MAX_RARE_HISTORY);

    return base;
}


function loadLocalState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw
            ? normalizeState(JSON.parse(raw))
            : cloneDefaultState();
    } catch (error) {
        console.error('Could not load local save:', error);
        return cloneDefaultState();
    }
}


function saveLocal() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state)
        );
    } catch (error) {
        console.error('Could not save local state:', error);
    }
}


state = loadLocalState();


/* ==================================================
   SUPABASE
================================================== */

function loadSupabaseLibrary() {
    return new Promise(resolve => {
        if (window.supabase) {
            resolve(true);
            return;
        }

        if (!SUPABASE_CONFIGURED) {
            resolve(false);
            return;
        }

        const existing =
            document.querySelector(
                'script[data-rng-vault-supabase]'
            );

        if (existing) {
            existing.addEventListener(
                'load',
                () => resolve(Boolean(window.supabase)),
                { once: true }
            );

            existing.addEventListener(
                'error',
                () => resolve(false),
                { once: true }
            );

            return;
        }

        const script = document.createElement('script');

        script.src =
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

        script.async = true;
        script.dataset.rngVaultSupabase = 'true';

        script.onload = () =>
            resolve(Boolean(window.supabase));

        script.onerror = () => {
            console.error('Could not load Supabase library.');
            resolve(false);
        };

        document.head.appendChild(script);
    });
}


async function initializeSupabase() {
    if (!SUPABASE_CONFIGURED) {
        return false;
    }

    if (supabaseClient) {
        return true;
    }

    if (!await loadSupabaseLibrary()) {
        return false;
    }

    try {
        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_KEY
            );

        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) {
            throw error;
        }

        currentUser =
            data?.session?.user || null;

        supabaseClient.auth.onAuthStateChange(
            async (event, session) => {
                currentUser =
                    session?.user || null;

                if (
                    event === 'SIGNED_IN' &&
                    currentUser
                ) {
                    await loadCloudState();
                }

                updateAuthUI();
            }
        );

        if (currentUser) {
            await loadCloudState();
        }

        return true;
    } catch (error) {
        console.error(
            'Supabase initialization error:',
            error
        );

        supabaseClient = null;
        currentUser = null;

        return false;
    }
}


async function loadCloudState() {
    if (!supabaseClient || !currentUser) {
        return false;
    }

    try {
        const { data, error } =
            await supabaseClient
                .from('game_saves')
                .select('data')
                .eq('user_id', currentUser.id)
                .maybeSingle();

        if (error) {
            throw error;
        }

        if (data?.data) {
            state = normalizeState(data.data);
            saveLocal();
            renderAll();
            return true;
        }

        /*
        New account:
        upload the current local guest save.
        */

        return await saveCloudState();
    } catch (error) {
        console.error(
            'Could not load cloud save:',
            error
        );

        return false;
    }
}


async function saveCloudState() {
    if (!supabaseClient || !currentUser) {
        return false;
    }

    try {
        const { error } =
            await supabaseClient
                .from('game_saves')
                .upsert(
                    {
                        user_id: currentUser.id,
                        data: state,
                        updated_at: new Date().toISOString()
                    },
                    {
                        onConflict: 'user_id'
                    }
                );

        if (error) {
            throw error;
        }

        return true;
    } catch (error) {
        console.error(
            'Could not save cloud state:',
            error
        );

        return false;
    }
}


function queueCloudSave() {
    if (!supabaseClient || !currentUser) {
        return;
    }

    clearTimeout(cloudSaveTimer);

    cloudSaveTimer = setTimeout(
        saveCloudState,
        500
    );
}


async function saveEverything() {
    saveLocal();

    if (supabaseClient && currentUser) {
        await saveCloudState();
    }
}


/* ==================================================
   NUMBER HELPERS
================================================== */

function randomInt(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}


function formatNumber(n) {
    return Number(n).toLocaleString('en-US');
}


const formatEP = formatNumber;


function pad(n) {
    return String(n).padStart(6, '0');
}


function digits(n) {
    return [...pad(n)].map(Number);
}


function digitSum(ds) {
    return ds.reduce((sum, d) => sum + d, 0);
}


function isPalindrome(n) {
    const s = pad(n);
    return s === [...s].reverse().join('');
}


function isPrime(n) {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;

    for (let i = 3; i * i <= n; i += 2) {
        if (n % i === 0) return false;
    }

    return true;
}


function isPower(n, base) {
    if (n < 1) return false;

    while (n % base === 0) {
        n /= base;
    }

    return n === 1;
}


function isFibonacci(n) {
    const square = x => {
        const root = Math.floor(Math.sqrt(x));
        return root * root === x;
    };

    return (
        square(5 * n * n + 4) ||
        square(5 * n * n - 4)
    );
}


function factorial(n) {
    if (n < 0 || n > 10) return null;

    let result = 1;

    for (let i = 2; i <= n; i++) {
        result *= i;
    }

    return result;
}


function productOfDigits(ds) {
    return ds.reduce(
        (product, digit) => product * digit,
        1
    );
}


/* ==================================================
   RARITY
================================================== */

function getRarityFromEP(ep) {
    return (
        RARITIES.find(
            rarity =>
                ep >= rarity.min &&
                ep <= rarity.max
        ) ||
        RARITIES[RARITIES.length - 1]
    );
}


function rollBaseEP() {
    const roll = Math.random();

    if (roll < 0.01) return randomInt(0, 99);
    if (roll < 0.50) return randomInt(100, 999);
    if (roll < 0.75) return randomInt(1000, 9999);
    if (roll < 0.90) return randomInt(10000, 49999);
    if (roll < 0.97) return randomInt(50000, 149999);
    if (roll < 0.999) return randomInt(150000, 499999);
    if (roll < 0.9999) return randomInt(500000, 799999);

    return randomInt(800000, 1000000);
}


/* ==================================================
   BADGES
================================================== */

const badgeDefinitions = [];


function addBadge(id, name, ep, description, test) {
    badgeDefinitions.push({
        id,
        name,
        ep,
        description,
        test
    });
}


/* ---------------- General ---------------- */

[
    ['even', 'Even', 5, 'The number is even', n => n % 2 === 0],
    ['odd', 'Odd', 5, 'The number is odd', n => n % 2 === 1],
    ['prime', 'Prime', 150, 'The number is prime', isPrime],
    ['pal', 'Palindrome', 500, 'Reads the same forwards and backwards', isPalindrome],
    ['repeat', 'Repeating Digit', 100, 'Contains a repeated digit',
        n => new Set(digits(n)).size < 6],

    ['ascending', 'Ascending', 300, 'Digits never decrease',
        n => {
            const d = digits(n);
            return d.every((x, i) => i === 0 || x >= d[i - 1]);
        }],

    ['descending', 'Descending', 300, 'Digits never increase',
        n => {
            const d = digits(n);
            return d.every((x, i) => i === 0 || x <= d[i - 1]);
        }],

    ['neighbors', 'Neighbor Digits', 150, 'Contains two neighboring digits',
        n => {
            const d = digits(n);
            return d.some((x, i) =>
                i > 0 && Math.abs(x - d[i - 1]) === 1
            );
        }],

    ['hetero', 'Heterogeneous', 100, 'Contains at least four different digits',
        n => new Set(digits(n)).size >= 4],

    ['harshad', 'Harshad', 500, 'Divisible by its digit sum',
        n => {
            const sum = digitSum(digits(n));
            return sum > 0 && n % sum === 0;
        }],

    ['square', 'Perfect Square', 1000, 'The number is a perfect square',
        n => {
            const root = Math.floor(Math.sqrt(n));
            return root * root === n;
        }],

    ['power2', 'Power of 2', 1500, 'The number is a power of two',
        n => isPower(n, 2)],

    ['power3', 'Power of 3', 2500, 'The number is a power of three',
        n => isPower(n, 3)],

    ['fibonacci', 'Fibonacci', 1200, 'The number is in the Fibonacci sequence',
        isFibonacci],

    ['factorial', 'Factorial', 3500, 'The number is a factorial',
        n => {
            for (let i = 0; i <= 10; i++) {
                if (factorial(i) === n) return true;
            }
            return false;
        }],

    ['triple', 'Triple Digit', 800, 'Contains three identical digits',
        n => {
            const d = digits(n);
            return d.some((x, i) =>
                i < 4 &&
                x === d[i + 1] &&
                x === d[i + 2]
            );
        }],

    ['quad', 'Quad Digit', 3000, 'Contains four identical digits',
        n => {
            const d = digits(n);
            return d.some((x, i) =>
                i < 3 &&
                x === d[i + 1] &&
                x === d[i + 2] &&
                x === d[i + 3]
            );
        }],

    ['twoPair', 'Two Pair', 700, 'Contains two separate digit pairs',
        n => {
            const counts = {};

            digits(n).forEach(d => {
                counts[d] = (counts[d] || 0) + 1;
            });

            return Object.values(counts)
                .filter(c => c >= 2).length >= 2;
        }],

    ['alternating', 'Alternating', 800, 'Digits alternate between two groups',
        n => {
            const d = digits(n);

            return d.every((x, i) =>
                i === 0 ||
                x % 2 !== d[i - 1] % 2
            );
        }],

    ['spacing', 'Equal Spacing', 1800, 'Digits have equal spacing',
        n => {
            const d = digits(n);
            const diff = d[1] - d[0];

            return d.every((x, i) =>
                i < 2 || x - d[i - 1] === diff
            );
        }]
].forEach(b => addBadge(...b));


/* ---------------- Digit sums ---------------- */

[
    [7, 400],
    [10, 500],
    [15, 700],
    [20, 900],
    [25, 1000],
    [30, 2000],
    [35, 1500],
    [40, 2500],
    [42, 1800],
    [45, 4000]
].forEach(([sum, ep]) =>
    addBadge(
        `sum${sum}`,
        `Digit Sum ${sum}`,
        ep,
        `Digits add to ${sum}`,
        n => digitSum(digits(n)) === sum
    )
);


/* ---------------- Digit patterns ---------------- */

[
    ['lucky13', 'Lucky 13', 700, 'Contains 13', '13'],
    ['contains7', 'Contains 7', 500, 'Contains the digit 7', '7'],
    ['contains69', 'Contains 69', 1200, 'Contains 69', '69'],
    ['contains123', 'Contains 123', 1500, 'Contains 123', '123'],
    ['contains456', 'Contains 456', 1500, 'Contains 456', '456'],
    ['contains789', 'Contains 789', 1500, 'Contains 789', '789'],
    ['contains987', 'Contains 987', 1500, 'Contains 987', '987']
].forEach(([id, name, ep, desc, text]) =>
    addBadge(
        id,
        name,
        ep,
        desc,
        n => pad(n).includes(text)
    )
);


addBadge(
    'sixdigits',
    'Six Digits',
    5,
    'A full six-digit number',
    n => n >= 100000
);

addBadge(
    'fivezeros',
    'Five Zeros',
    5000,
    'Contains five zeros',
    n => digits(n).filter(d => d === 0).length >= 5
);


[
    ['alllow', 'All Low', 1000, 'Every digit is 0–4', d => d <= 4],
    ['allhigh', 'All High', 1000, 'Every digit is 5–9', d => d >= 5],
    ['allEven', 'All Even', 1200, 'Every digit is even', d => d % 2 === 0],
    ['allOdd', 'All Odd', 1200, 'Every digit is odd', d => d % 2 === 1]
].forEach(([id, name, ep, desc, test]) =>
    addBadge(
        id,
        name,
        ep,
        desc,
        n => digits(n).every(test)
    )
);


[
    ['allunique', 'All Unique', 1200, 'Every digit is different', 6],
    ['fourUnique', 'Four Unique', 800, 'Exactly four unique digits', 4],
    ['fiveUnique', 'Five Unique', 1200, 'Exactly five unique digits', 5],
    ['threeunique', 'Three Unique', 100, 'Exactly three unique digits', 3]
].forEach(([id, name, ep, desc, count]) =>
    addBadge(
        id,
        name,
        ep,
        desc,
        n => new Set(digits(n)).size === count
    )
);


/* ---------------- Position patterns ---------------- */

addBadge(
    'center7',
    'Center 7',
    800,
    'Middle digit is 7',
    n => {
        const d = digits(n);
        return d[2] === 7 || d[3] === 7;
    }
);

addBadge(
    'endsame',
    'Matching Ends',
    600,
    'First and last digits match',
    n => {
        const d = digits(n);
        return d[0] === d[5];
    }
);

addBadge(
    'outerequal',
    'Outer Equal',
    1600,
    'Outer digit pairs match',
    n => {
        const d = digits(n);
        return d[0] === d[5] && d[1] === d[4];
    }
);

addBadge(
    'middleequal',
    'Middle Equal',
    1000,
    'Two middle digits match',
    n => {
        const d = digits(n);
        return d[2] === d[3];
    }
);

addBadge(
    'center00',
    'Center Double Zero',
    1500,
    'Middle two digits are 00',
    n => {
        const d = digits(n);
        return d[2] === 0 && d[3] === 0;
    }
);


[
    ['firstnine', 'Starts 9', 500, 'Starts with 9', s => s.startsWith('9')],
    ['lastnine', 'Ends 9', 500, 'Ends with 9', s => s.endsWith('9')],
    ['firstzero', 'Leading Zero', 500, 'Starts with 0', s => s.startsWith('0')],
    ['starts69', 'Starts 69', 2500, 'First two digits are 69', s => s.startsWith('69')],
    ['ends69', 'Ends 69', 2500, 'Last two digits are 69', s => s.endsWith('69')]
].forEach(([id, name, ep, desc, test]) =>
    addBadge(
        id,
        name,
        ep,
        desc,
        n => test(pad(n))
    )
);


/* ---------------- Special digits ---------------- */

[
    ['doublezero', 'Double Zero', 900, 'Contains 00', '00'],
    ['triplezero', 'Triple Zero', 3500, 'Contains 000', '000'],
    ['doublefive', 'Double Five', 800, 'Contains 55', '55'],
    ['doubleeight', 'Double Eight', 800, 'Contains 88', '88'],
    ['doubleone', 'Double One', 800, 'Contains 11', '11']
].forEach(([id, name, ep, desc, text]) =>
    addBadge(
        id,
        name,
        ep,
        desc,
        n => pad(n).includes(text)
    )
);


addBadge(
    'product0',
    'Zero Product',
    50,
    'Digit product is zero',
    n => productOfDigits(digits(n)) === 0
);

addBadge(
    'product1',
    'Product 1',
    1500,
    'Digit product equals 1',
    n => productOfDigits(digits(n)) === 1
);


/* ---------------- Repeating patterns ---------------- */

addBadge(
    'ababab',
    'ABABAB',
    7000,
    'Alternating repeating pair',
    n => {
        const d = digits(n);

        return (
            d[0] === d[2] &&
            d[2] === d[4] &&
            d[1] === d[3] &&
            d[3] === d[5] &&
            d[0] !== d[1]
        );
    }
);

addBadge(
    'mirrorpair',
    'Mirror Pair',
    4000,
    'ABC|CBA style pattern',
    n => {
        const d = digits(n);

        return (
            d[0] === d[5] &&
            d[1] === d[4] &&
            d[2] === d[3]
        );
    }
);

addBadge(
    'stairup',
    'Stair Up',
    7000,
    'Six consecutive ascending digits',
    n => {
        const d = digits(n);
        return d.every((x, i) =>
            i === 0 || x === d[i - 1] + 1
        );
    }
);

addBadge(
    'stairdown',
    'Stair Down',
    7000,
    'Six consecutive descending digits',
    n => {
        const d = digits(n);
        return d.every((x, i) =>
            i === 0 || x === d[i - 1] - 1
        );
    }
);

addBadge(
    'binary',
    'Binary Digits',
    5000,
    'Only contains 0 and 1',
    n => digits(n).every(d => d === 0 || d === 1)
);

addBadge(
    'aabbcc',
    'Double Pair Chain',
    3000,
    'AABBCC pattern',
    n => {
        const d = digits(n);

        return (
            d[0] === d[1] &&
            d[2] === d[3] &&
            d[4] === d[5] &&
            d[0] !== d[2] &&
            d[2] !== d[4]
        );
    }
);

addBadge(
    'twoTriples',
    'Double Triple',
    9000,
    'AAABBB pattern',
    n => {
        const d = digits(n);

        return (
            d[0] === d[1] &&
            d[1] === d[2] &&
            d[3] === d[4] &&
            d[4] === d[5] &&
            d[0] !== d[3]
        );
    }
);

addBadge(
    'firstTriple',
    'First Triple',
    3500,
    'First three digits match',
    n => {
        const d = digits(n);
        return d[0] === d[1] && d[1] === d[2];
    }
);

addBadge(
    'lastTriple',
    'Last Triple',
    3500,
    'Last three digits match',
    n => {
        const d = digits(n);
        return d[3] === d[4] && d[4] === d[5];
    }
);


/* ---------------- Exact numbers ---------------- */

[
    ['exact0', 'Zero', 50000, 0],
    ['exact1', 'One', 30000, 1],
    ['exact2', 'Two', 20000, 2],
    ['exact3', 'Three', 20000, 3],
    ['exact7', 'Seven', 30000, 7],
    ['exact8', 'Eight', 15000, 8],
    ['exact9', 'Nine', 15000, 9],
    ['exact67', 'The 67', 20000, 67],
    ['exact100', '100', 5000, 100],
    ['exact69', '69', 8000, 69],
    ['exact420', '420', 10000, 420],
    ['exact123', '123', 6000, 123],
    ['exact321', '321', 6000, 321],
    ['exact123456', '123456', 500000, 123456],
    ['exact654321', '654321', 500000, 654321],
    ['exact111111', '111111', 300000, 111111],
    ['exact222222', '222222', 280000, 222222],
    ['exact333333', '333333', 280000, 333333],
    ['exact420420', '420420', 450000, 420420],
    ['exact696969', '696969', 650000, 696969],
    ['exact777777', '777777', 700000, 777777],
    ['exact999999', '999999', 740000, 999999],
    ['exact101010', '101010', 350000, 101010],
    ['exact314159', '314159', 350000, 314159],
    ['exact271828', '271828', 350000, 271828],
    ['exact867530', '867530', 300000, 867530],
    ['exact123321', '123321', 250000, 123321],
    ['exact100001', '100001', 220000, 100001],
    ['exact808080', '808080', 250000, 808080]
].forEach(([id, name, ep, number]) =>
    addBadge(
        id,
        name,
        ep,
        `Exactly ${number}`,
        n => n === number
    )
);


/* ---------------- All same ---------------- */

[
    ['allseven', '777777', 100000],
    ['allzero', '000000', 50000],
    ['allnine', '999999', 60000],
    ['alltwo', '222222', 50000],
    ['allthree', '333333', 50000],
    ['allfive', '555555', 50000],
    ['allone', '111111', 50000]
].forEach(([id, name, ep]) =>
    addBadge(
        id,
        name,
        ep,
        `Every digit is ${name[0]}`,
        n => pad(n) === name
    )
);


/* ==================================================
   BADGE ANALYSIS
================================================== */

function getBadges(number) {
    return badgeDefinitions.filter(badge => {
        try {
            return badge.test(number);
        } catch (error) {
            console.error(
                'Badge error:',
                badge.id,
                error
            );

            return false;
        }
    });
}


function analyze(number) {
    const badges = getBadges(number);

    let ep =
        rollBaseEP() +
        badges.reduce(
            (sum, badge) => sum + badge.ep,
            0
        );

    if (Math.random() < 0.01) {
        ep += 50;
    }

    return {
        ep,
        rarity: getRarityFromEP(ep),
        badges
    };
}


function processBadges(badges) {
    const newBadges = [];

    for (const badge of badges) {
        if (state.foundBadges[badge.id]) {
            continue;
        }

        state.foundBadges[badge.id] = {
            name: badge.name,
            ep: badge.ep,
            description: badge.description,
            unlockedAt: Date.now()
        };

        newBadges.push(badge);
    }

    return newBadges;
}


/* ==================================================
   ROLL
================================================== */

async function roll() {
    if (rollLocked) {
        return null;
    }

    rollLocked = true;

    const button = $('rollBtn');

    if (button) {
        button.disabled = true;
    }

    try {
        const number = randomInt(0, MAX_NUMBER);
        const result = analyze(number);
        const newBadges = processBadges(result.badges);
        const rarity = result.rarity.id;

        state.totalRolls++;
        state.totalEp += result.ep;

        if (result.ep > state.bestEp) {
            state.bestEp = result.ep;
            state.bestNumber = number;
        }

        state.rarityCounts[rarity] =
            (state.rarityCounts[rarity] || 0) + 1;

        if (rarity === 'EPIC') state.epics++;
        if (rarity === 'ANOMALY') state.anomalies++;
        if (rarity === 'MYTHIC') state.mythics++;
        if (rarity === 'HOLY') state.holys++;

        const historyEntry = {
            number,
            ep: result.ep,
            rarity,
            badges: result.badges.map(b => b.id),
            time: Date.now()
        };

        state.history.unshift(historyEntry);
        state.history = state.history.slice(0, MAX_HISTORY);

        const rare =
            rarity === 'ANOMALY' ||
            rarity === 'MYTHIC' ||
            rarity === 'HOLY';

        const rarePause =
            rarity === 'MYTHIC' ||
            rarity === 'HOLY';

        if (rare) {
            state.rareHistory.unshift(historyEntry);

            state.rareHistory =
                state.rareHistory.slice(
                    0,
                    MAX_RARE_HISTORY
                );
        }

        renderAll();
        saveLocal();
        queueCloudSave();
        checkMilestones();

        for (const badge of newBadges) {
            showToast(
                'BADGE UNLOCKED',
                `${badge.name}  +${formatEP(badge.ep)} EP`,
                'badge-toast'
            );
        }

        if (rare) {
            showToast(
                rarity + '!',
                `${formatNumber(number)} • ${formatEP(result.ep)} EP`,
                rarity.toLowerCase() + '-toast'
            );

            playRareSound();
        }

        if (rarePause) {
            const flashClass =
                rarity.toLowerCase() + '-flash';

            document.body.classList.add(flashClass);

            await sleep(3000);

            document.body.classList.remove(flashClass);
        }

        return {
            number,
            ep: result.ep,
            rarity: result.rarity,
            badges: result.badges,
            rarePause
        };
    } catch (error) {
        console.error('Roll error:', error);

        showToast(
            'ERROR',
            'Something went wrong while rolling.',
            'error-toast'
        );

        return null;
    } finally {
        rollLocked = false;

        if (button) {
            button.disabled = false;
        }
    }
}


/* ==================================================
   AUTO ROLL
================================================== */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function autoRollLoop() {
    while (autoRunning) {
        const result = await roll();

        if (!autoRunning) {
            break;
        }

        if (result?.rarePause) {
            continue;
        }

        const speed = $('autoSpeed');

        await sleep(
            speed
                ? Number(speed.value) || 500
                : 500
        );
    }
}


function toggleAutoRoll() {
    const button = $('autoBtn');

    autoRunning = !autoRunning;

    if (button) {
        button.textContent =
            `AUTO ROLL: ${autoRunning ? 'ON' : 'OFF'}`;

        button.classList.toggle(
            'active',
            autoRunning
        );
    }

    if (autoRunning) {
        autoRollLoop();
    }
}


/* ==================================================
   MILESTONES
================================================== */

const MILESTONES = [];


function addMilestone(
    id,
    name,
    description,
    reward,
    target,
    getter
) {
    MILESTONES.push({
        id,
        name,
        description,
        reward,
        target,
        progress: getter,
        test: () => getter() >= target
    });
}


const epMilestones = [
    ['ep1000', 'First Thousand', 1000, 1000],
    ['ep5000', 'Warming Up', 5000, 1500],
    ['ep10000', 'Getting Started', 10000, 2500],
    ['ep25000', 'Quarter Century', 25000, 5000],
    ['ep100000', 'Six Figures', 100000, 10000],
    ['ep250000', 'EP Veteran', 250000, 25000],
    ['ep1000000', 'Million EP', 1000000, 50000],
    ['ep2500000', 'EP Tycoon', 2500000, 100000],
    ['ep10000000', 'EP Legend', 10000000, 500000]
];

epMilestones.forEach(([id, name, target, reward]) =>
    addMilestone(
        id,
        name,
        `Earn ${formatNumber(target)} total EP`,
        reward,
        target,
        () => state.totalEp
    )
);


const rollMilestones = [
    ['roll10', 'Getting Lucky', 10, 100],
    ['roll100', 'Roller', 100, 1000],
    ['roll500', 'Persistent', 500, 2500],
    ['roll1000', 'Dedicated', 1000, 5000],
    ['roll2500', 'Grinder', 2500, 10000],
    ['roll10000', 'Machine', 10000, 25000],
    ['roll25000', 'Unstoppable', 25000, 50000],
    ['roll100000', 'Roll Addict', 100000, 150000],
    ['roll500000', 'The Machine', 500000, 500000]
];

rollMilestones.forEach(([id, name, target, reward]) =>
    addMilestone(
        id,
        name,
        `Roll ${formatNumber(target)} times`,
        reward,
        target,
        () => state.totalRolls
    )
);


const badgeMilestones = [
    ['badge1', 'First Discovery', 1, 250],
    ['badge5', 'Collector', 5, 2500],
    ['badge10', 'Explorer', 10, 5000],
    ['badge15', 'Badge Hunter', 15, 7500],
    ['badge25', 'Badge Collector', 25, 15000],
    ['badge30', 'Badge Master', 30, 25000],
    ['badge40', 'Badge Expert', 40, 40000],
    ['badge50', 'Completionist', 50, 75000],
    ['badge60', 'Badge Elite', 60, 100000],
    ['badge75', 'Badge Overlord', 75, 200000]
];

badgeMilestones.forEach(([id, name, target, reward]) =>
    addMilestone(
        id,
        name,
        `Unlock ${formatNumber(target)} badges`,
        reward,
        target,
        () => Object.keys(state.foundBadges).length
    )
);


const rarityMilestones = [
    ['anomaly', 'anomaly1', 'Something Strange', 1, 10000],
    ['anomaly', 'anomaly5', 'Anomaly Seeker', 5, 25000],
    ['anomaly', 'anomaly10', 'Anomaly Hunter', 10, 50000],
    ['anomaly', 'anomaly25', 'Anomaly Master', 25, 200000],
    ['anomaly', 'anomaly50', 'Anomaly Legend', 50, 500000],

    ['mythic', 'mythic1', 'Mythic Discovery', 1, 50000],
    ['mythic', 'mythic5', 'Mythic Seeker', 5, 150000],
    ['mythic', 'mythic10', 'Mythic Hunter', 10, 300000],
    ['mythic', 'mythic25', 'Mythic Master', 25, 1000000],

    ['holy', 'holy1', 'Divine', 1, 250000],
    ['holy', 'holy5', 'Blessed', 5, 500000],
    ['holy', 'holy10', 'Chosen', 10, 1000000],
    ['holy', 'holy25', 'Divine Legend', 25, 5000000]
];


const rarityNames = {
    anomaly: 'Anomalies',
    mythic: 'Mythics',
    holy: 'Holys'
};


rarityMilestones.forEach(
    ([type, id, name, target, reward]) => {
        addMilestone(
            id,
            name,
            `Find ${formatNumber(target)} ${rarityNames[type]}`,
            reward,
            target,
            () => state[type + 's']
        );
    }
);


const bestMilestones = [
    ['best10k', 'Big Roll', 10000, 5000],
    ['best50k', 'Huge Roll', 50000, 25000],
    ['best100k', 'Monster Roll', 100000, 100000],
    ['best250k', 'Massive Roll', 250000, 250000],
    ['best500k', 'Insane Roll', 500000, 500000],
    ['best750k', 'Almost Divine', 750000, 750000],
    ['best1m', 'One Million', 1000000, 1000000]
];

bestMilestones.forEach(([id, name, target, reward]) =>
    addMilestone(
        id,
        name,
        `Get a single roll worth ${formatNumber(target)}+ EP`,
        reward,
        target,
        () => state.bestEp
    )
);


function checkMilestones() {
    let changed = false;

    for (const milestone of MILESTONES) {
        if (
            state.milestonesClaimed.includes(
                milestone.id
            )
        ) {
            continue;
        }

        if (milestone.test()) {
            state.milestonesClaimed.push(
                milestone.id
            );

            changed = true;

            showToast(
                'MILESTONE',
                `${milestone.name}  +${formatEP(milestone.reward)} EP`,
                'milestone-toast'
            );
        }
    }

    if (changed) {
        saveLocal();
        queueCloudSave();
        renderMilestones();
        renderStats();
    }
}


/* ==================================================
   RENDER RESULT
================================================== */

function renderResult() {
    const card = $('resultCard');

    if (!card) return;

    if (!state.history.length) {
        card.className = 'result-card';

        card.innerHTML = `
            <div class="latest-label">LATEST ROLL</div>
            <div class="latest-number">—</div>
            <div class="latest-rarity">NO ROLLS YET</div>
            <div class="latest-ep">0 EP</div>
        `;

        return;
    }

    const result = state.history[0];

    card.className =
        `result-card ${result.rarity.toLowerCase()}`;

    const count = result.badges.length;

    card.innerHTML = `
        <div class="latest-label">LATEST ROLL</div>
        <div class="latest-number">${formatNumber(result.number)}</div>
        <div class="latest-rarity">${result.rarity}</div>
        <div class="latest-ep">${formatEP(result.ep)} EP</div>
        <div class="latest-badges">
            ${count ? `${count} badge${count === 1 ? '' : 's'}` : 'No badges'}
        </div>
    `;
}


/* ==================================================
   RENDER STATS
================================================== */

function renderStats() {
    const values = {
        totalEp: formatEP(state.totalEp),
        totalRolls: formatNumber(state.totalRolls),
        bestEp: formatEP(state.bestEp),
        bestNumber:
            state.bestNumber === null
                ? '—'
                : formatNumber(state.bestNumber),
        badgesFound: formatNumber(
            Object.keys(state.foundBadges).length
        )
    };

    for (const [id, value] of Object.entries(values)) {
        const element = $(id);

        if (element) {
            element.textContent = value;
        }
    }

    const rarityStats = [
        ['anomalyStat', 'ANOMALY', state.anomalies],
        ['mythicStat', 'MYTHIC', state.mythics],
        ['holyStat', 'HOLY', state.holys]
    ];

    for (const [id, label, count] of rarityStats) {
        const element = $(id);

        if (element) {
            element.innerHTML = `
                <span>${label}</span>
                <strong>${formatNumber(count)}</strong>
            `;
        }
    }

    const accountName = $('accountName');

    if (accountName) {
        accountName.textContent = state.username;
    }
}


/* ==================================================
   RENDER RARITIES
================================================== */

function renderRarities() {
    const grid = $('rarityGrid');

    if (!grid) return;

    grid.innerHTML = RARITIES.map(rarity => `
        <div class="rarity-item ${rarity.id.toLowerCase()}">
            <span>${rarity.label}</span>
            <strong>
                ${formatNumber(
                    state.rarityCounts[rarity.id] || 0
                )}
            </strong>
        </div>
    `).join('');
}


/* ==================================================
   RENDER BADGES
================================================== */

function renderBadges() {
    const grid = $('badgeGrid');

    if (!grid) return;

    grid.innerHTML = badgeDefinitions.map(badge => {
        const unlocked =
            Boolean(state.foundBadges[badge.id]);

        return `
            <div class="badge-item ${unlocked ? 'unlocked' : 'locked'}">
                <div class="badge-name">
                    ${unlocked ? '✓ ' : '🔒 '}
                    ${badge.name}
                </div>

                <div class="badge-description">
                    ${badge.description}
                </div>

                <div class="badge-ep">
                    +${formatEP(badge.ep)} EP
                </div>
            </div>
        `;
    }).join('');
}


/* ==================================================
   RENDER MILESTONES
================================================== */

function renderMilestones() {
    const grid = $('milestoneGrid');

    if (!grid) return;

    grid.innerHTML = MILESTONES.map(milestone => {
        const claimed =
            state.milestonesClaimed.includes(
                milestone.id
            );

        const target =
            Number(milestone.target) || 1;

        let current = 0;

        try {
            current =
                Number(milestone.progress()) || 0;
        } catch (error) {
            console.error(
                'Milestone progress error:',
                milestone.id,
                error
            );
        }

        current = Math.max(0, current);

        const percent = claimed
            ? 100
            : Math.min(
                100,
                Math.max(
                    0,
                    current / target * 100
                )
            );

        const progressText = claimed
            ? 'COMPLETED'
            : `${formatNumber(Math.min(current, target))} / ${formatNumber(target)}`;

        return `
            <div class="milestone-item ${claimed ? 'claimed' : 'locked'}">

                <div class="milestone-name">
                    ${claimed ? '✓ ' : '○ '}
                    ${milestone.name}
                </div>

                <div class="milestone-description">
                    ${milestone.description}
                </div>

                <div class="milestone-progress">
                    <div class="milestone-progress-track">
                        <div
                            class="milestone-progress-fill"
                            style="--progress:${percent}%"
                        ></div>
                    </div>

                    <div class="milestone-progress-text">
                        ${progressText}
                    </div>
                </div>

                <div class="milestone-reward">
                    +${formatEP(milestone.reward)} EP
                </div>
            </div>
        `;
    }).join('');
}


/* ==================================================
   RENDER HISTORY
================================================== */

function renderHistory() {
    const list = $('historyList');

    if (!list) return;

    if (!state.history.length) {
        list.innerHTML = `
            <div class="empty-history">
                No rolls yet.
            </div>
        `;

        return;
    }

    list.innerHTML = state.history.map(entry => {
        const badges =
            Array.isArray(entry.badges)
                ? entry.badges.length
                : 0;

        return `
            <div class="history-row ${entry.rarity.toLowerCase()}">
                <div class="history-number">
                    ${formatNumber(entry.number)}
                </div>

                <div class="history-rarity">
                    ${entry.rarity}
                </div>

                <div class="history-ep">
                    ${formatEP(entry.ep)} EP
                </div>

                <div class="history-badges">
                    ${badges} badge${badges === 1 ? '' : 's'}
                </div>

                <div class="history-time">
                    ${new Date(entry.time).toLocaleTimeString()}
                </div>
            </div>
        `;
    }).join('');
}


/* ==================================================
   DETAILS
================================================== */

function openDetails(type) {
    const dialog = $('detailsDialog');
    const title = $('detailsTitle');
    const body = $('detailsBody');

    if (!dialog || !title || !body) {
        return;
    }

    const labels = {
        anomaly: 'ANOMALY HISTORY',
        mythic: 'MYTHIC HISTORY',
        holy: 'HOLY HISTORY'
    };

    const entries =
        state.rareHistory.filter(
            entry => entry.rarity === type.toUpperCase()
        );

    title.textContent = labels[type] || '';

    if (!entries.length) {
        body.innerHTML = `
            <div class="empty-history">
                Nothing found yet.
            </div>
        `;
    } else {
        body.innerHTML =
            entries.slice(0, 50).map(entry => `
                <div class="detail-row">
                    <strong>
                        ${formatNumber(entry.number)}
                    </strong>

                    <span class="${entry.rarity.toLowerCase()}">
                        ${entry.rarity}
                    </span>

                    <span>
                        ${formatEP(entry.ep)} EP
                    </span>
                </div>
            `).join('');
    }

    if (typeof dialog.showModal === 'function') {
        dialog.showModal();
    } else {
        dialog.setAttribute('open', '');
    }
}


/* ==================================================
   TOASTS
================================================== */

function showToast(title, message, className = '') {
    const container = $('toastContainer');

    if (!container) return;

    const toast = document.createElement('div');

    toast.className =
        `toast ${className}`;

    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');

        setTimeout(
            () => toast.remove(),
            300
        );
    }, 3500);
}


/* ==================================================
   AUDIO
================================================== */

function getAudioContext() {
    if (audioContext) {
        return audioContext;
    }

    const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

    if (!AudioContextClass) {
        return null;
    }

    audioContext =
        new AudioContextClass();

    return audioContext;
}


function playRareSound() {
    try {
        const ctx = getAudioContext();

        if (!ctx) return;

        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();

        oscillator.type = 'sine';

        oscillator.frequency.setValueAtTime(
            440,
            ctx.currentTime
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            880,
            ctx.currentTime + 0.25
        );

        gain.gain.setValueAtTime(
            0.0001,
            ctx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.15,
            ctx.currentTime + 0.03
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + 0.5
        );

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start();

        oscillator.stop(
            ctx.currentTime + 0.5
        );
    } catch (error) {
        console.warn(
            'Audio unavailable:',
            error
        );
    }
}


/* ==================================================
   RESET / HISTORY
================================================== */

async function resetStats() {
    if (!window.confirm(
        'Are you sure you want to reset all RNG Vault stats?'
    )) {
        return;
    }

    state = cloneDefaultState();

    saveLocal();
    renderAll();

    await saveCloudState();

    showToast(
        'RESET',
        'All RNG Vault statistics have been reset.',
        'reset-toast'
    );
}


async function clearHistory() {
    if (!window.confirm(
        'Clear your roll history? Your stats will remain.'
    )) {
        return;
    }

    state.history = [];
    state.rareHistory = [];

    saveLocal();
    renderAll();

    await saveCloudState();

    showToast(
        'HISTORY CLEARED',
        'Your roll history was cleared.',
        'reset-toast'
    );
}


/* ==================================================
   AUTH
================================================== */

function getAccountName() {
    return $('accountNameInput')?.value.trim() || '';
}


function getEmail() {
    return $('emailInput')?.value.trim() || '';
}


function getPassword() {
    return $('passwordInput')?.value || '';
}


function updateAuthUI() {
    const signInBtn = $('signInBtn');
    const signUpBtn = $('signUpBtn');
    const signOutBtn = $('signOutBtn');
    const guestBtn = $('guestBtn');
    const status = $('authStatus');

    if (!SUPABASE_CONFIGURED) {
        if (status) {
            status.textContent =
                'Guest mode active. Supabase is not configured.';
        }

        if (signInBtn) signInBtn.disabled = true;
        if (signUpBtn) signUpBtn.disabled = true;
        if (signOutBtn) signOutBtn.disabled = true;

        if (guestBtn) {
            guestBtn.textContent = 'Continue as Guest';
        }

        return;
    }

    if (currentUser) {
        if (status) {
            status.textContent =
                'Cloud account active. Your progress is synced automatically.';
        }

        if (signInBtn) signInBtn.disabled = true;
        if (signUpBtn) signUpBtn.disabled = true;
        if (signOutBtn) {
            signOutBtn.disabled = false;
            signOutBtn.textContent = 'Sign Out';
        }

        if (guestBtn) {
            guestBtn.textContent = 'Continue';
        }

        return;
    }

    if (status) {
        status.textContent =
            'Guest mode active. Your progress is saved locally.';
    }

    if (signInBtn) signInBtn.disabled = false;
    if (signUpBtn) signUpBtn.disabled = false;
    if (signOutBtn) signOutBtn.disabled = true;

    if (guestBtn) {
        guestBtn.textContent = 'Continue as Guest';
    }
}


async function initAuth() {
    updateAuthUI();

    if (!SUPABASE_CONFIGURED) {
        return;
    }

    const initialized =
        await initializeSupabase();

    if (!initialized) {
        const status = $('authStatus');

        if (status) {
            status.textContent =
                'Guest mode active. Could not connect to Supabase.';
        }
    }

    updateAuthUI();
}


function authErrorMessage(error, action) {
    const message =
        String(error?.message || '').toLowerCase();

    if (
        action === 'signin' &&
        (
            message.includes('email not confirmed') ||
            message.includes('email_not_confirmed')
        )
    ) {
        return 'Please confirm your email first, then try signing in again.';
    }

    if (
        action === 'signup' &&
        (
            message.includes('already registered') ||
            message.includes('already been registered') ||
            message.includes('duplicate key') ||
            message.includes('users_email_partial_key')
        )
    ) {
        return 'This email is already registered. Confirm the email if needed, then use Sign In.';
    }

    if (
        action === 'signup' &&
        message.includes('database error saving new user')
    ) {
        return 'This email may already be registered. If you already signed up, confirm your email and use Sign In.';
    }

    if (
        message.includes('invalid login credentials')
    ) {
        return 'Incorrect email or password.';
    }

    return error?.message ||
        `Could not ${action === 'signup' ? 'create the account' : 'sign in'}.`;
}


async function signIn() {
    if (!supabaseClient) {
        showToast(
            'CLOUD ACCOUNT',
            'Supabase is not connected yet.',
            'error-toast'
        );

        return;
    }

    const email = getEmail();
    const password = getPassword();

    if (!email || !password) {
        showToast(
            'SIGN IN',
            'Enter your email and password.',
            'error-toast'
        );

        return;
    }

    const button = $('signInBtn');

    if (button) {
        button.disabled = true;
    }

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            throw error;
        }

        currentUser = data.user;

        /*
        This loads the cloud save after
        authentication succeeds.
        */

        await loadCloudState();

        updateAuthUI();

        showToast(
            'SIGNED IN',
            'Your cloud save has been loaded.',
            'success-toast'
        );
    } catch (error) {
        console.error(
            'Sign in error:',
            error
        );

        showToast(
            'SIGN IN FAILED',
            authErrorMessage(error, 'signin'),
            'error-toast'
        );
    } finally {
        updateAuthUI();
    }
}


async function signUp() {
    if (!supabaseClient) {
        showToast(
            'CLOUD ACCOUNT',
            'Supabase is not connected yet.',
            'error-toast'
        );

        return;
    }

    const accountName = getAccountName();
    const email = getEmail();
    const password = getPassword();

    if (!accountName) {
        showToast(
            'SIGN UP',
            'Enter an account name.',
            'error-toast'
        );

        return;
    }

    if (!email || !password) {
        showToast(
            'SIGN UP',
            'Enter your email and password.',
            'error-toast'
        );

        return;
    }

    if (password.length < 6) {
        showToast(
            'SIGN UP',
            'Password must be at least 6 characters.',
            'error-toast'
        );

        return;
    }

    const button = $('signUpBtn');

    if (button) {
        button.disabled = true;
    }

    try {
        const { data, error } =
            await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: accountName
                    }
                }
            });

        if (error) {
            throw error;
        }

        /*
        IMPORTANT:
        When Supabase email confirmation is enabled,
        signup succeeds but session is NULL.

        We therefore DO NOT treat that as an error,
        and we DO NOT pretend the user is signed in.
        */

        state.username = accountName;
        saveLocal();
        renderStats();

        if (data?.session && data?.user) {
            currentUser = data.user;

            await saveCloudState();

            updateAuthUI();

            showToast(
                'ACCOUNT CREATED',
                'Your account was created and your save is synced.',
                'success-toast'
            );

            return;
        }

        /*
        Email confirmation is required.
        The account exists, but there is no
        authenticated session yet.
        */

        showToast(
            'CHECK YOUR EMAIL',
            'Your account was created. Confirm your email, then use Sign In.',
            'success-toast'
        );
    } catch (error) {
        console.error(
            'Sign up error:',
            error
        );

        showToast(
            'SIGN UP FAILED',
            authErrorMessage(error, 'signup'),
            'error-toast'
        );
    } finally {
        updateAuthUI();
    }
}


async function signOut() {
    if (!supabaseClient || !currentUser) {
        showToast(
            'GUEST MODE',
            'You are already using local guest saving.',
            'success-toast'
        );

        return;
    }

    try {
        await saveCloudState();

        const { error } =
            await supabaseClient.auth.signOut();

        if (error) {
            throw error;
        }

        currentUser = null;

        /*
        Keep the currently loaded state
        locally after signing out.
        */

        saveLocal();
        updateAuthUI();

        showToast(
            'SIGNED OUT',
            'Cloud account disconnected. Local saving is still active.',
            'success-toast'
        );
    } catch (error) {
        console.error(
            'Sign out error:',
            error
        );

        showToast(
            'SIGN OUT FAILED',
            error.message ||
                'Could not sign out.',
            'error-toast'
        );
    }
}


function continueAsGuest() {
    const dialog = $('accountDialog');

    if (dialog) {
        dialog.close();
    }

    showToast(
        'GUEST MODE',
        currentUser
            ? 'Your cloud account remains signed in.'
            : 'Your progress is saved locally.',
        'success-toast'
    );
}


/* ==================================================
   RENDER ALL
================================================== */

function renderAll() {
    renderResult();
    renderStats();
    renderRarities();
    renderBadges();
    renderMilestones();
    renderHistory();
}


/* ==================================================
   INIT
================================================== */

function init() {
    const events = {
        rollBtn: ['click', () => roll()],
        autoBtn: ['click', toggleAutoRoll],
        resetBtn: ['click', resetStats],
        clearHistoryBtn: ['click', clearHistory],

        anomalyStat: [
            'click',
            () => openDetails('anomaly')
        ],

        mythicStat: [
            'click',
            () => openDetails('mythic')
        ],

        holyStat: [
            'click',
            () => openDetails('holy')
        ],

        accountBtn: [
            'click',
            () => $('accountDialog')?.showModal()
        ],

        accountClose: [
            'click',
            () => $('accountDialog')?.close()
        ],

        detailsClose: [
            'click',
            () => $('detailsDialog')?.close()
        ],

        signInBtn: ['click', signIn],
        signUpBtn: ['click', signUp],
        signOutBtn: ['click', signOut],
        guestBtn: ['click', continueAsGuest]
    };

    for (const [id, [event, handler]] of Object.entries(events)) {
        const element = $(id);

        if (element) {
            element.addEventListener(event, handler);
        }
    }

    document.addEventListener('keydown', event => {
        const tag =
            document.activeElement?.tagName;

        if (
            event.code === 'Space' &&
            !event.repeat &&
            !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)
        ) {
            event.preventDefault();

            if (!rollLocked) {
                roll();
            }
        }
    });

    window.addEventListener(
        'beforeunload',
        saveLocal
    );

    renderAll();
    initAuth();
}


if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        init
    );
} else {
    init();
}
