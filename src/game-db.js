const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");


/*
|--------------------------------------------------------------------------
| DATABASE CONFIG
|--------------------------------------------------------------------------
*/

const DB_PATH =
    process.env.GAME_DB_PATH ||
    "/app/data/special-game.db";


/*
|--------------------------------------------------------------------------
| PREPARE DIRECTORY
|--------------------------------------------------------------------------
*/

const dbDirectory =
    path.dirname(DB_PATH);

fs.mkdirSync(
    dbDirectory,
    {
        recursive: true,
    }
);


/*
|--------------------------------------------------------------------------
| OPEN DATABASE
|--------------------------------------------------------------------------
*/

const db =
    new DatabaseSync(
        DB_PATH
    );


/*
|--------------------------------------------------------------------------
| SQLITE CONFIG
|--------------------------------------------------------------------------
*/

db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
`);


/*
|--------------------------------------------------------------------------
| CREATE TABLE
|--------------------------------------------------------------------------
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS game_players (

        phone_number TEXT PRIMARY KEY,

        love_score INTEGER NOT NULL DEFAULT 0,

        level INTEGER NOT NULL DEFAULT 1,

        questions_answered INTEGER NOT NULL DEFAULT 0,

        rps_player_wins INTEGER NOT NULL DEFAULT 0,

        rps_bot_wins INTEGER NOT NULL DEFAULT 0,

        rps_draws INTEGER NOT NULL DEFAULT 0,

        rps_rounds INTEGER NOT NULL DEFAULT 0,

        last_question TEXT,

        last_question_type TEXT,

        used_love TEXT NOT NULL DEFAULT '[]',

        used_truth TEXT NOT NULL DEFAULT '[]',

        used_dare TEXT NOT NULL DEFAULT '[]',

        used_choice TEXT NOT NULL DEFAULT '[]',

        used_responses TEXT NOT NULL DEFAULT '[]',

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

    );
`);


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function parseJson(
    value,
    fallback = []
) {
    try {
        return JSON.parse(
            value
        );
    } catch {
        return fallback;
    }
}


function serializeJson(value) {
    return JSON.stringify(
        value
    );
}


/*
|--------------------------------------------------------------------------
| GET / CREATE PLAYER
|--------------------------------------------------------------------------
*/

function getPlayer(
    phoneNumber
) {

    const existing =
        db.prepare(`
            SELECT *
            FROM game_players
            WHERE phone_number = ?
        `).get(
            phoneNumber
        );


    if (existing) {

        return {
            ...existing,

            used_love:
                parseJson(
                    existing.used_love
                ),

            used_truth:
                parseJson(
                    existing.used_truth
                ),

            used_dare:
                parseJson(
                    existing.used_dare
                ),

            used_choice:
                parseJson(
                    existing.used_choice
                ),

            used_responses:
                parseJson(
                    existing.used_responses
                ),
        };
    }


    db.prepare(`
        INSERT INTO game_players (
            phone_number
        )
        VALUES (?)
    `).run(
        phoneNumber
    );


    return getPlayer(
        phoneNumber
    );
}


/*
|--------------------------------------------------------------------------
| SAVE PLAYER
|--------------------------------------------------------------------------
*/

function savePlayer(
    player
) {

    db.prepare(`
        UPDATE game_players

        SET

            love_score = ?,

            level = ?,

            questions_answered = ?,

            rps_player_wins = ?,

            rps_bot_wins = ?,

            rps_draws = ?,

            rps_rounds = ?,

            last_question = ?,

            last_question_type = ?,

            used_love = ?,

            used_truth = ?,

            used_dare = ?,

            used_choice = ?,

            used_responses = ?,

            updated_at = CURRENT_TIMESTAMP

        WHERE phone_number = ?
    `).run(

        player.love_score,

        player.level,

        player.questions_answered,

        player.rps_player_wins,

        player.rps_bot_wins,

        player.rps_draws,

        player.rps_rounds,

        player.last_question,

        player.last_question_type,

        serializeJson(
            player.used_love
        ),

        serializeJson(
            player.used_truth
        ),

        serializeJson(
            player.used_dare
        ),

        serializeJson(
            player.used_choice
        ),

        serializeJson(
            player.used_responses
        ),

        player.phone_number
    );
}


/*
|--------------------------------------------------------------------------
| UPDATE SCORE
|--------------------------------------------------------------------------
*/

function addLoveScore(
    phoneNumber,
    amount
) {

    const player =
        getPlayer(
            phoneNumber
        );


    player.love_score += amount;


    player.level =
        Math.floor(
            player.love_score / 100
        ) + 1;


    savePlayer(
        player
    );


    return player;
}


/*
|--------------------------------------------------------------------------
| SET QUESTION
|--------------------------------------------------------------------------
*/

function setQuestion(
    phoneNumber,
    question,
    type
) {

    const player =
        getPlayer(
            phoneNumber
        );


    player.last_question =
        question;

    player.last_question_type =
        type;


    savePlayer(
        player
    );


    return player;
}


/*
|--------------------------------------------------------------------------
| CLEAR QUESTION
|--------------------------------------------------------------------------
*/

function clearQuestion(
    phoneNumber
) {

    const player =
        getPlayer(
            phoneNumber
        );


    player.last_question =
        null;

    player.last_question_type =
        null;


    savePlayer(
        player
    );


    return player;
}


/*
|--------------------------------------------------------------------------
| INCREMENT QUESTION COUNTER
|--------------------------------------------------------------------------
*/

function incrementQuestions(
    phoneNumber
) {

    const player =
        getPlayer(
            phoneNumber
        );


    player.questions_answered++;


    savePlayer(
        player
    );


    return player;
}


/*
|--------------------------------------------------------------------------
| RPS RESULT
|--------------------------------------------------------------------------
*/

function recordRps(
    phoneNumber,
    result
) {

    const player =
        getPlayer(
            phoneNumber
        );


    player.rps_rounds++;


    if (result === "win") {

        player.rps_player_wins++;

    } else if (
        result === "lose"
    ) {

        player.rps_bot_wins++;

    } else {

        player.rps_draws++;

    }


    savePlayer(
        player
    );


    return player;
}


/*
|--------------------------------------------------------------------------
| RANDOM POOL STORAGE
|--------------------------------------------------------------------------
*/

function getUsedPool(
    phoneNumber,
    poolName
) {

    const player =
        getPlayer(
            phoneNumber
        );


    return [
        ...player[poolName],
    ];
}


function saveUsedPool(
    phoneNumber,
    poolName,
    values
) {

    const player =
        getPlayer(
            phoneNumber
        );


    player[poolName] = [
        ...values,
    ];


    savePlayer(
        player
    );
}


/*
|--------------------------------------------------------------------------
| STATISTICS
|--------------------------------------------------------------------------
*/

function getStatistics(
    phoneNumber
) {

    return getPlayer(
        phoneNumber
    );
}


/*
|--------------------------------------------------------------------------
| CLOSE
|--------------------------------------------------------------------------
*/

function closeDatabase() {

    if (db.isOpen) {
        db.close();
    }
}


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {

    getPlayer,

    savePlayer,

    addLoveScore,

    setQuestion,

    clearQuestion,

    incrementQuestions,

    recordRps,

    getUsedPool,

    saveUsedPool,

    getStatistics,

    closeDatabase,

};