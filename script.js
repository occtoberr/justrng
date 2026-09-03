/* =========================================================
   RNG VAULT
   Online version
========================================================= */


/* =========================================================
   SUPABASE CONFIG
========================================================= */

/*
    IMPORTANT:

    Replace these two values with the values from your
    Supabase project.

    NEVER put a Supabase secret/service_role key here.
    Only use the public/publishable browser key.
*/

const SUPABASE_URL =
    "YOUR_SUPABASE_PROJECT_URL";

const SUPABASE_KEY =
    "YOUR_SUPABASE_PUBLISHABLE_KEY";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


/* =========================================================
   STORAGE
========================================================= */

const LOCAL_STORAGE_KEY =
    "rng-vault-local-v5";


/* =========================================================
   RARITIES
========================================================= */

const RARITIES = [

    {
        name: "TRASH",
        min: 0
    },

    {
        name: "COMMON",
        min: 10000
    },

    {
        name: "UNCOMMON",
        min: 500000
    },

    {
        name: "RARE",
        min: 750000
    },

    {
        name: "EPIC",
        min: 900000
    },

    {
        name: "ANOMALY",
        min: 950000
    },

    {
        name: "MYTHIC",
        min: 990000
    }

];


/* =========================================================
   MILESTONES
========================================================= */

const MILESTONES = [

    {
        ep: 1000,
        name: "First Thousand",
        reward: 100
    },

    {
        ep: 10000,
        name: "Ten Thousand",
        reward: 250
    },

    {
        ep: 100000,
        name: "Hundred Thousand",
        reward: 500
    },

    {
        ep: 1000000,
        name: "EP Millionaire",
        reward: 1000
    },

    {
        ep: 10000000,
        name: "Ten Million EP",
        reward: 2500
    },

    {
        ep: 100000000,
        name: "Hundred Million EP",
        reward: 5000
    },

    {
        ep: 1000000000,
        name: "EP Billionaire",
        reward: 10000
    },

    {
        ep: 10000000000,
        name: "EP Legend",
        reward: 25000
    },

    {
        ep: 100000000000,
        name: "EP God",
        reward: 100000
    },

    {
        ep: 1000000000000,
        name: "TRILLION EP",
        reward: 1000000
    }

];


/* =========================================================
   BADGES
========================================================= */

