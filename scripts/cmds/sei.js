const { MongoClient } = require("mongodb");
const { getStreamFromURL } = global.utils;

const mongoURL = "mongodb+srv://ikalaminss:uchR2FJzOGBS1flG@cluster0.lugxuhr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "file";
const collectionName = "sei";

let seiCollection;
MongoClient.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(client => {
    seiCollection = client.db(dbName).collection(collectionName);
  })
  .catch(console.error);

module.exports = {
  config: {
    name: "sei",
    version: "3.1",
    author: "Alamin + ChatGPT",
    role: 0,
    shortDescription: { en: "Send random sei media, add/remove/list" },
    category: "media",
    guide: {
      en: `{prefix}sei => Send random media
{prefix}sei add <name> => Reply to media to add
{prefix}sei remove => Reply to media (sent by bot) to remove
{prefix}sei list => List all
{prefix}sei <name> => Send by name`
    }
  },

  onStart: async function ({ event, message, args, api }) {
    const { senderID, messageReply, messageID } = event;
    const command = args[0]?.toLowerCase();
    const mediaList = await seiCollection.find().toArray();

    // === .sei add <name> ===
    if (command === "add") {
      if (!messageReply?.attachments?.length)
        return message.reply("❗ Reply to an image or video to add.");
      const name = args.slice(1).join(" ").trim();
      if (!name) return message.reply("❗ Please provide a name.");

      const { url, type } = messageReply.attachments[0];
      const exists = await seiCollection.findOne({ url });
      if (exists) return message.reply("⚠️ This media is already added.");

      await seiCollection.insertOne({ url, name, type });
      api.setMessageReaction("☠️", messageID, () => {}, true);
      return message.reply(`✅ Media saved as "${name}".`);
    }

    // === .sei remove === (uses reply body name)
    if (command === "remove") {
      if (!messageReply?.body)
        return message.reply("❗ Reply to a media sent by bot to remove.");

      const matched = messageReply.body.match(/Media(?: #\d+)?: (.+)/i);
      if (!matched || !matched[1]) return message.reply("⚠️ Could not extract name from reply.");
      const name = matched[1].trim();

      const result = await seiCollection.deleteOne({ name });
      if (result.deletedCount === 0)
        return message.reply("⚠️ Media not found with that name.");

      api.setMessageReaction("☠️", messageID, () => {}, true);
      return message.reply(`✅ Media "${name}" removed successfully.`);
    }

    // === .sei list ===
    if (command === "list") {
      if (mediaList.length === 0) return message.reply("❌ No media found.");
      let msg = "📄 Media List:\n";
      mediaList.forEach((m, i) => msg += `${i + 1}. ${m.name}\n`);
      return message.reply(msg, (err, info) => {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: "sei",
          type: "sendMediaByNumber",
          author: senderID,
          mediaList
        });
      });
    }

    // === .sei <name> ===
    if (command && !["add", "remove", "list"].includes(command)) {
      const search = args.join(" ").toLowerCase();
      const exact = mediaList.find(m => m.name.toLowerCase() === search);
      if (exact) {
        await sendMedia(exact, message, messageID, api);
      } else {
        const similar = mediaList.find(m => m.name.toLowerCase().includes(search));
        if (similar) {
          await message.send({
            body: `⚠️ No exact match. Sending similar: ${similar.name}`,
            attachment: await getStreamFromURL(similar.url)
          });
          return api.setMessageReaction("☠️", messageID, () => {}, true);
        } else {
          return message.reply(`❌ No media found named "${search}".`);
        }
      }
    }

    // === default: random media ===
    if (!command) {
      if (mediaList.length === 0) return message.reply("❌ No media saved yet.");
      let used = global._seiUsed || {};
      if (!used[senderID]) used[senderID] = [];

      let unused = mediaList.filter(m => !used[senderID].includes(m.url));
      if (unused.length === 0) {
        used[senderID] = [];
        unused = [...mediaList];
      }

      const chosen = unused[Math.floor(Math.random() * unused.length)];
      used[senderID].push(chosen.url);
      global._seiUsed = used;
      await sendMedia(chosen, message, messageID, api);
    }

    async function sendMedia(media, message, messageID, api) {
      try {
        await message.send({
          body: `🎬 Media: ${media.name}`,
          attachment: await getStreamFromURL(media.url)
        });
        api.setMessageReaction("☠️", messageID, () => {}, true);
      } catch {
        return message.reply("⚠️ Failed to send media.");
      }
    }
  },

  onReply: async function ({ event, message, api, Reply }) {
    const { senderID, body, messageID } = event;
    if (senderID !== Reply.author) return;

    if (Reply.type === "sendMediaByNumber") {
      const num = parseInt(body);
      const mediaList = Reply.mediaList;
      if (isNaN(num) || num < 1 || num > mediaList.length)
        return message.reply("❗ Send a valid number.");
      const media = mediaList[num - 1];
      try {
        await message.send({
          body: `🎬 Media #${num}: ${media.name}`,
          attachment: await getStreamFromURL(media.url)
        });
        api.setMessageReaction("☠️", messageID, () => {}, true);
      } catch {
        return message.reply("⚠️ Failed to send media.");
      }
    }
  }
};