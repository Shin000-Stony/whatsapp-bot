require("dotenv").config();

const express = require("express");
const axios = require("axios");

const {
    getCpuUsage,
    getMemory,
    getUptime,
    getDisk,
    getLoadAverage,
    getDockerContainers,
    getNetwork,
} = require("./host-monitor");

const {
    formatStatus,
    formatCpu,
    formatMemory,
    formatDisk,
    formatDocker,
    formatNetwork,
    formatHelp,
} = require("./formatter");

const {
    isSpecialUser,
    handleSpecialCommand,
    handleGameAnswer,
    getSpecialFallback,
} = require("./special-game");

/*
|--------------------------------------------------------------------------
| APPLICATION
|--------------------------------------------------------------------------
*/

const app = express();

app.use(express.json());

const PORT =
    Number(process.env.PORT) || 3000;


/*
|--------------------------------------------------------------------------
| CONFIGURATION
|--------------------------------------------------------------------------
*/

const INSTANCE =
    process.env.EVOLUTION_INSTANCE;

const BOT_NUMBER =
    process.env.BOT_NUMBER || "";

const COOLDOWN =
    Number(process.env.COMMAND_COOLDOWN) || 3000;


/*
|--------------------------------------------------------------------------
| SCHEDULE CONFIGURATION
|--------------------------------------------------------------------------
*/

// Default: 30 menit
const STATUS_INTERVAL =
    Number(
        process.env.STATUS_REPORT_INTERVAL
    ) || 30 * 60 * 1000;


// Default: cek alert setiap 1 menit
const ALERT_INTERVAL =
    Number(
        process.env.ALERT_CHECK_INTERVAL
    ) || 60 * 1000;


const STATUS_REPORT_NUMBER =
    process.env.STATUS_REPORT_NUMBER;


/*
|--------------------------------------------------------------------------
| EVOLUTION API
|--------------------------------------------------------------------------
*/

const evolution = axios.create({

    baseURL:
        process.env.EVOLUTION_API_URL,

    headers: {
        apikey:
            process.env.EVOLUTION_API_KEY,

        "Content-Type":
            "application/json",
    },

    timeout: 15000,
});


/*
|--------------------------------------------------------------------------
| RUNTIME STATE
|--------------------------------------------------------------------------
*/

// Chat yang sedang menjalankan command
const activeChats = new Set();


// Waktu command terakhir setiap chat
const cooldowns = new Map();


// State alert
const alertState = {

    cpu: "normal",

    ram: "normal",

    disk: "normal",

    docker: "normal",

};


/*
|--------------------------------------------------------------------------
| UTILITY
|--------------------------------------------------------------------------
*/

function normalizeNumber(number) {

    if (!number) {
        return "";
    }

    return String(number)
        .replace(/\D/g, "")
        .replace(/^0/, "62");
}


/*
|--------------------------------------------------------------------------
| SEND WHATSAPP MESSAGE
|--------------------------------------------------------------------------
*/

async function sendWhatsApp(
    number,
    text
) {

    try {

        const response =
            await evolution.post(

                `/message/sendText/${INSTANCE}`,

                {
                    number,
                    text,
                }

            );


        console.log(
            `[WHATSAPP] Message sent to ${number}`
        );


        return response.data;

    } catch (error) {

        console.error(
            "[WHATSAPP] Failed to send message:",
            error.response?.data ||
            error.message
        );

        throw error;
    }
}


/*
|--------------------------------------------------------------------------
| CHECK OWN MESSAGE
|--------------------------------------------------------------------------
*/

function isOwnMessage(data) {

    /*
     * Baileys fromMe
     */

    if (
        data?.key?.fromMe === true
    ) {
        return true;
    }


    const remoteJid =
        data?.key?.remoteJid;


    if (!remoteJid) {
        return true;
    }


    /*
     * Bandingkan dengan nomor bot
     */

    if (BOT_NUMBER) {

        const remoteNumber =
            normalizeNumber(

                remoteJid
                    .replace(
                        "@s.whatsapp.net",
                        ""
                    )
                    .replace(
                        "@c.us",
                        ""
                    )

            );


        if (
            remoteNumber ===
            normalizeNumber(BOT_NUMBER)
        ) {

            return true;

        }
    }


    return false;
}


/*
|--------------------------------------------------------------------------
| PARSE WHATSAPP MESSAGE
|--------------------------------------------------------------------------
*/

