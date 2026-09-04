'use strict';

/*
==================================================
RNG VAULT
Version 4.1.0
==================================================
*/

const SUPABASE_URL = '';
const SUPABASE_KEY = '';

const SUPABASE_CONFIGURED =
    /^https:\/\/[^\s]+$/.test(SUPABASE_URL) &&
    SUPABASE_KEY.length > 20;

const supabaseClient =
    SUPABASE_CONFIGURED && window.supabase
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        : null;


/* ==================================================
   SETTINGS
================================================== */

const STORAGE_KEY = 'rng-vault-v3';
const MAX_NUMBER = 1000000;
const MAX_HISTORY = 60;
const MAX_RARE_HISTORY = 150;


/* ==================================================
   RARITIES
================================================== */

const RARITIES = [
    {
        id: 'TRASH',
        label: 'TRASH',
        min: 0,
        max: 99
    },
    {
        id: 'COMMON',
        label: 'COMMON',
        min: 100,
        max: 999
    },
    {
        id: 'UNCOMMON',
        label: 'UNCOMMON',
        min: 1000,
        max: 9999
    },
    {
        id: 'RARE',
        label: 'RARE',
        min: 10000,
        max: 49999
    },
    {
        id: 'EPIC',
        label: 'EPIC',
        min: 50000,
        max: 149999
    },
    {
        id: 'ANOMALY',
        label: 'ANOMALY',
        min: 150000,
        max: 499999
    },
    {
        id: 'MYTHIC',
        label: 'MYTHIC',
        min: 500000,
        max: 799999
    },
    {
        id: 'HOLY',
        label: 'HOLY',
        min: 800000,
        max: Infinity
    }
];


/* ==================================================
   DEFAULT STATE
================================================== */

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

    rarityCounts: {
        TRASH: 0,
        COMMON: 0,
        UNCOMMON: 0,
        RARE: 0,
        EPIC: 0,
        ANOMALY: 0,
        MYTHIC: 0,
        HOLY: 0
    },

    foundBadges: {},

    history: [],
    rareHistory: [],

    milestonesClaimed: []
};


let state = loadLocalState();
let rollLocked = false;
let autoRunning = false;
let audioContext = null;
let cloudSaveTimer = null;


/* ==================================================
   DOM HELPERS
================================================== */

function $(id) {
    return document.getElementById(id);
}


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

    if (typeof base.username !== 'string' || !base.username.trim()) {
        base.username = 'Guest';
    }

    base.totalEp = Number(base.totalEp) || 0;
    base.totalRolls = Number(base.totalRolls) || 0;
    base.bestEp = Number(base.bestEp) || 0;

    if (
        base.bestNumber !== null &&
        base.bestNumber !== undefined
    ) {
        const parsedBest = Number(base.bestNumber);

        base.bestNumber = Number.isFinite(parsedBest)
            ? parsedBest
            : null;
    } else {
        base.bestNumber = null;
    }

    base.mythics = Number(base.mythics) || 0;
    base.holys = Number(base.holys) || 0;
    base.anomalies = Number(base.anomalies) || 0;
    base.epics = Number(base.epics) || 0;

    if (!base.rarityCounts || typeof base.rarityCounts !== 'object') {
        base.rarityCounts = {};
    }

    for (const rarity of RARITIES) {
        base.rarityCounts[rarity.id] =
            Number(base.rarityCounts[rarity.id]) || 0;
    }

    if (!base.foundBadges || typeof base.foundBadges !== 'object') {
        base.foundBadges = {};
    }

    if (!Array.isArray(base.history)) {
        base.history = [];
    }

    if (!Array.isArray(base.rareHistory)) {
        base.rareHistory = [];
    }

    if (!Array.isArray(base.milestonesClaimed)) {
        base.milestonesClaimed = [];
    }

    base.history = base.history.slice(0, MAX_HISTORY);
    base.rareHistory = base.rareHistory.slice(0, MAX_RARE_HISTORY);

    return base;
}


function loadLocalState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return cloneDefaultState();
        }

        return normalizeState(JSON.parse(raw));
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


/* ==================================================
   CLOUD SAVE
================================================== */

function scheduleCloudSave() {
    if (!supabaseClient) {
        return;
    }

    clearTimeout(cloudSaveTimer);

    cloudSaveTimer = setTimeout(function () {
        saveCloud();
    }, 1000);
}


async function saveCloud() {
    if (!supabaseClient) {
        return;
    }

    try {
        const result = await supabaseClient.auth.getUser();

        if (!result || !result.data || !result.data.user) {
            return;
        }

        const user = result.data.user;

        await supabaseClient
            .from('game_saves')
            .upsert({
                user_id: user.id,
                data: state,
                updated_at: new Date().toISOString()
            });
    } catch (error) {
        console.error('Cloud save failed:', error);
    }
}


