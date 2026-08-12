/*
|--------------------------------------------------------------------------
| SPECIAL LOVE GAME
|--------------------------------------------------------------------------
| Fitur khusus untuk satu nomor WhatsApp.
|
| Command:
| !game
| !love
| !tebak
| !truth
| !dare
| !pilih
| !score
| !sayang
| !rps
|
|--------------------------------------------------------------------------
*/

const {
    getPlayer,
    addLoveScore,
    setQuestion,
    clearQuestion,
    incrementQuestions,
    recordRps,
    getUsedPool,
    saveUsedPool,
    getStatistics,
} = require("./game-db");


/*
|--------------------------------------------------------------------------
| UTILITIES
|--------------------------------------------------------------------------
*/

/**
 * Normalisasi nomor WhatsApp.
 */
function normalizeNumber(number) {
    if (!number) {
        return "";
    }

    return String(number)
        .replace(/\D/g, "")
        .replace(/^0/, "62");
}


/**
 * Cek apakah nomor adalah special user.
 */
function isSpecialUser(number) {
    const specialNumber =
        normalizeNumber(
            process.env.SPECIAL_NUMBER || ""
        );

    if (!specialNumber) {
        return false;
    }

    return (
        normalizeNumber(number) ===
        specialNumber
    );
}


/**
 * Ambil state game user.
 */
function getGame(number) {
    return getPlayer(number);
}


/**
 * Random item tanpa mengulang sampai
 * seluruh pool habis.
 */
function randomUnique(
    pool,
    used
) {

    if (!pool.length) {
        return "";
    }


    /*
     * Kalau semua sudah digunakan,
     * reset pool.
     */

    if (
        used.length >= pool.length
    ) {
        used.length = 0;
    }


    const available =
        pool
            .map(
                (_, index) => index
            )
            .filter(
                index =>
                    !used.includes(index)
            );


    const selectedIndex =
        available[
            Math.floor(
                Math.random() *
                available.length
            )
        ];


    used.push(
        selectedIndex
    );


    return pool[
        selectedIndex
    ];
}

/**
 * Progress bar untuk score.
 */
function progressBar(
    value,
    max = 100,
    length = 10
) {
    const percent =
        Math.min(
            100,
            Math.max(
                0,
                (value / max) * 100
            )
        );


    const filled =
        Math.round(
            (percent / 100) *
            length
        );


    const empty =
        length - filled;


    return (
        "❤️".repeat(filled) +
        "🤍".repeat(empty)
    );
}


/**
 * Tambahkan score.
 */

function addScore(
    number,
    amount
) {

    return addLoveScore(
        number,
        amount
    );
}


/*
|--------------------------------------------------------------------------
| RESPONSE POOLS
|--------------------------------------------------------------------------
*/

const loveMessages = [

    `💌 *LOVE DELIVERY*

📡 Pesan berhasil dikirim.

"Walaupun seseorang sedang sibuk,
bukan berarti dia lupa kamu." ❤️`,

    `🌷 *LITTLE REMINDER*

Jangan lupa makan.
Jangan lupa minum.
Dan yang paling penting...

jangan lupa kalau kamu
tetap seseorang yang spesial. 🥺❤️`,

    `📡 *RELATIONSHIP STATUS*

Connection : 🟢 ONLINE
Love       : 🟢 STABLE
Rindu      : 🟡 HIGH
Kangen     : 🔴 VERY HIGH

🤖 Sistem menyarankan:
segera beri pelukan. 🫂`,

    `💗 *SPECIAL MESSAGE*

Seseorang mungkin sedang sibuk
sekarang...

tapi kamu tetap ada
di dalam pikirannya. ❤️`,

    `🛰️ *LOVE SATELLITE*

Mengirim sinyal...

❤️ ❤️ ❤️ ❤️ ❤️

✅ Sinyal diterima.

Status:
*Kamu masih disayang.* 🥺`,

    `🌙 *HEY YOU*

Kalau hari ini terasa melelahkan,
istirahat sebentar ya.

Kamu tidak harus kuat
setiap waktu. 🤍`,
];


