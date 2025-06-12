const fs = require("fs");
const path = require("path");
const axios = require("axios");
const config = require("../../config.json");

module.exports = {
  config: {
    name: "mockey",
    aliases: ["mk"],
    version: "1.0",
    author: "Ove x ChatGPT",
    countDown: 5,
    role: 2,
    shortDescription: "Upload local file to Mocky",
    longDescription: "Find and upload a local file using fuzzy match to Mocky.io",
    category: "owner",
    guide: "{pn} <filename>"
  },

  onStart: async function ({ args, message, event }) {
    const permission = config.adminBot;
    if (!permission.includes(event.senderID)) {
      return message.reply("❌ | You are not authorized to use this command.");
    }

    if (!args[0]) return message.reply("⚠️ | Please provide the filename (e.g., `mockey file.js`)");

    const fileQuery = args[0].toLowerCase();
    const searchDir = path.join(__dirname, "..", "cmds");

    let allFiles = fs.readdirSync(searchDir).filter(file => file.endsWith(".js") || file.endsWith(".json"));
    let matched = allFiles.find(file => file.toLowerCase().includes(fileQuery));

    if (!matched) {
      return message.reply("❌ | No matching file found.");
    }

    const fullPath = path.join(searchDir, matched);
    let fileContent = fs.readFileSync(fullPath, "utf8");

    try {
      const link = await uploadToMocky(fileContent);
      message.reply(`✅ | File "${matched}" uploaded:\n🔗 ${link}`);
    } catch (err) {
      console.error(err);
      message.reply("❌ | Failed to upload to Mocky: " + err.message);
    }
  }
};

async function uploadToMocky(content) {
  const res = await axios.post('https://api.mocky.io/api/mock', {
    status: 200,
    content,
    content_type: "text/plain",
    charset: "UTF-8",
    secret: "LeMinhTien",
    expiration: "never"
  });
  return res.data.link;
}