function parseMessage(body) {

    const data =
        body?.data;


    if (!data) {
        return null;
    }


    /*
     * Ignore pesan bot sendiri
     */

    if (
        isOwnMessage(data)
    ) {

        console.log(
            "[WEBHOOK] Ignoring own message"
        );

        return null;
    }


    const remoteJid =
        data?.key?.remoteJid;


    if (!remoteJid) {
        return null;
    }


    /*
     * Ignore group
     */

    if (
        remoteJid.endsWith("@g.us")
    ) {

        console.log(
            "[WEBHOOK] Ignoring group message"
        );

        return null;
    }


    const message =
        data?.message;


    if (!message) {
        return null;
    }


    /*
     * Support berbagai tipe text
     */

    const text =

        message.conversation ||

        message.extendedTextMessage?.text ||

        message.imageMessage?.caption ||

        message.videoMessage?.caption ||

        "";


    if (!text.trim()) {
        return null;
    }


    const number =
        remoteJid
            .replace(
                "@s.whatsapp.net",
                ""
            )
            .replace(
                "@c.us",
                "");


    return {

        number,

        text:
            text.trim(),

        messageId:
            data?.key?.id,

        pushName:
            data?.pushName ||
            data?.verifiedBizName ||
            "User",

    };
}


/*
|--------------------------------------------------------------------------
| GET FULL SERVER STATUS
|--------------------------------------------------------------------------
*/

async function getFullStatus() {

    const [

        cpu,

        memory,

        uptime,

        disk,

        load,

        containers,

        network,

    ] = await Promise.all([

        getCpuUsage(),

        getMemory(),

        getUptime(),

        getDisk(),

        getLoadAverage(),

        getDockerContainers(),

        getNetwork(),

    ]);


    const running =
        containers.filter(
            container =>
                container.running
        ).length;


    const stopped =
        containers.length -
        running;


    return {

        cpu,

        memory,

        uptime,

        disk,

        load,

        docker: {

            total:
                containers.length,

            running,

            stopped,

        },

        containers,

        network,

    };
}


/*
|--------------------------------------------------------------------------
| SCHEDULED STATUS
|--------------------------------------------------------------------------
*/

async function sendScheduledStatus() {

    if (!STATUS_REPORT_NUMBER) {

        console.error(
            "[SCHEDULER] STATUS_REPORT_NUMBER belum dikonfigurasi"
        );

        return;
    }


    try {

        console.log(
            "[SCHEDULER] Mengambil status server..."
        );


        const data =
            await getFullStatus();


        const message =
            formatStatus(data);


        await sendWhatsApp(

            STATUS_REPORT_NUMBER,

            `📊 *PERIODIC SERVER REPORT*

━━━━━━━━━━━━━━━━━━

${message}

━━━━━━━━━━━━━━━━━━
🤖 WhatsApp Server Monitoring`

        );


        console.log(
            `[SCHEDULER] Status berhasil dikirim ke ${STATUS_REPORT_NUMBER}`
        );


    } catch (error) {

        console.error(

            "[SCHEDULER] Gagal mengirim status:",

            error.response?.data ||
            error.message

        );
    }
}


/*
|--------------------------------------------------------------------------
| ALERT LEVEL
|--------------------------------------------------------------------------
*/

function getResourceLevel(
    value,
    warning,
    critical
) {

    if (
        value >= critical
    ) {

        return "critical";

    }


    if (
        value >= warning
    ) {

        return "warning";

    }


    return "normal";
}


/*
|--------------------------------------------------------------------------
| RESOURCE ALERT
|--------------------------------------------------------------------------
*/

async function processResourceAlert(

    resource,

    level,

    value,

    number,

    label

) {

    const previous =
        alertState[resource];


    /*
     * Tidak ada perubahan
     */

    if (
        level === previous
    ) {

        return;

    }


    /*
     * Update state
     */

    alertState[resource] =
        level;


    /*
     * RECOVERY
     */

    if (

        level === "normal" &&

        previous !== "normal"

    ) {

        await sendWhatsApp(

            number,

            `🟢 *RESOURCE RECOVERY*

━━━━━━━━━━━━━━━━━━

🖥️ Resource:
*${label}*

📊 Usage:
*${value.toFixed(1)}%*

🟢 Status:
*NORMAL*

✅ Resource kembali dalam batas normal.

━━━━━━━━━━━━━━━━━━
🤖 Server Monitoring`

        );

        return;
    }


    /*
     * ALERT
     */

    const icon =
        level === "critical"
            ? "🔴"
            : "🟠";


    const title =
        level === "critical"
            ? "CRITICAL ALERT"
            : "WARNING ALERT";


    await sendWhatsApp(

        number,

        `${icon} *${title}*

━━━━━━━━━━━━━━━━━━

🖥️ Resource:
*${label}*

📊 Usage:
*${value.toFixed(1)}%*

🚨 Status:
*${level.toUpperCase()}*

━━━━━━━━━━━━━━━━━━

⚠️ Server membutuhkan perhatian.

🤖 Server Monitoring`

    );
}


