/*
|--------------------------------------------------------------------------
| FORMATTER
|--------------------------------------------------------------------------
| Formatter untuk data monitoring dari Home Server.
|
| Struktur CPU dari server.py:
|
| "cpu": {
|     "usage": 12.34
| }
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| SAFE NUMBER
|--------------------------------------------------------------------------
*/

function safeNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}


/*
|--------------------------------------------------------------------------
| CPU VALUE
|--------------------------------------------------------------------------
| Mendukung:
|
| data.cpu.usage
| data.cpu
|
| sehingga kompatibel dengan format lama maupun baru.
|--------------------------------------------------------------------------
*/

function getCpuValue(data) {

    const value =
        data?.cpu?.usage ??
        data?.cpu ??
        0;

    return safeNumber(value);
}


/*
|--------------------------------------------------------------------------
| PROGRESS BAR
|--------------------------------------------------------------------------
*/

function progressBar(
    percent,
    length = 10
) {

    percent = Math.max(
        0,
        Math.min(
            100,
            safeNumber(percent)
        )
    );

    const filled =
        Math.round(
            (percent / 100) * length
        );

    const empty =
        length - filled;

    return (
        "█".repeat(filled) +
        "░".repeat(empty)
    );
}


/*
|--------------------------------------------------------------------------
| STATUS ICON
|--------------------------------------------------------------------------
*/

function statusIcon(percent) {

    percent =
        safeNumber(percent);

    if (percent >= 95) {
        return "🔴";
    }

    if (percent >= 85) {
        return "🟠";
    }

    if (percent >= 70) {
        return "🟡";
    }

    return "🟢";
}


/*
|--------------------------------------------------------------------------
| FORMAT PERCENT
|--------------------------------------------------------------------------
*/

function formatPercent(percent) {

    return `${safeNumber(percent).toFixed(1)}%`;
}


/*
|--------------------------------------------------------------------------
| FORMAT BYTES
|--------------------------------------------------------------------------
*/

function formatBytes(bytes) {

    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];

    let value =
        safeNumber(bytes);

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
|--------------------------------------------------------------------------
| SYSTEM STATUS
|--------------------------------------------------------------------------
*/

function getSystemStatus(
    cpu,
    ram,
    disk
) {

    if (
        cpu >= 95 ||
        ram >= 95 ||
        disk >= 95
    ) {

        return {
            text: "🔴 SYSTEM CRITICAL",
            icon: "🔴"
        };
    }


    if (
        cpu >= 85 ||
        ram >= 85 ||
        disk >= 85
    ) {

        return {
            text: "🟠 SYSTEM WARNING",
            icon: "🟠"
        };
    }


    if (
        cpu >= 70 ||
        ram >= 70 ||
        disk >= 70
    ) {

        return {
            text: "🟡 SYSTEM NOTICE",
            icon: "🟡"
        };
    }


    return {
        text: "🟢 ALL SYSTEMS OPERATIONAL",
        icon: "🟢"
    };
}


/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

function formatStatus(data) {

    /*
     * CPU
     */

    const cpu =
        getCpuValue(data);


    /*
     * RAM
     */

    const ram =
        safeNumber(
            data?.memory?.percent
        );


    /*
     * DISK
     */

    const disk =
        safeNumber(
            data?.disk?.percent
        );


    /*
     * DOCKER
     */

    const running =
        safeNumber(
            data?.docker?.running
        );


    const stopped =
        safeNumber(
            data?.docker?.stopped
        );


    /*
     * SYSTEM STATUS
     *
     * Docker tidak dimasukkan ke dalam
     * SYSTEM CRITICAL.
     *
     * CPU/RAM/DISK = system resource
     * Docker = service/container status
     */

    const system =
        getSystemStatus(
            cpu,
            ram,
            disk
        );


    /*
     * NETWORK
     */

    const network =
        Array.isArray(data?.network)
            ? data.network
            : [];


    let rx = 0;
    let tx = 0;


    for (const iface of network) {

        rx += safeNumber(
            iface?.rx
        );

        tx += safeNumber(
            iface?.tx
        );
    }


    /*
     * WARNING COUNTER
     */

    let warnings = 0;


    if (cpu >= 70) {
        warnings++;
    }


    if (ram >= 70) {
        warnings++;
    }


    if (disk >= 70) {
        warnings++;
    }


    /*
     * Docker problem dihitung terpisah
     */

    const dockerProblem =
        stopped > 0;


    /*
     * FOOTER
     */

    let footer;


    if (
        warnings === 0 &&
        !dockerProblem
    ) {

        footer =
            "🟢 Monitoring Active";

    } else {

        const totalProblems =
            warnings +
            (dockerProblem ? 1 : 0);


        footer =
            `${system.icon} ` +
            `${totalProblems} issue(s) require attention`;
    }


    /*
     * HOSTNAME
     */

    const hostname =
        data?.hostname ||
        "Home Server";


    /*
     * UPTIME
     */

    const uptime =
        data?.uptime?.formatted ||
        "-";


    /*
     * LOAD
     */

    const load1 =
        safeNumber(
            data?.load?.one
        );


    const load5 =
        safeNumber(
            data?.load?.five
        );


    const load15 =
        safeNumber(
            data?.load?.fifteen
        );


    /*
     * DOCKER STATUS
     */

    const dockerStatus =
        stopped > 0
            ? `🔴 ${stopped} Stopped`
            : "🟢 0 Stopped";


    return `╭━━━━━━ 🖥️ SERVER STATUS ━━━━━━╮
┃ ${system.text}
┃
┃ 🖥️ HOST
┃ ${hostname}
┃
┃ ⚙️ SYSTEM
┃ CPU  ${progressBar(cpu)} ${cpu.toFixed(0)}%
┃ RAM  ${progressBar(ram)} ${ram.toFixed(0)}%
┃ DISK ${progressBar(disk)} ${disk.toFixed(0)}%
┃
┃ 🐳 DOCKER
┃ 🟢 ${running} Running
┃ ${dockerStatus}
┃
┃ 🌐 NETWORK
┃ RX  ${formatBytes(rx)}
┃ TX  ${formatBytes(tx)}
┃
┃ 📊 LOAD
┃ 1m   ${load1.toFixed(2)}
┃ 5m   ${load5.toFixed(2)}
┃ 15m  ${load15.toFixed(2)}
┃
┃ ⏱️ UPTIME
┃ ${uptime}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
🤖 WhatsApp Monitoring
${footer}`;
}


