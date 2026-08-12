const si = require("systeminformation");

async function getServerStatus() {
    const [cpu, memory, disk, uptime] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.time(),
    ]);

    const cpuUsage = cpu.currentLoad;

    const ramUsed = memory.used / 1024 ** 3;
    const ramTotal = memory.total / 1024 ** 3;
    const ramPercent = (memory.used / memory.total) * 100;

    const rootDisk = disk.find((item) => item.mount === "/");

    const diskPercent = rootDisk
        ? rootDisk.use
        : 0;

    const uptimeSeconds = uptime.uptime;

    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    return {
        cpu: cpuUsage,
        ramUsed,
        ramTotal,
        ramPercent,
        diskPercent,
        uptime: `${days} hari, ${hours} jam, ${minutes} menit`,
    };
}

module.exports = {
    getServerStatus,
};