/*
|--------------------------------------------------------------------------
| DOCKER ALERT
|--------------------------------------------------------------------------
*/

async function checkDockerAlert(
    data,
    number
) {

    const containers =
        data.containers || [];


    const stopped =
        containers.filter(

            container =>
                !container.running

        );


    const currentState =
        stopped.length > 0
            ? "problem"
            : "normal";


    const previous =
        alertState.docker;


    /*
     * Tidak ada perubahan
     */

    if (
        currentState === previous
    ) {

        return;
    }


    /*
     * Update state
     */

    alertState.docker =
        currentState;


    /*
     * DOCKER RECOVERY
     */

    if (

        currentState === "normal" &&

        previous === "problem"

    ) {

        await sendWhatsApp(

            number,

            `🟢 *DOCKER RECOVERY*

━━━━━━━━━━━━━━━━━━

🐳 Semua container kembali berjalan.

📦 Total:
*${containers.length}*

🟢 Status:
*ALL CONTAINERS RUNNING*

━━━━━━━━━━━━━━━━━━
🤖 Server Monitoring`

        );

        return;
    }


    /*
     * DOCKER ALERT
     */

    if (
        currentState === "problem"
    ) {

        const list =
            stopped
                .map(

                    container =>

                        `🔴 *${container.name}*\n` +
                        `   ${container.status}`

                )
                .join("\n");


        await sendWhatsApp(

            number,

            `🔴 *DOCKER ALERT*

━━━━━━━━━━━━━━━━━━

🐳 Container bermasalah:

${list}

━━━━━━━━━━━━━━━━━━

⚠️ Segera periksa container tersebut.

🤖 Server Monitoring`

        );
    }
}


/*
|--------------------------------------------------------------------------
| SERVER ALERT MONITORING
|--------------------------------------------------------------------------
*/

async function checkServerAlerts() {

    if (!STATUS_REPORT_NUMBER) {

        console.error(
            "[ALERT] STATUS_REPORT_NUMBER belum dikonfigurasi"
        );

        return;
    }


    try {

        const data =
            await getFullStatus();


        /*
         * CPU
         */

        const cpu =
            Number(
                data.cpu || 0
            );


        const cpuLevel =
            getResourceLevel(

                cpu,

                Number(
                    process.env.ALERT_CPU_WARNING
                ) || 85,

                Number(
                    process.env.ALERT_CPU_CRITICAL
                ) || 95

            );


        /*
         * RAM
         */

        const ram =
            Number(
                data.memory?.percent || 0
            );


        const ramLevel =
            getResourceLevel(

                ram,

                Number(
                    process.env.ALERT_RAM_WARNING
                ) || 85,

                Number(
                    process.env.ALERT_RAM_CRITICAL
                ) || 95

            );


        /*
         * DISK
         */

        const disk =
            Number(
                data.disk?.percent || 0
            );


        const diskLevel =
            getResourceLevel(

                disk,

                Number(
                    process.env.ALERT_DISK_WARNING
                ) || 85,

                Number(
                    process.env.ALERT_DISK_CRITICAL
                ) || 95

            );


        /*
         * Process resource alerts
         */

        await processResourceAlert(

            "cpu",

            cpuLevel,

            cpu,

            STATUS_REPORT_NUMBER,

            "CPU"

        );


        await processResourceAlert(

            "ram",

            ramLevel,

            ram,

            STATUS_REPORT_NUMBER,

            "RAM"

        );


        await processResourceAlert(

            "disk",

            diskLevel,

            disk,

            STATUS_REPORT_NUMBER,

            "DISK"

        );


        /*
         * Docker
         */

        await checkDockerAlert(

            data,

            STATUS_REPORT_NUMBER

        );


    } catch (error) {

        console.error(

            "[ALERT] Monitoring error:",

            error.response?.data ||
            error.message

        );
    }
}


/*
|--------------------------------------------------------------------------
| COMMAND PARSER
|--------------------------------------------------------------------------
*/

function parseCommand(text) {

    const parts =
        text
            .trim()
            .split(/\s+/);


    const command =
        parts[0]
            ?.toLowerCase();


    const args =
        parts.slice(1);


    return {

        command,

        args,

    };
}