const BADGE_DEFS = [

    ["single", "Single Digit", 10,
        n => n < 10],

    ["zero", "Zero", 50,
        n => n === 0],

    ["one", "The One", 50000,
        n => n === 1],

    ["two", "The Two", 30000,
        n => n === 2],

    ["three", "The Three", 20000,
        n => n === 3],

    ["four", "The Four", 15000,
        n => n === 4],

    ["five", "The Five", 12000,
        n => n === 5],

    ["six", "The Six", 10000,
        n => n === 6],

    ["seven", "The Seven", 10000,
        n => n === 7],

    ["eight", "The Eight", 10000,
        n => n === 8],

    ["nine", "The Nine", 10000,
        n => n === 9],

    ["even", "Even", 5,
        n => n % 2 === 0],

    ["odd", "Odd", 5,
        n => n % 2 === 1],

    ["prime", "Prime", 80,
        isPrime],

    ["pal", "Palindrome", 100,
        palindrome],

    ["repeat", "Repeating Digits", 75,
        n =>
            new Set(digits(n)).size <
            digits(n).length],

    ["unique", "All Unique", 150,
        n =>
            new Set(digits(n)).size ===
            digits(n).length],

    ["asc", "Ascending", 150,
        ascending],

    ["desc", "Descending", 150,
        descending],

    ["neighbors", "Neighbors", 80,
        neighbors],

    ["echo", "Echo", 250,
        n => /^(\d+)\1$/.test(String(n))],

    ["hetero", "Heterogeneous", 50,
        n =>
            new Set(digits(n)).size ===
            digits(n).length],

    ["harshad", "Harshad", 120,
        n =>
            n > 0 &&
            n % digitSum(n) === 0],

    ["spy", "Spy", 150,
        n =>
            n > 0 &&
            digitSum(n) ===
            digitProduct(n)],

    ["fibo", "Fibonacci", 300,
        fibonacci],

    ["square", "Perfect Square", 400,
        perfectSquare],

    ["power2", "Power of Two", 500,
        n => powerOf(n, 2)],

    ["power3", "Power of Three", 700,
        n => powerOf(n, 3)],

    ["factorial", "Factorial", 1200,
        factorial],

    ["pair", "Double Pair", 300,
        n =>
            /(00|11|22|33|44|55|66|77|88|99)/
                .test(String(n))],

    ["twopair", "Two Pairs", 700,
        n => countRepeatedDigits(n) >= 2],

    ["triple", "Triple", 1000,
        n => /(.)\1\1/.test(String(n))],

    ["quad", "Quad", 3000,
        n => /(.)\1\1\1/.test(String(n))],

    ["pent", "Five Stack", 10000,
        n => /(.)\1\1\1\1/.test(String(n))],

    ["hex", "Six Stack", 50000,
        n => /(.)\1\1\1\1\1/.test(String(n))],

    ["nice", "Nice", 690,
        n => n === 69],

    ["blaze", "Blaze", 4200,
        n => n === 420],

    ["answer", "The Answer", 4200,
        n => n === 42],

    ["beast", "The Beast", 6666,
        n => n === 666],

    ["lucky7", "Lucky Seven", 777,
        n => n % 7 === 0],

    ["lucky13", "Unlucky 13", 1300,
        n => n % 13 === 0],

    ["seq123", "123", 1234,
        n => String(n).includes("123")],

    ["double", "Double Number", 500,
        n => {

            const s = String(n);

            return (
                s.length % 2 === 0 &&
                s.slice(
                    0,
                    s.length / 2
                ) ===
                s.slice(
                    s.length / 2
                )
            );

        }],

    ["mirror", "Mirror", 800,
        palindrome],

    ["centerzero", "Center Zero", 600,
        n => {

            const s = String(n);

            return (
                s.length >= 3 &&
                s[
                    Math.floor(s.length / 2)
                ] === "0"
            );

        }],

    ["endszero", "Zero Ends", 400,
        n => n % 10 === 0],

    ["doublezero", "Double Zero", 900,
        n => String(n).includes("00")],

    ["alllow", "All Low", 1000,
        n => digits(n).every(x => x <= 3)],

    ["allhigh", "All High", 1000,
        n => digits(n).every(x => x >= 6)],

    ["allodd", "All Odd", 2000000,
        n => digits(n).every(x => x % 2 === 1)],

    ["alleven", "All Even", 2000000,
        n => digits(n).every(x => x % 2 === 0)],

    ["alternating", "Alternating", 1200,
        alternatingParity],

    ["stairs", "Stairs", 1500,
        constantSpacing],

    ["sum10", "Digit Sum 10", 800,
        n => digitSum(n) === 10],

    ["sum20", "Digit Sum 20", 1200,
        n => digitSum(n) === 20],

    ["sum30", "Digit Sum 30", 3000,
        n => digitSum(n) === 30],

    ["sum40", "Digit Sum 40", 10000,
        n => digitSum(n) === 40],

    ["perfect10", "Perfect Ten", 2000,
        n =>
            n > 0 &&
            n % 10 === 0 &&
            digitSum(n) === 10],

    ["perfect100", "Perfect Hundred", 5000,
        n =>
            n > 0 &&
            n % 100 === 0],

    ["fivezeros", "Five Zeros", 5000,
        n =>
            (String(n).match(/0/g) || [])
                .length >= 5],

    ["fivedigits", "Five Digits", 10,
        n => n >= 10000],

    ["sixdigits", "Six Digits", 20,
        n => n >= 100000],

    ["binary", "Binary", 1000000,
        n => /^[01]+$/.test(String(n))],

    ["ternary", "Ternary", 1200000,
        n => /^[012]+$/.test(String(n))],

    ["basefour", "Base Four", 1500000,
        n => /^[0-3]+$/.test(String(n))],

    ["basefive", "Base Five", 1800000,
        n => /^[0-4]+$/.test(String(n))],

    ["123456", "Perfect Sequence", 500000,
        n => n === 123456],

    ["654321", "Reverse Sequence", 500000,
        n => n === 654321],

    ["111111", "Six Ones", 800000,
        n => n === 111111],

    ["222222", "Six Twos", 800000,
        n => n === 222222],

    ["333333", "Six Threes", 800000,
        n => n === 333333],

    ["444444", "Six Fours", 800000,
        n => n === 444444],

    ["555555", "Six Fives", 800000,
        n => n === 555555],

    ["666666", "Six Sixes", 900000,
        n => n === 666666],

    ["777777", "Six Sevens", 1000000,
        n => n === 777777],

    ["888888", "Six Eights", 900000,
        n => n === 888888],

    ["999999", "Six Nines", 1000000,
        n => n === 999999],

    ["696969", "Nice Nice Nice", 750000,
        n => n === 696969],

    ["420420", "Double Blaze", 750000,
        n => n === 420420],

    ["314159", "Pi", 1500000,
        n => n === 314159],

    ["271828", "Euler", 1500000,
        n => n === 271828],

    ["161803", "Golden Ratio", 1500000,
        n => n === 161803],

    ["867530", "Jenny", 2000000,
        n => n === 867530],

    ["800813", "Ancient Meme", 2000000,
        n => n === 800813],

    ["420069", "Cursed Blaze", 3000000,
        n => n === 420069],

    ["perfectpal6", "Perfect Six", 5000000,
        n => {

            const s = String(n);

            return (
                s.length === 6 &&
                s ===
                [...s]
                    .reverse()
                    .join("")
            );

        }],

    ["allunique6", "Six Unique", 2500000,
        n => {

            const s = String(n);

            return (
                s.length === 6 &&
                new Set(s).size === 6
            );

        }],

    ["million", "One Million", 250000000,
        n => n === 1000000],

    ["god1", "Reality Breaker", 25000000,
        n => n === 999998],

    ["god2", "System Error", 50000000,
        n => n === 999997],

    ["god3", "Impossible", 100000000,
        n => n === 999996]

];


