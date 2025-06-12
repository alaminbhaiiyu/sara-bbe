const fs = require("fs-extra");
const path = require("path");
const requestPath = path.join(process.cwd(), "request.json");
const adminThreadID = "24321422870862417"; // Admin group chat thread ID

module.exports = {
  config: {
    name: "request",
    version: "1.0",
    author: "ntgkh07",
    role: 0,
    shortDescription: "Request to unlock the bot",
    category: "system"
  },

  onStart: async function ({ message, event, threadsData, usersData, api }) {
    const { threadID, senderID } = event;
    let requestData = {};

    if (fs.existsSync(requestPath)) {
      requestData = await fs.readJson(requestPath);
    }

    if (!requestData[threadID]) {
      requestData[threadID] = {
        status: "locked",
        expiresAt: null
      };
      await fs.writeJson(requestPath, requestData, { spaces: 2 });
    }

    const threadInfo = await threadsData.get(threadID);
    const userInfo = await usersData.get(senderID);

    const requestMessageBody = `📥 Group Request\n\n🏷️ Name: ${threadInfo.threadName || "Unknown"}\n👤 User: ${userInfo.name} \n\n📝 Reply to this message with:\n- Number of days (e.g., 5) → Unlock for 5 days\n- "skip"/"leave" → Bot will leave the group\n- "infinity"/"unlimited" → Permanent unlock`;

    try {
      const sentMessageInfo = await api.sendMessage(
        { body: requestMessageBody },
        adminThreadID
      );

      global.GoatBot.onReply.set(sentMessageInfo.messageID, {
        commandName: "request",
        messageID: sentMessageInfo.messageID,
        threadID: threadID,
        type: "groupAccessRequest"
      });

      await message.reply(
        `📥 Group Request Sent\n\n🏷️ Name: ${threadInfo.threadName || "Unknown"}\n🆔 Thread ID: ${threadID}\n👤 User: ${userInfo.name} (UID: ${senderID})\n\n📝 Request sent to admin group.`
      );
    } catch (error) {
      console.error("Error sending request to admin thread:", error);
      await message.reply("❌ Failed to send request. Please try again later.");
    }
  },

  onReply: async function ({ Reply, event, message, api, threadsData }) {
    let requestData = {};
    if (fs.existsSync(requestPath)) {
      requestData = await fs.readJson(requestPath);
    }

    const requestedThreadID = Reply.threadID;
    const input = event.body.trim().toLowerCase();

    if (event.threadID !== adminThreadID) return;

    // Fetch thread info for messages
    let threadInfo = { threadName: "Unknown" };
    try {
      threadInfo = await threadsData.get(requestedThreadID);
    } catch (e) {}

    if (["skip", "leave", "out"].includes(input)) {
      await api.sendMessage(`🚪 Leaving group '${threadInfo.threadName}'...`, adminThreadID);
      try {
        await api.removeUserFromGroup(api.getCurrentUserID(), requestedThreadID);
        await message.reply(`✅ Bot has left group ${threadInfo.threadName}.`);
        delete requestData[requestedThreadID];
        await fs.writeJson(requestPath, requestData, { spaces: 2 });
      } catch (error) {
        console.error(`Error leaving group ${threadInfo.threadName}:`, error);
        await message.reply(`❌ Failed to leave group ${threadInfo.threadName}. Error: ${error.message}`);
      }
      return;
    }

    if (["infinity", "unlock", "unlimited"].includes(input)) {
      requestData[requestedThreadID] = {
        status: "unlocked",
        expiresAt: null
      };
      await fs.writeJson(requestPath, requestData, { spaces: 2 });
      await message.reply("🔓 Group permanently unlocked.");
      try {
        await api.sendMessage(
          `✅ Your group has been permanently unlocked by the admin.`,
          requestedThreadID
        );
      } catch (error) {
        console.error(`Error notifying group ${requestedThreadID}:`, error);
      }
      return;
    }

    const num = parseInt(input);
if (!isNaN(num) && num > 0) {
  const expiresAt = Date.now() + num * 24 * 60 * 60 * 1000;
  requestData[requestedThreadID] = {
    status: "unlocked",
    expiresAt
  };
  await fs.writeJson(requestPath, requestData, { spaces: 2 });

  // Format expiration date nicely
  const expirationDate = new Date(expiresAt).toLocaleString();

  // Reply to admin confirming unlock
  await message.reply(
    `🔓 𝗚𝗿𝗼𝘂𝗽 𝗨𝗻𝗹𝗼𝗰𝗸𝗲𝗱\n\n` +
    `• Duration: *${num} day(s)*\n` +
    `• Expiry: ${expirationDate}\n\n` +
    `✅ The group has been successfully unlocked for the specified period.`
  );

  // Notify the group about unlock
  try {
    await api.sendMessage(
      `✅ 𝗚𝗿𝗼𝘂𝗽 𝗨𝗻𝗹𝗼𝗰𝗸𝗲𝗱\n\n` +
      `🔓 Your group has been unlocked by the admin for ${num} day.\n` +
      `⏳ This access will expire on: ${expirationDate}\n\n` +
      `🙏 Please use this time responsibly.`,
      requestedThreadID
    );
  } catch (error) {
    console.error(`Error notifying group ${requestedThreadID}:`, error);
  }
  return;
}


    await message.reply("❌ Invalid input. Please reply with a number of days, 'skip', or 'infinity'.");
  }
};
