const interval = 5 * 1000; // প্রতি ৫ মিনিটে

module.exports = {
  config: {
    name: "checkPending",
    type: "event",
    author: "OpenAI & Loufi",
    description: "Auto-check for pending/spam group invites and send welcome message",
    category: "events"
  },

  onStart: async function ({ api, globalData }) {
    setInterval(async () => {
      try {
        const spam = await api.getThreadList(100, null, ["OTHER"]) || [];
        const pending = await api.getThreadList(100, null, ["PENDING"]) || [];
        const list = [...spam, ...pending].filter(thread => thread.isGroup && thread.isSubscribed);

        for (const thread of list) {
          const threadID = thread.threadID;

          // Check if already sent
          const sentMap = globalData.get("sentPendingMsg") || {};
          if (sentMap[threadID]) continue;

          const welcomeMsg = `👋 Thank you for inviting me to your group: ${thread.name}\n\nMy prefix: !\nType !help to see command list.`;

          await api.sendMessage(welcomeMsg, threadID);

          // Mark as sent
          sentMap[threadID] = true;
          globalData.set("sentPendingMsg", sentMap);
        }
      } catch (err) {
        console.error("Failed to check pending/spam threads:", err);
      }
    }, interval);
  }
};