/* =========================================================
   STATE
========================================================= */

let state = createFreshState();

let currentUser = null;

let authMode = "signin";

let saveTimer = null;

let onlineSaveReady = false;


function createFreshState() {

    const rarityCounts = {};

    for (const rarity of RARITIES) {

        rarityCounts[
            rarity.name
        ] = 0;

    }


    return {

        username: "",

        totalEp: 0,

        totalRolls: 0,

        bestEp: 0,

        bestNumber: null,

        mythics: 0,

        anomalies: 0,

        epics: 0,

        rarityCounts,

        foundBadges: {},

        history: [],

        rarityHistory: {

            ANOMALY: [],

            MYTHIC: []

        },

        milestones: []

    };

}


/* =========================================================
   HELPERS
========================================================= */

function $(id) {

    return document.getElementById(id);

}


function digits(n) {

    return String(n)
        .split("")
        .map(Number);

}


function digitSum(n) {

    return digits(n)
        .reduce(
            (a, b) => a + b,
            0
        );

}


function digitProduct(n) {

    return digits(n)
        .reduce(
            (a, b) => a * b,
            1
        );

}


function palindrome(n) {

    const s = String(n);

    return (
        s ===
        [...s].reverse().join("")
    );

}


function isPrime(n) {

    if (n < 2)
        return false;

    if (n === 2)
        return true;

    if (n % 2 === 0)
        return false;

    for (
        let i = 3;
        i * i <= n;
        i += 2
    ) {

        if (n % i === 0)
            return false;

    }

    return true;

}


function fibonacci(n) {

    if (n < 0)
        return false;

    let a = 0;

    let b = 1;

    while (a < n) {

        [
            a,
            b
        ] = [
            b,
            a + b
        ];

    }

    return a === n;

}


function perfectSquare(n) {

    return Number.isInteger(
        Math.sqrt(n)
    );

}


function powerOf(n, base) {

    if (n < 1)
        return false;

    while (
        n % base === 0
    ) {

        n /= base;

    }

    return n === 1;

}


function factorial(n) {

    if (n < 1)
        return false;

    let x = 1;

    for (
        let i = 2;
        i <= n;
        i++
    ) {

        x *= i;

        if (x > 1000000)
            return false;

    }

    return x === n;

}


function ascending(n) {

    const d = digits(n);

    if (d.length < 2)
        return false;

    for (
        let i = 1;
        i < d.length;
        i++
    ) {

        if (
            d[i] <
            d[i - 1]
        ) {

            return false;

        }

    }

    return true;

}


function descending(n) {

    const d = digits(n);

    if (d.length < 2)
        return false;

    for (
        let i = 1;
        i < d.length;
        i++
    ) {

        if (
            d[i] >
            d[i - 1]
        ) {

            return false;

        }

    }

    return true;

}


function neighbors(n) {

    const d = digits(n);

    if (d.length < 2)
        return false;

    for (
        let i = 1;
        i < d.length;
        i++
    ) {

        if (
            Math.abs(
                d[i] -
                d[i - 1]
            ) !== 1
        ) {

            return false;

        }

    }

    return true;

}


function alternatingParity(n) {

    const d = digits(n);

    if (d.length < 3)
        return false;

    for (
        let i = 1;
        i < d.length;
        i++
    ) {

        if (
            d[i] % 2 ===
            d[i - 1] % 2
        ) {

            return false;

        }

    }

    return true;

}


function constantSpacing(n) {

    const d = digits(n);

    if (d.length < 3)
        return false;

    const difference =
        d[1] - d[0];

    for (
        let i = 2;
        i < d.length;
        i++
    ) {

        if (
            d[i] -
            d[i - 1] !==
            difference
        ) {

            return false;

        }

    }

    return true;

}


function countRepeatedDigits(n) {

    const counts = {};

    for (
        const d of digits(n)
    ) {

        counts[d] =
            (counts[d] || 0) + 1;

    }

    return Object
        .values(counts)
        .filter(
            x => x >= 2
        )
        .length;

}


function getBadge(id) {

    return BADGE_DEFS.find(
        badge =>
            badge[0] === id
    );

}


