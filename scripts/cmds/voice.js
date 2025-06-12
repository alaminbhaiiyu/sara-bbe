const { MongoClient } = require("mongodb");
const Fuse = require("fuse.js");

module.exports = {
  config: {
    name: "voice",
    version: "1.0",
    author: "Alamin + ChatGPT",
    role: 0,
    shortDescription: "Manage and play saved voices",
    category: "media",
    guide: `
{prefix}voice add <name> - Reply to voice message to save
{prefix}voice remove - Reply to bot voice message to remove
{prefix}voice list - List all saved voices
{prefix}voice <name> - Play voice by name (fuzzy search)
Typing exact voice name triggers auto playback`
  },

  _init: false,
  _dbClient: null,
  _voiceCollection: null,

  async _connectDb() {
    if (!this._init) {
      this._dbClient = new MongoClient(
        "mongodb+srv://ikalaminss:uchR2FJzOGBS1flG@cluster0.lugxuhr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
      );
      await this._dbClient.connect();
      this._voiceCollection = this._dbClient.db("file").collection("voice");
      this._init = true;
    }
  },

  async onStart({ event, message, api, args, isAuto }) {
    const { senderID, messageReply, messageID, body } = event;
    const prefix = ".";

    // Connect to DB once
    try {
      await this._connectDb();
    } catch (e) {
      return await message.reply("❌ Database connection failed.");
    }

    const voiceCollection = this._voiceCollection;
    if (!voiceCollection) return await message.reply("❌ Database not ready.");

    function formatBytes(bytes, decimals = 2) {
      if (bytes === 0) return "0 Bytes";
      const k = 1024,
        dm = decimals < 0 ? 0 : decimals,
        sizes = ["Bytes", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    async function sendVoice(voiceDoc) {
      try {
        await message.send({
          body: `🎙 Voice: ${voiceDoc.name} (${voiceDoc.duration}s, ${formatBytes(voiceDoc.size)})`,
          attachment: await global.utils.getStreamFromURL(voiceDoc.url)
        });
        await api.setMessageReaction("✅", messageID, () => {}, true);
      } catch (e) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        await message.reply("⚠️ Failed to send voice.");
      }
    }

    // Load all voices
    let allVoices;
    try {
      allVoices = await voiceCollection.find().toArray();
    } catch (e) {
      await api.setMessageReaction("❌", messageID, () => {}, true);
      return message.reply("❌ Failed to load voices.");
    }

    const lowerArgs = args.map(a => a.toLowerCase());
    const cmd = lowerArgs[0]?.replace(prefix, "") || "";

    // Helper: react ⏳ on start
    await api.setMessageReaction("⏳", messageID, () => {}, true);

    // Handle .voice add <name>
    if (cmd === "voice" && lowerArgs[1] === "add") {
      if (!messageReply || !messageReply.attachments || messageReply.attachments.length === 0) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("❗ Please reply to a voice/audio message to add.");
      }

      const voiceAttachment = messageReply.attachments.find(a => a.type === "audio");
      if (!voiceAttachment) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("❗ Reply to a valid voice/audio message.");
      }

      const name = args.slice(2).join(" ").trim();
      if (!name) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("❗ Please provide a name for the voice.");
      }

      const existsUrl = await voiceCollection.findOne({ url: voiceAttachment.url });
      if (existsUrl) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("⚠️ This voice is already saved.");
      }

      const doc = {
        url: voiceAttachment.url,
        name,
        duration: voiceAttachment.duration || 0,
        size: voiceAttachment.fileSize || 0
      };

      try {
        await voiceCollection.insertOne(doc);
        await api.setMessageReaction("✅", messageID, () => {}, true);
        return message.reply(`✅ Voice saved as "${name}".`);
      } catch (e) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("❌ Failed to save voice.");
      }
    }

    // Handle .voice remove
    if (cmd === "voice" && lowerArgs[1] === "remove") {
      if (!messageReply || !messageReply.body) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("❗ Reply to the bot's voice message to remove.");
      }

      const match = messageReply.body.match(/🎙 Voice: (.+?) \(/);
      if (!match) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("⚠️ Could not identify voice name in reply.");
      }

      const nameToRemove = match[1].trim();

      const res = await voiceCollection.deleteOne({ name: nameToRemove });
      if (res.deletedCount === 0) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply(`⚠️ Voice "${nameToRemove}" not found.`);
      }

      await api.setMessageReaction("✅", messageID, () => {}, true);
      return message.reply(`✅ Voice "${nameToRemove}" removed.`);
    }

    // Handle .voice list
    if (cmd === "voice" && lowerArgs[1] === "list") {
      if (allVoices.length === 0) {
        await api.setMessageReaction("❌", messageID, () => {}, true);
        return message.reply("❌ No voices saved.");
      }

      let listMsg = "🎙 Saved voices:\n";
      allVoices.forEach((v, i) => {
        listMsg += `${i + 1}. ${v.name} — ${v.duration}s, ${formatBytes(v.size)}\n`;
      });
      await api.setMessageReaction("✅", messageID, () => {}, true);
      return message.reply(listMsg);
    }

    // Handle .voice <name> fuzzy search
    if (cmd === "voice" && lowerArgs.length >= 2 && !["add", "remove", "list"].includes(lowerArgs[1])) {
      const searchName = args.slice(1).join(" ").toLowerCase();

      const fuse = new Fuse(allVoices, { keys: ["name"], threshold: 0.3 });
      let found = allVoices.find(v => v.name.toLowerCase() === searchName);

      if (!found) {
        const results = fuse.search(searchName);
        if (results.length === 0) {
          await api.setMessageReaction("❌", messageID, () => {}, true);
          return message.reply(`❌ No voice found matching "${searchName}".`);
        }
        found = results[0].item;
        await message.reply(`⚠️ No exact match found. Sending similar voice "${found.name}".`);
      }

      await sendVoice(found);
      return;
    }

    // Auto-trigger exact match (no prefix)
    if (isAuto) {
      const text = body.trim().toLowerCase();
      const exactVoice = allVoices.find(v => v.name.toLowerCase() === text);
      if (exactVoice) {
        await sendVoice(exactVoice);
        return;
      }
    }

    // If .voice with no args -> send guide
    if (cmd === "voice" && lowerArgs.length === 1) {
      await api.setMessageReaction("✅", messageID, () => {}, true);
      return message.reply(this.config.guide.en.replace(/{prefix}/g, prefix));
    }
  }
};