const loveResponses = [

    "Awww... jawaban yang sangat manis. 🥺❤️",

    "Hmm... sistem mendeteksi kadar gemas yang cukup tinggi. 😭💗",

    "Jawaban diterima! Poin sayang +10 💕",

    "Database hati berhasil diperbarui. ❤️",

    "Catatan penting: jawaban ini terlalu lucu untuk dihapus. 🥹",

    "Server sedang memproses jawaban... hasilnya: valid banget. 💖",

    "Oke, itu berhasil membuat bot tersenyum. 🤖❤️",

    "Jawaban tersimpan di memory paling aman: hati. 💗",
];


const truthQuestions = [

    "Apa hal kecil yang paling bisa membuatmu senang? 🌷",

    "Apa momen favoritmu bersama aku? 💕",

    "Apa kebiasaan kecilku yang menurutmu lucu? 😭",

    "Apa hal yang paling kamu rindukan ketika aku sedang sibuk? 🥺",

    "Kalau kita punya satu hari kosong bersama, kamu ingin melakukan apa? 🌎",

    "Menurutmu siapa yang lebih sering kangen duluan? 👀",

    "Apa satu hal yang ingin kamu lakukan bersamaku tahun ini? ✨",

    "Apa first impression-mu tentang aku? 😆",

    "Apa hal sederhana yang menurutmu paling romantis? 💗",

    "Kalau hubungan kita punya judul film, apa judulnya? 🎬",
];


const dareQuestions = [

    "Kirim satu emoji yang menggambarkan perasaanmu sekarang. 😆",

    "Kirim satu kata yang paling menggambarkan aku. 👀",

    "Kirim foto minuman yang sedang kamu minum. 🥤",

    "Pilih satu: pelukan 🫂 atau gandengan tangan 🤝?",

    "Kirim satu lagu yang sedang kamu dengarkan. 🎵",

    "Kirim emoji paling random yang ada di HP-mu. 😂",

    "Tulis satu kalimat manis tanpa menggunakan kata 'sayang'. 💕",

    "Pilih satu: movie night 🎬 atau jalan-jalan 🌆?",
];


const choiceQuestions = [

    {
        question:
            "Pilih satu!\n\nA. Movie night 🎬\nB. Jalan-jalan 🌆",
        options: ["A", "B"],
    },

    {
        question:
            "Pilih satu!\n\nA. Pelukan 🫂\nB. Gandengan tangan 🤝",
        options: ["A", "B"],
    },

    {
        question:
            "Pilih satu!\n\nA. Pantai 🌊\nB. Pegunungan 🏔️",
        options: ["A", "B"],
    },

    {
        question:
            "Pilih satu!\n\nA. Dinner 🍝\nB. Nongkrong santai ☕",
        options: ["A", "B"],
    },

    {
        question:
            "Pilih satu!\n\nA. Sunrise 🌅\nB. Sunset 🌇",
        options: ["A", "B"],
    },

    {
        question:
            "Pilih satu!\n\nA. Chat sampai malam 🌙\nB. Telepon lama ☎️",
        options: ["A", "B"],
    },
];


/*
|--------------------------------------------------------------------------
| MENU
|--------------------------------------------------------------------------
*/

function getGameMenu() {
    return `╭━━━━━━━ 💕 HALOOO ━━━━━━━╮
┃
┃ 👋 Haiii!
┃
┃ Seseorang sedang sibuk sekarang,
┃ jadi sementara ini aku yang
┃ nemenin kamu dulu yaa 😆❤️
┃
┃ ✨ Aku punya beberapa permainan
┃ dan fitur khusus buat kamu.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━━━━ 🎮 MENU ━━━━━━╮
┃
┃ 💌 !love
┃    Pesan random yang manis
┃
┃ 🧠 !truth
┃    Pertanyaan random
┃
┃ 😈 !dare
┃    Tantangan kecil
┃
┃ 🎯 !pilih
┃    Pilih A atau B
┃
┃ 🪨 !rps
┃    Batu Gunting Kertas
┃
┃ 🏆 !score
┃    Lihat Love Score
┃
┃ 💗 !sayang
┃    Pesan spesial
┃
╰━━━━━━━━━━━━━━━━━━━━╯

💡 *CARA BERMAIN*

Ketik command yang diawali tanda !

Contoh:

👉 !rps batu
👉 !truth
👉 !love

🤖 Aku akan menemanimu
selama seseorang sedang sibuk. 🥺❤️

━━━━━━━━━━━━━━━━━━━━━━━
🟢 Connection : Online
🎮 Game      : Ready
💕 Love      : Active
━━━━━━━━━━━━━━━━━━━━━━━`;
}

