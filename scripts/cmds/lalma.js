const axios = require("axios");

const activeUsers = {};

module.exports = {
  config: {
    name: "lalma",
    aliases: ["llm"],
    version: "3.0",
    author: "Alamin",
    countDown: 2,
    role: 0,
    shortDescription: {
      en: "Smart Lalma AI chat via reply only"
    },
    longDescription: {
      en: "Start with .lalma <question>, then only reply to that bot message to continue"
    },
    category: "ai",
    guide: {
      en: ".lalma <msg> → Start\nReply to bot's msg only to continue.\nOther replies/messages = No response"
    }
  },

  onStart: async function ({ message, event, args }) {
    const { senderID } = event;
    const text = args.join(" ");
    if (!text) return message.reply("Please provide a question for Lalma.");

    try {
      const res = await axios.get(`https://api-new-dxgd.onrender.com/lalma3?text=${encodeURIComponent(text)}`);
      const replyText = res.data.text || "No response.";
      const sent = await message.reply(replyText);

      // Save only this specific bot reply ID to allow future replies
      activeUsers[senderID] = sent.messageID;
    } catch (err) {
      console.error(err);
      return message.reply("Error reaching Lalma.");
    }
  },

  onChat: async function ({ message, event }) {
    const { senderID, messageReply, body } = event;

    // User must be in active session
    if (!activeUsers[senderID]) return;

    // User must reply to bot's last Lalma message
    if (!messageReply || messageReply.messageID !== activeUsers[senderID]) {
      delete activeUsers[senderID]; // auto-end chat
      return;
    }

    try {
      const res = await axios.get(`https://api-new-dxgd.onrender.com/lalma3?text=${encodeURIComponent(body)}`);
      const replyText = res.data.text || "No response.";
      const sent = await message.reply(replyText);

      // Update the message ID to only allow replying to the new one
      activeUsers[senderID] = sent.messageID;
    } catch (err) {
      console.error(err);
      message.reply("Failed to get response.");
    }
  }
};