/*
|--------------------------------------------------------------------------
| COMMAND HANDLER
|--------------------------------------------------------------------------
*/

async function handleCommand(
    message
) {

    const {
        command,
        args,
    } =
        parseCommand(
            message.text
        );


    /*
     * PING
     */

    if (
        command === "!ping"
    ) {

        return `╭━━━ 🏓 PING ━━━╮
┃
┃ 🟢 BOT ONLINE
┃
┃ 🟢 Evolution API
┃ 🟢 Webhook
┃ 🟢 Command Handler
┃ 🟢 Host Monitor
┃
╰━━━━━━━━━━━━━━━━╯

⚡ Response : OK
🤖 Status   : Operational`;

    }


    /*
     * HELP
     */

    if (
        command === "!help"
    ) {

        return formatHelp();

    }


    /*
     * STATUS
     */

    if (
        command === "!status"
    ) {

        const data =
            await getFullStatus();


        return formatStatus(
            data
        );

    }


    /*
     * CPU
     */

    if (
        command === "!cpu"
    ) {

        const [
            cpu,
            load,
        ] =
            await Promise.all([

                getCpuUsage(),

                getLoadAverage(),

            ]);


        return formatCpu({

            cpu,

            load,

        });

    }


    /*
     * RAM
     */

    if (
        command === "!ram"
    ) {

        const memory =
            getMemory();


        return formatMemory(
            memory
        );

    }


    /*
     * DISK
     */

    if (
        command === "!disk"
    ) {

        const disk =
            await getDisk();


        return formatDisk(
            disk
        );

    }


    /*
     * UPTIME
     */

    if (
        command === "!uptime"
    ) {

        const uptime =
            getUptime();


        return `╭━━━ ⏱️ SERVER UPTIME ━━━╮
┃
┃ 🟢 SERVER ONLINE
┃
┃ ⏱️ Uptime
┃ ${uptime.formatted}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

🟢 Monitoring service
   berjalan normal.`;

    }


    /*
     * DOCKER
     */

    if (
        command === "!docker"
    ) {

        const containers =
            await getDockerContainers();


        return formatDocker(
            containers
        );

    }


    /*
     * NETWORK
     */

    if (
        command === "!network"
    ) {

        const network =
            await getNetwork();


        return formatNetwork(
            network
        );

    }


    /*
     * UNKNOWN COMMAND
     */

    return `╭━━━ ❓ COMMAND ERROR ━━━╮
┃
┃ Command tidak ditemukan.
┃
┃ Command:
┃ ${message.text}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯

💡 Gunakan:

!help

untuk melihat daftar
command yang tersedia.`;
}


/*
|--------------------------------------------------------------------------
| PROCESS COMMAND
|--------------------------------------------------------------------------
*/

async function processMessage(message) {

    const chat = message.number;


    /*
    |--------------------------------------------------------------------------
    | SPECIAL USER MODE
    |--------------------------------------------------------------------------
    */

    if (isSpecialUser(chat)) {

        console.log(
            `[SPECIAL] Message from special user: ${message.text}`
        );


        /*
         * 1. Coba proses jawaban game
         *
         * Contoh:
         * !truth
         *      ↓
         * bot bertanya
         *
         * "karena kamu lucu"
         *      ↓
         * dianggap sebagai jawaban
         */

        const gameAnswer =
            handleGameAnswer(
                chat,
                message.text
            );


        if (gameAnswer) {

            await sendWhatsApp(
                chat,
                gameAnswer
            );

            return;
        }


        /*
         * 2. Coba command khusus
         */

        const special =
            handleSpecialCommand(
                message
            );


        if (special.handled) {

            await sendWhatsApp(
                chat,
                special.reply
            );

            return;
        }


        /*
         * 3. Kalau bukan command khusus,
         *    anggap sebagai chat biasa.
         *
         *    Bot tidak masuk ke command monitoring.
         */

        const fallback =
            getSpecialFallback(
                message.text
            );


        await sendWhatsApp(
            chat,
            fallback
        );


        return;
    }


    /*
    |--------------------------------------------------------------------------
    | NORMAL MONITORING MODE
    |--------------------------------------------------------------------------
    */

    if (activeChats.has(chat)) {

        await sendWhatsApp(
            chat,

            `⏳ *COMMAND SEDANG DIPROSES*

━━━━━━━━━━━━━━━━━━

Command sebelumnya masih berjalan.

🔒 Hanya satu command
yang dapat dijalankan pada
satu chat.

Mohon tunggu sebentar...`
        ).catch(() => {});

        return;
    }


    /*
     * Cooldown
     */

    const now =
        Date.now();


    const lastCommand =
        cooldowns.get(chat) || 0;


    if (
        now - lastCommand <
        COOLDOWN
    ) {

        console.log(
            `[COOLDOWN] ${chat}`
        );

        return;
    }


    cooldowns.set(
        chat,
        now
    );


    /*
     * Lock chat
     */

    activeChats.add(chat);


    try {

        console.log(
            `[COMMAND] ${chat}: ${message.text}`
        );


        const reply =
            await handleCommand(
                message
            );


        await sendWhatsApp(
            chat,
            reply
        );


    } catch (error) {

        console.error(
            "[COMMAND] Error:",
            error
        );


        try {

            await sendWhatsApp(
                chat,

                `╭━━━ ❌ MONITORING ERROR ━━━╮
┃
┃ Command gagal diproses.
┃
┃ ⚠️ Terjadi kesalahan
┃ pada monitoring server.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯

💡 Silakan coba kembali beberapa saat lagi.`
            );

        } catch (
            sendError
        ) {

            console.error(
                "[COMMAND] Failed to send error:",
                sendError.message
            );
        }


    } finally {

        activeChats.delete(chat);

    }
}