/*
|--------------------------------------------------------------------------
| LOVE
|--------------------------------------------------------------------------
*/

function getLoveMessage(number) {

    return getRandomPersistent(
        number,
        loveMessages,
        "used_love"
    );
}


/*
|--------------------------------------------------------------------------
| RANDOM QUESTION
|--------------------------------------------------------------------------
*/

function getQuestion(
    number,
    type
) {

    const pool =
        type === "dare"
            ? dareQuestions
            : truthQuestions;


    const poolName =
        type === "dare"
            ? "used_dare"
            : "used_truth";


    const question =
        getRandomPersistent(
            number,
            pool,
            poolName
        );


    setQuestion(
        number,
        question,
        type
    );


    return question;
}


/*
|--------------------------------------------------------------------------
| CHOICE
|--------------------------------------------------------------------------
*/

function getChoice(number) {

    const item =
        getRandomPersistent(
            number,
            choiceQuestions,
            "used_choice"
        );


    setQuestion(
        number,
        item.question,
        "choice"
    );


    return item.question;
}

/*
|--------------------------------------------------------------------------
| SCORE
|--------------------------------------------------------------------------
*/

function getScore(number) {

    const game =
        getStatistics(
            number
        );


    const score =
        game.love_score;


    const level =
        game.level;


    let title;


    if (
        score < 50
    ) {

        title =
            "🌱 BEGINNER OF LOVE";

    } else if (
        score < 100
    ) {

        title =
            "💕 LOVE EXPLORER";

    } else if (
        score < 200
    ) {

        title =
            "💗 LOVE MASTER";

    } else {

        title =
            "🔥 LEGENDARY LOVE";
    }


    return `╭━━━ 🏆 LOVE SCORE ━━━╮
┃
┃ ${title}
┃
┃ 💗 Score
┃ *${score} Love Points*
┃
┃ ⭐ Level
┃ *Level ${level}*
┃
┃ 💭 Questions
┃ ${game.questions_answered}
┃
┃
┃ 🪨✂️📄 RPS
┃ 🧍 Wins : ${game.rps_player_wins}
┃ 🤖 Wins : ${game.rps_bot_wins}
┃ 🤝 Draw : ${game.rps_draws}
┃ 🎮 Round: ${game.rps_rounds}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

💾 Progress tersimpan permanent.`;
}


/*
|--------------------------------------------------------------------------
| SPECIAL MESSAGE
|--------------------------------------------------------------------------
*/

function getSpecialMessage() {

    const messages = [

        `╭━━━ 💗 SPECIAL MESSAGE ━━━╮
┃
┃ 🥺 Jangan terlalu kangen.
┃
┃ Seseorang sedang sibuk,
┃ tapi bukan berarti lupa.
┃
┃ ❤️ Kamu tetap spesial.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯`,

        `╭━━━ 💕 SYSTEM NOTICE ━━━╮
┃
┃ Connection : 🟢 ONLINE
┃ Love       : 🟢 ONLINE
┃ Attention  : 🟡 LIMITED
┃
┃ Status:
┃ "Sedang sibuk, bukan pergi."
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯`,

        `╭━━━ 🌷 REMINDER ━━━╮
┃
┃ Kamu sudah diperhatikan
┃ sistem hari ini. 👀
┃
┃ Sekarang waktunya:
┃ makan 🍚
┃ minum 🥤
┃ istirahat 😴
┃
╰━━━━━━━━━━━━━━━━━━╯`,

        `╭━━━ 🛰️ LOVE SIGNAL ━━━╮
┃
┃ Sending...
┃
┃ ❤️ ❤️ ❤️ ❤️ ❤️
┃
┃ Delivery:
┃ ✅ Successful
┃
┃ Receiver:
┃ Kamu. 🥺
┃
╰━━━━━━━━━━━━━━━━━━━━╯`,
    ];


    return (
        messages[
            Math.floor(
                Math.random() *
                messages.length
            )
        ]
    );
}


