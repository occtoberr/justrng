```javascript
'use strict';

/*
==================================================
RNG VAULT
Version 4.0.0
==================================================
EP-BASED RARITY SYSTEM
==================================================
*/

const SUPABASE_URL = '';
const SUPABASE_KEY = '';

const SUPABASE_CONFIGURED =
    /^https:\/\/[^\s]+$/.test(SUPABASE_URL) &&
    SUPABASE_KEY.length > 20;

const supabaseClient =
    SUPABASE_CONFIGURED && window.supabase
        ? window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        )
        : null;


/* =========================
   GENERAL SETTINGS
========================= */

const STORAGE_KEY = 'rng-vault-v3';

const MAX_NUMBER = 1000000;

const MAX_HISTORY = 60;

const MAX_RARE_HISTORY = 150;


/*
==================================================
RARITY IS NOW BASED ON EP
==================================================

The number itself no longer determines rarity.

EP thresholds:

0 - 99        TRASH
100 - 999     COMMON
1K - 9,999    UNCOMMON
10K - 49,999  RARE
50K - 149,999 EPIC
150K - 499,999 ANOMALY
500K - 799,999 MYTHIC
800K+         HOLY
==================================================
*/

const RARITIES = [

    {
        name: 'TRASH',
        minEP: 0,
        maxEP: 99,
        label: '0–99 EP'
    },

    {
        name: 'COMMON',
        minEP: 100,
        maxEP: 999,
        label: '100–999 EP'
    },

    {
        name: 'UNCOMMON',
        minEP: 1000,
        maxEP: 9999,
        label: '1K–9.99K EP'
    },

    {
        name: 'RARE',
        minEP: 10000,
        maxEP: 49999,
        label: '10K–49.99K EP'
    },

    {
        name: 'EPIC',
        minEP: 50000,
        maxEP: 149999,
        label: '50K–149.99K EP'
    },

    {
        name: 'ANOMALY',
        minEP: 150000,
        maxEP: 499999,
        label: '150K–499.99K EP'
    },

    {
        name: 'MYTHIC',
        minEP: 500000,
        maxEP: 799999,
        label: '500K–799.99K EP'
    },

    {
        name: 'HOLY',
        minEP: 800000,
        maxEP: Infinity,
        label: '800K+ EP'
    }

];


/* =========================
   DEFAULT SAVE
========================= */

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


/* =========================
   GLOBAL STATE
========================= */

let state = loadLocalState();

let currentUser = null;

let cloudSaveTimer = null;

let autoTimer = null;

let rollLocked = false;

let audioContext = null;


/* =========================
   SHORT DOM HELPER
========================= */

const $ = id =>
    document.getElementById(id);


/* =========================
   STATE HELPERS
========================= */

function cloneDefault() {

    return JSON.parse(
        JSON.stringify(DEFAULT_STATE)
    );

}


function normalizeState(raw) {

    const result = cloneDefault();

    if (
        !raw ||
        typeof raw !== 'object'
    ) {

        return result;

    }

    Object.assign(
        result,
        raw
    );

    result.version = 4;

    result.rarityCounts = {

        ...DEFAULT_STATE.rarityCounts,

        ...(raw.rarityCounts || {})

    };

    /*
    Migrate old saves.
    */

    result.holys =
        Number(raw.holys) || 0;

    /*
    Old saves did not have HOLY.
    */

    if (
        !result.rarityCounts.HOLY
    ) {

        result.rarityCounts.HOLY = 0;

    }

    result.foundBadges =
        raw.foundBadges &&
        typeof raw.foundBadges === 'object'
            ? raw.foundBadges
            : {};

    result.history =
        Array.isArray(raw.history)
            ? raw.history.slice(
                0,
                MAX_HISTORY
            )
            : [];

    result.rareHistory =
        Array.isArray(raw.rareHistory)
            ? raw.rareHistory.slice(
                0,
                MAX_RARE_HISTORY
            )
            : [];

    result.milestonesClaimed =
        Array.isArray(
            raw.milestonesClaimed
        )
            ? raw.milestonesClaimed
            : [];

    result.totalEp =
        Number(result.totalEp) || 0;

    result.totalRolls =
        Number(result.totalRolls) || 0;

    result.bestEp =
        Number(result.bestEp) || 0;

    result.mythics =
        Number(result.mythics) || 0;

    result.anomalies =
        Number(result.anomalies) || 0;

    result.epics =
        Number(result.epics) || 0;

    return result;

}


function loadLocalState() {

    try {

        const saved =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_KEY
                )
            );

        return normalizeState(
            saved
        );

    } catch {

        return cloneDefault();

    }

}


function saveLocal() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state)
        );

    } catch (error) {

        console.warn(
            'Local save failed:',
            error
        );

    }

}


/* =========================
   CLOUD SAVE
========================= */

function scheduleCloudSave() {

    saveLocal();

    if (
        !currentUser ||
        !supabaseClient
    ) {

        return;

    }

    clearTimeout(
        cloudSaveTimer
    );

    cloudSaveTimer =
        setTimeout(
            saveCloud,
            500
        );

}


async function saveCloud() {

    if (
        !currentUser ||
        !supabaseClient
    ) {

        return;

    }

    const payload = {

        user_id:
            currentUser.id,

        data:
            state,

        updated_at:
            new Date().toISOString()

    };

    const {
        error
    } =
        await supabaseClient
            .from('game_saves')
            .upsert(
                payload,
                {
                    onConflict:
                        'user_id'
                }
            );

    if (error) {

        console.error(error);

        setAuthStatus(
            'Cloud save failed. Local progress is still safe.',
            true
        );

    } else {

        setAuthStatus(
            'Cloud save synced.'
        );

    }

}


async function loadCloudForUser(
    user
) {

    if (!supabaseClient) {

        return;

    }

    setAuthStatus(
        'Loading your cloud save...'
    );

    const {
        data,
        error
    } =
        await supabaseClient
            .from('game_saves')
            .select('data')
            .eq(
                'user_id',
                user.id
            )
            .maybeSingle();

    if (error) {

        console.error(error);

        setAuthStatus(
            'Could not load cloud save. Local progress kept.',
            true
        );

        return;

    }

    if (
        data &&
        data.data &&
        typeof data.data === 'object'
    ) {

        state =
            normalizeState(
                data.data
            );

        if (
            user.user_metadata &&
            user.user_metadata.username
        ) {

            state.username =
                String(
                    user.user_metadata.username
                ).slice(
                    0,
                    24
                );

        }

        saveLocal();

        renderAll();

        setAuthStatus(
            'Cloud save loaded.'
        );

    } else {

        if (
            user.user_metadata &&
            user.user_metadata.username
        ) {

            state.username =
                String(
                    user.user_metadata.username
                ).slice(
                    0,
                    24
                );

        }

        await saveCloud();

        renderAll();

    }

}


/* =========================
   AUTH STATUS
========================= */

function setAuthStatus(
    text,
    error = false
) {

    const element =
        $('authStatus');

    if (!element) {

        return;

    }

    element.textContent =
        text;

    element.classList.toggle(
        'error',
        error
    );

}


/* =========================
   NUMBER HELPERS
========================= */

function formatNumber(
    number
) {

    return Number(number)
        .toLocaleString(
            'en-US'
        );

}


function formatEP(
    number
) {

    return Number(number)
        .toLocaleString(
            'en-US'
        );

}


function pad(number) {

    return String(number)
        .padStart(
            6,
            '0'
        );

}


function digits(number) {

    return pad(number)
        .split('')
        .map(Number);

}


function digitSum(number) {

    return digits(number)
        .reduce(
            (a, b) =>
                a + b,
            0
        );

}


function isPalindrome(
    number
) {

    const string =
        pad(number);

    return (
        string ===
        string
            .split('')
            .reverse()
            .join('')
    );

}


function isPrime(
    number
) {

    if (
        number < 2 ||
        !Number.isInteger(number)
    ) {

        return false;

    }

    if (number === 2) {

        return true;

    }

    if (
        number % 2 === 0
    ) {

        return false;

    }

    for (
        let i = 3;
        i * i <= number;
        i += 2
    ) {

        if (
            number % i === 0
        ) {

            return false;

        }

    }

    return true;

}


function isPower(
    number,
    base
) {

    if (number < 1) {

        return false;

    }

    let value =
        number;

    while (
        value % base === 0
    ) {

        value /= base;

    }

    return value === 1;

}


function isFibonacci(
    number
) {

    let a = 0;

    let b = 1;

    while (
        b < number
    ) {

        [
            a,
            b
        ] = [
            b,
            a + b
        ];

    }

    return (
        number === 0 ||
        b === number
    );

}


/* =========================
   EP-BASED RARITY
========================= */

function getRarityFromEP(
    ep
) {

    const value =
        Math.max(
            0,
            Number(ep) || 0
        );

    const rarity =
        RARITIES.find(
            entry =>
                value >= entry.minEP &&
                value <= entry.maxEP
        );

    return rarity
        ? rarity.name
        : 'TRASH';

}


/* =========================
   BADGES
========================= */

const badgeDefs = [];


function addBadge(
    id,
    name,
    ep,
    description,
    test
) {

    badgeDefs.push({

        id,

        name,

        ep,

        description,

        test

    });

}


/* =========================
   EXACT NUMBER BADGES
========================= */

addBadge(
    'zero',
    'Absolute Zero',
    12000,
    'Roll exactly 0.',
    n => n === 0
);

addBadge(
    'one',
    'The One',
    10000,
    'Roll exactly 1.',
    n => n === 1
);

addBadge(
    'two',
    'Deuce',
    4000,
    'Roll exactly 2.',
    n => n === 2
);

addBadge(
    'three',
    'Three',
    4000,
    'Roll exactly 3.',
    n => n === 3
);

addBadge(
    'seven_exact',
    'Lucky Seven',
    6000,
    'Roll exactly 7.',
    n => n === 7
);

addBadge(
    'eight',
    'Eight',
    3500,
    'Roll exactly 8.',
    n => n === 8
);

addBadge(
    'nine',
    'Nine',
    3500,
    'Roll exactly 9.',
    n => n === 9
);

addBadge(
    'sixtyseven',
    'Seventh Heaven',
    2500,
    'Roll exactly 67.',
    n => n === 67
);


/* =========================
   GENERAL BADGES
========================= */

addBadge(
    'even',
    'Even Steven',
    25,
    'An even number.',
    n => n % 2 === 0
);

addBadge(
    'odd',
    'Odd One Out',
    25,
    'An odd number.',
    n => n % 2 !== 0
);

addBadge(
    'prime',
    'Prime Time',
    700,
    'A prime number.',
    isPrime
);

addBadge(
    'pal',
    'Mirror',
    2500,
    'A six-digit palindrome.',
    isPalindrome
);

addBadge(
    'repeat',
    'Double Vision',
    500,
    'Contains adjacent repeated digits.',
    n =>
        /(\d)\1/.test(
            pad(n)
        )
);

addBadge(
    'asc',
    'Ascending',
    2200,
    'Digits never decrease.',
    n =>
        digits(n).every(
            (
                digit,
                index,
                array
            ) =>
                index === 0 ||
                digit >=
                array[index - 1]
        )
);

addBadge(
    'desc',
    'Descending',
    2200,
    'Digits never increase.',
    n =>
        digits(n).every(
            (
                digit,
                index,
                array
            ) =>
                index === 0 ||
                digit <=
                array[index - 1]
        )
);

addBadge(
    'neighbors',
    'Neighbors',
    900,
    'Contains consecutive digits.',
    n =>
        /01|12|23|34|45|56|67|78|89/
            .test(
                pad(n)
            )
);

addBadge(
    'hetero',
    'Heterogeneous',
    600,
    'All non-zero digits are different.',
    n => {

        const values =
            digits(n)
                .filter(Boolean);

        return (
            new Set(values).size ===
            values.length
        );

    }
);

addBadge(
    'harshad',
    'Harshad',
    3000,
    'Divisible by its digit sum.',
    n =>
        n > 0 &&
        n % digitSum(n) === 0
);

addBadge(
    'square',
    'Perfect Square',
    5000,
    'A perfect square.',
    n =>
        Number.isInteger(
            Math.sqrt(n)
        )
);

addBadge(
    'power2',
    'Power of Two',
    7500,
    'A power of two.',
    n =>
        n > 0 &&
        (n & (n - 1)) === 0
);

addBadge(
    'power3',
    'Power of Three',
    10000,
    'A power of three.',
    n =>
        isPower(n, 3)
);

addBadge(
    'fibo',
    'Fibonacci',
    6500,
    'A Fibonacci number.',
    isFibonacci
);

addBadge(
    'factorial',
    'Factorial',
    12000,
    'A small factorial value.',
    n =>
        [
            1,
            2,
            6,
            24,
            120,
            720,
            5040,
            40320,
            362880
        ].includes(n)
);

addBadge(
    'triple',
    'Triple',
    6000,
    'Three equal digits in a row.',
    n =>
        /(\d)\1\1/.test(
            pad(n)
        )
);

addBadge(
    'quad',
    'Quad',
    18000,
    'Four equal digits in a row.',
    n =>
        /(\d)\1\1\1/.test(
            pad(n)
        )
);

addBadge(
    'twopair',
    'Two Pairs',
    5000,
    'Two separate adjacent pairs.',
    n =>
        /(\d)\1.*(\d)\2/.test(
            pad(n)
        )
);

addBadge(
    'alternating',
    'Alternating',
    4500,
    'Digits alternate between odd and even.',
    n => {

        const values =
            digits(n);

        return values.every(
            (
                value,
                index
            ) =>
                index === 0 ||
                value % 2 !==
                values[index - 1] % 2
        );

    }
);

addBadge(
    'spacing',
    'Perfect Spacing',
    9000,
    'Equal gap between every digit.',
    n => {

        const values =
            digits(n);

        const gap =
            values[1] -
            values[0];

        return values
            .slice(2)
            .every(
                (
                    value,
                    index
                ) =>
                    value -
                    values[index + 1] ===
                    gap
            );

    }
);

addBadge(
    'sum10',
    'Digit Sum 10',
    3000,
    'Digit sum equals 10.',
    n =>
        digitSum(n) === 10
);

addBadge(
    'sum20',
    'Digit Sum 20',
    5500,
    'Digit sum equals 20.',
    n =>
        digitSum(n) === 20
);

addBadge(
    'sum30',
    'Digit Sum 30',
    10000,
    'Digit sum equals 30.',
    n =>
        digitSum(n) === 30
);

addBadge(
    'lucky13',
    'Unlucky 13',
    4500,
    'Digit sum equals 13.',
    n =>
        digitSum(n) === 13
);

addBadge(
    'contains7',
    'Lucky Seven',
    1800,
    'Contains a 7.',
    n =>
        pad(n).includes('7')
);

addBadge(
    'contains69',
    'Nice',
    7500,
    'Contains 69.',
    n =>
        pad(n).includes('69')
);

addBadge(
    'sixdigits',
    'Six Digits',
    50,
    'The roll uses six displayed digits.',
    n =>
        n >= 100000
);

addBadge(
    'fivezeros',
    'Zero Parade',
    20000,
    'Contains at least five zeroes.',
    n =>
        (
            pad(n).match(
                /0/g
            ) || []
        ).length >= 5
);

addBadge(
    'alllow',
    'Low Roll',
    5500,
    'Every digit is 0–4.',
    n =>
        digits(n).every(
            digit =>
                digit <= 4
        )
);

addBadge(
    'allhigh',
    'High Roll',
    5500,
    'Every digit is 5–9.',
    n =>
        digits(n).every(
            digit =>
                digit >= 5
        )
);

addBadge(
    'allunique',
    'No Repeats',
    6500,
    'All six digits are different.',
    n =>
        new Set(
            digits(n)
        ).size === 6
);

addBadge(
    'threeunique',
    'Triple Variety',
    1200,
    'At least three different digits.',
    n =>
        new Set(
            digits(n)
        ).size >= 3
);

addBadge(
    'center7',
    'Center Stage',
    5000,
    'One of the center digits is 7.',
    n => {

        const s =
            pad(n);

        return (
            s[2] === '7' ||
            s[3] === '7'
        );

    }
);

addBadge(
    'endsame',
    'Bookends',
    5000,
    'First and last digits match.',
    n => {

        const s =
            pad(n);

        return (
            s[0] === s[5]
        );

    }
);

addBadge(
    'doublezero',
    'Double Zero',
    8000,
    'Contains 00.',
    n =>
        pad(n).includes(
            '00'
        )
);

addBadge(
    'triplezero',
    'Triple Zero',
    25000,
    'Contains 000.',
    n =>
        pad(n).includes(
            '000'
        )
);

addBadge(
    'doublefive',
    'High Five',
    7000,
    'Contains 55.',
    n =>
        pad(n).includes(
            '55'
        )
);

addBadge(
    'doubleeight',
    'Infinity Pair',
    7000,
    'Contains 88.',
    n =>
        pad(n).includes(
            '88'
        )
);

addBadge(
    'doubleone',
    'Twin Ones',
    7000,
    'Contains 11.',
    n =>
        pad(n).includes(
            '11'
        )
);

addBadge(
    'sum7',
    'Sum of Seven',
    2500,
    'Digit sum equals 7.',
    n =>
        digitSum(n) === 7
);

addBadge(
    'sum42',
    'Answer',
    12000,
    'Digit sum equals 42.',
    n =>
        digitSum(n) === 42
);

addBadge(
    'sum45',
    'Maximum Sum',
    20000,
    'Digit sum equals 45.',
    n =>
        digitSum(n) === 45
);

addBadge(
    'product0',
    'Zero Product',
    500,
    'At least one digit is zero.',
    n =>
        digits(n).includes(0)
);

addBadge(
    'product1',
    'Unit Product',
    10000,
    'Digit product equals 1.',
    n =>
        digits(n)
            .reduce(
                (a, b) =>
                    a * b,
                1
            ) === 1
);

addBadge(
    'firstnine',
    'Front Nine',
    4500,
    'Starts with 9.',
    n =>
        pad(n)[0] === '9'
);

addBadge(
    'lastnine',
    'Final Nine',
    4500,
    'Ends with 9.',
    n =>
        pad(n)[5] === '9'
);

addBadge(
    'firstzero',
    'Leading Void',
    4500,
    'Starts with 0.',
    n =>
        pad(n)[0] === '0'
);

addBadge(
    'middleequal',
    'Middle Match',
    8000,
    'The two center digits match.',
    n => {

        const s =
            pad(n);

        return (
            s[2] === s[3]
        );

    }
);

addBadge(
    'outerequal',
    'Outer Match',
    8000,
    'Both outer pairs match.',
    n => {

        const s =
            pad(n);

        return (
            s[0] === s[5] &&
            s[1] === s[4]
        );

    }
);

addBadge(
    'halfmirror',
    'Half Mirror',
    15000,
    'First three digits equal last three.',
    n => {

        const s =
            pad(n);

        return (
            s.slice(0, 3) ===
            s.slice(3)
        );

    }
);

addBadge(
    'ababab',
    'ABABAB',
    30000,
    'Pattern ABABAB.',
    n => {

        const s =
            pad(n);

        return (
            s[0] === s[2] &&
            s[2] === s[4] &&
            s[1] === s[3] &&
            s[3] === s[5] &&
            s[0] !== s[1]
        );

    }
);

addBadge(
    'mirrorpair',
    'Mirror Pairs',
    18000,
    'ABC CBA structure.',
    n => {

        const s =
            pad(n);

        return (
            s[0] === s[5] &&
            s[1] === s[4] &&
            s[2] === s[3]
        );

    }
);

addBadge(
    'stairup',
    'Staircase',
    20000,
    'Every digit rises by one.',
    n => {

        const s =
            pad(n);

        return s
            .split('')
            .every(
                (
                    value,
                    index,
                    array
                ) =>
                    index === 0 ||
                    Number(value) ===
                    Number(
                        array[index - 1]
                    ) + 1
            );

    }
);

addBadge(
    'stairdown',
    'Downstairs',
    20000,
    'Every digit falls by one.',
    n => {

        const s =
            pad(n);

        return s
            .split('')
            .every(
                (
                    value,
                    index,
                    array
                ) =>
                    index === 0 ||
                    Number(value) ===
                    Number(
                        array[index - 1]
                    ) - 1
            );

    }
);

addBadge(
    'binary',
    'Binary Soul',
    25000,
    'Only 0 and 1 appear.',
    n =>
        digits(n).every(
            digit =>
                digit === 0 ||
                digit === 1
        )
);

addBadge(
    'allseven',
    'Seven Heaven',
    100000,
    'Every digit is 7.',
    n =>
        pad(n) ===
        '777777'
);

addBadge(
    'allzero',
    'Nothingness',
    100000,
    'Every digit is 0.',
    n =>
        pad(n) ===
        '000000'
);

addBadge(
    'allnine',
    'Nine Lives',
    100000,
    'Every digit is 9.',
    n =>
        pad(n) ===
        '999999'
);

addBadge(
    'alltwo',
    'Two-Two-Two',
    80000,
    'Every digit is 2.',
    n =>
        pad(n) ===
        '222222'
);

addBadge(
    'allthree',
    'Threefold',
    80000,
    'Every digit is 3.',
    n =>
        pad(n) ===
        '333333'
);

addBadge(
    'allfive',
    'High Five x6',
    80000,
    'Every digit is 5.',
    n =>
        pad(n) ===
        '555555'
);

addBadge(
    'allone',
    'One Nation',
    80000,
    'Every digit is 1.',
    n =>
        pad(n) ===
        '111111'
);


/* =========================
   EXTRA BADGES
========================= */

addBadge(
    'allfour',
    'Quad Squad',
    80000,
    'Every digit is 4.',
    n =>
        pad(n) ===
        '444444'
);

addBadge(
    'allsix',
    'Six Pack',
    80000,
    'Every digit is 6.',
    n =>
        pad(n) ===
        '666666'
);

addBadge(
    'all8',
    'Infinity',
    90000,
    'Every digit is 8.',
    n =>
        pad(n) ===
        '888888'
);

addBadge(
    'singleunique',
    'Lonely Digit',
    12000,
    'Exactly one digit appears once.',
    n => {

        const counts = {};

        digits(n).forEach(
            digit => {
                counts[digit] =
                    (counts[digit] || 0) + 1;
            }
        );

        return Object.values(
            counts
        ).includes(1);

    }
);

addBadge(
    'twozeroes',
    'Zero Duo',
    7000,
    'Contains at least two zeroes.',
    n =>
        (
            pad(n).match(
                /0/g
            ) || []
        ).length >= 2
);

addBadge(
    'threefives',
    'Five Stack',
    14000,
    'Contains at least three 5s.',
    n =>
        (
            pad(n).match(
                /5/g
            ) || []
        ).length >= 3
);

addBadge(
    'three7s',
    'Lucky Stack',
    16000,
    'Contains at least three 7s.',
    n =>
        (
            pad(n).match(
                /7/g
            ) || []
        ).length >= 3
);

addBadge(
    'three9s',
    'Nine Stack',
    16000,
    'Contains at least three 9s.',
    n =>
        (
            pad(n).match(
                /9/g
            ) || []
        ).length >= 3
);

addBadge(
    'sum1',
    'Minimalist',
    12000,
    'Digit sum equals 1.',
    n =>
        digitSum(n) === 1
);

addBadge(
    'sum50',
    'Overload',
    15000,
    'Digit sum equals 50.',
    n =>
        digitSum(n) === 50
);

addBadge(
    'sum54',
    'Beyond Maximum',
    25000,
    'Digit sum equals 54.',
    n =>
        digitSum(n) === 54
);

addBadge(
    'ends69',
    'Nice Ending',
    10000,
    'Ends in 69.',
    n =>
        pad(n).endsWith(
            '69'
        )
);

addBadge(
    'starts69',
    'Nice Beginning',
    10000,
    'Starts with 69.',
    n =>
        pad(n).startsWith(
            '69'
        )
);

addBadge(
    'center00',
    'Void Center',
    18000,
    'The center digits are 00.',
    n => {

        const s =
            pad(n);

        return (
            s[2] === '0' &&
            s[3] === '0'
        );

    }
);

addBadge(
    'center69',
    'Center Nice',
    20000,
    'The center digits are 69.',
    n => {

        const s =
            pad(n);

        return (
            s[2] === '6' &&
            s[3] === '9'
        );

    }
);


/* =========================
   EXACT PATTERN NUMBERS
========================= */

const exactBadges = [

    [
        69,
        'Nice Number',
        10000
    ],

    [
        100,
        'Century',
        8000
    ],

    [
        420,
        'Four Twenty',
        12000
    ],

    [
        123,
        'Tiny Straight',
        10000
    ],

    [
        321,
        'Reverse Tiny Straight',
        10000
    ],

    [
        123456,
        'Straight Up',
        70000
    ],

    [
        654321,
        'Reverse Straight',
        70000
    ],

    [
        111111,
        'Six Ones',
        100000
    ],

    [
        222222,
        'Six Twos',
        80000
    ],

    [
        333333,
        'Six Threes',
        80000
    ],

    [
        420420,
        'Four Twenty Forever',
        120000
    ],

    [
        696969,
        'Nice Nice Nice',
        150000
    ],

    [
        777777,
        'Jackpot Pattern',
        200000
    ],

    [
        999999,
        'Six Nines',
        150000
    ],

    [
        101010,
        'Binary Beat',
        110000
    ],

    [
        314159,
        'Pi Slice',
        130000
    ],

    [
        271828,
        'Euler Slice',
        130000
    ],

    [
        867530,
        'Jenny',
        120000
    ],

    [
        123321,
        'Palindrome Prime',
        90000
    ],

    [
        100001,
        'Bookend Zero',
        80000
    ],

    [
        808080,
        'Eight Oh Eight',
        100000
    ],

    [
        696969,
        'Triple Nice',
        150000
    ],

    [
        777777,
        'Sacred Seven',
        200000
    ]

];


exactBadges.forEach(
    (
        [
            value,
            name,
            ep
        ]
    ) => {

        addBadge(
            `exact_${value}_${name
                .replace(
                    /[^a-z0-9]/gi,
                    ''
                )
                .toLowerCase()}`,
            name,
            ep,
            `Roll exactly ${value}.`,
            n =>
                n === value
        );

    }
);


/* =========================
   BADGE EVALUATION
========================= */

function getBadges(
    number
) {

    return badgeDefs.filter(
        badge => {

            try {

                return badge.test(
                    number
                );

            } catch {

                return false;

            }

        }
    );

}


function analyze(
    number
) {

    const badges =
        getBadges(number);

    let ep =
        badges.reduce(
            (
                total,
                badge
            ) =>
                total + badge.ep,
            0
        );

    /*
    Small luck bonus.
    */

    if (
        Math.random() < 0.01
    ) {

        ep += 100;

    }

    const rarity =
        getRarityFromEP(ep);

    return {

        ep,

        rarity,

        badges

    };

}


/* =========================
   RANDOM NUMBER
========================= */

function randomInt(
    min,
    max
) {

    return Math.floor(
        Math.random() *
        (
            max - min + 1
        )
    ) + min;

}


/* =========================
   WAIT
========================= */

function sleep(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}


/* =========================
   MYTHIC / HOLY SOUND
========================= */

function playMythicSound() {

    try {

        audioContext ||=
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

        if (
            audioContext.state ===
            'suspended'
        ) {

            audioContext.resume();

        }

        const now =
            audioContext.currentTime;

        const notes = [

            261.63,
            329.63,
            392,
            523.25,
            659.25,
            783.99

        ];

        notes.forEach(
            (
                frequency,
                index
            ) => {

                const oscillator =
                    audioContext
                        .createOscillator();

                const gain =
                    audioContext
                        .createGain();

                oscillator.type =
                    index % 2
                        ? 'triangle'
                        : 'sine';

                oscillator.frequency.value =
                    frequency;

                const start =
                    now +
                    index * 0.08;

                gain.gain.setValueAtTime(
                    0.0001,
                    start
                );

                gain.gain.exponentialRampToValueAtTime(
                    0.16,
                    start + 0.025
                );

                gain.gain.exponentialRampToValueAtTime(
                    0.0001,
                    start + 0.55
                );

                oscillator
                    .connect(gain)
                    .connect(
                        audioContext
                            .destination
                    );

                oscillator.start(
                    start
                );

                oscillator.stop(
                    start + 0.6
                );

            }
        );

    } catch (error) {

        console.warn(
            'Audio unavailable:',
            error
        );

    }

}


/* =========================
   TOASTS
========================= */

function showToast(
    message,
    type = ''
) {

    const toast =
        document.createElement(
            'div'
        );

    toast.className =
        `toast ${type}`.trim();

    toast.textContent =
        message;

    $('toastContainer')
        .appendChild(
            toast
        );

    requestAnimationFrame(
        () => {

            toast.classList.add(
                'show'
            );

        }
    );

    setTimeout(
        () => {

            toast.classList.remove(
                'show'
            );

            setTimeout(
                () =>
                    toast.remove(),
                300
            );

        },
        2600
    );

}


/* =========================
   MILESTONES
========================= */

const milestones = [

    [
        'ep1k',
        '1K EP',
        1000,
        state =>
            state.totalEp
    ],

    [
        'ep10k',
        '10K EP',
        10000,
        state =>
            state.totalEp
    ],

    [
        'ep100k',
        '100K EP',
        100000,
        state =>
            state.totalEp
    ],

    [
        'ep1m',
        '1M EP',
        1000000,
        state =>
            state.totalEp
    ],

    [
        'ep10m',
        '10M EP',
        10000000,
        state =>
            state.totalEp
    ],

    [
        'ep100m',
        '100M EP',
        100000000,
        state =>
            state.totalEp
    ],

    [
        'ep1b',
        '1B EP',
        1000000000,
        state =>
            state.totalEp
    ],

    [
        'roll100',
        '100 Rolls',
        100,
        state =>
            state.totalRolls
    ],

    [
        'roll1k',
        '1K Rolls',
        1000,
        state =>
            state.totalRolls
    ],

    [
        'roll10k',
        '10K Rolls',
        10000,
        state =>
            state.totalRolls
    ],

    [
        'roll100k',
        '100K Rolls',
        100000,
        state =>
            state.totalRolls
    ],

    [
        'roll1m',
        '1M Rolls',
        1000000,
        state =>
            state.totalRolls
    ],

    [
        'badge10',
        '10 Badges',
        10,
        state =>
            Object.keys(
                state.foundBadges
            ).length
    ],

    [
        'badge50',
        '50 Badges',
        50,
        state =>
            Object.keys(
                state.foundBadges
            ).length
    ],

    [
        'badge100',
        '100 Badges',
        100,
        state =>
            Object.keys(
                state.foundBadges
            ).length
    ],

    [
        'anomaly10',
        '10 Anomalies',
        10,
        state =>
            state.anomalies
    ],

    [
        'mythic10',
        '10 Mythics',
        10,
        state =>
            state.mythics
    ],

    [
        'holy1',
        'First Holy',
        1,
        state =>
            state.holys
    ],

    [
        'holy5',
        '5 Holies',
        5,
        state =>
            state.holys
    ],

    [
        'holy10',
        '10 Holies',
        10,
        state =>
            state.holys
    ]

];


function checkMilestones() {

    milestones.forEach(
        milestone => {

            const [
                id,
                name,
                target,
                getter
            ] = milestone;

            if (
                getter(state) >=
                    target &&
                !state.milestonesClaimed
                    .includes(id)
            ) {

                state.milestonesClaimed
                    .push(id);

                showToast(
                    `🏆 Milestone unlocked: ${name}`,
                    'success'
                );

            }

        }
    );

}


/* =========================
   ROLL
========================= */

async function roll(
    isAuto = false
) {

    if (rollLocked) {

        return;

    }

    /*
    MINIMUM AND MAXIMUM ARE
    PERMANENTLY LOCKED.

    No user input is used here.
    */

    const min = 0;

    const max =
        MAX_NUMBER;

    rollLocked = true;

    if ($('rollBtn')) {

        $('rollBtn').disabled =
            true;

    }

    const number =
        randomInt(
            min,
            max
        );

    const result =
        analyze(number);

    state.totalRolls += 1;

    state.totalEp +=
        result.ep;

    state.bestEp =
        Math.max(
            state.bestEp,
            result.ep
        );

    /*
    Best number is based on
    the EP earned by the roll.
    */

    if (
        state.bestNumber === null
    ) {

        state.bestNumber =
            number;

    } else {

        const oldBest =
            analyze(
                state.bestNumber
            ).ep;

        if (
            result.ep >
            oldBest
        ) {

            state.bestNumber =
                number;

        }

    }

    state.rarityCounts[
        result.rarity
    ] += 1;

    if (
        result.rarity ===
        'MYTHIC'
    ) {

        state.mythics += 1;

    }

    if (
        result.rarity ===
        'HOLY'
    ) {

        state.holys += 1;

    }

    if (
        result.rarity ===
        'ANOMALY'
    ) {

        state.anomalies += 1;

    }

    if (
        result.rarity ===
        'EPIC'
    ) {

        state.epics += 1;

    }


    /* =========================
       RECORD BADGES
    ========================= */

    result.badges.forEach(
        badge => {

            if (
                !state.foundBadges[
                    badge.id
                ]
            ) {

                state.foundBadges[
                    badge.id
                ] = {

                    name:
                        badge.name,

                    firstNumber:
                        number,

                    ep:
                        badge.ep,

                    foundAt:
                        Date.now()

                };

            }

        }
    );


    /* =========================
       HISTORY
    ========================= */

    const record = {

        number,

        ep:
            result.ep,

        rarity:
            result.rarity,

        badges:
            result.badges.map(
                badge =>
                    badge.name
            ),

        time:
            Date.now()

    };


    state.history.unshift(
        record
    );

    state.history =
        state.history.slice(
            0,
            MAX_HISTORY
        );


    /* =========================
       RARE HISTORY
    ========================= */

    if (
        result.rarity ===
            'ANOMALY' ||
        result.rarity ===
            'MYTHIC' ||
        result.rarity ===
            'HOLY'
    ) {

        state.rareHistory.unshift(
            record
        );

        state.rareHistory =
            state.rareHistory.slice(
                0,
                MAX_RARE_HISTORY
            );

    }


    checkMilestones();

    saveLocal();

    scheduleCloudSave();

    renderAll();


    /* =========================
       MYTHIC / HOLY EVENT
    ========================= */

    if (
        result.rarity ===
            'MYTHIC' ||
        result.rarity ===
            'HOLY'
    ) {

        document.body.classList.add(
            result.rarity ===
                'HOLY'
                ? 'holy'
                : 'mythic'
        );

        playMythicSound();

        showToast(
            result.rarity ===
                'HOLY'
                ? `✦ HOLY — ${formatNumber(number)} — ${formatEP(result.ep)} EP`
                : `🌌 MYTHIC — ${formatNumber(number)} — ${formatEP(result.ep)} EP`,
            result.rarity ===
                'HOLY'
                ? 'holy-toast'
                : 'mythic-toast'
        );

        /*
        AUTO ROLL MUST WAIT
        THE FULL 3 SECONDS.
        */

        await sleep(3000);

        document.body.classList.remove(
            'mythic',
            'holy'
        );

    }


    rollLocked = false;

    if ($('rollBtn')) {

        $('rollBtn').disabled =
            false;

    }

    if (!isAuto && $('rollBtn')) {

        $('rollBtn').focus();

    }

}


/* =========================
   LOCK MIN/MAX INPUTS
========================= */

function lockNumberInputs() {

    const minInput =
        $('minNumber');

    const maxInput =
        $('maxNumber');

    if (minInput) {

        minInput.value = 0;

        minInput.disabled = true;

        minInput.readOnly = true;

        minInput.setAttribute(
            'aria-disabled',
            'true'
        );

    }

    if (maxInput) {

        maxInput.value =
            MAX_NUMBER;

        maxInput.disabled = true;

        maxInput.readOnly = true;

        maxInput.setAttribute(
            'aria-disabled',
            'true'
        );

    }

}


/* =========================
   RENDER RESULT
========================= */

function renderResult(
    record
) {

    $('latestNumber').textContent =
        record
            ? pad(record.number)
            : '—';

    $('latestRarity').textContent =
        record
            ? record.rarity
            : 'READY';

    $('latestEP').textContent =
        record
            ? `${formatEP(record.ep)} EP`
            : '0 EP';

    $('latestEffect').textContent =
        record
            ? (
                record.badges.length
                    ? record.badges.join(
                        ' • '
                    )
                    : 'No special badge'
            )
            : 'Roll to begin';

    $('resultCard').className =
        `result-card ${
            record
                ? record.rarity.toLowerCase()
                : ''
        }`;

}


/* =========================
   RENDER STATS
========================= */

function renderStats() {

    $('totalEp').textContent =
        formatEP(
            state.totalEp
        );

    $('totalRolls').textContent =
        formatNumber(
            state.totalRolls
        );

    $('bestEp').textContent =
        formatEP(
            state.bestEp
        );

    $('bestNumber').textContent =
        state.bestNumber === null
            ? '—'
            : pad(
                state.bestNumber
            );

    $('anomalies').textContent =
        formatNumber(
            state.anomalies
        );

    $('mythics').textContent =
        formatNumber(
            state.mythics
        );

    /*
    Holy counter.
    Works if the HTML contains
    #holys.
    */

    if ($('holys')) {

        $('holys').textContent =
            formatNumber(
                state.holys
            );

    }

    $('badgesFound').textContent =
        `${Object.keys(
            state.foundBadges
        ).length}/${badgeDefs.length}`;

    $('accountName').textContent =
        currentUser
            ? state.username
            : 'Guest';

}


/* =========================
   RENDER RARITIES
========================= */

function renderRarities() {

    $('rarityGrid').innerHTML =
        RARITIES.map(
            rarity => `

                <div class="rarity-item ${rarity.name.toLowerCase()}">

                    <div>

                        <strong>
                            ${rarity.name}
                        </strong>

                        <span>
                            ${rarity.label}
                        </span>

                    </div>

                    <b>
                        ${formatNumber(
                            state.rarityCounts[
                                rarity.name
                            ] || 0
                        )}
                    </b>

                </div>

            `
        ).join('');

}


/* =========================
   HTML ESCAPE
========================= */

function escapeHtml(
    value
) {

    return String(value)
        .replace(
            /[&<>'"]/g,
            character => ({

                '&':
                    '&amp;',

                '<':
                    '&lt;',

                '>':
                    '&gt;',

                "'":
                    '&#39;',

                '"':
                    '&quot;'

            })[character]
        );

}


/* =========================
   RENDER BADGES
========================= */

function renderBadges() {

    const found =
        state.foundBadges;

    const count =
        Object.keys(found).length;

    $('badgeCount').textContent =
        `${count}/${badgeDefs.length}`;

    $('badgeGrid').innerHTML =
        badgeDefs.map(
            badge => {

                const unlocked =
                    Boolean(
                        found[
                            badge.id
                        ]
                    );

                return `

                    <div
                        class="badge ${
                            unlocked
                                ? 'found'
                                : 'locked'
                        }"
                        title="${escapeHtml(
                            badge.description
                        )}"
                    >

                        <div class="badge-icon">
                            ${
                                unlocked
                                    ? '✦'
                                    : '?'
                            }
                        </div>

                        <div class="badge-info">

                            <strong>
                                ${escapeHtml(
                                    badge.name
                                )}
                            </strong>

                            <span>
                                ${
                                    unlocked
                                        ? `${formatEP(
                                            badge.ep
                                        )} EP`
                                        : 'LOCKED'
                                }
                            </span>

                        </div>

                    </div>

                `;

            }
        ).join('');

}


/* =========================
   RENDER MILESTONES
========================= */

function renderMilestones() {

    $('milestoneGrid').innerHTML =
        milestones.map(
            milestone => {

                const [
                    id,
                    name,
                    target,
                    getter
                ] = milestone;

                const value =
                    getter(state);

                const unlocked =
                    state.milestonesClaimed
                        .includes(id) ||
                    value >= target;

                const percentage =
                    Math.min(
                        100,
                        target
                            ? (
                                value /
                                target
                            ) * 100
                            : 100
                    );

                return `

                    <div
                        class="milestone ${
                            unlocked
                                ? 'unlocked'
                                : ''
                        }"
                    >

                        <div class="milestone-top">

                            <strong>
                                ${escapeHtml(
                                    name
                                )}
                            </strong>

                            <span>
                                ${
                                    unlocked
                                        ? 'UNLOCKED'
                                        : `${formatNumber(
                                            value
                                        )} / ${formatNumber(
                                            target
                                        )}`
                                }
                            </span>

                        </div>

                        <div class="progress">

                            <i
                                style="width:${percentage}%"
                            ></i>

                        </div>

                    </div>

                `;

            }
        ).join('');

}


/* =========================
   RENDER HISTORY
========================= */

function renderHistory() {

    $('historyList').innerHTML =
        state.history.length

            ? state.history.map(
                record => `

                    <div
                        class="history-row ${
                            record.rarity.toLowerCase()
                        }"
                    >

                        <span class="history-number">
                            ${pad(
                                record.number
                            )}
                        </span>

                        <span class="history-rarity">
                            ${record.rarity}
                        </span>

                        <span class="history-ep">
                            +${formatEP(
                                record.ep
                            )} EP
                        </span>

                    </div>

                `
            ).join('')

            : `
                <div class="empty">
                    No rolls yet.
                </div>
            `;

}


/* =========================
   ACCOUNT RENDER
========================= */

function renderAccount() {

    $('accountNameInput').value =
        state.username === 'Guest'
            ? ''
            : state.username;

    $('signOutBtn').disabled =
        !currentUser;

    $('cloudNote').textContent =
        SUPABASE_CONFIGURED

            ? (
                currentUser
                    ? `Signed in as ${currentUser.email}`
                    : 'Cloud accounts are available.'
            )

            : 'Cloud accounts are disabled until you add your Supabase project values to script.js.';

}


/* =========================
   RENDER EVERYTHING
========================= */

function renderAll() {

    renderResult(
        state.history[0] ||
        null
    );

    renderStats();

    renderRarities();

    renderBadges();

    renderMilestones();

    renderHistory();

    renderAccount();

}


/* =========================
   RARE DETAILS
========================= */

function openDetails(
    type
) {

    let title;

    if (
        type === 'holy'
    ) {

        title =
            'Holy Rolls';

    } else if (
        type === 'mythic'
    ) {

        title =
            'Mythic Rolls';

    } else {

        title =
            'Anomaly Rolls';

    }

    const records =
        state.rareHistory.filter(
            record => {

                if (
                    type === 'holy'
                ) {

                    return (
                        record.rarity ===
                        'HOLY'
                    );

                }

                if (
                    type === 'mythic'
                ) {

                    return (
                        record.rarity ===
                        'MYTHIC'
                    );

                }

                return (
                    record.rarity ===
                    'ANOMALY'
                );

            }
        );

    $('detailsTitle').textContent =
        `${title} (${records.length})`;

    $('detailsBody').innerHTML =
        records.length

            ? records.map(
                record => `

                    <div class="detail-row">

                        <div>

                            <strong>
                                ${pad(
                                    record.number
                                )}
                            </strong>

                            <span
                                class="${record.rarity.toLowerCase()}"
                            >
                                ${record.rarity}
                            </span>

                        </div>

                        <b>
                            ${formatEP(
                                record.ep
                            )} EP
                        </b>

                        <small>
                            ${
                                record.badges.length
                                    ? escapeHtml(
                                        record.badges.join(
                                            ' • '
                                        )
                                    )
                                    : 'No badges'
                            }
                        </small>

                    </div>

                `
            ).join('')

            : `
                <div class="empty">
                    You have not found any yet.
                </div>
            `;

    $('detailsDialog').showModal();

}


/* =========================
   CLEAR HISTORY
========================= */

function clearHistory() {

    state.history = [];

    saveLocal();

    scheduleCloudSave();

    renderHistory();

}


/* =========================
   RESET
========================= */

function resetStats() {

    const confirmed =
        window.confirm(
            'Reset all RNG Vault progress on this account/device?'
        );

    if (!confirmed) {

        return;

    }

    const username =
        state.username;

    state =
        cloneDefault();

    state.username =
        username;

    saveLocal();

    scheduleCloudSave();

    renderAll();

    showToast(
        'Progress reset.'
    );

}


/* =========================
   AUTO ROLL
========================= */

function toggleAutoRoll() {

    if (autoTimer) {

        clearInterval(
            autoTimer
        );

        autoTimer = null;

        $('autoBtn').textContent =
            'AUTO ROLL: OFF';

        $('autoBtn')
            .classList.remove(
                'active'
            );

        return;

    }

    const delay =
        Number(
            $('autoSpeed').value
        ) || 500;

    autoTimer =
        setInterval(
            () =>
                roll(true),
            delay
        );

    $('autoBtn').textContent =
        'AUTO ROLL: ON';

    $('autoBtn')
        .classList.add(
            'active'
        );

}


/* =========================
   SIGN UP
========================= */

async function signUp() {

    if (!supabaseClient) {

        setAuthStatus(
            'Supabase is not configured. Guest mode still works.'
        );

        return;

    }

    const email =
        $('emailInput')
            .value
            .trim();

    const password =
        $('passwordInput')
            .value;

    const username =
        $('accountNameInput')
            .value
            .trim() ||
        'Player';

    if (
        !email ||
        password.length < 6
    ) {

        setAuthStatus(
            'Enter an email and a password of at least 6 characters.',
            true
        );

        return;

    }

    setAuthStatus(
        'Creating account...'
    );

    const {
        data,
        error
    } =
        await supabaseClient
            .auth
            .signUp({

                email,

                password,

                options: {

                    data: {

                        username:
                            username.slice(
                                0,
                                24
                            )

                    },

                    emailRedirectTo:
                        window.location.origin +
                        window.location.pathname

                }

            });

    if (error) {

        setAuthStatus(
            error.message,
            true
        );

        return;

    }

    state.username =
        username.slice(
            0,
            24
        );

    if (data.session) {

        currentUser =
            data.user;

        await loadCloudForUser(
            currentUser
        );

        showToast(
            'Account created.',
            'success'
        );

    } else {

        setAuthStatus(
            'Account created. Check your email if confirmation is enabled, then sign in.'
        );

    }

}


/* =========================
   SIGN IN
========================= */

async function signIn() {

    if (!supabaseClient) {

        setAuthStatus(
            'Supabase is not configured. Guest mode still works.'
        );

        return;

    }

    const email =
        $('emailInput')
            .value
            .trim();

    const password =
        $('passwordInput')
            .value;

    if (
        !email ||
        !password
    ) {

        setAuthStatus(
            'Enter your email and password.',
            true
        );

        return;

    }

    setAuthStatus(
        'Signing in...'
    );

    const {
        data,
        error
    } =
        await supabaseClient
            .auth
            .signInWithPassword({

                email,

                password

            });

    if (error) {

        setAuthStatus(
            error.message,
            true
        );

        return;

    }

    currentUser =
        data.user;

    await loadCloudForUser(
        currentUser
    );

    $('accountDialog')
        .close();

    showToast(
        'Signed in. Cloud save loaded.',
        'success'
    );

}


/* =========================
   SIGN OUT
========================= */

async function signOut() {

    if (
        !supabaseClient ||
        !currentUser
    ) {

        return;

    }

    await saveCloud();

    const {
        error
    } =
        await supabaseClient
            .auth
            .signOut();

    if (error) {

        setAuthStatus(
            error.message,
            true
        );

        return;

    }

    currentUser = null;

    state =
        loadLocalState();

    state.username =
        'Guest';

    renderAll();

    setAuthStatus(
        'Signed out.'
    );

    showToast(
        'Signed out.'
    );

}


/* =========================
   AUTH INITIALIZATION
========================= */

function initAuth() {

    if (!supabaseClient) {

        setAuthStatus(
            'Guest mode active. Add Supabase settings to enable accounts.'
        );

        return;

    }

    supabaseClient
        .auth
        .getSession()
        .then(
            async ({ data }) => {

                currentUser =
                    data.session
                        ? data.session.user
                        : null;

                if (currentUser) {

                    await loadCloudForUser(
                        currentUser
                    );

                }

                renderAll();

            }
        );

    supabaseClient
        .auth
        .onAuthStateChange(
            (
                _event,
                session
            ) => {

                currentUser =
                    session
                        ? session.user
                        : null;

                renderAll();

            }
        );

}


/* =========================
   INITIALIZATION
========================= */

function init() {

    $('rollBtn')
        .addEventListener(
            'click',
            () =>
                roll(false)
        );

    $('autoBtn')
        .addEventListener(
            'click',
            toggleAutoRoll
        );

    $('resetBtn')
        .addEventListener(
            'click',
            resetStats
        );

    $('clearHistoryBtn')
        .addEventListener(
            'click',
            clearHistory
        );

    $('anomalyStat')
        .addEventListener(
            'click',
            () =>
                openDetails(
                    'anomaly'
                )
        );

    $('mythicStat')
        .addEventListener(
            'click',
            () =>
                openDetails(
                    'mythic'
                )
        );

    /*
    Holy stat is optional so the
    script doesn't break if the
    current HTML doesn't have it.
    */

    if ($('holyStat')) {

        $('holyStat')
            .addEventListener(
                'click',
                () =>
                    openDetails(
                        'holy'
                    )
            );

    }

    $('accountBtn')
        .addEventListener(
            'click',
            () =>
                $('accountDialog')
                    .showModal()
        );

    $('closeAccountBtn')
        .addEventListener(
            'click',
            () =>
                $('accountDialog')
                    .close()
        );

    $('closeDetailsBtn')
        .addEventListener(
            'click',
            () =>
                $('detailsDialog')
                    .close()
        );

    $('signInBtn')
        .addEventListener(
            'click',
            signIn
        );

    $('signUpBtn')
        .addEventListener(
            'click',
            signUp
        );

    $('signOutBtn')
        .addEventListener(
            'click',
            signOut
        );

    $('guestBtn')
        .addEventListener(
            'click',
            () => {

                currentUser =
                    null;

                $('accountDialog')
                    .close();

                showToast(
                    'Guest mode. Progress stays on this device.'
                );

            }
        );


    /* =========================
       LOCK MIN/MAX
    ========================= */

    lockNumberInputs();


    /* =========================
       SPACE TO ROLL
    ========================= */

    document.addEventListener(
        'keydown',
        event => {

            if (
                event.code ===
                    'Space' &&
                ![
                    'INPUT',
                    'TEXTAREA',
                    'SELECT'
                ].includes(
                    document.activeElement
                        .tagName
                )
            ) {

                event.preventDefault();

                roll(false);

            }

        }
    );


    /* =========================
       SAVE BEFORE LEAVING
    ========================= */

    window.addEventListener(
        'beforeunload',
        () => {

            saveLocal();

        }
    );


    renderAll();

    initAuth();

}


/* =========================
   START
========================= */

document.addEventListener(
    'DOMContentLoaded',
    init
);
```
