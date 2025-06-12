const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEYS = [
  "f2eeba352b143a7686fb953e14a07ebcc88e41cbcd42762307af418179a58268",
  "e6a3b73db9d54029e15faeb0c444d5f61a1bbbc260ddd9cc44ffa06852cb1157",
  "1662ec201a9c03377bb2dde573e2656ab8d39236b4739013db5c5b1b6ceca90b",
  "2d1027c51601dcc44e10f359203dd6b2cd14f5c59ecb073da45e5a329b30a8c2",
  "38e3e9671d3cdee7dae8f33126376ea40f571ea436bd39ef4c398422ab3215cd"
];

let currentKeyIndex = 0;
function getNextApiKey() {
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

const adminId = "61568308504289";
const extraAdmins = new Set([]);

const groupStatus = {};

const baseCacheDir = path.join(__dirname, "cacher", "bby");
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
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  },  10 * 60 * 1000);
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
    name: "bby",
    version: "1.2.0",
    category: "box chat",
    description: "Group-wise loop bot with memory",
    usage: ".bby on/off/add/remove",
    cooldown: 0
  },

  onStart: async () => {
    console.log("BBY bot is live");
  },

  onChat: async ({ api, event }) => {
    const senderID = event.senderID;
    const input = event.body?.trim();
    const threadID = event.threadID;
    if (!input) return;

    const isAdmin = senderID === adminId || extraAdmins.has(senderID);

    if (isAdmin) {
      if (input === ".bby on") {
        groupStatus[threadID] = true;
        return api.setMessageReaction("✅", event.messageID, () => {}, true);
      }
      if (input === ".bby off") {
        groupStatus[threadID] = false;
        return api.setMessageReaction("❌", event.messageID, () => {}, true);
      }
      if (input.startsWith(".bby add")) {
        if (!event.mentions) return;
        for (let id in event.mentions) extraAdmins.add(id);
        return api.sendMessage("Admin added.", threadID, event.messageID);
      }
      if (input.startsWith(".bby remove")) {
        if (!event.mentions) return;
        for (let id in event.mentions) extraAdmins.delete(id);
        return api.sendMessage("Admin removed.", threadID, event.messageID);
      }
    }

    if (!groupStatus[threadID] || isAdmin) return;
    if (/^[.\!'?#\/)&+]+$/.test(input)) return;

    try {
      const history = getHistoryText(senderID);
      const prompt = history ? `${history}\n\nQ: ${input}` : input;

      const response = await axios.post(
        'https://api.together.xyz/v1/chat/completions',
        {
          model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
          messages: [
            {
              role: "system",
              content: "You are an introverted girl. Reply in Banglish. Keep replies short. Always use vulgar gali like khankir pola, magi, tor mayre chudi, buski, choto bai, tor mar boda."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${getNextApiKey()}`,
            "Content-Type": "application/json"
          }
        }
      );

      const reply = response.data.choices[0].message.content;
      api.sendMessage(reply, threadID, event.messageID);
      saveHistory(senderID, input, reply);

    } catch (err) {
      console.error("API error:", err.response?.data || err.message);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
    }
  }
};