const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "say",
    version: "1.0",
    author: "Alamin",
    countDown: 0,
    role: 0,
    shortDescription: "Text to voice using Google Translate",
    longDescription: "Convert text to Google Translate style voice and send as audio.",
    category: "fun",
    guide: "{pn} hello world"
  },

  onStart: async function ({ message, args, api, event }) {
    const text = args.join(" ");
    if (!text) return message.reply("দয়া করে কিছু লেখো: `{pn} তোমার লেখা`");

    const apiUrl = `https://api-new-dxgd.onrender.com/say?text=${encodeURIComponent(text)}`;
    const filePath = path.join(__dirname, "cache", `say-${event.senderID}.mp3`);

    try {
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(filePath, response.data);
      await message.reply({ body: "তোমার ভয়েস রেডি!", attachment: fs.createReadStream(filePath) });
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Error:", error.message);
      message.reply("ভয়েস তৈরি করতে সমস্যা হয়েছে। একটু পরে চেষ্টা করো।");
    }
  }
};