/*
|--------------------------------------------------------------------------
| CPU
|--------------------------------------------------------------------------
*/

function formatCpu(data) {

    const cpu =
        getCpuValue(data);


    let status =
        "🟢 HEALTHY";


    if (cpu >= 95) {

        status =
            "🔴 CRITICAL";

    } else if (cpu >= 85) {

        status =
            "🟠 WARNING";

    } else if (cpu >= 70) {

        status =
            "🟡 HIGH";
    }


    const load1 =
        safeNumber(
            data?.load?.one
        );


    const load5 =
        safeNumber(
            data?.load?.five
        );


    const load15 =
        safeNumber(
            data?.load?.fifteen
        );


    return `╭━━━ ⚙️ CPU MONITOR ━━━╮
┃
┃ ${status}
┃
┃ Usage
┃ ${progressBar(cpu)} ${formatPercent(cpu)}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

📈 LOAD AVERAGE

1 minute  : ${load1.toFixed(2)}
5 minutes : ${load5.toFixed(2)}
15 minutes: ${load15.toFixed(2)}

⚙️ CPU monitoring aktif`;
}


/*
|--------------------------------------------------------------------------
| MEMORY
|--------------------------------------------------------------------------
*/

function formatMemory(memory) {

    const percent =
        safeNumber(
            memory?.percent
        );


    let status =
        "🟢 HEALTHY";


    if (percent >= 95) {

        status =
            "🔴 CRITICAL";

    } else if (percent >= 85) {

        status =
            "🟠 WARNING";

    } else if (percent >= 70) {

        status =
            "🟡 HIGH";
    }


    return `╭━━━ 🧠 MEMORY MONITOR ━━━╮
┃
┃ ${status}
┃
┃ RAM Usage
┃ ${progressBar(percent)} ${formatPercent(percent)}
┃
┃ Used      : ${formatBytes(memory?.used)}
┃ Available : ${formatBytes(memory?.available)}
┃ Total     : ${formatBytes(memory?.total)}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━╯

🧠 Memory monitoring aktif`;
}


/*
|--------------------------------------------------------------------------
| DISK
|--------------------------------------------------------------------------
*/

function formatDisk(disk) {

    const percent =
        safeNumber(
            disk?.percent
        );


    let status =
        "🟢 HEALTHY";


    if (percent >= 95) {

        status =
            "🔴 CRITICAL";

    } else if (percent >= 85) {

        status =
            "🟠 WARNING";

    } else if (percent >= 70) {

        status =
            "🟡 HIGH";
    }


    return `╭━━━ 💾 DISK MONITOR ━━━╮
┃
┃ ${status}
┃
┃ Storage
┃ ${progressBar(percent)} ${formatPercent(percent)}
┃
┃ Used      : ${formatBytes(disk?.used)}
┃ Available : ${formatBytes(disk?.available)}
┃ Total     : ${formatBytes(disk?.total)}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯

💾 Disk monitoring aktif`;
}


/*
|--------------------------------------------------------------------------
| DOCKER
|--------------------------------------------------------------------------
*/

function formatDocker(containers) {

    if (
        !Array.isArray(containers) ||
        containers.length === 0
    ) {

        return `╭━━━ 🐳 DOCKER MONITOR ━━━╮
┃
┃ ⚠️ Tidak ada container
┃ yang terdeteksi.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }


    const running =
        containers.filter(
            container =>
                container?.running
        ).length;


    const stopped =
        containers.length -
        running;


    const list =
        containers
            .map(
                container => {

                    const icon =
                        container?.running
                            ? "🟢"
                            : "🔴";


                    return `┃ ${icon} ${container.name}
┃    ${container.status}`;
                }
            )
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


/*
|--------------------------------------------------------------------------
| NETWORK
|--------------------------------------------------------------------------
*/

function formatNetwork(network) {

    if (
        !Array.isArray(network) ||
        network.length === 0
    ) {

        return `╭━━━ 🌐 NETWORK MONITOR ━━━╮
┃
┃ ⚠️ Interface tidak ditemukan.
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }


    const list =
        network
            .map(
                item => {

                    return `┃ 🌐 ${item.name}
┃    RX : ${formatBytes(item.rx)}
┃    TX : ${formatBytes(item.tx)}`;
                }
            )
            .join("\n");


    return `╭━━━ 🌐 NETWORK MONITOR ━━━╮
┃
${list}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯

🌐 Network monitoring aktif`;
}


/*
|--------------------------------------------------------------------------
| HELP
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {

    formatStatus,

    formatCpu,

    formatMemory,

    formatDisk,

    formatDocker,

    formatNetwork,

    formatHelp,

};