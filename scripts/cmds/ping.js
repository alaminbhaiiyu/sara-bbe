const os = require("os");

module.exports = {
  config: {
    name: "ping",
    aliases: ["pong","ping"],
    author: "Alamin",
    countDown: 0,
    role: 0,
    category: "system",
    longDescription: {
      en: "Check Bot's Response Time",
    },
  },

  onStart: async function ({ api, event }) {
    try {
      const timeStart = Date.now();

      await api.sendMessage({
        body: "🏓 Checking ping...",
      }, event.threadID);

      const ping = Date.now() - timeStart;
      let pingStatus = "🔴 Poor";
      let emoji = "😓";

      if (ping < 200) {
        pingStatus = "🟢 Excellent";
        emoji = "🚀";
      } else if (ping < 500) {
        pingStatus = "🟡 Good";
        emoji = "👍";
      }

      const pingInfo = `
🌐 BOT PING STATUS
━━━━━━━━━━━━━━
🏓 Latency: ${ping}ms
📊 Status: ${pingStatus}
${emoji} Response Time
━━━━━━━━━━━━━━
🔧 Crafted by Alamin
`;

      api.sendMessage(
        {
          body: pingInfo,
        },
        event.threadID,
        (err, messageInfo) => {
          if (err) {
            console.error("Error sending ping message:", err);
          } else {
            console.log("Ping message sent successfully:", messageInfo);
          }
        }
      );
    } catch (error) {
      console.error("Error checking ping:", error);
      api.sendMessage(
        "Unable to check ping.",
        event.threadID,
        event.messageID
      );
    }
  },
};