async function loadCloud() {
    if (!supabaseClient) {
        return;
    }

    try {
        const result = await supabaseClient.auth.getUser();

        if (!result || !result.data || !result.data.user) {
            return;
        }

        const user = result.data.user;

        const response = await supabaseClient
            .from('game_saves')
            .select('data')
            .eq('user_id', user.id)
            .maybeSingle();

        if (
            response &&
            response.data &&
            response.data.data
        ) {
            state = normalizeState(response.data.data);
            saveLocal();
            renderAll();
        }
    } catch (error) {
        console.error('Cloud load failed:', error);
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


function formatNumber(number) {
    return Number(number).toLocaleString('en-US');
}


function formatEP(ep) {
    return Number(ep).toLocaleString('en-US');
}


function pad(number) {
    return String(number).padStart(6, '0');
}


function digits(number) {
    return pad(number)
        .split('')
        .map(function (digit) {
            return Number(digit);
        });
}


function digitSum(ds) {
    return ds.reduce(function (sum, digit) {
        return sum + digit;
    }, 0);
}


function isPalindrome(value) {
    const str = pad(value);

    return str === str.split('').reverse().join('');
}


function isPrime(number) {
    if (number < 2) {
        return false;
    }

    if (number === 2) {
        return true;
    }

    if (number % 2 === 0) {
        return false;
    }

    for (
        let i = 3;
        i * i <= number;
        i += 2
    ) {
        if (number % i === 0) {
            return false;
        }
    }

    return true;
}


function isPower(number, base) {
    if (number < 1) {
        return false;
    }

    let value = number;

    while (value % base === 0) {
        value /= base;
    }

    return value === 1;
}


function isFibonacci(number) {
    function isSquare(value) {
        const root = Math.floor(Math.sqrt(value));
        return root * root === value;
    }

    return (
        isSquare(5 * number * number + 4) ||
        isSquare(5 * number * number - 4)
    );
}


function factorial(n) {
    if (n < 0 || n > 10) {
        return null;
    }

    let result = 1;

    for (let i = 2; i <= n; i++) {
        result *= i;
    }

    return result;
}


function productOfDigits(ds) {
    if (!ds.length) {
        return 0;
    }

    return ds.reduce(function (product, digit) {
        return product * digit;
    }, 1);
}


/* ==================================================
   RARITY
================================================== */

function getRarityFromEP(ep) {
    for (const rarity of RARITIES) {
        if (
            ep >= rarity.min &&
            ep <= rarity.max
        ) {
            return rarity;
        }
    }

    return RARITIES[RARITIES.length - 1];
}


/* ==================================================
   BALANCED BASE EP
================================================== */

function rollBaseEP() {
    const roll = Math.random();

    /*
    Balanced distribution:
    
    TRASH      1%
    COMMON    49%
    UNCOMMON  25%
    RARE      15%
    EPIC       7%
    ANOMALY    2.9%
    MYTHIC     0.09%
    HOLY       0.01%
    */

    if (roll < 0.01) {
        return randomInt(0, 99);
    }

    if (roll < 0.50) {
        return randomInt(100, 999);
    }

    if (roll < 0.75) {
        return randomInt(1000, 9999);
    }

    if (roll < 0.90) {
        return randomInt(10000, 49999);
    }

    if (roll < 0.97) {
        return randomInt(50000, 149999);
    }

    if (roll < 0.999) {
        return randomInt(150000, 499999);
    }

    if (roll < 0.9999) {
        return randomInt(500000, 799999);
    }

    return randomInt(800000, 1000000);
}


/* ==================================================
   BADGES
================================================== */

function addBadge(id, name, ep, description, test) {
    badgeDefinitions.push({
        id: id,
        name: name,
        ep: ep,
        description: description,
        test: test
    });
}


const badgeDefinitions = [];


/* ---------------- General ---------------- */

addBadge(
    'even',
    'Even',
    5,
    'The number is even',
    function (n) {
        return n % 2 === 0;
    }
);

addBadge(
    'odd',
    'Odd',
    5,
    'The number is odd',
    function (n) {
        return n % 2 === 1;
    }
);

addBadge(
    'prime',
    'Prime',
    150,
    'The number is prime',
    function (n) {
        return isPrime(n);
    }
);

addBadge(
    'pal',
    'Palindrome',
    500,
    'Reads the same forwards and backwards',
    function (n) {
        return isPalindrome(n);
    }
);

addBadge(
    'repeat',
    'Repeating Digit',
    100,
    'Contains a repeated digit',
    function (n) {
        const ds = digits(n);
        return new Set(ds).size < 6;
    }
);

addBadge(
    'ascending',
    'Ascending',
    300,
    'Digits never decrease',
    function (n) {
        const ds = digits(n);

        for (let i = 1; i < ds.length; i++) {
            if (ds[i] < ds[i - 1]) {
                return false;
            }
        }

        return true;
    }
);

addBadge(
    'descending',
    'Descending',
    300,
    'Digits never increase',
    function (n) {
        const ds = digits(n);

        for (let i = 1; i < ds.length; i++) {
            if (ds[i] > ds[i - 1]) {
                return false;
            }
        }

        return true;
    }
);

addBadge(
    'neighbors',
    'Neighbor Digits',
    150,
    'Contains two neighboring digits',
    function (n) {
        const ds = digits(n);

        for (let i = 1; i < ds.length; i++) {
            if (Math.abs(ds[i] - ds[i - 1]) === 1) {
                return true;
            }
        }

        return false;
    }
);

addBadge(
    'hetero',
    'Heterogeneous',
    100,
    'Contains at least four different digits',
    function (n) {
        return new Set(digits(n)).size >= 4;
    }
);

addBadge(
    'harshad',
    'Harshad',
    500,
    'Divisible by its digit sum',
    function (n) {
        const sum = digitSum(digits(n));

        return sum > 0 && n % sum === 0;
    }
);

addBadge(
    'square',
    'Perfect Square',
    1000,
    'The number is a perfect square',
    function (n) {
        const root = Math.floor(Math.sqrt(n));
        return root * root === n;
    }
);

addBadge(
    'power2',
    'Power of 2',
    1500,
    'The number is a power of two',
    function (n) {
        return isPower(n, 2);
    }
);

addBadge(
    'power3',
    'Power of 3',
    2500,
    'The number is a power of three',
    function (n) {
        return isPower(n, 3);
    }
);

addBadge(
    'fibonacci',
    'Fibonacci',
    1200,
    'The number is in the Fibonacci sequence',
    function (n) {
        return isFibonacci(n);
    }
);

addBadge(
    'factorial',
    'Factorial',
    3500,
    'The number is a factorial',
    function (n) {
        for (let i = 0; i <= 10; i++) {
            if (factorial(i) === n) {
                return true;
            }
        }

        return false;
    }
);

addBadge(
    'triple',
    'Triple Digit',
    800,
    'Contains three identical digits',
    function (n) {
        const ds = digits(n);

        for (let i = 0; i < ds.length - 2; i++) {
            if (
                ds[i] === ds[i + 1] &&
                ds[i] === ds[i + 2]
            ) {
                return true;
            }
        }

        return false;
    }
);

addBadge(
    'quad',
    'Quad Digit',
    3000,
    'Contains four identical digits',
    function (n) {
        const ds = digits(n);

        for (let i = 0; i < ds.length - 3; i++) {
            if (
                ds[i] === ds[i + 1] &&
                ds[i] === ds[i + 2] &&
                ds[i] === ds[i + 3]
            ) {
                return true;
            }
        }

        return false;
    }
);

addBadge(
    'twoPair',
    'Two Pair',
    700,
    'Contains two separate digit pairs',
    function (n) {
        const ds = digits(n);
        const counts = {};

        ds.forEach(function (digit) {
            counts[digit] =
                (counts[digit] || 0) + 1;
        });

        return Object.values(counts)
            .filter(function (count) {
                return count >= 2;
            }).length >= 2;
    }
);

addBadge(
    'alternating',
    'Alternating',
    800,
    'Digits alternate between two groups',
    function (n) {
        const ds = digits(n);

        let evenOdd = true;
        let oddEven = true;

        for (let i = 1; i < ds.length; i++) {
            if (
                ds[i] % 2 ===
                ds[i - 1] % 2
            ) {
                evenOdd = false;
                oddEven = false;
                break;
            }
        }

        return evenOdd || oddEven;
    }
);

addBadge(
    'spacing',
    'Equal Spacing',
    1800,
    'Digits have equal spacing',
    function (n) {
        const ds = digits(n);
        const difference = ds[1] - ds[0];

        for (let i = 2; i < ds.length; i++) {
            if (ds[i] - ds[i - 1] !== difference) {
                return false;
            }
        }

        return true;
    }
);


/* ---------------- Digit sums ---------------- */

addBadge(
    'sum7',
    'Digit Sum 7',
    400,
    'Digits add to 7',
    function (n) {
        return digitSum(digits(n)) === 7;
    }
);

addBadge(
    'sum10',
    'Digit Sum 10',
    500,
    'Digits add to 10',
    function (n) {
        return digitSum(digits(n)) === 10;
    }
);

addBadge(
    'sum15',
    'Digit Sum 15',
    700,
    'Digits add to 15',
    function (n) {
        return digitSum(digits(n)) === 15;
    }
);

addBadge(
    'sum20',
    'Digit Sum 20',
    900,
    'Digits add to 20',
    function (n) {
        return digitSum(digits(n)) === 20;
    }
);

addBadge(
    'sum25',
    'Digit Sum 25',
    1000,
    'Digits add to 25',
    function (n) {
        return digitSum(digits(n)) === 25;
    }
);

addBadge(
    'sum30',
    'Digit Sum 30',
    2000,
    'Digits add to 30',
    function (n) {
        return digitSum(digits(n)) === 30;
    }
);

addBadge(
    'sum35',
    'Digit Sum 35',
    1500,
    'Digits add to 35',
    function (n) {
        return digitSum(digits(n)) === 35;
    }
);

addBadge(
    'sum40',
    'Digit Sum 40',
    2500,
    'Digits add to 40',
    function (n) {
        return digitSum(digits(n)) === 40;
    }
);

addBadge(
    'sum42',
    'Digit Sum 42',
    1800,
    'Digits add to 42',
    function (n) {
        return digitSum(digits(n)) === 42;
    }
);

addBadge(
    'sum45',
    'Digit Sum 45',
    4000,
    'Digits add to 45',
    function (n) {
        return digitSum(digits(n)) === 45;
    }
);


/* ---------------- Digit patterns ---------------- */

addBadge(
    'lucky13',
    'Lucky 13',
    700,
    'Contains 13',
    function (n) {
        return pad(n).includes('13');
    }
);

addBadge(
    'contains7',
    'Contains 7',
    500,
    'Contains the digit 7',
    function (n) {
        return pad(n).includes('7');
    }
);

addBadge(
    'contains69',
    'Contains 69',
    1200,
    'Contains 69',
    function (n) {
        return pad(n).includes('69');
    }
);

addBadge(
    'contains123',
    'Contains 123',
    1500,
    'Contains 123',
    function (n) {
        return pad(n).includes('123');
    }
);

addBadge(
    'contains456',
    'Contains 456',
    1500,
    'Contains 456',
    function (n) {
        return pad(n).includes('456');
    }
);

addBadge(
    'contains789',
    'Contains 789',
    1500,
    'Contains 789',
    function (n) {
        return pad(n).includes('789');
    }
);

addBadge(
    'contains987',
    'Contains 987',
    1500,
    'Contains 987',
    function (n) {
        return pad(n).includes('987');
    }
);

addBadge(
    'sixdigits',
    'Six Digits',
    5,
    'A full six-digit number',
    function (n) {
        return n >= 100000;
    }
);

addBadge(
    'fivezeros',
    'Five Zeros',
    5000,
    'Contains five zeros',
    function (n) {
        return digits(n).filter(function (d) {
            return d === 0;
        }).length >= 5;
    }
);

addBadge(
    'alllow',
    'All Low',
    1000,
    'Every digit is 0–4',
    function (n) {
        return digits(n).every(function (d) {
            return d <= 4;
        });
    }
);

addBadge(
    'allhigh',
    'All High',
    1000,
    'Every digit is 5–9',
    function (n) {
        return digits(n).every(function (d) {
            return d >= 5;
        });
    }
);

addBadge(
    'allEven',
    'All Even',
    1200,
    'Every digit is even',
    function (n) {
        return digits(n).every(function (d) {
            return d % 2 === 0;
        });
    }
);

addBadge(
    'allOdd',
    'All Odd',
    1200,
    'Every digit is odd',
    function (n) {
        return digits(n).every(function (d) {
            return d % 2 === 1;
        });
    }
);

addBadge(
    'allunique',
    'All Unique',
    1200,
    'Every digit is different',
    function (n) {
        const ds = digits(n);
        return new Set(ds).size === 6;
    }
);

addBadge(
    'fourUnique',
    'Four Unique',
    800,
    'Exactly four unique digits',
    function (n) {
        return new Set(digits(n)).size === 4;
    }
);

addBadge(
    'fiveUnique',
    'Five Unique',
    1200,
    'Exactly five unique digits',
    function (n) {
        return new Set(digits(n)).size === 5;
    }
);

addBadge(
    'threeunique',
    'Three Unique',
    100,
    'Exactly three unique digits',
    function (n) {
        return new Set(digits(n)).size === 3;
    }
);


/* ---------------- Position patterns ---------------- */

addBadge(
    'center7',
    'Center 7',
    800,
    'Middle digit is 7',
    function (n) {
        const ds = digits(n);
        return ds[2] === 7 || ds[3] === 7;
    }
);

addBadge(
    'endsame',
    'Matching Ends',
    600,
    'First and last digits match',
    function (n) {
        const ds = digits(n);
        return ds[0] === ds[5];
    }
);

addBadge(
    'outerequal',
    'Outer Equal',
    1600,
    'Outer digit pairs match',
    function (n) {
        const ds = digits(n);

        return (
            ds[0] === ds[5] &&
            ds[1] === ds[4]
        );
    }
);

addBadge(
    'middleequal',
    'Middle Equal',
    1000,
    'Two middle digits match',
    function (n) {
        const ds = digits(n);
        return ds[2] === ds[3];
    }
);

addBadge(
    'center00',
    'Center Double Zero',
    1500,
    'Middle two digits are 00',
    function (n) {
        const ds = digits(n);
        return ds[2] === 0 && ds[3] === 0;
    }
);

addBadge(
    'firstnine',
    'Starts 9',
    500,
    'Starts with 9',
    function (n) {
        return pad(n).startsWith('9');
    }
);

addBadge(
    'lastnine',
    'Ends 9',
    500,
    'Ends with 9',
    function (n) {
        return pad(n).endsWith('9');
    }
);

addBadge(
    'firstzero',
    'Leading Zero',
    500,
    'Starts with 0',
    function (n) {
        return pad(n).startsWith('0');
    }
);

addBadge(
    'starts69',
    'Starts 69',
    2500,
    'First two digits are 69',
    function (n) {
        return pad(n).startsWith('69');
    }
);

addBadge(
    'ends69',
    'Ends 69',
    2500,
    'Last two digits are 69',
    function (n) {
        return pad(n).endsWith('69');
    }
);


/* ---------------- Special digits ---------------- */

addBadge(
    'doublezero',
    'Double Zero',
    900,
    'Contains 00',
    function (n) {
        return pad(n).includes('00');
    }
);

addBadge(
    'triplezero',
    'Triple Zero',
    3500,
    'Contains 000',
    function (n) {
        return pad(n).includes('000');
    }
);

addBadge(
    'doublefive',
    'Double Five',
    800,
    'Contains 55',
    function (n) {
        return pad(n).includes('55');
    }
);

addBadge(
    'doubleeight',
    'Double Eight',
    800,
    'Contains 88',
    function (n) {
        return pad(n).includes('88');
    }
);

addBadge(
    'doubleone',
    'Double One',
    800,
    'Contains 11',
    function (n) {
        return pad(n).includes('11');
    }
);

addBadge(
    'product0',
    'Zero Product',
    50,
    'Digit product is zero',
    function (n) {
        return productOfDigits(digits(n)) === 0;
    }
);

addBadge(
    'product1',
    'Product 1',
    1500,
    'Digit product equals 1',
    function (n) {
        return productOfDigits(digits(n)) === 1;
    }
);


/* ---------------- Repeating patterns ---------------- */

addBadge(
    'ababab',
    'ABABAB',
    7000,
    'Alternating repeating pair',
    function (n) {
        const ds = digits(n);

        return (
            ds[0] === ds[2] &&
            ds[2] === ds[4] &&
            ds[1] === ds[3] &&
            ds[3] === ds[5] &&
            ds[0] !== ds[1]
        );
    }
);

addBadge(
    'mirrorpair',
    'Mirror Pair',
    4000,
    'ABC|CBA style pattern',
    function (n) {
        const ds = digits(n);

        return (
            ds[0] === ds[5] &&
            ds[1] === ds[4] &&
            ds[2] === ds[3]
        );
    }
);

addBadge(
    'stairup',
    'Stair Up',
    7000,
    'Six consecutive ascending digits',
    function (n) {
        const ds = digits(n);

        for (let i = 1; i < ds.length; i++) {
            if (ds[i] !== ds[i - 1] + 1) {
                return false;
            }
        }

        return true;
    }
);

addBadge(
    'stairdown',
    'Stair Down',
    7000,
    'Six consecutive descending digits',
    function (n) {
        const ds = digits(n);

        for (let i = 1; i < ds.length; i++) {
            if (ds[i] !== ds[i - 1] - 1) {
                return false;
            }
        }

        return true;
    }
);

addBadge(
    'binary',
    'Binary Digits',
    5000,
    'Only contains 0 and 1',
    function (n) {
        return digits(n).every(function (d) {
            return d === 0 || d === 1;
        });
    }
);

addBadge(
    'aabbcc',
    'Double Pair Chain',
    3000,
    'AABBCC pattern',
    function (n) {
        const ds = digits(n);

        return (
            ds[0] === ds[1] &&
            ds[2] === ds[3] &&
            ds[4] === ds[5] &&
            ds[0] !== ds[2] &&
            ds[2] !== ds[4]
        );
    }
);

addBadge(
    'twoTriples',
    'Double Triple',
    9000,
    'AAABBB pattern',
    function (n) {
        const ds = digits(n);

        return (
            ds[0] === ds[1] &&
            ds[1] === ds[2] &&
            ds[3] === ds[4] &&
            ds[4] === ds[5] &&
            ds[0] !== ds[3]
        );
    }
);

addBadge(
    'firstTriple',
    'First Triple',
    3500,
    'First three digits match',
    function (n) {
        const ds = digits(n);

        return (
            ds[0] === ds[1] &&
            ds[1] === ds[2]
        );
    }
);

addBadge(
    'lastTriple',
    'Last Triple',
    3500,
    'Last three digits match',
    function (n) {
        const ds = digits(n);

        return (
            ds[3] === ds[4] &&
            ds[4] === ds[5]
        );
    }
);


/* ---------------- Exact numbers ---------------- */

addBadge(
    'exact0',
    'Zero',
    50000,
    'Exactly 0',
    function (n) {
        return n === 0;
    }
);

addBadge(
    'exact1',
    'One',
    30000,
    'Exactly 1',
    function (n) {
        return n === 1;
    }
);

addBadge(
    'exact2',
    'Two',
    20000,
    'Exactly 2',
    function (n) {
        return n === 2;
    }
);

addBadge(
    'exact3',
    'Three',
    20000,
    'Exactly 3',
    function (n) {
        return n === 3;
    }
);

addBadge(
    'exact7',
    'Seven',
    30000,
    'Exactly 7',
    function (n) {
        return n === 7;
    }
);

addBadge(
    'exact8',
    'Eight',
    15000,
    'Exactly 8',
    function (n) {
        return n === 8;
    }
);

addBadge(
    'exact9',
    'Nine',
    15000,
    'Exactly 9',
    function (n) {
        return n === 9;
    }
);

addBadge(
    'exact67',
    'The 67',
    20000,
    'Exactly 67',
    function (n) {
        return n === 67;
    }
);

addBadge(
    'exact100',
    '100',
    5000,
    'Exactly 100',
    function (n) {
        return n === 100;
    }
);

addBadge(
    'exact69',
    '69',
    8000,
    'Exactly 69',
    function (n) {
        return n === 69;
    }
);

addBadge(
    'exact420',
    '420',
    10000,
    'Exactly 420',
    function (n) {
        return n === 420;
    }
);

addBadge(
    'exact123',
    '123',
    6000,
    'Exactly 123',
    function (n) {
        return n === 123;
    }
);

addBadge(
    'exact321',
    '321',
    6000,
    'Exactly 321',
    function (n) {
        return n === 321;
    }
);

addBadge(
    'exact123456',
    '123456',
    500000,
    'Exactly 123456',
    function (n) {
        return n === 123456;
    }
);

addBadge(
    'exact654321',
    '654321',
    500000,
    'Exactly 654321',
    function (n) {
        return n === 654321;
    }
);

addBadge(
    'exact111111',
    '111111',
    300000,
    'Exactly 111111',
    function (n) {
        return n === 111111;
    }
);

addBadge(
    'exact222222',
    '222222',
    280000,
    'Exactly 222222',
    function (n) {
        return n === 222222;
    }
);

addBadge(
    'exact333333',
    '333333',
    280000,
    'Exactly 333333',
    function (n) {
        return n === 333333;
    }
);

addBadge(
    'exact420420',
    '420420',
    450000,
    'Exactly 420420',
    function (n) {
        return n === 420420;
    }
);

addBadge(
    'exact696969',
    '696969',
    650000,
    'Exactly 696969',
    function (n) {
        return n === 696969;
    }
);

addBadge(
    'exact777777',
    '777777',
    700000,
    'Exactly 777777',
    function (n) {
        return n === 777777;
    }
);

addBadge(
    'exact999999',
    '999999',
    740000,
    'Exactly 999999',
    function (n) {
        return n === 999999;
    }
);

addBadge(
    'exact101010',
    '101010',
    350000,
    'Exactly 101010',
    function (n) {
        return n === 101010;
    }
);

addBadge(
    'exact314159',
    '314159',
    350000,
    'Exactly 314159',
    function (n) {
        return n === 314159;
    }
);

addBadge(
    'exact271828',
    '271828',
    350000,
    'Exactly 271828',
    function (n) {
        return n === 271828;
    }
);

addBadge(
    'exact867530',
    '867530',
    300000,
    'Exactly 867530',
    function (n) {
        return n === 867530;
    }
);

addBadge(
    'exact123321',
    '123321',
    250000,
    'Exactly 123321',
    function (n) {
        return n === 123321;
    }
);

addBadge(
    'exact100001',
    '100001',
    220000,
    'Exactly 100001',
    function (n) {
        return n === 100001;
    }
);

addBadge(
    'exact808080',
    '808080',
    250000,
    'Exactly 808080',
    function (n) {
        return n === 808080;
    }
);


/* ---------------- All same ---------------- */

addBadge(
    'allseven',
    '777777',
    100000,
    'Every digit is 7',
    function (n) {
        return pad(n) === '777777';
    }
);

addBadge(
    'allzero',
    '000000',
    50000,
    'Every digit is 0',
    function (n) {
        return pad(n) === '000000';
    }
);

addBadge(
    'allnine',
    '999999',
    60000,
    'Every digit is 9',
    function (n) {
        return pad(n) === '999999';
    }
);

addBadge(
    'alltwo',
    '222222',
    50000,
    'Every digit is 2',
    function (n) {
        return pad(n) === '222222';
    }
);

addBadge(
    'allthree',
    '333333',
    50000,
    'Every digit is 3',
    function (n) {
        return pad(n) === '333333';
    }
);

addBadge(
    'allfive',
    '555555',
    50000,
    'Every digit is 5',
    function (n) {
        return pad(n) === '555555';
    }
);

addBadge(
    'allone',
    '111111',
    50000,
    'Every digit is 1',
    function (n) {
        return pad(n) === '111111';
    }
);


/* ==================================================
   BADGE ANALYSIS
================================================== */

function getBadges(number) {
    const result = [];

    for (const badge of badgeDefinitions) {
        let matched = false;

        try {
            matched = badge.test(number);
        } catch (error) {
            console.error(
                'Badge error:',
                badge.id,
                error
            );
        }

        if (matched) {
            result.push(badge);
        }
    }

    return result;
}


function analyze(number) {
    const badges = getBadges(number);

    let ep = rollBaseEP();

    for (const badge of badges) {
        ep += badge.ep;
    }

    /*
    Small independent lucky bonus.
    */
    if (Math.random() < 0.01) {
        ep += 50;
    }

    const rarity = getRarityFromEP(ep);

    return {
        ep: ep,
        rarity: rarity,
        badges: badges
    };
}


/* ==================================================
   BADGE UNLOCKS
================================================== */

function processBadges(badges) {
    let newBadges = [];

    for (const badge of badges) {
        if (!state.foundBadges[badge.id]) {
            state.foundBadges[badge.id] = {
                name: badge.name,
                ep: badge.ep,
                description: badge.description,
                unlockedAt: Date.now()
            };

            newBadges.push(badge);
        }
    }

    return newBadges;
}


/* ==================================================
   ROLL
================================================== */

async function roll(fromAuto) {
    if (rollLocked) {
        return null;
    }

    rollLocked = true;

    const rollButton = $('rollBtn');

    if (rollButton) {
        rollButton.disabled = true;
    }

    try {
        /*
        Always roll from 0 to 1,000,000.
        There are no user min/max controls anymore.
        */
        const number = randomInt(
            0,
            MAX_NUMBER
        );

        const result = analyze(number);

        const newBadges =
            processBadges(result.badges);

        state.totalRolls += 1;
        state.totalEp += result.ep;

        if (result.ep > state.bestEp) {
            state.bestEp = result.ep;
            state.bestNumber = number;
        }

        const rarityId = result.rarity.id;

        if (
            state.rarityCounts[rarityId] === undefined
        ) {
            state.rarityCounts[rarityId] = 0;
        }

        state.rarityCounts[rarityId] += 1;

        if (rarityId === 'EPIC') {
            state.epics += 1;
        }

        if (rarityId === 'ANOMALY') {
            state.anomalies += 1;
        }

        if (rarityId === 'MYTHIC') {
            state.mythics += 1;
        }

        if (rarityId === 'HOLY') {
            state.holys += 1;
        }

        const historyEntry = {
            number: number,
            ep: result.ep,
            rarity: rarityId,
            badges: result.badges.map(function (badge) {
                return badge.id;
            }),
            time: Date.now()
        };

        state.history.unshift(historyEntry);
        state.history =
            state.history.slice(0, MAX_HISTORY);

        const rarePause =
            rarityId === 'MYTHIC' ||
            rarityId === 'HOLY';

        if (
            rarityId === 'ANOMALY' ||
            rarityId === 'MYTHIC' ||
            rarityId === 'HOLY'
        ) {
            state.rareHistory.unshift(
                historyEntry
            );

            state.rareHistory =
                state.rareHistory.slice(
                    0,
                    MAX_RARE_HISTORY
                );
        }

        renderAll();

        saveLocal();
        scheduleCloudSave();

        checkMilestones();

        if (newBadges.length > 0) {
            for (const badge of newBadges) {
                showToast(
                    'BADGE UNLOCKED',
                    badge.name +
                    '  +' +
                    formatEP(badge.ep) +
                    ' EP',
                    'badge-toast'
                );
            }
        }

        if (rarityId === 'ANOMALY') {
            showToast(
                'ANOMALY!',
                formatNumber(number) +
                ' • ' +
                formatEP(result.ep) +
                ' EP',
                'anomaly-toast'
            );

            playRareSound();
        }

        if (rarityId === 'MYTHIC') {
            showToast(
                'MYTHIC!',
                formatNumber(number) +
                ' • ' +
                formatEP(result.ep) +
                ' EP',
                'mythic-toast'
            );

            playRareSound();
        }

        if (rarityId === 'HOLY') {
            showToast(
                'HOLY!',
                formatNumber(number) +
                ' • ' +
                formatEP(result.ep) +
                ' EP',
                'holy-toast'
            );

            playRareSound();
        }

        /*
        Rare rolls pause for exactly 3 seconds.
        */
        if (rarePause) {
            document.body.classList.add(
                rarityId.toLowerCase() + '-flash'
            );

            await sleep(3000);

            document.body.classList.remove(
                rarityId.toLowerCase() + '-flash'
            );
        }

        return {
            number: number,
            ep: result.ep,
            rarity: result.rarity,
            badges: result.badges,
            rarePause: rarePause
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

        if (rollButton) {
            rollButton.disabled = false;
        }
    }
}


/* ==================================================
   AUTO ROLL
================================================== */

function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}


async function autoRollLoop() {
    while (autoRunning) {
        const result = await roll(true);

        if (!autoRunning) {
            break;
        }

        if (
            result &&
            result.rarePause
        ) {
            /*
            roll() already waited 3 seconds.
            Continue immediately.
            */
            continue;
        }

        const speedElement = $('autoSpeed');

        const delay = speedElement
            ? Number(speedElement.value) || 500
            : 500;

        await sleep(delay);
    }
}


function toggleAutoRoll() {
    const button = $('autoBtn');

    if (autoRunning) {
        autoRunning = false;

        if (button) {
            button.textContent =
                'AUTO ROLL: OFF';

            button.classList.remove('active');
        }

        return;
    }

    autoRunning = true;

    if (button) {
        button.textContent =
            'AUTO ROLL: ON';

        button.classList.add('active');
    }

    autoRollLoop();
}


/* ==================================================
   MILESTONES
================================================== */

const MILESTONES = [
    {
        id: 'ep1000',
        name: 'First Thousand',
        description: 'Earn 1,000 total EP',
        reward: 1000,
        test: function () {
            return state.totalEp >= 1000;
        }
    },
    {
        id: 'ep10000',
        name: 'Getting Started',
        description: 'Earn 10,000 total EP',
        reward: 2500,
        test: function () {
            return state.totalEp >= 10000;
        }
    },
    {
        id: 'ep100000',
        name: 'Six Figures',
        description: 'Earn 100,000 total EP',
        reward: 10000,
        test: function () {
            return state.totalEp >= 100000;
        }
    },
    {
        id: 'ep1000000',
        name: 'Million EP',
        description: 'Earn 1,000,000 total EP',
        reward: 50000,
        test: function () {
            return state.totalEp >= 1000000;
        }
    },

    {
        id: 'roll100',
        name: 'Roller',
        description: 'Roll 100 times',
        reward: 1000,
        test: function () {
            return state.totalRolls >= 100;
        }
    },
    {
        id: 'roll1000',
        name: 'Dedicated',
        description: 'Roll 1,000 times',
        reward: 5000,
        test: function () {
            return state.totalRolls >= 1000;
        }
    },
    {
        id: 'roll10000',
        name: 'Machine',
        description: 'Roll 10,000 times',
        reward: 25000,
        test: function () {
            return state.totalRolls >= 10000;
        }
    },

    {
        id: 'badge5',
        name: 'Collector',
        description: 'Unlock 5 badges',
        reward: 2500,
        test: function () {
            return Object.keys(
                state.foundBadges
            ).length >= 5;
        }
    },
    {
        id: 'badge15',
        name: 'Badge Hunter',
        description: 'Unlock 15 badges',
        reward: 7500,
        test: function () {
            return Object.keys(
                state.foundBadges
            ).length >= 15;
        }
    },
    {
        id: 'badge30',
        name: 'Badge Master',
        description: 'Unlock 30 badges',
        reward: 25000,
        test: function () {
            return Object.keys(
                state.foundBadges
            ).length >= 30;
        }
    },
    {
        id: 'badge50',
        name: 'Completionist',
        description: 'Unlock 50 badges',
        reward: 75000,
        test: function () {
            return Object.keys(
                state.foundBadges
            ).length >= 50;
        }
    },

    {
        id: 'anomaly10',
        name: 'Anomaly Hunter',
        description: 'Find 10 Anomalies',
        reward: 25000,
        test: function () {
            return state.anomalies >= 10;
        }
    },
    {
        id: 'mythic10',
        name: 'Mythic Hunter',
        description: 'Find 10 Mythics',
        reward: 100000,
        test: function () {
            return state.mythics >= 10;
        }
    },
    {
        id: 'holy1',
        name: 'Divine',
        description: 'Find your first Holy',
        reward: 250000,
        test: function () {
            return state.holys >= 1;
        }
    },
    {
        id: 'holy5',
        name: 'Blessed',
        description: 'Find 5 Holys',
        reward: 500000,
        test: function () {
            return state.holys >= 5;
        }
    },
    {
        id: 'holy10',
        name: 'Chosen',
        description: 'Find 10 Holys',
        reward: 1000000,
        test: function () {
            return state.holys >= 10;
        }
    }
];


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
                milestone.name +
                '  +' +
                formatEP(milestone.reward) +
                ' EP',
                'milestone-toast'
            );
        }
    }

    if (changed) {
        saveLocal();
        scheduleCloudSave();
        renderMilestones();
        renderStats();
    }
}