function getBadgeIds(number) {

    const found = [];

    for (
        const badge of BADGE_DEFS
    ) {

        const [
            id,
            name,
            ep,
            condition
        ] = badge;

        try {

            if (
                condition(number)
            ) {

                found.push(id);

            }

        } catch {

            // Ignore malformed conditions.

        }

    }

    return found;

}


function getRarity(number) {

    if (number >= 990000)
        return "MYTHIC";

    if (number >= 950000)
        return "ANOMALY";

    if (number >= 900000)
        return "EPIC";

    if (number >= 750000)
        return "RARE";

    if (number >= 500000)
        return "UNCOMMON";

    if (number < 10000)
        return "TRASH";

    return "COMMON";

}


function formatNumber(n) {

    return Number(n || 0)
        .toLocaleString();

}


/* =========================================================
   ANALYSIS
========================================================= */

function analyze(number) {

    const badgeIds =
        getBadgeIds(number);

    let ep = 0;

    for (
        const id of badgeIds
    ) {

        ep += getBadge(id)[2];

    }


    let effect = "None";

    const luck =
        Math.random();


    if (luck < 0.00001) {

        ep += 1000000;

        effect =
            "COSMIC LUCK";

    }

    else if (
        luck < 0.0001
    ) {

        ep += 100000;

        effect =
            "EXTREME LUCK";

    }

    else if (
        luck < 0.001
    ) {

        ep += 10000;

        effect =
            "LUCKY BURST";

    }


    return {

        number,

        rarity:
            getRarity(number),

        ep,

        badgeIds,

        effect

    };

}


/* =========================================================
   ROLL
========================================================= */

async function roll() {

    if (
        $("rollButton").disabled
    ) {

        return;

    }


    const min =
        Number(
            $("minNumber").value
        );

    const max =
        Number(
            $("maxNumber").value
        );


    if (
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        min < 0 ||
        max > 1000000 ||
        min > max
    ) {

        alert(
            "Numbers must be between 0 and 1,000,000."
        );

        return;

    }


    const number =
        Math.floor(
            Math.random() *
            (max - min + 1)
        ) + min;


    const result =
        analyze(number);


    state.totalRolls++;

    state.totalEp += result.ep;


    if (
        result.ep >
        state.bestEp
    ) {

        state.bestEp =
            result.ep;

        state.bestNumber =
            number;

    }


    state.rarityCounts[
        result.rarity
    ] =
        (
            state.rarityCounts[
                result.rarity
            ] || 0
        ) + 1;


    if (
        result.rarity ===
        "MYTHIC"
    ) {

        state.mythics++;


        state.rarityHistory
            .MYTHIC
            .unshift({

                number,

                ep:
                    result.ep,

                badges:
                    result.badgeIds
                        .map(
                            id =>
                                getBadge(id)[1]
                        ),

                time:
                    Date.now()

            });


        state.rarityHistory
            .MYTHIC =
            state.rarityHistory
                .MYTHIC
                .slice(
                    0,
                    500
                );

    }


    if (
        result.rarity ===
        "ANOMALY"
    ) {

        state.anomalies++;


        state.rarityHistory
            .ANOMALY
            .unshift({

                number,

                ep:
                    result.ep,

                badges:
                    result.badgeIds
                        .map(
                            id =>
                                getBadge(id)[1]
                        ),

                time:
                    Date.now()

            });


        state.rarityHistory
            .ANOMALY =
            state.rarityHistory
                .ANOMALY
                .slice(
                    0,
                    500
                );

    }


    if (
        result.rarity ===
        "EPIC"
    ) {

        state.epics++;

    }


    for (
        const id of
        result.badgeIds
    ) {

        if (
            !state.foundBadges[id]
        ) {

            state.foundBadges[id] = {

                firstNumber:
                    number,

                firstEp:
                    result.ep,

                foundAt:
                    Date.now()

            };

        }

    }


    state.history.unshift(
        result
    );


    state.history =
        state.history.slice(
            0,
            100
        );


    checkMilestones();


    saveLocal();

    renderAll();


    if (
        result.rarity ===
        "MYTHIC"
    ) {

        await mythicEffect(
            result
        );

    }


    queueOnlineSave();

}


/* =========================================================
   MILESTONES
========================================================= */

function checkMilestones() {

    for (
        const milestone
        of MILESTONES
    ) {

        if (
            state.totalEp >=
            milestone.ep &&
            !state.milestones
                .includes(
                    milestone.ep
                )
        ) {

            state.milestones
                .push(
                    milestone.ep
                );


            showMilestone(
                milestone.name,
                `+${formatNumber(
                    milestone.reward
                )} bonus EP`
            );

        }

    }

}


/* =========================================================
   SOUND
========================================================= */

