const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const HOST = "/host";

function readFile(path) {
    return fs.readFileSync(`${HOST}${path}`, "utf8");
}

function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB", "TB"];

    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${value.toFixed(2)} ${units[unit]}`;
}

function percentBar(percent, length = 10) {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;

    return "█".repeat(filled) + "░".repeat(empty);
}

function getCpu() {
    const data = readFile("/proc/stat");

    const line = data
        .split("\n")
        .find((line) => line.startsWith("cpu "));

    if (!line) {
        throw new Error("CPU information tidak ditemukan");
    }

    const values = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map(Number);

    const idle = values[3] + values[4];

    const total = values.reduce(
        (sum, value) => sum + value,
        0
    );

    return {
        idle,
        total,
    };
}

async function getCpuUsage() {
    const first = getCpu();

    await new Promise((resolve) => setTimeout(resolve, 500));

    const second = getCpu();

    const totalDiff = second.total - first.total;
    const idleDiff = second.idle - first.idle;

    if (totalDiff <= 0) {
        return 0;
    }

    return ((totalDiff - idleDiff) / totalDiff) * 100;
}

function getMemory() {
    const data = readFile("/proc/meminfo");

    const values = {};

    for (const line of data.split("\n")) {
        const match = line.match(/^(\w+):\s+(\d+)\s+kB/);

        if (match) {
            values[match[1]] = Number(match[2]) * 1024;
        }
    }

    const total = values.MemTotal || 0;
    const available = values.MemAvailable || 0;
    const used = total - available;

    return {
        total,
        used,
        available,
        percent: total
            ? (used / total) * 100
            : 0,
    };
}

function getUptime() {
    const seconds = Number(
        readFile("/proc/uptime")
            .split(" ")[0]
    );

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(
        (seconds % 86400) / 3600
    );
    const minutes = Math.floor(
        (seconds % 3600) / 60
    );

    return {
        seconds,
        formatted: `${days}d ${hours}h ${minutes}m`,
    };
}

async function getDisk() {
    const { stdout } = await execFileAsync(
        "df",
        ["-B1", "-P", `${HOST}/`]
    );

    const lines = stdout.trim().split("\n");

    const values = lines[lines.length - 1]
        .split(/\s+/);

    const total = Number(values[1]);
    const used = Number(values[2]);
    const available = Number(values[3]);
    const percent = Number(
        values[4].replace("%", "")
    );

    return {
        total,
        used,
        available,
        percent,
    };
}

async function getLoadAverage() {
    const data = readFile("/proc/loadavg");

    const values = data
        .trim()
        .split(/\s+/);

    return {
        one: Number(values[0]),
        five: Number(values[1]),
        fifteen: Number(values[2]),
    };
}

async function getDockerContainers() {
    try {
        const { stdout } = await execFileAsync(
            "docker",
            [
                "ps",
                "-a",
                "--format",
                "{{.Names}}|{{.Status}}"
            ]
        );

        return stdout
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => {
                const [name, status] =
                    line.split("|");

                return {
                    name,
                    status,
                    running: status.startsWith("Up"),
                };
            });
    } catch (error) {
        console.error(
            "Docker monitoring error:",
            error.message
        );

        return [];
    }
}

async function getNetwork() {
    try {

        const interfaces = [];

        const netPath =
            `${HOST}/sys/class/net`;

        const names =
            fs.readdirSync(netPath);


        for (const name of names) {

            try {

                const statsPath =
                    `${HOST}/proc/net/dev`;

                const data =
                    fs.readFileSync(
                        statsPath,
                        "utf8"
                    );


                const line =
                    data
                        .split("\n")
                        .find(
                            line =>
                                line.trim()
                                    .startsWith(
                                        `${name}:`
                                    )
                        );


                if (!line) {

                    interfaces.push({
                        name,
                        rx: 0,
                        tx: 0,
                    });

                    continue;
                }


                const [, values] =
                    line.split(":");


                const parts =
                    values
                        .trim()
                        .split(/\s+/)
                        .map(Number);


                interfaces.push({

                    name,

                    rx:
                        parts[0] || 0,

                    tx:
                        parts[8] || 0,

                });


            } catch {

                interfaces.push({

                    name,

                    rx: 0,

                    tx: 0,

                });
            }
        }


        return interfaces;

    } catch (error) {

        console.error(
            "Network monitoring error:",
            error.message
        );

        return [];
    }
}

module.exports = {
    getCpuUsage,
    getMemory,
    getUptime,
    getDisk,
    getLoadAverage,
    getDockerContainers,
    getNetwork,
    formatBytes,
    percentBar,
};