/*
|--------------------------------------------------------------------------
| ROOT ENDPOINT
|--------------------------------------------------------------------------
*/

app.get(
    "/",
    (req, res) => {

        res.json({

            status: "ok",

            service:
                "WhatsApp Server Monitoring Bot",

            version:
                "2.0.0",

            instance:
                INSTANCE,

            uptime:
                process.uptime(),

        });

    }
);


/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get(
    "/health",
    (req, res) => {

        res.json({

            status: "healthy",

            service:
                "whatsapp-monitoring-bot",

            timestamp:
                new Date().toISOString(),

        });

    }
);


/*
|--------------------------------------------------------------------------
| WEBHOOK
|--------------------------------------------------------------------------
*/

app.post(
    "/webhook",
    async (req, res) => {

        /*
         * Balas webhook secepat mungkin
         */

        res.sendStatus(200);


        try {

            console.log(
                "[WEBHOOK] Received"
            );


            const message =
                parseMessage(
                    req.body
                );


            if (!message) {
                return;
            }


            console.log(
                "[WEBHOOK] From:",
                message.number
            );


            console.log(
                "[WEBHOOK] Name:",
                message.pushName
            );


            console.log(
                "[WEBHOOK] Message:",
                message.text
            );


            await processMessage(
                message
            );


        } catch (error) {

            console.error(
                "[WEBHOOK] Error:",
                error
            );
        }

    }
);


/*
|--------------------------------------------------------------------------
| EXPRESS ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use(

    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "[EXPRESS] Error:",
            error
        );


        if (
            !res.headersSent
        ) {

            res.status(500)
                .json({

                    status:
                        "error",

                    message:
                        "Internal server error",

                });

        }

    }

);


/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

app.listen(

    PORT,

    "0.0.0.0",

    () => {

        console.log(
            "================================="
        );

        console.log(
            " WhatsApp Monitoring Bot"
        );

        console.log(
            "================================="
        );

        console.log(
            `Port     : ${PORT}`
        );

        console.log(
            `Instance : ${INSTANCE}`
        );

        console.log(
            `Bot      : ${
                BOT_NUMBER ||
                "not configured"
            }`
        );

        console.log(
            `Report   : ${
                STATUS_REPORT_NUMBER ||
                "not configured"
            }`
        );

        console.log(
            `Report interval : ${
                STATUS_INTERVAL / 60000
            } minutes`
        );

        console.log(
            `Alert interval  : ${
                ALERT_INTERVAL / 1000
            } seconds`
        );

        console.log(
            "Status   : ONLINE"
        );

        console.log(
            "================================="
        );

    }
);


/*
|--------------------------------------------------------------------------
| SCHEDULER
|--------------------------------------------------------------------------
*/

/*
 * Status server setiap 30 menit
 */

setInterval(

    sendScheduledStatus,

    STATUS_INTERVAL

);


/*
 * Check alert setiap 1 menit
 */

setInterval(

    checkServerAlerts,

    ALERT_INTERVAL

);


console.log(
    `[SCHEDULER] Status report: ${
        STATUS_INTERVAL / 60000
    } menit`
);


console.log(
    `[SCHEDULER] Alert check: ${
        ALERT_INTERVAL / 1000
    } detik`
);