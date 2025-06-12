const axios = require("axios");
const fs = require("fs");
const path = require("path");

const lastApiMessageId = {}; // থ্রেড অনুযায়ী শেষ Gemini মেসেজের ID

const baseCacheDir = path.join(__dirname, "cacher", "ai","gpt");

const defaultPrompts = ["hi", "hello", "hola"];

function ensureCacheDir() {
  if (!fs.existsSync(baseCacheDir)) {
    fs.mkdirSync(baseCacheDir, { recursive: true });
  }
}

function getUserHistoryFile(uid) {
  ensureCacheDir();
  return path.join(baseCacheDir, `${uid}.json`);
}

function saveHistory(uid, question, answer) {
  const filePath = getUserHistoryFile(uid);
  let data = [];
  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {}
  }

  data.push({ question, answer, time: Date.now() });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }, 6 * 60 * 60 * 1000); // 6 ঘণ্টার মধ্যে ডিলিট
}

function getHistoryText(uid) {
  const filePath = getUserHistoryFile(uid);
  if (!fs.existsSync(filePath)) return "";
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return data.map(item => `Q: ${item.question}\nA: ${item.answer}`).join("\n\n");
  } catch {
    return "";
  }
}

module.exports = {
  config: {
    name: "chatgpt",
    aliases: ["gpt"],
    version: "3.7",
    author: "Alamin + GPT",
    countDown: 2,
    role: 0,
    shortDescription: {
      en: "Gemini AI chat"
    },
    longDescription: {
      en: "Anyone can reply to the last Gemini message to continue"
    },
    category: "ai",
    guide: {
      en: ".mini <question>\nReply to the last Gemini message (anyone)"
    }
  },

  onStart: async function ({ message, event, args }) {
    const { threadID, senderID } = event;
    let text = args.join(" ").trim();

    // যদি ইউজার কিছু না দেয়, তাহলে random ডিফল্ট মেসেজ দিবে
    if (!text) {
      const randIndex = Math.floor(Math.random() * defaultPrompts.length);
      text = defaultPrompts[randIndex];
    }

    try {
      const historyText = getHistoryText(senderID);
      const prompt = historyText ? `${historyText}\n\nQ: ${text}` : text;

      const res = await axios.get(`https://alit-x-api.onrender.com/api/gpt-4-1-nano?text=${encodeURIComponent(prompt)}`);
      let replyText = res.data.text || "No response.";
      replyText = replyText.replace(/^A:\s*/i, "");

      const sent = await message.reply(replyText);
      saveHistory(senderID, text, replyText);

      lastApiMessageId[threadID] = sent.messageID;
    } catch (err) {
      console.error(err);
      return message.reply("Gemini API error.");
    }
  },

  onChat: async function ({ message, event }) {
    const { threadID, messageReply, body, senderID } = event;
    if (!messageReply) return;

    // শুধু তখনই উত্তর দিবে যখন রিপ্লাই করা মেসেজটা শেষ Gemini মেসেজ হয়
    if (messageReply.messageID !== lastApiMessageId[threadID]) return;

    try {
      const historyText = getHistoryText(senderID);
      const prompt = historyText ? `${historyText}\n\nQ: ${body}` : body;

      const res = await axios.get(`https://alit-x-api.onrender.com/api/gpt-4-1-nano?text=${encodeURIComponent(prompt)}`);
      let replyText = res.data.text || "No response.";
      replyText = replyText.replace(/^A:\s*/i, "");

      const sent = await message.reply(replyText);
      saveHistory(senderID, body, replyText);

      lastApiMessageId[threadID] = sent.messageID;
    } catch (err) {
      console.error(err);
      message.reply("Gemini API error (reply).");
    }
  }
};