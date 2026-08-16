const os = require("os");
const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);


/*
|--------------------------------------------------------------------------
| CPU
|--------------------------------------------------------------------------
*/

async function getAwsCpuUsage() {
    function readCpu() {
        const stat = fs.readFileSync(
            "/proc/stat",
            "utf8"
        );

        const line = stat
            .split("\n")
            .find(line => line.startsWith("cpu "));

        const values = line
            .trim()
            .split(/\s+/)
            .slice(1)
            .map(Number);

        const idle =
            values[3] + values[4];

        const total =
            values.reduce(
                (sum, value) => sum + value,
                0
            );

        return {
            idle,
            total
        };
    }

    const first = readCpu();

    await new Promise(resolve =>
        setTimeout(resolve, 500)
    );

    const second = readCpu();

    const totalDiff =
        second.total - first.total;

    const idleDiff =
        second.idle - first.idle;

    if (totalDiff <= 0) {
        return 0;
    }

    return Number(
        (
            ((totalDiff - idleDiff) /
                totalDiff) *
            100
        ).toFixed(2)
    );
}


/*
|--------------------------------------------------------------------------
| MEMORY
|--------------------------------------------------------------------------
*/

function getAwsMemory() {
    const meminfo =
        fs.readFileSync(
            "/proc/meminfo",
            "utf8"
        );

    const values = {};

    for (const line of meminfo.split("\n")) {
        const parts = line.split(/\s+/);

        if (parts.length >= 2) {
            const key =
                parts[0].replace(":", "");

            values[key] =
                Number(parts[1]) * 1024;
        }
    }

    const total =
        values.MemTotal || 0;

    const available =
        values.MemAvailable || 0;

    const used =
        total - available;

    const percent =
        total > 0
            ? (used / total) * 100
            : 0;

    return {
        total,
        used,
        available,
        percent: Number(
            percent.toFixed(2)
        )
    };
}


/*
|--------------------------------------------------------------------------
| DISK
|--------------------------------------------------------------------------
*/

async function getAwsDisk() {
    try {
        const { stdout } =
            await execFileAsync(
                "df",
                ["-B1", "/"]
            );

        const lines =
            stdout.trim().split("\n");

        const parts =
            lines[1].split(/\s+/);

        const total =
            Number(parts[1]);

        const used =
            Number(parts[2]);

        const available =
            Number(parts[3]);

        const percent =
            parseFloat(
                parts[4].replace("%", "")
            );

        return {
            total,
            used,
            available,
            percent
        };

    } catch (error) {

        console.error(
            "[AWS] Disk error:",
            error.message
        );

        return {
            total: 0,
            used: 0,
            available: 0,
            percent: 0
        };
    }
}


/*
|--------------------------------------------------------------------------
| LOAD
|--------------------------------------------------------------------------
*/

function getAwsLoad() {
    const load =
        os.loadavg();

    return {
        one: load[0],
        five: load[1],
        fifteen: load[2]
    };
}


/*
|--------------------------------------------------------------------------
| UPTIME
|--------------------------------------------------------------------------
*/

function getAwsUptime() {
    const seconds =
        os.uptime();

    const days =
        Math.floor(
            seconds / 86400
        );

    const hours =
        Math.floor(
            (seconds % 86400) / 3600
        );

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    return {
        seconds,
        formatted:
            `${days}d ${hours}h ${minutes}m`
    };
}


/*
|--------------------------------------------------------------------------
| DOCKER
|--------------------------------------------------------------------------
*/

async function getAwsDocker() {
    try {

        const { stdout } =
            await execFileAsync(
                "docker",
                [
                    "ps",
                    "-a",
                    "--format",
                    "{{.Names}}|{{.Status}}"
                ],
                {
                    timeout: 5000
                }
            );

        const containers =
            stdout
                .trim()
                .split("\n")
                .filter(Boolean)
                .map(line => {

                    const [
                        name,
                        status
                    ] = line.split("|");

                    return {
                        name,
                        status,
                        running:
                            status.startsWith("Up")
                    };
                });

        const running =
            containers.filter(
                c => c.running
            ).length;

        return {
            available: true,
            running,
            stopped:
                containers.length -
                running,
            containers
        };

    } catch (error) {

        return {
            available: false,
            running: 0,
            stopped: 0,
            containers: [],
            error: error.message
        };
    }
}


/*
|--------------------------------------------------------------------------
| NETWORK
|--------------------------------------------------------------------------
*/

function getAwsNetwork() {
    const interfaces =
        fs.readFileSync(
            "/proc/net/dev",
            "utf8"
        );

    const result = [];

    for (
        const line of
        interfaces.split("\n")
    ) {

        if (!line.includes(":")) {
            continue;
        }

        const [
            name,
            values
        ] = line.trim().split(":");

        const parts =
            values.trim().split(/\s+/);

        if (parts.length < 9) {
            continue;
        }

        result.push({
            name: name.trim(),
            rx: Number(parts[0]),
            tx: Number(parts[8])
        });
    }

    return result;
}


/*
|--------------------------------------------------------------------------
| FULL AWS STATUS
|--------------------------------------------------------------------------
*/

async function getAwsStatus() {

    const [
        cpu,
        disk,
        docker
    ] = await Promise.all([
        getAwsCpuUsage(),
        getAwsDisk(),
        getAwsDocker()
    ]);

    return {
        online: true,

        hostname:
            os.hostname(),

        platform:
            os.platform(),

        architecture:
            os.arch(),

        cpu: {
            usage: cpu
        },

        memory:
            getAwsMemory(),

        disk,

        uptime:
            getAwsUptime(),

        load:
            getAwsLoad(),

        network:
            getAwsNetwork(),

        docker
    };
}


module.exports = {
    getAwsCpuUsage,
    getAwsMemory,
    getAwsDisk,
    getAwsLoad,
    getAwsUptime,
    getAwsDocker,
    getAwsNetwork,
    getAwsStatus
};