/* ==================================================
   RENDER RESULT
================================================== */

function renderResult() {
    const resultCard = $('resultCard');

    if (!resultCard) {
        return;
    }

    if (!state.history.length) {
        resultCard.className =
            'result-card';

        resultCard.innerHTML = `
            <div class="latest-label">LATEST ROLL</div>
            <div class="latest-number">—</div>
            <div class="latest-rarity">NO ROLLS YET</div>
            <div class="latest-ep">0 EP</div>
        `;

        return;
    }

    const result = state.history[0];

    resultCard.className =
        'result-card ' +
        result.rarity.toLowerCase();

    const badgeText =
        result.badges.length > 0
            ? result.badges.length +
              ' badge' +
              (result.badges.length === 1 ? '' : 's')
            : 'No badges';

    resultCard.innerHTML = `
        <div class="latest-label">LATEST ROLL</div>
        <div class="latest-number">
            ${formatNumber(result.number)}
        </div>
        <div class="latest-rarity">
            ${result.rarity}
        </div>
        <div class="latest-ep">
            ${formatEP(result.ep)} EP
        </div>
        <div class="latest-badges">
            ${badgeText}
        </div>
    `;
}


/* ==================================================
   RENDER STATS
================================================== */

function renderStats() {
    const totalEp = $('totalEp');
    const totalRolls = $('totalRolls');
    const bestEp = $('bestEp');
    const bestNumber = $('bestNumber');
    const anomalyStat = $('anomalyStat');
    const mythicStat = $('mythicStat');
    const holyStat = $('holyStat');
    const badgesFound = $('badgesFound');
    const accountName = $('accountName');

    if (totalEp) {
        totalEp.textContent =
            formatEP(state.totalEp);
    }

    if (totalRolls) {
        totalRolls.textContent =
            formatNumber(state.totalRolls);
    }

    if (bestEp) {
        bestEp.textContent =
            formatEP(state.bestEp);
    }

    if (bestNumber) {
        bestNumber.textContent =
            state.bestNumber === null
                ? '—'
                : formatNumber(state.bestNumber);
    }

    if (anomalyStat) {
        anomalyStat.textContent =
            formatNumber(state.anomalies);
    }

    if (mythicStat) {
        mythicStat.textContent =
            formatNumber(state.mythics);
    }

    if (holyStat) {
        holyStat.textContent =
            formatNumber(state.holys);
    }

    if (badgesFound) {
        badgesFound.textContent =
            formatNumber(
                Object.keys(
                    state.foundBadges
                ).length
            );
    }

    if (accountName) {
        accountName.textContent =
            state.username;
    }
}


