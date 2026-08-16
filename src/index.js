require("dotenv").config();

const express = require("express");
const axios = require("axios");

const {
    getHomeServerStatus,
    getHomeServerHealth,
} = require("./home-server-monitor");

const {
    getAwsStatus,
} = require("./aws-monitor");

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
    process.env.EVOLUTION_INSTANCE || "";

const BOT_NUMBER =
    process.env.BOT_NUMBER || "";

const COMMAND_COOLDOWN =
    Number(process.env.COMMAND_COOLDOWN) || 3000;


/*
|--------------------------------------------------------------------------
| ACCESS CONTROL
|--------------------------------------------------------------------------
|
| ADMIN_NUMBER
| → Nomor utama yang memiliki akses monitoring.
|
| SPECIAL_NUMBER
| → Ditangani oleh special-game.js melalui isSpecialUser().
|
| Nomor lainnya
| → Tidak mendapatkan balasan sama sekali.
|
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


const ADMIN_NUMBER =
    normalizeNumber(
        process.env.ADMIN_NUMBER || ""
    );


function isAdmin(number) {

    if (!ADMIN_NUMBER) {

        console.error(
            "[ACCESS] ADMIN_NUMBER belum dikonfigurasi!"
        );

        return false;
    }

    return (
        normalizeNumber(number) ===
        ADMIN_NUMBER
    );
}


/*
|--------------------------------------------------------------------------
| SCHEDULER
|--------------------------------------------------------------------------
|
| STATUS_REPORT_INTERVAL = 30 menit
| ALERT_CHECK_INTERVAL   = 1 menit
|
|--------------------------------------------------------------------------
*/

const STATUS_INTERVAL =
    Number(
        process.env.STATUS_REPORT_INTERVAL
    ) || 30 * 60 * 1000;


const ALERT_INTERVAL =
    Number(
        process.env.ALERT_CHECK_INTERVAL
    ) || 60 * 1000;


const STATUS_REPORT_NUMBER =
    process.env.STATUS_REPORT_NUMBER || "";


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

/*
 * Chat yang sedang menjalankan command.
 */

const activeChats =
    new Set();


/*
 * Cooldown setiap chat.
 */

const cooldowns =
    new Map();


/*
 * State resource alert.
 */

const alertState = {

    cpu: "normal",

    ram: "normal",

    disk: "normal",

    docker: "normal",

};


/*
|--------------------------------------------------------------------------
| SEND WHATSAPP
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
| OWN MESSAGE DETECTION
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
     * Bandingkan dengan nomor bot.
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
     * Ignore pesan bot sendiri.
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
     * Ignore group.
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
     * Support text dan caption.
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
                ""
            );


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
| HOME SERVER
|--------------------------------------------------------------------------
*/

/*
 * Semua monitoring Home Server
 * mengambil data dari Home Server Agent.
 */

async function getFullStatus() {

    try {

        const data =
            await getHomeServerStatus();

        return data;

    } catch (error) {

        console.error(
            "[HOME SERVER] Failed to get status:",
            error.response?.data ||
            error.message
        );

        throw error;

    }

}