function playMythicSound() {

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContext)
            return;


        const ctx =
            new AudioContext();


        const notes = [

            [261.63, 0],

            [329.63, .18],

            [392.00, .36],

            [523.25, .55],

            [659.25, .80],

            [783.99, 1.05],

            [1046.50, 1.30]

        ];


        for (
            const [
                frequency,
                delay
            ] of notes
        ) {

            const oscillator =
                ctx.createOscillator();

            const gain =
                ctx.createGain();


            oscillator.type =
                "sine";

            oscillator.frequency.value =
                frequency;


            oscillator.connect(gain);

            gain.connect(
                ctx.destination
            );


            const start =
                ctx.currentTime +
                delay;


            gain.gain.setValueAtTime(
                0,
                start
            );


            gain.gain
                .linearRampToValueAtTime(
                    .18,
                    start + .03
                );


            gain.gain
                .exponentialRampToValueAtTime(
                    .001,
                    start + .8
                );


            oscillator.start(start);

            oscillator.stop(
                start + .8
            );

        }


        setTimeout(
            () => ctx.close(),
            3500
        );

    }

    catch (error) {

        console.log(
            "Audio unavailable:",
            error
        );

    }

}


/* =========================================================
   MYTHIC EFFECT
========================================================= */

function mythicEffect(result) {

    return new Promise(
        resolve => {

            const button =
                $("rollButton");


            button.disabled =
                true;


            playMythicSound();


            const screen =
                document.createElement(
                    "div"
                );


            screen.className =
                "mythic-screen";


            screen.innerHTML = `

                <div
                    class="mythic-screen-text"
                >

                    ✦ MYTHIC ✦

                    <div
                        style="
                            font-size:35px;
                            margin-top:20px;
                            letter-spacing:2px;
                        "
                    >

                        ${result.number.toLocaleString()}

                    </div>


                    <div
                        style="
                            font-size:25px;
                            margin-top:10px;
                            letter-spacing:1px;
                        "
                    >

                        ${formatNumber(
                            result.ep
                        )} EP

                    </div>

                </div>

            `;


            document.body.appendChild(
                screen
            );


            setTimeout(
                () => {

                    screen.remove();

                    button.disabled =
                        false;

                    resolve();

                },
                3000
            );

        }
    );

}


/* =========================================================
   MILESTONE TOAST
========================================================= */

function showMilestone(
    name,
    reward
) {

    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        "milestone-toast";


    toast.innerHTML = `

        <strong>
            🏆 MILESTONE!
        </strong>

        <span>
            ${name}
        </span>

        <br>

        <span>
            ${reward}
        </span>

    `;


    document.body.appendChild(
        toast
    );


    setTimeout(
        () => toast.remove(),
        5000
    );

}


/* =========================================================
   RARITY HISTORY
========================================================= */

function showRarityHistory(type) {

    const entries =
        state.rarityHistory[type] ||
        [];


    const popup =
        document.createElement(
            "div"
        );


    popup.className =
        "rarity-popup";


    const title =
        type === "MYTHIC"
            ? "✦ Mythic Discoveries"
            : "◆ Anomaly Discoveries";


    let html = `

        <div
            class="rarity-popup-box"
        >

            <button
                class="close-rarity"
            >
                ×
            </button>

            <h2>
                ${title}
            </h2>

    `;


    if (
        entries.length === 0
    ) {

        html += `

            <p
                style="
                    color:var(--muted)
                "
            >

                You haven't found any
                ${type.toLowerCase()}
                numbers yet.

            </p>

        `;

    }

    else {

        for (
            const entry
            of entries
        ) {

            html += `

                <div
                    class="rarity-entry"
                >

                    <div
                        class="
                            rarity-entry-number
                        "
                    >

                        ${entry.number.toLocaleString()}

                    </div>


                    <div>

                        ${formatNumber(
                            entry.ep
                        )} EP

                    </div>


                    <div
                        class="
                            rarity-entry-badges
                        "
                    >

                        <strong>
                            Badges:
                        </strong>

                        <br>

                        ${
                            entry.badges.length
                                ? entry.badges.join(
                                    " • "
                                )
                                : "No badges"
                        }

                    </div>

                </div>

            `;

        }

    }


    html += `
        </div>
    `;


    popup.innerHTML =
        html;


    document.body.appendChild(
        popup
    );


    popup.addEventListener(
        "click",
        event => {

            if (
                event.target === popup ||
                event.target
                    .classList
                    .contains(
                        "close-rarity"
                    )
            ) {

                popup.remove();

            }

        }
    );

}


/* =========================================================
   RENDER
========================================================= */

