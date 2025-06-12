const fs = require('fs').promises;
const os = require('os');
const moment = require('moment-timezone');
const nodeDiskInfo = require('node-disk-info');

module.exports = {
    config: {
        name: "system",
        version: "0.0.3",
        author: "LocDev",
        countDown: 5,
        role: 0,
        description: {
            en: "Show system uptime and information.",
            vi: ""
        },
        category: "system",
        guide: {
            en: "",
            vi: ""
        }
    },

    langs: {
        en: {},
        vi: {}
    },

    onStart: async function ({ api, event }) {
        const startTime = Date.now();

        // Package dependency সংখ্যা গণনা করে
        async function getDependencyCount() {
            try {
                const packageJson = await fs.readFile('package.json', 'utf8');
                return Object.keys(JSON.parse(packageJson).dependencies).length;
            } catch (err) {
                console.error('❎ Error reading package.json:', err);
                return -1;
            }
        }

        // পিং অনুযায়ী স্ট্যাটাস রিটার্ন করে
        function getStatusByPing(ping) {
            if (ping < 200) return '⚡ Smooth';
            if (ping < 800) return '⚠️ Average';
            return '🐢 Slow';
        }

        // মূল IP অ্যাড্রেস বের করে
        function getPrimaryIP() {
            const interfaces = os.networkInterfaces();
            for (const iface of Object.values(interfaces)) {
                for (const alias of iface) {
                    if (alias.family === 'IPv4' && !alias.internal) {
                        return alias.address;
                    }
                }
            }
            return '127.0.0.1';
        }

        // আপটাইমকে hh:mm:ss ফরম্যাটে কনভার্ট করে
        function formatUptime(uptime) {
            const h = Math.floor(uptime / 3600);
            const m = Math.floor((uptime % 3600) / 60);
            const s = Math.floor(uptime % 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }

        // বাইটকে গিগাবাইটে রূপান্তর করে
        function convertToGB(bytes) {
            if (!bytes) return 'N/A';
            return (bytes / (1024 ** 3)).toFixed(2) + 'GB';
        }

        try {
            // সিস্টেম ইনফো কালেক্ট করে
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const uptime = formatUptime(process.uptime());
            const dependencyCount = await getDependencyCount();
            const ping = Date.now() - startTime;
            const status = getStatusByPing(ping);
            const ip = getPrimaryIP();
            const disks = await nodeDiskInfo.getDiskInfo();
            const disk = disks[0] || {};

            const userInfo = await api.getUserInfo(event.senderID);
            const userName = userInfo[event.senderID]?.name || "Unknown User";

            // ফাইনাল মেসেজ
            const msg = `
━━━━━━━━━━━━━━━━━━━
𝗦𝗬𝗦𝗧𝗘𝗠 𝗜𝗡𝗙𝗢
━━━━━━━━━━━━━━━━━━━

⏰ 𝗧𝗶𝗺𝗲: ${moment().tz('Asia/Ho_Chi_Minh').format('HH:mm:ss')} | ${moment().tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY')}
⏱️ 𝗨𝗽𝘁𝗶𝗺𝗲: ${uptime}
🔌 𝗦𝘁𝗮𝘁𝘂𝘀: ${status}
⚙️ 𝗢𝗦: ${os.type()} ${os.release()} (${os.arch()})
🧠 𝗖𝗣𝗨: ${os.cpus().length} Core(s)
         ${os.cpus()[0].model} @ ${Math.round(os.cpus()[0].speed)} MHz

📦 𝗣𝗮𝗰𝗸𝗮𝗴𝗲𝘀: ${dependencyCount >= 0 ? dependencyCount : 'Unknown'}
📊 𝗥𝗔𝗠: ${(usedMemory / (1024 ** 3)).toFixed(2)}GB / ${(totalMemory / (1024 ** 3)).toFixed(2)}GB (used)
🛢️ 𝗙𝗿𝗲𝗲 𝗥𝗔𝗠: ${(freeMemory / (1024 ** 3)).toFixed(2)}GB

💾 𝗦𝘁𝗼𝗿𝗮𝗴𝗲 𝗨𝘀𝗲𝗱: ${convertToGB(disk.used)} / ${convertToGB(disk.blocks)}
📂 𝗙𝗿𝗲𝗲 𝗦𝘁𝗼𝗿𝗮𝗴𝗲: ${convertToGB(disk.available)}

📡 𝗣𝗶𝗻𝗴: ${ping}ms
👤 𝗥𝗲𝗾𝘂𝗲𝘀𝘁𝗲𝗱 𝗯𝘆: ${userName}

━━━━━━━━━━━━━━━━━━━
✨ 𝗦𝘁𝗮𝘆 𝗦𝗺𝗼𝗼𝘁𝗵, 𝗦𝘁𝗮𝘆 𝗢𝗻𝗹𝗶𝗻𝗲!
━━━━━━━━━━━━━━━━━━━
            `.trim();

            await api.sendMessage(msg, event.threadID, event.messageID);
        } catch (err) {
            console.error('❎ Error occurred:', err.message);
            api.sendMessage(`❎ An error occurred: ${err.message}`, event.threadID, event.messageID);
        }
    }
};