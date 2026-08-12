function progressBar(percent, length = 10) {
    percent = Math.max(0, Math.min(100, Number(percent) || 0));

    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;

    return "█".repeat(filled) + "░".repeat(empty);
}

function statusIcon(percent) {
    percent = Number(percent) || 0;

    if (percent >= 95) return "🔴";
    if (percent >= 85) return "🟠";
    if (percent >= 70) return "🟡";

    return "🟢";
}

function formatPercent(percent) {
    return `${Number(percent || 0).toFixed(1)}%`;
}

function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB", "TB"];

    let value = Number(bytes) || 0;
    let unit = 0;

    while (
        value >= 1024 &&
        unit < units.length - 1
    ) {
        value /= 1024;
        unit++;
    }

    return `${value.toFixed(2)} ${units[unit]}`;
}


/* =========================================
   STATUS
========================================= */

function formatStatus(data) {

    const cpu =
        Number(data.cpu || 0);

    const ram =
        Number(data.memory?.percent || 0);

    const disk =
        Number(data.disk?.percent || 0);

    const running =
        data.docker?.running || 0;

    const stopped =
        data.docker?.stopped || 0;


    /*
     * Tentukan status sistem
     */

    let systemStatus =
        "🟢 ALL SYSTEMS OPERATIONAL";

    let statusIcon = "🟢";


    if (
        cpu >= 95 ||
        ram >= 95 ||
        disk >= 95 ||
        stopped > 0
    ) {
        systemStatus =
            "🔴 SYSTEM CRITICAL";

        statusIcon = "🔴";

    } else if (
        cpu >= 85 ||
        ram >= 85 ||
        disk >= 85
    ) {
        systemStatus =
            "🟠 SYSTEM WARNING";

        statusIcon = "🟠";

    } else if (
        cpu >= 70 ||
        ram >= 70 ||
        disk >= 70
    ) {
        systemStatus =
            "🟡 SYSTEM NOTICE";

        statusIcon = "🟡";
    }


    /*
     * Network
     */

    const network =
        data.network || [];

    let rx = 0;
    let tx = 0;

    for (const iface of network) {
        rx += Number(iface.rx || 0);
        tx += Number(iface.tx || 0);
    }


    /*
     * Format bytes
     */

    function bytes(bytes) {

        const units = [
            "B",
            "KB",
            "MB",
            "GB",
            "TB"
        ];

        let value =
            Number(bytes) || 0;

        let unit = 0;

        while (
            value >= 1024 &&
            unit < units.length - 1
        ) {
            value /= 1024;
            unit++;
        }

        return `${value.toFixed(2)} ${units[unit]}`;
    }


    /*
     * Warning counter
     */

    let warnings = 0;

    if (cpu >= 70) warnings++;
    if (ram >= 70) warnings++;
    if (disk >= 70) warnings++;
    if (stopped > 0) warnings++;


    /*
     * Footer
     */

    let footer;

    if (warnings === 0) {

        footer =
            "🟢 Monitoring Active";

    } else {

        footer =
            `${statusIcon} ${warnings} resource(s) require attention`;
    }


    return `╭━━━━━━ 🖥️ SERVER STATUS ━━━━━━╮
┃ ${systemStatus}
┃
┃ ⚙️ SYSTEM
┃ CPU  ${progressBar(cpu)} ${cpu.toFixed(0)}%
┃ RAM  ${progressBar(ram)} ${ram.toFixed(0)}%
┃ DISK ${progressBar(disk)} ${disk.toFixed(0)}%
┃
┃ 🐳 DOCKER
┃ 🟢 ${running} Running
┃ 🔴 ${stopped} Stopped
┃
┃ 🌐 NETWORK
┃ RX  ${bytes(rx)}
┃ TX  ${bytes(tx)}
┃
┃ 📊 LOAD
┃ 1m   ${Number(data.load?.one || 0).toFixed(2)}
┃ 5m   ${Number(data.load?.five || 0).toFixed(2)}
┃ 15m  ${Number(data.load?.fifteen || 0).toFixed(2)}
┃
┃ ⏱️ UPTIME
┃ ${data.uptime?.formatted || "-"}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🤖 WhatsApp Monitoring
${footer}`;
}

/* =========================================
   CPU
========================================= */