function renderStats() {

    $("totalEp")
        .textContent =
        formatNumber(
            state.totalEp
        );


    $("totalRolls")
        .textContent =
        formatNumber(
            state.totalRolls
        );


    $("bestEp")
        .textContent =
        formatNumber(
            state.bestEp
        );


    $("bestNumber")
        .textContent =
        state.bestNumber === null
            ? "—"
            : state.bestNumber
                .toLocaleString();


    $("mythics")
        .textContent =
        formatNumber(
            state.mythics
        );


    $("anomalies")
        .textContent =
        formatNumber(
            state.anomalies
        );


    $("badgesFound")
        .textContent =
        `${Object.keys(
            state.foundBadges
        ).length}/${BADGE_DEFS.length}`;

}


function renderRarities() {

    const container =
        $("rarityCollection");


    container.innerHTML = "";


    for (
        const rarity of RARITIES
    ) {

        const count =
            state.rarityCounts[
                rarity.name
            ] || 0;


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "rarity-card";


        card.innerHTML = `

            <div
                class="rarity-name"
            >

                ${rarity.name}

            </div>


            <div
                class="rarity-count"
            >

                ${formatNumber(
                    count
                )}

            </div>


            <div
                class="rarity-percent"
            >

                ${
                    state.totalRolls
                        ? (
                            count /
                            state.totalRolls *
                            100
                        ).toFixed(3)
                        : "0.000"
                }%

            </div>

        `;


        container.appendChild(
            card
        );

    }

}


function renderBadges() {

    const container =
        $("badgeCollection");


    container.innerHTML = "";


    for (
        const badge of BADGE_DEFS
    ) {

        const [
            id,
            name,
            ep
        ] = badge;


        const found =
            state.foundBadges[id];


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "badge-card" +
            (
                found
                    ? " found"
                    : ""
            );


        card.innerHTML = `

            <div
                class="badge-name"
            >

                ${
                    found
                        ? "✓ "
                        : "?"
                }

                ${name}

            </div>


            <div
                class="badge-ep"
            >

                ${formatNumber(
                    ep
                )}

                EP

            </div>


            <div
                class="badge-status"
            >

                ${
                    found
                        ? `First found:
                           ${found.firstNumber.toLocaleString()}`
                        : "Undiscovered"
                }

            </div>

        `;


        container.appendChild(
            card
        );

    }

}


function renderMilestones() {

    const container =
        $("milestoneCollection");


    container.innerHTML = "";


    for (
        const milestone
        of MILESTONES
    ) {

        const completed =
            state.milestones
                .includes(
                    milestone.ep
                );


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "milestone-card" +
            (
                completed
                    ? " completed"
                    : ""
            );


        card.innerHTML = `

            <div
                class="milestone-name"
            >

                ${
                    completed
                        ? "✓ "
                        : ""
                }

                ${milestone.name}

            </div>


            <div
                class="
                    milestone-requirement
                "
            >

                ${formatNumber(
                    milestone.ep
                )}

                total EP

            </div>


            <div
                class="
                    milestone-reward
                "
            >

                Reward:
                ${formatNumber(
                    milestone.reward
                )} EP

            </div>

        `;


        container.appendChild(
            card
        );

    }

}


function renderHistory() {

    const container =
        $("history");


    container.innerHTML = "";


    if (
        state.history.length === 0
    ) {

        container.innerHTML = `

            <div
                style="
                    padding:20px;
                    color:var(--muted);
                    text-align:center;
                "
            >

                No rolls yet.

            </div>

        `;

        return;

    }


    for (
        const result
        of state.history
    ) {

        const entry =
            document.createElement(
                "div"
            );


        entry.className =
            "history-entry";


        entry.innerHTML = `

            <div
                class="history-number"
            >

                ${result.number.toLocaleString()}

            </div>


            <div
                class="history-rarity"
            >

                ${result.rarity}

            </div>


            <div
                class="history-ep"
            >

                ${formatNumber(
                    result.ep
                )} EP

            </div>

        `;


        container.appendChild(
            entry
        );

    }

}


function renderAccount() {

    if (currentUser) {

        $("accountStatus")
            .textContent =
            state.username ||
            currentUser.email ||
            "Online";

    }

    else {

        $("accountStatus")
            .textContent =
            state.username ||
            "Guest";

    }

}


function renderAll() {

    renderStats();

    renderRarities();

    renderBadges();

    renderMilestones();

    renderHistory();

    renderAccount();

}


/* =========================================================
   LOCAL SAVE
========================================================= */

function saveLocal() {

    try {

        localStorage.setItem(
            LOCAL_STORAGE_KEY,
            JSON.stringify(state)
        );

    }

    catch (error) {

        console.log(
            "Local save failed:",
            error
        );

    }

}


function loadLocal() {

    try {

        const saved =
            localStorage.getItem(
                LOCAL_STORAGE_KEY
            );


        if (!saved)
            return;


        const parsed =
            JSON.parse(saved);


        state = mergeState(
            createFreshState(),
            parsed
        );

    }

    catch (error) {

        console.log(
            "Local load failed:",
            error
        );

    }

}