/* ==================================================
   RENDER RARITIES
================================================== */

function renderRarities() {
    const grid = $('rarityGrid');

    if (!grid) {
        return;
    }

    grid.innerHTML = '';

    for (const rarity of RARITIES) {
        const count =
            state.rarityCounts[rarity.id] || 0;

        const item =
            document.createElement('div');

        item.className =
            'rarity-item ' +
            rarity.id.toLowerCase();

        item.innerHTML = `
            <span>
                ${rarity.label}
            </span>
            <strong>
                ${formatNumber(count)}
            </strong>
        `;

        grid.appendChild(item);
    }
}


/* ==================================================
   RENDER BADGES
================================================== */

function renderBadges() {
    const grid = $('badgeGrid');

    if (!grid) {
        return;
    }

    grid.innerHTML = '';

    for (const badge of badgeDefinitions) {
        const unlocked =
            Boolean(
                state.foundBadges[badge.id]
            );

        const item =
            document.createElement('div');

        item.className =
            'badge-item ' +
            (unlocked ? 'unlocked' : 'locked');

        item.innerHTML = `
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
        `;

        grid.appendChild(item);
    }
}


/* ==================================================
   RENDER MILESTONES
================================================== */

function renderMilestones() {
    const grid = $('milestoneGrid');

    if (!grid) {
        return;
    }

    grid.innerHTML = '';

    for (const milestone of MILESTONES) {
        const claimed =
            state.milestonesClaimed.includes(
                milestone.id
            );

        const item =
            document.createElement('div');

        item.className =
            'milestone-item ' +
            (claimed ? 'claimed' : 'locked');

        item.innerHTML = `
            <div class="milestone-name">
                ${claimed ? '✓ ' : '○ '}
                ${milestone.name}
            </div>

            <div class="milestone-description">
                ${milestone.description}
            </div>

            <div class="milestone-reward">
                +${formatEP(milestone.reward)} EP
            </div>
        `;

        grid.appendChild(item);
    }
}


