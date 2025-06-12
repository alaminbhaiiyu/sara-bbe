const axios = require("axios");
const fs = require("fs-extra");
const { shortenURL } = global.utils;

const nusu = "https://rasin-x-apis-main.onrender.com/api/rasin/autodl?url=";

module.exports = {
  config: {
    name: "autodl",
    version: "1.0.3",
    author: "Rasin",
    countDown: 0,
    role: 0,
    description: {
      en: "empty ()",
    },
    category: "downloader",
    guide: {
      en: "video link",
    },
  },

  onStart: async function () {},

  onChat: async function ({ api, event }) {
    let rasin = event.body ? event.body.trim() : "";

    try {
      if (
        rasin.startsWith("https://vt.tiktok.com") ||
        rasin.startsWith("https://www.tiktok.com/") ||
        rasin.startsWith("https://www.facebook.com") ||
        rasin.startsWith("https://www.instagram.com/") ||
        rasin.startsWith("https://youtu.be/") ||
        rasin.startsWith("https://youtube.com/") ||
        rasin.startsWith("https://twitter.com/") ||
        rasin.startsWith("https://vm.tiktok.com") ||
        rasin.startsWith("https://fb.watch")
      ) {
        api.setMessageReaction("🌚", event.messageID, (err) => {}, true);

        const path = __dirname + "/cache/video.mp4";
        
        const videoStream = await axios({
          url: `${nusu}${encodeURIComponent(rasin)}`,
          method: "GET",
          responseType: "stream",
        });
        
        const writer = fs.createWriteStream(path);
        videoStream.data.pipe(writer);
        
        writer.on("finish", async () => {
          api.sendMessage(
            {
              body: "🌟 𝐇𝐞𝐫𝐞'𝐬 𝐲𝐨𝐮𝐫 𝐯𝐢𝐝𝐞𝐨",
              attachment: fs.createReadStream(path),
            },
            event.threadID,
            () => fs.unlinkSync(path),
            event.messageID
          );
        });
      }
    } catch (e) {
      api.setMessageReaction("❎", event.messageID, (err) => {}, true);
      api.sendMessage(`Error: ${e.message}`, event.threadID, event.messageID);
    }
  },
};