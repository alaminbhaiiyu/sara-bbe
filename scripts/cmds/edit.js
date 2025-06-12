const axios = require("axios");

module.exports = {
  config: {
    name: "edit",
    aliases: [],
    version: "1.1",
    author: "Alamin",
    countDown: 2,
    role: 0,
    shortDescription: {
      en: "Edit image with prompt (reply only)"
    },
    longDescription: {
      en: "Reply to an image and provide a prompt to edit it using AI."
    },
    category: "image",
    guide: {
      en: "{p}edit <prompt> → Reply to an image and give instruction to edit it."
    }
  },

  onStart: async function ({ message, event, args, api }) {
    const prompt = args.join(" ");
    if (!prompt) return message.reply("Please provide a prompt for image editing.");
    if (!event.messageReply || !event.messageReply.attachments || event.messageReply.attachments.length === 0)
      return message.reply("Please reply to an image.");

    const attachment = event.messageReply.attachments[0];
    if (attachment.type !== "photo") return message.reply("Please reply to a photo only.");

    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      const imgUrl = encodeURIComponent(attachment.url);
      const encodedPrompt = encodeURIComponent(prompt);
      const apiUrl = `https://alit-x-api.onrender.com/api/edit?prompt=${encodedPrompt}&url=${imgUrl}`;

      const res = await axios.get(apiUrl);
      
      if (!res.data || !res.data.imageUrl) {
        return message.reply("No image returned from API.");
      }

      const editedImageUrl = res.data.imageUrl;

      await message.reply({
        body: "✨ | Edited image ready!",
        attachment: await global.utils.getStreamFromURL(editedImageUrl)
      });

      api.setMessageReaction("✅", event.messageID, () => {}, true);

    } catch (err) {
      console.error("Edit command error:", err.message);
      message.reply("Image edit failed. Please try again later.");
      api.setMessageReaction("❌", event.messageID, () => {}, true);
    }
  }
};