/* ==================================================
   RENDER HISTORY
================================================== */

function renderHistory() {
    const list = $('historyList');

    if (!list) {
        return;
    }

    list.innerHTML = '';

    if (!state.history.length) {
        list.innerHTML = `
            <div class="empty-history">
                No rolls yet.
            </div>
        `;

        return;
    }

    for (const entry of state.history) {
        const row =
            document.createElement('div');

        row.className =
            'history-row ' +
            entry.rarity.toLowerCase();

        const date =
            new Date(entry.time);

        const badgeCount =
            Array.isArray(entry.badges)
                ? entry.badges.length
                : 0;

        row.innerHTML = `
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
                ${badgeCount} badge${badgeCount === 1 ? '' : 's'}
            </div>

            <div class="history-time">
                ${date.toLocaleTimeString()}
            </div>
        `;

        list.appendChild(row);
    }
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

    let heading = '';
    let entries = [];

    if (type === 'anomaly') {
        heading = 'ANOMALY HISTORY';

        entries =
            state.rareHistory.filter(function (entry) {
                return entry.rarity === 'ANOMALY';
            });
    }

    if (type === 'mythic') {
        heading = 'MYTHIC HISTORY';

        entries =
            state.rareHistory.filter(function (entry) {
                return entry.rarity === 'MYTHIC';
            });
    }

    if (type === 'holy') {
        heading = 'HOLY HISTORY';

        entries =
            state.rareHistory.filter(function (entry) {
                return entry.rarity === 'HOLY';
            });
    }

    title.textContent = heading;

    if (!entries.length) {
        body.innerHTML = `
            <div class="empty-history">
                Nothing found yet.
            </div>
        `;
    } else {
        body.innerHTML = entries
            .slice(0, 50)
            .map(function (entry) {
                return `
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
                `;
            })
            .join('');
    }

    if (typeof dialog.showModal === 'function') {
        dialog.showModal();
    } else {
        dialog.setAttribute(
            'open',
            ''
        );
    }
}