function mergeState(
    base,
    incoming
) {

    return {

        ...base,

        ...incoming,

        rarityCounts: {

            ...base.rarityCounts,

            ...(incoming.rarityCounts || {})

        },

        foundBadges: {

            ...(incoming.foundBadges || {})

        },

        history:
            Array.isArray(
                incoming.history
            )
                ? incoming.history
                : [],

        rarityHistory: {

            ANOMALY:
                incoming.rarityHistory
                    ?.ANOMALY || [],

            MYTHIC:
                incoming.rarityHistory
                    ?.MYTHIC || []

        },

        milestones:
            Array.isArray(
                incoming.milestones
            )
                ? incoming.milestones
                : []

    };

}


/* =========================================================
   ONLINE SAVE
========================================================= */

function queueOnlineSave() {

    if (
        !currentUser ||
        !onlineSaveReady
    ) {

        return;

    }


    clearTimeout(
        saveTimer
    );


    saveTimer =
        setTimeout(
            saveOnline,
            700
        );

}


async function saveOnline() {

    if (
        !currentUser ||
        !onlineSaveReady
    ) {

        return;

    }


    try {

        const {
            error
        } =
            await supabaseClient
                .from("game_saves")
                .upsert(

                    {

                        user_id:
                            currentUser.id,

                        username:
                            state.username,

                        save_data:
                            state,

                        updated_at:
                            new Date()
                                .toISOString()

                    },

                    {

                        onConflict:
                            "user_id"

                    }

                );


        if (error) {

            console.error(
                "Online save error:",
                error
            );

            return;

        }


        console.log(
            "Online save complete."
        );

    }

    catch (error) {

        console.error(
            "Online save failed:",
            error
        );

    }

}


/* =========================================================
   ONLINE LOAD
========================================================= */

async function loadOnline() {

    if (!currentUser)
        return;


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("game_saves")
                .select(
                    "username, save_data"
                )
                .eq(
                    "user_id",
                    currentUser.id
                )
                .maybeSingle();


        if (error) {

            console.error(
                "Online load error:",
                error
            );

            return;

        }


        if (
            data &&
            data.save_data
        ) {

            state =
                mergeState(
                    createFreshState(),
                    data.save_data
                );


            if (
                data.username
            ) {

                state.username =
                    data.username;

            }


            saveLocal();

        }

        else {

            /*
                First login on this account:
                upload whatever local progress
                currently exists.
            */

            await saveOnline();

        }


        onlineSaveReady =
            true;


        renderAll();

    }

    catch (error) {

        console.error(
            "Online load failed:",
            error
        );

    }

}


/* =========================================================
   AUTH MODE
========================================================= */

function updateAuthMode() {

    if (
        authMode === "signin"
    ) {

        $("accountTitle")
            .textContent =
            "Sign in";

        $("accountDescription")
            .textContent =
            "Sign in to load your saved progress.";

        $("authButton")
            .textContent =
            "Sign In";

        $("switchAuthMode")
            .textContent =
            "Need an account? Sign up";

        $("passwordInput")
            .autocomplete =
            "current-password";

    }

    else {

        $("accountTitle")
            .textContent =
            "Create account";

        $("accountDescription")
            .textContent =
            "Create an account to save your progress across devices.";

        $("authButton")
            .textContent =
            "Create Account";

        $("switchAuthMode")
            .textContent =
            "Already have an account? Sign in";

        $("passwordInput")
            .autocomplete =
            "new-password";

    }

}


function showAuthMessage(
    message
) {

    $("authMessage")
        .textContent =
        message;

}


function openAccount() {

    if (currentUser) {

        $("loggedOutPanel")
            .classList
            .add("hidden");

        $("loggedInPanel")
            .classList
            .remove("hidden");

        $("accountTitle")
            .textContent =
            "Your Account";

        $("accountDescription")
            .textContent =
            "Your progress is synchronized online.";

        $("loggedInEmail")
            .textContent =
            currentUser.email || "";

    }

    else {

        $("loggedOutPanel")
            .classList
            .remove("hidden");

        $("loggedInPanel")
            .classList
            .add("hidden");

        updateAuthMode();

    }


    showAuthMessage("");

    $("accountDialog")
        .showModal();

}


/* =========================================================
   SIGN UP / SIGN IN
========================================================= */