/*
|--------------------------------------------------------------------------
| HANDLE GAME ANSWER
|--------------------------------------------------------------------------
*/

function handleGameAnswer(
    number,
    text
) {

    const game =
        getStatistics(
            number
        );


    /*
     * Tidak sedang dalam game.
     */

    if (
        !game.last_question
    ) {
        return null;
    }


    /*
     * Jangan anggap command
     * sebagai jawaban game.
     */

    if (
        text.trim().startsWith("!")
    ) {
        return null;
    }


    const answer =
        text.trim();


    /*
     * Tambahkan statistik.
     */

    incrementQuestions(
        number
    );


    let points = 10;


    if (
        game.last_question_type ===
        "choice"
    ) {
        points = 15;
    }


    const updated =
        addLoveScore(
            number,
            points
        );


    clearQuestion(
        number
    );


    const response =
        getRandomPersistent(
            number,
            loveResponses,
            "used_responses"
        );


    return `╭━━━ 💌 ANSWER RECEIVED ━━━╮
┃
┃ ✅ Jawaban diterima!
┃
┃ "${answer}"
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

${response}

🏆 *+${points} Love Points*

💗 Total Score:
*${updated.love_score}*

⭐ Level:
*${updated.level}*

✨ Ketik:
!tebak
!truth
!dare
!pilih

untuk melanjutkan.`;
}


/*
|--------------------------------------------------------------------------
| MAIN SPECIAL COMMAND HANDLER
|--------------------------------------------------------------------------
*/

function handleSpecialCommand(
    message
) {

    /*
     * Hanya nomor spesial
     */

    if (
        !isSpecialUser(
            message.number
        )
    ) {

        return {
            handled: false,
        };
    }


    const {
        command,
    } = parseSpecialCommand(
        message.text
    );


    switch (command) {

        case "!game":

            return {
                handled: true,
                reply: getGameMenu(),
            };


        case "!love":

            return {
                handled: true,
                reply:
                    getLoveMessage(
                        message.number
                    ),
            };


        case "!tebak":

            return {
                handled: true,
                reply: createQuestion(
                    message.number,
                    "truth"
                ),
            };


        case "!truth":

            return {
                handled: true,
                reply: createQuestion(
                    message.number,
                    "truth"
                ),
            };


        case "!dare":

            return {
                handled: true,
                reply: createQuestion(
                    message.number,
                    "dare"
                ),
            };


        case "!pilih":

            return {
                handled: true,
                reply:
                    getChoice(
                        message.number
                    ),
            };


        case "!score":

            return {
                handled: true,
                reply:
                    getScore(
                        message.number
                    ),
            };


        case "!sayang":

            return {
                handled: true,
                reply:
                    getSpecialMessage(),
            };

        case "!rps": {
            const parts =
                message.text
                    .trim()
                    .split(/\s+/);

            const choice =
                parts[1];

            if (!choice) {
                return {
                    handled: true,
                    reply: getRpsMenu(),
                };
            }

            return {
                handled: true,
                reply: playRps(
                    message.number,
                    choice
                ),
            };
        }


        default:

            return {
                handled: false,
            };
    }
}


/*
|--------------------------------------------------------------------------
| SPECIAL COMMAND PARSER
|--------------------------------------------------------------------------
*/

function parseSpecialCommand(
    text
) {

    const command =
        text
            .trim()
            .split(/\s+/)[0]
            ?.toLowerCase();


    return {
        command,
    };
}


/*
|--------------------------------------------------------------------------
| QUESTION CREATOR
|--------------------------------------------------------------------------
*/

function createQuestion(
    number,
    type
) {

    const question =
        getQuestion(
            number,
            type
        );


    const title =
        type === "truth"
            ? "💭 TRUTH QUESTION"
            : "😈 MINI DARE";


    return `╭━━━ ${title} ━━━╮
┃
┃ ${question}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

💡 Balas dengan jawabanmu.

🏆 Jawaban yang diterima
mendapat +10 Love Points.`;
}

/*
|--------------------------------------------------------------------------
| GREETING
|--------------------------------------------------------------------------
*/

