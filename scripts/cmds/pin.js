const axios = require('axios');

module.exports = {
  config: {
    name: "pin",
    aliases: [],
    version: "1.3",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Pinterest image search" },
    longDescription: { en: "Search Pinterest and return 4 random images using Alit API" },
    category: "image",
    guide: { en: "{pn} <search text>" }
  },

  onStart: async function ({ api, event, args }) {
    const query = args.join(" ");
    if (!query) return api.sendMessage("Search term dao, e.g. .pin cat", event.threadID, event.messageID);

    // ⏱️ react while loading
    api.setMessageReaction("⏱️", event.messageID, () => {}, true);

    try {
      const res = await axios.get(`https://alit-x-api.onrender.com/api/pin?query=${encodeURIComponent(query)}`);
      const { images } = res.data;

      if (!images || images.length === 0) {
        api.setMessageReaction("❌", event.messageID, () => {}, true);
        return api.sendMessage("Kono image pai nai. Onnno kichu try koro.", event.threadID, event.messageID);
      }

      // 4 ta random image
      const selected = images.sort(() => 0.5 - Math.random()).slice(0, 4);

      // Image URLs as streams
      const attachments = await Promise.all(
        selected.map(async (url) => {
          try {
            const img = await axios.get(url, { responseType: "stream" });
            return img.data;
          } catch (err) {
            console.error("Image load fail:", url);
            return null;
          }
        })
      );

      const validAttachments = attachments.filter(Boolean);

      if (validAttachments.length === 0) {
        api.setMessageReaction("❌", event.messageID, () => {}, true);
        return api.sendMessage("Image load korte problem hocche.", event.threadID, event.messageID);
      }

      // 💀 react on success
      api.setMessageReaction("💀", event.messageID, () => {}, true);

      return api.sendMessage({
        body: `Pinterest search "${query}"`,
        attachment: validAttachments
      }, event.threadID, event.messageID);

    } catch (err) {
      console.error("API error:", err.message);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      return api.sendMessage("API error. Try again later.", event.threadID, event.messageID);
    }
  }
};