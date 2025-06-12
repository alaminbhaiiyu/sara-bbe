const os = require("os");
const process = require("process");

function getCPUUsage() {
  try {
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce((acc, cpu) =>
      acc + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0);

    const avgIdle = totalIdle / cpuCount;
    const avgTotal = totalTick / cpuCount;
    return (100 - (avgIdle / avgTotal * 100)).toFixed(1);
  } catch {
    return "N/A";
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = {
  config: {
    name: "upba",
    aliases: ["up", "sys"],
    author: "OpenAI x You",
    countDown: 0,
    role: 0,
    category: "system",
    longDescription: { en: "Animated system info with dynamic values" },
    guide: { en: "{pn}" },
  },

  count_req: 0,

  async onStart({ api, event, threadsData, usersData }) {
    try {
      const uptimeInSeconds = process.uptime();
      const days = Math.floor(uptimeInSeconds / (3600 * 24));
      const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
      const seconds = Math.floor(uptimeInSeconds % 60);
      const uptimeFormatted = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);
      const cpuUsage = getCPUUsage();

      const allUsers = await usersData.getAll() || [];
      const allThreads = await threadsData.getAll() || [];
      const userCount = allUsers.length;
      const threadCount = allThreads.length;

      const ping = Date.now() - event.timestamp;
      const pingStatus = ping < 100 ? "🟢" : ping < 300 ? "🟡" : "🔴";

      const currentDate = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      const lines = [
        `╭──── SYSTEM INFO ────╮\n 💻 System Stats\n  ❯ CPU: ${cpuUsage}% Usage\n  ❯ RAM: ${memoryUsagePercent}% Used\n  ❯ Total: ${formatBytes(totalMem)}\n  ❯ Used: ${formatBytes(usedMem)}\n  ❯ Free: ${formatBytes(freeMem)}`,
        `⚙️ Bot Info\n  ❯ Prefix: .\n  ❯ Uptime: ${uptimeFormatted}\n  ❯ Platform: ${os.platform()}\n  ❯ NodeJS: ${process.version}`,
        `📊 Usage Stats\n  ❯ Users: ${userCount}\n  ❯ Threads: ${threadCount}\n  ❯ Ping: ${ping}ms ${pingStatus}`,
        `🕒 Current Time\n  ❯ ${currentDate}\n  ❯ Craft By Alit<3`
        
      ];

      // Step 1: Send initial line
      const { messageID, threadID } = await api.sendMessage(lines[0], event.threadID);

      // Step 2: Append each line one by one every 1s
      for (let i = 1; i < lines.length; i++) {
        await new Promise(res => setTimeout(res, 1000));
        const fullText = lines.slice(0, i + 1).join("\n");
        editMessage(this, messageID, fullText);
      }

    } catch (error) {
      console.error("System info error:", error);
      api.sendMessage("❌ Error while fetching system info:\n" + error.message, event.threadID);
    }
  }
};

// MQTT edit message
function editMessage(ctx, messageID, text) {
  mqttClient?.publish('/ls_req', JSON.stringify({
    app_id: "2220391788200892",
    payload: JSON.stringify({
      tasks: [{
        label: '742',
        payload: JSON.stringify({ message_id: messageID, text }),
        queue_name: 'edit_message',
        task_id: Math.floor(Math.random() * 100000),
        failure_count: null
      }],
      epoch_id: generateOfflineThreadingID(),
      version_id: '6903494529735864',
    }),
    request_id: ++ctx.count_req,
    type: 3
  }));
}

function generateOfflineThreadingID() {
  const ret = Date.now();
  const value = Math.floor(Math.random() * 4294967295);
  const str = ("0000000000000000000000" + value.toString(2)).slice(-22);
  const msgs = ret.toString(2) + str;
  return binaryToDecimal(msgs);
}

function binaryToDecimal(data) {
  let ret = "";
  while (data !== "0") {
    let end = 0;
    let fullName = "";
    for (let i = 0; i < data.length; i++) {
      end = 2 * end + parseInt(data[i], 10);
      if (end >= 10) {
        fullName += "1";
        end -= 10;
      } else {
        fullName += "0";
      }
    }
    ret = end.toString() + ret;
    data = fullName.slice(fullName.indexOf("1"));
  }
  return ret;
}