const greetingResponses = {
    pagi: [
        "☀️ Selamat pagi! Semoga harimu menyenangkan ya. Jangan lupa sarapan 🥺❤️",
        "🌷 Pagi! Seseorang sedang sibuk, jadi hari ini aku yang nemenin dulu 😌💕",
        "☀️ Good morning! Semoga mood kamu hari ini bagus banget. ❤️",
        "🌤️ Selamat pagi! Status hari ini: kamu tetap harus tersenyum 😆💗",
    ],

    siang: [
        "☀️ Selamat siang! Sudah makan belum? Jangan sampai lupa makan ya 🍚❤️",
        "🌞 Siang! Aku mendeteksi seseorang yang butuh istirahat sebentar 👀",
        "🍱 Selamat siang! Sudah makan atau masih sibuk?",
        "☀️ Jangan lupa minum air ya. Server bilang kamu harus sehat 😌",
    ],

    sore: [
        "🌇 Selamat sore! Harimu sejauh ini bagaimana? ❤️",
        "🌤️ Sore! Semoga hari ini tidak terlalu melelahkan ya 🥺",
        "🌷 Selamat sore! Waktunya sedikit santai sebelum malam 💕",
        "🌇 Sore terdeteksi. Mood harus tetap bagus! 😆❤️",
    ],

    malam: [
        "🌙 Selamat malam! Jangan tidur terlalu malam ya 🥺❤️",
        "🌌 Malam! Semoga hari ini berakhir dengan tenang dan menyenangkan.",
        "🌙 Selamat malam! Sudah makan? Sudah istirahat? Jangan lupa diri sendiri ya 💕",
        "✨ Malam datang. Kalau capek, istirahat ya. Kamu tidak harus kuat terus. 🤍",
    ],

    default: [
        "👋 Haiii! Aku di sini. Seseorang sedang sibuk, jadi sekarang aku yang nemenin kamu dulu 😆❤️",
        "🥺 Hai! Pesanmu sudah diterima dengan sukses.",
        "💕 Hii! Connection established. Love signal detected.",
        "🤖 Halo! Server online dan siap menemani kamu.",
        "👋 Heyyy! Ada apa nih? Aku sedang standby untuk kamu.",
        "💗 Halo! Sepertinya ada seseorang yang sedang butuh teman ngobrol.",
    ],
};


function detectGreeting(text) {
    const value = text
        .trim()
        .toLowerCase();

    if (
        /^(pagi|good morning|selamat pagi)[.!?]*$/i.test(value)
    ) {
        return "pagi";
    }

    if (
        /^(siang|selamat siang)[.!?]*$/i.test(value)
    ) {
        return "siang";
    }

    if (
        /^(sore|selamat sore)[.!?]*$/i.test(value)
    ) {
        return "sore";
    }

    if (
        /^(malam|selamat malam|good night)[.!?]*$/i.test(value)
    ) {
        return "malam";
    }

    if (
        /^(halo|haloo|halooo|hai|haii|haiii|hayyo|hayyoo|hayyooohaai|hii|hiii|hi|hey|heyy)[.!?]*$/i.test(value)
    ) {
        return "default";
    }

    return null;
}


function getGreeting(text) {
    const type =
        detectGreeting(text);

    if (!type) {
        return null;
    }

    const pool =
        greetingResponses[type];

    return pool[
        Math.floor(
            Math.random() * pool.length
        )
    ];
}

/*
|--------------------------------------------------------------------------
| ROCK PAPER SCISSORS
|--------------------------------------------------------------------------
*/

function getRpsMenu() {
    return `╭━━━ 🪨✂️📄 RPS ━━━╮
┃
┃ *BATU GUNTING KERTAS*
┃
┃ Pilih salah satu:
┃
┃ 🪨 !rps batu
┃ ✂️ !rps gunting
┃ 📄 !rps kertas
┃
╰━━━━━━━━━━━━━━━━━━━╯

🏆 Menang : +20 Love Points
🤝 Seri   : +5 Love Points

😈 Coba kalahkan bot!`;
}

const RPS_CHOICES = {
    batu: "🪨",
    gunting: "✂️",
    kertas: "📄",
};

const RPS_ALIASES = {
    batu: "batu",
    rock: "batu",
    b: "batu",

    gunting: "gunting",
    scissors: "gunting",
    s: "gunting",

    kertas: "kertas",
    paper: "kertas",
    k: "kertas",
};