function formatCpu(data) {
    const cpu = Number(data.cpu || 0);

    let status = "🟢 HEALTHY";

    if (cpu >= 95) {
        status = "🔴 CRITICAL";
    } else if (cpu >= 85) {
        status = "🟠 WARNING";
    } else if (cpu >= 70) {
        status = "🟡 HIGH";
    }

    return `╭━━━ ⚙️ CPU MONITOR ━━━╮
┃
┃ ${status}
┃
┃ Usage
┃ ${progressBar(cpu)} ${formatPercent(cpu)}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

📈 LOAD AVERAGE

1 minute  : ${data.load?.one?.toFixed(2) || "0.00"}
5 minutes : ${data.load?.five?.toFixed(2) || "0.00"}
15 minutes: ${data.load?.fifteen?.toFixed(2) || "0.00"}

⚙️ CPU monitoring aktif`;
}


/* =========================================
   MEMORY
========================================= */

function formatMemory(memory) {
    const percent = Number(memory?.percent || 0);

    let status = "🟢 HEALTHY";

    if (percent >= 95) {
        status = "🔴 CRITICAL";
    } else if (percent >= 85) {
        status = "🟠 WARNING";
    } else if (percent >= 70) {
        status = "🟡 HIGH";
    }

    return `╭━━━ 🧠 MEMORY MONITOR ━━━╮
┃
┃ ${status}
┃
┃ RAM Usage
┃ ${progressBar(percent)} ${formatPercent(percent)}
┃
┃ Used      : ${formatBytes(memory.used)}
┃ Available : ${formatBytes(memory.available)}
┃ Total     : ${formatBytes(memory.total)}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯

🧠 Memory monitoring aktif`;
}


/* =========================================
   DISK
========================================= */

function formatDisk(disk) {
    const percent = Number(disk?.percent || 0);

    let status = "🟢 HEALTHY";

    if (percent >= 95) {
        status = "🔴 CRITICAL";
    } else if (percent >= 85) {
        status = "🟠 WARNING";
    } else if (percent >= 70) {
        status = "🟡 HIGH";
    }

    return `╭━━━ 💾 DISK MONITOR ━━━╮
┃
┃ ${status}
┃
┃ Storage
┃ ${progressBar(percent)} ${formatPercent(percent)}
┃
┃ Used      : ${formatBytes(disk.used)}
┃ Available : ${formatBytes(disk.available)}
┃ Total     : ${formatBytes(disk.total)}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯

💾 Disk monitoring aktif`;
}


/* =========================================
   DOCKER
========================================= */

function formatDocker(containers) {
    if (!containers || containers.length === 0) {
        return `╭━━━ 🐳 DOCKER MONITOR ━━━╮
┃
┃ ⚠️ Tidak ada container
┃ yang terdeteksi.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }

    const running =
        containers.filter(
            (container) => container.running
        ).length;

    const stopped =
        containers.length - running;

    const list = containers
        .map((container) => {
            const icon =
                container.running
                    ? "🟢"
                    : "🔴";

            return `┃ ${icon} ${container.name}
┃    ${container.status}`;
        })
        .join("\n");

    return `╭━━━ 🐳 DOCKER MONITOR ━━━╮
┃
${list}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯

📦 CONTAINER SUMMARY

Total   : ${containers.length}
🟢 Up   : ${running}
🔴 Down : ${stopped}`;
}


/* =========================================
   NETWORK
========================================= */

function formatNetwork(network) {
    if (!network || network.length === 0) {
        return `╭━━━ 🌐 NETWORK MONITOR ━━━╮
┃
┃ ⚠️ Interface tidak ditemukan.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }

    const list = network
        .map((item) => {
            return `┃ 🌐 ${item.name}
┃    RX : ${formatBytes(item.rx)}
┃    TX : ${formatBytes(item.tx)}`;
        })
        .join("\n");

    return `╭━━━ 🌐 NETWORK MONITOR ━━━╮
┃
${list}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯

🌐 Network monitoring aktif`;
}


/* =========================================
   HELP
========================================= */

function formatHelp() {
    return `╭━━━ 🤖 SERVER MONITOR ━━━╮
┃
┃ 📊 SYSTEM MONITORING
┃
┃ !status
┃   └─ Status server lengkap
┃
┃ !cpu
┃   └─ CPU & load average
┃
┃ !ram
┃   └─ Penggunaan RAM
┃
┃ !disk
┃   └─ Penggunaan storage
┃
┃ !docker
┃   └─ Status container Docker
┃
┃ !network
┃   └─ Informasi network
┃
┃ !uptime
┃   └─ Lama server aktif
┃
┃
┃ ⚙️ OTHER
┃
┃ !ping
┃   └─ Test bot
┃
┃ !help
┃   └─ Menampilkan menu ini
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

💡 Ketik command di atas
untuk menjalankan monitoring.

🔒 Satu command per chat
⚡ Response otomatis`;
}


module.exports = {
    formatStatus,
    formatCpu,
    formatMemory,
    formatDisk,
    formatDocker,
    formatNetwork,
    formatHelp,
};