/* ==================================================
   TOASTS
================================================== */

function showToast(title, message, className) {
    const container =
        $('toastContainer');

    if (!container) {
        return;
    }

    const toast =
        document.createElement('div');

    toast.className =
        'toast ' +
        (className || '');

    toast.innerHTML = `
        <div class="toast-title">
            ${title}
        </div>

        <div class="toast-message">
            ${message}
        </div>
    `;

    container.appendChild(toast);

    setTimeout(function () {
        toast.classList.add('hide');

        setTimeout(function () {
            toast.remove();
        }, 300);
    }, 3500);
}


/* ==================================================
   AUDIO
================================================== */

function getAudioContext() {
    if (!audioContext) {
        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContextClass) {
            return null;
        }

        audioContext =
            new AudioContextClass();
    }

    return audioContext;
}


function playRareSound() {
    try {
        const ctx =
            getAudioContext();

        if (!ctx) {
            return;
        }

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
   RESET
================================================== */

function resetStats() {
    const confirmed =
        window.confirm(
            'Are you sure you want to reset all RNG Vault stats?'
        );

    if (!confirmed) {
        return;
    }

    state = cloneDefaultState();

    saveLocal();
    scheduleCloudSave();

    renderAll();

    showToast(
        'RESET',
        'All local statistics have been reset.',
        'reset-toast'
    );
}


/* ==================================================
   CLEAR HISTORY
================================================== */

function clearHistory() {
    const confirmed =
        window.confirm(
            'Clear your roll history? Your stats will remain.'
        );

    if (!confirmed) {
        return;
    }

    state.history = [];
    state.rareHistory = [];

    saveLocal();
    scheduleCloudSave();

    renderAll();

    showToast(
        'HISTORY CLEARED',
        'Your roll history was cleared.',
        'reset-toast'
    );
}


/* ==================================================
   ACCOUNT
================================================== */

function updateAuthUI(user) {
    const signInBtn = $('signInBtn');
    const signUpBtn = $('signUpBtn');
    const signOutBtn = $('signOutBtn');
    const guestBtn = $('guestBtn');
    const status = $('authStatus');

    if (!supabaseClient) {
        if (status) {
            status.textContent =
                'Cloud saving is not configured. Guest mode is active.';
        }

        if (signInBtn) signInBtn.disabled = true;
        if (signUpBtn) signUpBtn.disabled = true;
        if (signOutBtn) signOutBtn.disabled = true;

        return;
    }

    if (user) {
        if (status) {
            status.textContent =
                'Signed in as ' +
                (user.email || 'account');
        }

        if (signInBtn) signInBtn.disabled = true;
        if (signUpBtn) signUpBtn.disabled = true;
        if (signOutBtn) signOutBtn.disabled = false;

        if (guestBtn) {
            guestBtn.textContent =
                'Continue as Guest';
        }
    } else {
        if (status) {
            status.textContent =
                'Not signed in. Local saving is still active.';
        }

        if (signInBtn) signInBtn.disabled = false;
        if (signUpBtn) signUpBtn.disabled = false;
        if (signOutBtn) signOutBtn.disabled = true;
    }
}


async function initAuth() {
    if (!supabaseClient) {
        updateAuthUI(null);
        return;
    }

    try {
        const result =
            await supabaseClient.auth.getUser();

        updateAuthUI(
            result &&
            result.data
                ? result.data.user
                : null
        );

        if (
            result &&
            result.data &&
            result.data.user
        ) {
            await loadCloud();
        }

        supabaseClient.auth.onAuthStateChange(
            async function (_event, session) {
                const user =
                    session
                        ? session.user
                        : null;

                updateAuthUI(user);

                if (user) {
                    await loadCloud();
                }
            }
        );
    } catch (error) {
        console.error(
            'Auth initialization failed:',
            error
        );

        updateAuthUI(null);
    }
}


async function signIn() {
    if (!supabaseClient) {
        return;
    }

    const email =
        $('emailInput')
            ? $('emailInput').value.trim()
            : '';

    const password =
        $('passwordInput')
            ? $('passwordInput').value
            : '';

    if (!email || !password) {
        showToast(
            'LOGIN',
            'Enter your email and password.',
            'error-toast'
        );

        return;
    }

    try {
        const result =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (result.error) {
            throw result.error;
        }

        showToast(
            'SIGNED IN',
            'Cloud saving is now active.',
            'success-toast'
        );

        const dialog = $('accountDialog');

        if (dialog) {
            dialog.close();
        }
    } catch (error) {
        console.error(error);

        showToast(
            'LOGIN FAILED',
            error.message || 'Could not sign in.',
            'error-toast'
        );
    }
}


async function signUp() {
    if (!supabaseClient) {
        return;
    }

    const email =
        $('emailInput')
            ? $('emailInput').value.trim()
            : '';

    const password =
        $('passwordInput')
            ? $('passwordInput').value
            : '';

    if (!email || !password) {
        showToast(
            'SIGN UP',
            'Enter your email and password.',
            'error-toast'
        );

        return;
    }

    try {
        const result =
            await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

        if (result.error) {
            throw result.error;
        }

        showToast(
            'ACCOUNT CREATED',
            'Check your email if confirmation is required.',
            'success-toast'
        );
    } catch (error) {
        console.error(error);

        showToast(
            'SIGN UP FAILED',
            error.message || 'Could not create account.',
            'error-toast'
        );
    }
}


async function signOut() {
    if (!supabaseClient) {
        return;
    }

    try {
        const result =
            await supabaseClient.auth.signOut();

        if (result.error) {
            throw result.error;
        }

        showToast(
            'SIGNED OUT',
            'You are now using local guest saving.',
            'success-toast'
        );
    } catch (error) {
        console.error(error);

        showToast(
            'ERROR',
            error.message || 'Could not sign out.',
            'error-toast'
        );
    }
}


function continueAsGuest() {
    const dialog =
        $('accountDialog');

    if (dialog) {
        dialog.close();
    }

    showToast(
        'GUEST MODE',
        'Your progress is saved locally.',
        'success-toast'
    );
}


/* ==================================================
   RENDER EVERYTHING
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
    const rollBtn = $('rollBtn');
    const autoBtn = $('autoBtn');
    const resetBtn = $('resetBtn');
    const clearHistoryBtn =
        $('clearHistoryBtn');

    const anomalyStat =
        $('anomalyStat');

    const mythicStat =
        $('mythicStat');

    const holyStat =
        $('holyStat');

    const accountBtn =
        $('accountBtn');

    const accountDialog =
        $('accountDialog');

    const accountClose =
        $('accountClose');

    const detailsDialog =
        $('detailsDialog');

    const detailsClose =
        $('detailsClose');

    if (rollBtn) {
        rollBtn.addEventListener(
            'click',
            function () {
                roll(false);
            }
        );
    }

    if (autoBtn) {
        autoBtn.addEventListener(
            'click',
            toggleAutoRoll
        );
    }

    if (resetBtn) {
        resetBtn.addEventListener(
            'click',
            resetStats
        );
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener(
            'click',
            clearHistory
        );
    }

    if (anomalyStat) {
        anomalyStat.addEventListener(
            'click',
            function () {
                openDetails('anomaly');
            }
        );
    }

    if (mythicStat) {
        mythicStat.addEventListener(
            'click',
            function () {
                openDetails('mythic');
            }
        );
    }

    if (holyStat) {
        holyStat.addEventListener(
            'click',
            function () {
                openDetails('holy');
            }
        );
    }

    if (accountBtn && accountDialog) {
        accountBtn.addEventListener(
            'click',
            function () {
                accountDialog.showModal();
            }
        );
    }

    if (accountClose && accountDialog) {
        accountClose.addEventListener(
            'click',
            function () {
                accountDialog.close();
            }
        );
    }

    if (detailsClose && detailsDialog) {
        detailsClose.addEventListener(
            'click',
            function () {
                detailsDialog.close();
            }
        );
    }

    const signInBtn =
        $('signInBtn');

    const signUpBtn =
        $('signUpBtn');

    const signOutBtn =
        $('signOutBtn');

    const guestBtn =
        $('guestBtn');

    if (signInBtn) {
        signInBtn.addEventListener(
            'click',
            signIn
        );
    }

    if (signUpBtn) {
        signUpBtn.addEventListener(
            'click',
            signUp
        );
    }

    if (signOutBtn) {
        signOutBtn.addEventListener(
            'click',
            signOut
        );
    }

    if (guestBtn) {
        guestBtn.addEventListener(
            'click',
            continueAsGuest
        );
    }

    document.addEventListener(
        'keydown',
        function (event) {
            if (
                event.code === 'Space' &&
                !event.repeat &&
                document.activeElement &&
                document.activeElement.tagName !== 'INPUT' &&
                document.activeElement.tagName !== 'TEXTAREA' &&
                document.activeElement.tagName !== 'SELECT'
            ) {
                event.preventDefault();

                if (!rollLocked) {
                    roll(false);
                }
            }
        }
    );

    window.addEventListener(
        'beforeunload',
        function () {
            saveLocal();
        }
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