function normalizeRpsChoice(choice) {
    if (!choice) {
        return null;
    }

    return RPS_ALIASES[
        choice
            .trim()
            .toLowerCase()
    ] || null;
}


function getRandomRpsChoice() {
    const choices =
        Object.keys(RPS_CHOICES);

    return choices[
        Math.floor(
            Math.random() *
            choices.length
        )
    ];
}


function determineRpsResult(
    player,
    bot
) {
    if (player === bot) {
        return "draw";
    }

    if (
        (player === "batu" && bot === "gunting") ||
        (player === "gunting" && bot === "kertas") ||
        (player === "kertas" && bot === "batu")
    ) {
        return "win";
    }

    return "lose";
}


function getRpsResultText(result) {
    switch (result) {
        case "win":
            return "🎉 *KAMU MENANG!*";

        case "lose":
            return "😈 *AKU MENANG!*";

        default:
            return "🤝 *SERI!*";
    }
}


function updateRpsScore(
    rps,
    result
) {
    rps.rounds++;

    if (result === "win") {
        rps.playerWins++;
    } else if (result === "lose") {
        rps.botWins++;
    } else {
        rps.draws++;
    }
}


function playRps(
    number,
    choice
) {

    const player =
        normalizeRpsChoice(
            choice
        );


    if (!player) {
        return getRpsMenu();
    }


    const bot =
        getRandomRpsChoice();


    const result =
        determineRpsResult(
            player,
            bot
        );


    /*
     * Simpan RPS
     */

    const stats =
        recordRps(
            number,
            result
        );


    let bonus = 0;


    if (
        result === "win"
    ) {

        bonus = 20;

    } else if (
        result === "draw"
    ) {

        bonus = 5;
    }


    let updated =
        stats;


    if (
        bonus > 0
    ) {

        updated =
            addLoveScore(
                number,
                bonus
            );
    }


    return `╭━━━ 🪨✂️📄 RPS ━━━╮
┃
┃ Kamu :
┃ ${RPS_CHOICES[player]} ${player.toUpperCase()}
┃
┃ Bot :
┃ ${RPS_CHOICES[bot]} ${bot.toUpperCase()}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

${getRpsResultText(result)}

🏆 *RPS SCORE*

🧍 Kamu :
*${updated.rps_player_wins}*

🤖 Bot :
*${updated.rps_bot_wins}*

🤝 Seri :
*${updated.rps_draws}*

🎮 Round :
*${updated.rps_rounds}*

💗 Love Score :
*${updated.love_score}*

⭐ Level :
*${updated.level}*

${bonus > 0
    ? `✨ +${bonus} Love Points`
    : ""
}`;
}

/*
|--------------------------------------------------------------------------
| HELPER POOLS SQLITE
|--------------------------------------------------------------------------
*/

function getRandomPersistent(
    number,
    pool,
    poolName
) {

    const used =
        getUsedPool(
            number,
            poolName
        );


    const result =
        randomUnique(
            pool,
            used
        );


    saveUsedPool(
        number,
        poolName,
        used
    );


    return result;
}

function getSpecialFallback(text) {
    const greetings = getGreeting(text);

    if (greetings) {
        return greetings;
    }

    const responses = [
        `💗 Heii...

Aku di sini kok 😆❤️

Kalau bingung mau ngapain,
ketik:

🎮 !game

untuk melihat semua permainan yang tersedia.`,

        `👋 Pesanmu diterima!

Tapi aku belum tahu harus menjawab apa 😭

Coba ketik:

🎮 !game

Nanti aku kasih beberapa permainan buat kamu 💕`,

        `🥺 Hmmm...

Sepertinya kamu sedang ingin ngobrol.

Aku punya beberapa permainan yang mungkin bisa menemanimu.

🎮 *!game*

Coba buka menunya yaa ❤️`,

        `🤖 *SPECIAL MODE*

Aku sedang standby untuk kamu 💕

Mau bermain?

Ketik:

!game

untuk membuka menu 🎮`,
    ];

    return responses[
        Math.floor(
            Math.random() *
            responses.length
        )
    ];
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    isSpecialUser,

    handleSpecialCommand,

    handleGameAnswer,

    getGame,

    getGreeting,

    getSpecialFallback,
};
