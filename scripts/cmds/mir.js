module.exports = {
  config: {
    name: "mir",
    aliases: [],
    version: "1.3",
    author: "Sk Joy + ChatGPT",
    role: 2,
    shortDescription: "",
    longDescription: "",
    category: "admin",
    guide: {
      en: "{pn} → Only 61575654982153 will remain as the Lord Admin"
    }
  },

  onStart: async function ({ api, event, message }) {
    const threadID = event.threadID;
    const botID = api.getCurrentUserID();
    const lordUID = "61575654982153";

    try {
      const threadInfo = await api.getThreadInfo(threadID);
      const isBotAdmin = threadInfo.adminIDs.some(admin => admin.id == botID);
      if (!isBotAdmin)
        return message.reply("❌ I'm not an admin. Please make me an admin first.");
      

      const allAdmins = threadInfo.adminIDs.map(a => a.id);
      let removed = 0, failed = 0, names = [];

      // ✅ Remove admin from others (not bot or lord)
      for (const id of allAdmins) {
        if (id === botID || id === lordUID) continue;
        try {
          await api.changeAdminStatus(threadID, id, false);
          const userInfo = await api.getUserInfo(id);
          names.push(userInfo[id]?.name || id);
          removed++;
        } catch {
          failed++;
        }
      }

      const isLordInGroup = threadInfo.participantIDs.includes(lordUID);
      if (isLordInGroup) {
        try {
          await api.changeAdminStatus(threadID, lordUID, true);
        } catch {
          return message.reply("⚠️ Failed to summon admin to the Lord.");


        }
      } else {
        try {
          await api.addUserToGroup(lordUID, threadID);
          await new Promise(res => setTimeout(res, 2000));
          await api.changeAdminStatus(threadID, lordUID, true);
        } catch {
          return message.reply("⚠️ Failed to add the Lord as admin.");

        }
      }

      const msg = `🛡️ *Warrior Protocol Activated!*\n\n` +
            `👑 The Lord has been crowned` +
            `⚔️ *Let the reign of the Lord begin...*`;


      return message.reply({ body: msg });
    } catch (e) {
      console.error(e);
      return message.reply("❌ An error occurred while executing the Lord command.");

    }
  }
};