/*
|--------------------------------------------------------------------------
| SCHEDULED STATUS REPORT
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
            "[SCHEDULER] Mengambil status Home Server..."
        );


        const data =
            await getFullStatus();


        const message =
            formatStatus(data);


        await sendWhatsApp(

            STATUS_REPORT_NUMBER,

            `📊 *PERIODIC HOME SERVER REPORT*

━━━━━━━━━━━━━━━━━━

${message}

━━━━━━━━━━━━━━━━━━

☁️ EC2 WATCHDOG
🟢 ONLINE

📡 Data:
🏠 Home Server

━━━━━━━━━━━━━━━━━━

🤖 WhatsApp Server Monitoring`

        );


        console.log(
            "[SCHEDULER] Home Server status berhasil dikirim"
        );


    } catch (error) {

        console.error(

            "[SCHEDULER] Gagal mengambil/mengirim status:",
            error.response?.data ||
            error.message

        );

    }

}


/*
|--------------------------------------------------------------------------
| RESOURCE LEVEL
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
     * Tidak ada perubahan.
     */

    if (
        level === previous
    ) {

        return;

    }


    /*
     * Update state.
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

🏠 Server:
*Home Server*

🖥️ Resource:
*${label}*

📊 Usage:
*${value.toFixed(1)}%*

🟢 Status:
*NORMAL*

━━━━━━━━━━━━━━━━━━

✅ Resource kembali
dalam batas normal.

☁️ EC2 Watchdog
🟢 ONLINE`

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

🏠 Server:
*Home Server*

🖥️ Resource:
*${label}*

📊 Usage:
*${value.toFixed(1)}%*

🚨 Status:
*${level.toUpperCase()}*

━━━━━━━━━━━━━━━━━━

⚠️ Home Server membutuhkan
perhatian.

☁️ EC2 Watchdog
🟢 ONLINE`

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
        data?.docker?.containers ||
        data?.containers ||
        [];


    const stopped =
        containers.filter(

            container =>
                !container.running

        );


    /*
     * Jika tidak ada container,
     * jangan dianggap sebagai masalah.
     */

    const currentState =
        stopped.length > 0
            ? "problem"
            : "normal";


    const previous =
        alertState.docker;


    /*
     * Tidak ada perubahan.
     */

    if (
        currentState === previous
    ) {

        return;

    }


    /*
     * Update state.
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

🏠 Server:
*Home Server*

🐳 Docker:
🟢 NORMAL

📦 Total Container:
*${containers.length}*

━━━━━━━━━━━━━━━━━━

✅ Semua container
kembali berjalan.

☁️ EC2 Watchdog
🟢 ONLINE`

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

🏠 Server:
*Home Server*

🐳 Container bermasalah:

${list}

━━━━━━━━━━━━━━━━━━

⚠️ Segera periksa
container tersebut.

☁️ EC2 Watchdog
🟢 ONLINE`

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

        /*
         * Data berasal dari Home Server.
         */

        const data =
            await getFullStatus();


        /*
         * CPU
         */

        const cpuValue =
            data?.cpu?.usage ??
            data?.cpu ??
            0;


        const cpu =
            Number(cpuValue);


        const safeCpu =
            Number.isFinite(cpu)
                ? cpu
                : 0;


        const cpuLevel =
            getResourceLevel(

                safeCpu,

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
                data?.memory?.percent ||
                0
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
                data?.disk?.percent ||
                0
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
         * Resource alerts
         */

        await processResourceAlert(

            "cpu",

            cpuLevel,

            safeCpu,

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
         * Docker alert
         */

        await checkDockerAlert(

            data,

            STATUS_REPORT_NUMBER

        );


    } catch (error) {

        console.error(

            "[ALERT] Home Server monitoring error:",

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

        let homeOnline = false;

        try {

            const health =
                await getHomeServerHealth();


            homeOnline =
                health?.status === "online";

        } catch {

            homeOnline = false;

        }


        return `╭━━━ 🏓 PING ━━━╮
┃
┃ 🟢 BOT ONLINE
┃ 🟢 Evolution API
┃ 🟢 Webhook
┃ 🟢 Command Handler
┃
┃ 🏠 Home Server
┃ ${homeOnline ? "🟢 ONLINE" : "🔴 OFFLINE"}
┃
┃ ☁️ EC2 Watchdog
┃ 🟢 ONLINE
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

        const data =
            await getFullStatus();


        const cpu =
            Number(
                data?.cpu?.usage ??
                data?.cpu ??
                0
            );


        const load =
            data?.load || {

                one: 0,

                five: 0,

                fifteen: 0,

            };


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

        const data =
            await getFullStatus();


        const memory =
            data?.memory || {

                total: 0,

                used: 0,

                available: 0,

                percent: 0,

            };


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

        const data =
            await getFullStatus();


        const disk =
            data?.disk || {

                total: 0,

                used: 0,

                available: 0,

                percent: 0,

            };


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

        const data =
            await getFullStatus();


        const uptime =
            data?.uptime || {

                formatted:
                    "Unknown",

            };


        return `╭━━━ ⏱️ HOME SERVER UPTIME ━━━╮
┃
┃ 🏠 HOME SERVER
┃ 🟢 ONLINE
┃
┃ ⏱️ Uptime
┃ ${uptime.formatted}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

☁️ EC2 Watchdog
🟢 ONLINE

📡 Data source:
🏠 Home Server`;

    }


    /*
     * DOCKER
     */

    if (
        command === "!docker"
    ) {

        const data =
            await getFullStatus();


        const containers =
            data?.docker?.containers ||
            data?.containers ||
            [];


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

        const data =
            await getFullStatus();


        const network =
            data?.network ||
            [];


        return formatNetwork(
            network
        );

    }


    /*
     * AWS EC2
     */

    if (
        command === "!aws"
    ) {

        const data =
            await getAwsStatus();


        return formatStatus(data)
            .replace(
                "🖥️ SERVER STATUS",
                "☁️ AWS EC2 STATUS"
            )
            .replace(
                "🤖 WhatsApp Monitoring",
                "☁️ AWS T4g.micro Monitoring"
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
| PROCESS MESSAGE
|--------------------------------------------------------------------------
*/

async function processMessage(
    message
) {

    const chat =
        message.number;


    /*
    |--------------------------------------------------------------------------
    | SPECIAL USER
    |--------------------------------------------------------------------------
    |
    | Nomor special diproses terlebih dahulu.
    |
    | Nomor ini tetap bisa menggunakan
    | fitur special-game.js.
    |
    |--------------------------------------------------------------------------
    */

    if (
        isSpecialUser(chat)
    ) {

        console.log(
            `[SPECIAL] Message from special user: ${message.text}`
        );


        /*
         * Game answer
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
         * Special command
         */

        const special =
            handleSpecialCommand(
                message
            );


        if (
            special.handled
        ) {

            await sendWhatsApp(
                chat,
                special.reply
            );

            return;

        }


        /*
         * Special fallback
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
    | ADMIN ACCESS
    |--------------------------------------------------------------------------
    |
    | Hanya ADMIN_NUMBER yang boleh
    | menjalankan monitoring.
    |
    |--------------------------------------------------------------------------
    */

    if (
        !isAdmin(chat)
    ) {

        console.log(
            `[ACCESS DENIED] Ignoring message from ${chat}`
        );

        /*
         * PENTING:
         *
         * Tidak ada sendWhatsApp()
         * di sini.
         *
         * Jadi nomor yang tidak
         * memiliki akses akan
         * benar-benar tidak mendapat
         * balasan.
         */

        return;

    }


    /*
    |--------------------------------------------------------------------------
    | NORMAL MONITORING MODE
    |--------------------------------------------------------------------------
    */

    if (
        activeChats.has(chat)
    ) {

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
     * COOLDOWN
     */

    const now =
        Date.now();


    const lastCommand =
        cooldowns.get(chat) || 0;


    if (
        now - lastCommand <
        COMMAND_COOLDOWN
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
     * LOCK CHAT
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
┃ ⚠️ Home Server mungkin
┃ tidak dapat dihubungi.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯

💡 Silakan coba kembali
beberapa saat lagi.`

            );

        } catch (sendError) {

            console.error(
                "[COMMAND] Failed to send error:",
                sendError.message
            );

        }

    } finally {

        activeChats.delete(
            chat
        );

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
                "3.1.0",

            instance:
                INSTANCE,

            uptime:
                process.uptime(),

            monitoring:
                "Home Server",

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

            monitoring:
                "home-server",

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
         * Balas webhook secepat mungkin.
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
            `Admin    : ${
                ADMIN_NUMBER ||
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
            `Monitoring : HOME SERVER`
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
| SCHEDULERS
|--------------------------------------------------------------------------
*/

/*
 * Status Home Server setiap 30 menit.
 */

setInterval(
    sendScheduledStatus,
    STATUS_INTERVAL
);


/*
 * Resource alert Home Server setiap 1 menit.
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