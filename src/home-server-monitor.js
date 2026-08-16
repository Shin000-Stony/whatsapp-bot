const axios = require("axios");

const HOME_SERVER_URL = (
    process.env.HOME_SERVER_URL || ""
).replace(/\/$/, "");

if (!HOME_SERVER_URL) {
    console.warn(
        "[HOME MONITOR] HOME_SERVER_URL belum dikonfigurasi"
    );
}


/**
 * Mengambil status lengkap Home Server
 */
async function getHomeServerStatus() {
    if (!HOME_SERVER_URL) {
        throw new Error(
            "HOME_SERVER_URL belum dikonfigurasi"
        );
    }

    try {
        const response = await axios.get(
            `${HOME_SERVER_URL}/status`,
            {
                timeout: 15000,
            }
        );

        return response.data;

    } catch (error) {

        console.error(
            "[HOME MONITOR] Failed to get status:",
            error.response?.data ||
            error.message
        );

        throw new Error(
            "Home Server tidak dapat dihubungi"
        );
    }
}


/**
 * Mengecek apakah Home Server online
 */
async function getHomeServerHealth() {
    if (!HOME_SERVER_URL) {
        throw new Error(
            "HOME_SERVER_URL belum dikonfigurasi"
        );
    }

    try {

        const response = await axios.get(
            `${HOME_SERVER_URL}/health`,
            {
                timeout: 10000,
            }
        );

        return response.data;

    } catch (error) {

        console.error(
            "[HOME MONITOR] Health check failed:",
            error.message
        );

        throw new Error(
            "Home Server offline"
        );
    }
}


module.exports = {
    getHomeServerStatus,
    getHomeServerHealth,
};