async function authenticate() {

    const email =
        $("emailInput")
            .value
            .trim();

    const password =
        $("passwordInput")
            .value;


    if (!email) {

        showAuthMessage(
            "Enter an email address."
        );

        return;

    }


    if (
        password.length < 6
    ) {

        showAuthMessage(
            "Password must be at least 6 characters."
        );

        return;

    }


    $("authButton")
        .disabled = true;


    showAuthMessage(
        authMode === "signin"
            ? "Signing in..."
            : "Creating account..."
    );


    try {

        if (
            authMode ===
            "signup"
        ) {

            const username =
                $("usernameInput")
                    .value
                    .trim();


            if (!username) {

                showAuthMessage(
                    "Choose a username."
                );

                $("authButton")
                    .disabled =
                    false;

                return;

            }


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

                                username

                            }

                        }

                    });


            if (error)
                throw error;


            if (
                data.session
            ) {

                state.username =
                    username;

                saveLocal();

                showAuthMessage(
                    "Account created! Loading your save..."
                );

            }

            else {

                showAuthMessage(
                    "Account created. Check your email to confirm it, then sign in."
                );

            }

        }

        else {

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


            if (error)
                throw error;


            if (
                data.user
            ) {

                showAuthMessage(
                    "Signed in! Loading your save..."
                );

            }

        }

    }

    catch (error) {

        console.error(
            error
        );

        showAuthMessage(
            error.message ||
            "Authentication failed."
        );

    }


    $("authButton")
        .disabled = false;

}


/* =========================================================
   SIGN OUT
========================================================= */

async function signOut() {

    try {

        await saveOnline();

        const {
            error
        } =
            await supabaseClient
                .auth
                .signOut();


        if (error)
            throw error;


        currentUser =
            null;

        onlineSaveReady =
            false;


        renderAccount();


        $("accountDialog")
            .close();

    }

    catch (error) {

        console.error(
            "Sign out error:",
            error
        );

        showAuthMessage(
            "Could not sign out."
        );

    }

}


/* =========================================================
   RESET
========================================================= */

async function resetStats() {

    if (
        !confirm(
            "Reset ALL progress?"
        )
    ) {

        return;

    }


    const username =
        state.username;


    state =
        createFreshState();


    state.username =
        username;


    saveLocal();

    renderAll();


    if (
        currentUser
    ) {

        await saveOnline();

    }

}


/* =========================================================
   INITIAL AUTH
========================================================= */

async function initializeAuth() {

    const {
        data,
        error
    } =
        await supabaseClient
            .auth
            .getSession();


    if (error) {

        console.error(
            "Session error:",
            error
        );

        return;

    }


    if (
        data.session
    ) {

        currentUser =
            data.session.user;

        await loadOnline();

    }

}


/* =========================================================
   AUTH STATE LISTENER
========================================================= */

supabaseClient
    .auth
    .onAuthStateChange(
        async (
            event,
            session
        ) => {

            if (
                session &&
                session.user
            ) {

                currentUser =
                    session.user;


                if (
                    !onlineSaveReady
                ) {

                    await loadOnline();

                }


                renderAccount();

            }

            else {

                currentUser =
                    null;

                onlineSaveReady =
                    false;

                renderAccount();

            }

        }
    );


/* =========================================================
   EVENTS
========================================================= */

$("rollButton")
    .addEventListener(
        "click",
        roll
    );


$("resetButton")
    .addEventListener(
        "click",
        resetStats
    );


$("accountButton")
    .addEventListener(
        "click",
        openAccount
    );


$("closeAccount")
    .addEventListener(
        "click",
        () => {

            $("accountDialog")
                .close();

        }
    );


$("continueGuest")
    .addEventListener(
        "click",
        () => {

            $("accountDialog")
                .close();

        }
    );


$("switchAuthMode")
    .addEventListener(
        "click",
        () => {

            authMode =
                authMode === "signin"
                    ? "signup"
                    : "signin";


            updateAuthMode();

            showAuthMessage("");

        }
    );


$("authButton")
    .addEventListener(
        "click",
        authenticate
    );


$("signOutButton")
    .addEventListener(
        "click",
        signOut
    );


$("clearHistoryButton")
    .addEventListener(
        "click",
        () => {

            state.history = [];

            saveLocal();

            renderHistory();

            queueOnlineSave();

        }
    );


$("anomalyStat")
    .addEventListener(
        "click",
        () => {

            showRarityHistory(
                "ANOMALY"
            );

        }
    );


$("mythicStat")
    .addEventListener(
        "click",
        () => {

            showRarityHistory(
                "MYTHIC"
            );

        }
    );


document.addEventListener(
    "keydown",
    event => {

        if (
            event.code === "Space" &&
            !event.repeat &&
            document.activeElement.tagName !==
                "INPUT" &&
            document.activeElement.tagName !==
                "TEXTAREA"
        ) {

            event.preventDefault();


            if (
                !$("rollButton")
                    .disabled
            ) {

                roll();

            }

        }

    }
);


/* =========================================================
   START
========================================================= */

loadLocal();

renderAll();

initializeAuth();
