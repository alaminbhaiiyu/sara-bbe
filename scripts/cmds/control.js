const fs = require("fs-extra");
const path = require("path");

const requestPath = path.join(process.cwd(), "request.json");
const configPath = path.join(process.cwd(), "config.json");

module.exports = {
  config: {
    name: "control",
    version: "1.0",
    author: "AlaminX",
    role: 2,
    shortDescription: "Group access control panel",
    category: "system",
  },

  onStart: async function ({ message, event, api, threadsData }) {
    const { senderID, threadID } = event;
    const config = await fs.readJson(configPath);
    const isAdmin = config.adminBot.includes(senderID);

    if (!isAdmin) return message.reply("❌ You are not allowed to use this command.");

    const requestData = fs.existsSync(requestPath) ? await fs.readJson(requestPath) : {};
    const threadIDs = Object.keys(requestData);
    const totalPages = Math.ceil(threadIDs.length / 15);
    const page = 1;

    const makePageMessage = async (page) => {
      const start = (page - 1) * 15;
      const list = threadIDs.slice(start, start + 15);
      let msg = `📋 Group Access List (Page ${page}/${totalPages})\n\n`;

      for (let i = 0; i < list.length; i++) {
        const id = list[i];
        const info = requestData[id];
        const threadInfo = await threadsData.get(id) || {};
        const name = threadInfo.threadName || "Unknown";
        const status = info.status === "unlocked" ? "🔓 Unlocked" : "🔒 Locked";
        const expires = info.expiresAt ? new Date(info.expiresAt).toLocaleString() : "∞";

        msg += `${start + i + 1}. ${name}\n🆔 ${id}\n📌 Status: ${status}\n⏳ Expires: ${expires}\n\n`;
      }

      msg += `🔁 Reply:\n- Number to see group control\n- "next" / "prev" to switch pages`;
      return msg;
    };

    const msg = await makePageMessage(page);
    const sent = await message.reply(msg);

    global.GoatBot.onReply.set(sent.messageID, {
      commandName: "control",
      messageID: sent.messageID,
      type: "list",
      page,
      threadIDs,
      senderID
    });
  },

  onReply: async function ({ Reply, event, message, api, threadsData }) {
    const input = event.body.trim().toLowerCase();
    const requestData = fs.existsSync(requestPath) ? await fs.readJson(requestPath) : {};
    const config = await fs.readJson(configPath);
    const isAdmin = config.adminBot.includes(event.senderID);

    if (!isAdmin) return;

    if (Reply.type === "list") {
      if (input === "next" || input === "prev") {
        let newPage = input === "next" ? Reply.page + 1 : Reply.page - 1;
        const totalPages = Math.ceil(Reply.threadIDs.length / 15);

        if (newPage < 1) newPage = 1;
        if (newPage > totalPages) newPage = totalPages;

        const start = (newPage - 1) * 15;
        const list = Reply.threadIDs.slice(start, start + 15);
        let msg = `📋 Group Access List (Page ${newPage}/${totalPages})\n\n`;

        for (let i = 0; i < list.length; i++) {
          const id = list[i];
          const info = requestData[id];
          const threadInfo = await threadsData.get(id) || {};
          const name = threadInfo.threadName || "Unknown";
          const status = info.status === "unlocked" ? "🔓 Unlocked" : "🔒 Locked";
          const expires = info.expiresAt ? new Date(info.expiresAt).toLocaleString() : "∞";

          msg += `${start + i + 1}. ${name}\n🆔 ${id}\n📌 Status: ${status}\n⏳ Expires: ${expires}\n\n`;
        }

        msg += `🔁 Reply:\n- Number to see group control\n- "next" / "prev" to switch pages`;

        const sent = await message.reply(msg);
        global.GoatBot.onReply.set(sent.messageID, {
          ...Reply,
          messageID: sent.messageID,
          page: newPage
        });
        return;
      }

      const number = parseInt(input);
      const index = (Reply.page - 1) * 15 + number - 1;
      const groupID = Reply.threadIDs[index];

      if (!groupID) return message.reply("❌ Invalid group number.");
      const info = requestData[groupID];
      const threadInfo = await threadsData.get(groupID) || {};
      const name = threadInfo.threadName || "Unknown";
      const status = info.status === "unlocked" ? "🔓 Unlocked" : "🔒 Locked";
      const expires = info.expiresAt ? new Date(info.expiresAt).toLocaleString() : "∞";

      const controlMsg = `📌 Group Control Panel\n\n🏷️ Name: ${name}\n🆔 ID: ${groupID}\n📎 Status: ${status}\n📆 Expiry: ${expires}\n\nReply with:\n- Number of days (e.g., 5)\n- "unlock", "lock"\n- "infinity" for permanent\n- "out" to remove bot`;

      const sent = await message.reply(controlMsg);
      global.GoatBot.onReply.set(sent.messageID, {
        commandName: "control",
        type: "control",
        groupID,
        messageID: sent.messageID
      });
    }

    if (Reply.type === "control") {
      const groupID = Reply.groupID;
      const input = event.body.trim().toLowerCase();

      if (!requestData[groupID]) {
        requestData[groupID] = { status: "locked", expiresAt: null };
      }

      if (input === "out") {
        await message.reply(`🚪 Leaving group...`);
        await api.removeUserFromGroup(api.getCurrentUserID(), groupID);
        delete requestData[groupID];
        await fs.writeJson(requestPath, requestData, { spaces: 2 });
        return;
      }

      if (["unlock", "infinity", "unlimited"].includes(input)) {
        requestData[groupID] = {
          status: "unlocked",
          expiresAt: null
        };
        await fs.writeJson(requestPath, requestData, { spaces: 2 });
        await message.reply("🔓 Group permanently unlocked.");
        return;
      }

      if (input === "lock") {
        requestData[groupID] = {
          status: "locked",
          expiresAt: null
        };
        await fs.writeJson(requestPath, requestData, { spaces: 2 });
        await message.reply("🔒 Group locked.");
        return;
      }

      const days = parseInt(input);
      if (!isNaN(days) && days > 0) {
        const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
        requestData[groupID] = {
          status: "unlocked",
          expiresAt
        };
        await fs.writeJson(requestPath, requestData, { spaces: 2 });

        const expDate = new Date(expiresAt).toLocaleString();
        await message.reply(`🔓 Group unlocked for ${days} day(s).\n⏳ Expires at: ${expDate}`);
        return;
      }

      await message.reply("❌ Invalid input. Try number of days, 'unlock', 'lock', or 'out'.");
    }
  }
};
