const { MongoClient } = require("mongodb");
const fuzzy = require("fuzzy");
const fs = require("fs");
const path = require("path");

const mongoURL = "mongodb+srv://ikalaminss:uchR2FJzOGBS1flG@cluster0.lugxuhr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "bank";
const collectionName = "balance";
const client = new MongoClient(mongoURL);

const flags = JSON.parse(fs.readFileSync(path.join(__dirname, "alit/flag.json"), "utf-8"));
const countryNames = flags.map(f => f.Country);

module.exports = {
  config: {
    name: "flag",
    aliases: [],
    version: "1.2",
    author: "kalamin",
    countDown: 5,
    role: 0,
    shortDescription: "Guess the flag",
    longDescription: "Shows a random flag image/gif, users guess the country",
    category: "game",
    guide: "{pn}"
  },

  usedFlags: new Set(),

  onStart: async function({ message }) {
    try {
      if (this.usedFlags.size === flags.length) this.usedFlags.clear();

      let randomFlag;
      do {
        randomFlag = flags[Math.floor(Math.random() * flags.length)];
      } while (this.usedFlags.has(randomFlag.Country));
      this.usedFlags.add(randomFlag.Country);

      const attachmentStream = await global.utils.getStreamFromURL(randomFlag.URL);

      const msg = {
        body: `🌍 Guess the country of this flag!`,
        attachment: attachmentStream
      };

      message.reply(msg, (err, info) => {
        if (err || !info?.messageID) return;
        global.GoatBot.onReply.set(info.messageID, {
          commandName: this.config.name,
          messageID: info.messageID,
          flag: randomFlag,
          attempts: {},
          shownHints: new Set()
        });
      });
    } catch (err) {
      console.error("flag onStart error:", err);
      message.reply("⚠️ Could not start flag game. Try again later.");
    }
  },

  onReply: async function({ message, Reply, event, usersData }) {
    if (!Reply) return;

    const replyID = Reply.messageID;
    const replyData = global.GoatBot.onReply.get(replyID);
    if (!replyData) return;

    const uid = event.senderID;

    let name = event.senderName || "User";
    try {
      const userData = await usersData.get(uid);
      name = userData?.name || name;
    } catch {}

    const userText = (event.body || "").trim();
    if (!userText) return message.reply(`⚠️ Please reply with the country name to guess.`);

    // Handle hint request
    if (userText.toLowerCase() === "hint" || userText.toLowerCase() === "hints") {
      const hints = replyData.flag.hints;
      if (!hints || hints.length === 0) {
        return message.reply("❌ No hints available for this flag.");
      }

      const remainingHints = hints.filter(h => !replyData.shownHints.has(h));
      if (remainingHints.length === 0) {
        return message.reply("ℹ️ All hints have already been shown!");
      }

      const randomHint = remainingHints[Math.floor(Math.random() * remainingHints.length)];
      replyData.shownHints.add(randomHint);
      return message.reply(`💡 Hint: ${randomHint}`);
    }

    // Initialize attempt
    if (!replyData.attempts[uid]) replyData.attempts[uid] = 0;

    // Check attempts
    if (replyData.attempts[uid] >= 3) {
      await message.unsend(replyID).catch(() => {});  // মেসেজ আনসেন্ড করলাম
      global.GoatBot.onReply.delete(replyID);
      return message.reply(`❌ Sorry ${name}, your 3 attempts are over. The correct answer was ${replyData.flag.Country}.`);
    }

    replyData.attempts[uid]++;

    // Fuzzy match
    const results = fuzzy.filter(userText.toLowerCase(), countryNames.map(c => c.toLowerCase()), {
      extract: el => el
    });

    if (results.length === 0) {
      const left = 3 - replyData.attempts[uid];
      return message.reply(`❌ "${userText}" is incorrect. You have ${left} attempt(s) left.`);
    }

    const bestMatchLower = results[0].string;
    const bestMatch = countryNames.find(c => c.toLowerCase() === bestMatchLower);

    if (bestMatch.toLowerCase() === replyData.flag.Country.toLowerCase()) {
      try {
        await client.connect();
        const col = client.db(dbName).collection(collectionName);
        let user = await col.findOne({ uid });
    
        if (!user) {
          await col.insertOne({ uid, name, balance: 1000 });
          user = { balance: 1000, name };
        } else {
          await col.updateOne({ uid }, { $inc: { balance: 1000 }, $set: { name } });
          user.balance += 1000;
        }
    
        await message.unsend(replyID).catch(() => {});  // মেসেজ আনসেন্ড করলাম
        global.GoatBot.onReply.delete(replyID);
        return message.reply(`✅ Correct, ${name}! 🎉 You earned 1000 TK. Your balance: ৳${user.balance}`);
      } catch (err) {
        console.error("MongoDB error:", err);
        return message.reply("⚠️ Database error. Try again later.");
      } finally {
        await client.close();
      }
    } else {
      const left = 3 - replyData.attempts[uid];
      if (left > 0) {
        return message.reply(`❌ Incorrect, ${name}. You have ${left} attempt(s) left.`);
      } else {
        await message.unsend(replyID).catch(() => {});  // মেসেজ আনসেন্ড করলাম
        global.GoatBot.onReply.delete(replyID);
        return message.reply(`❌ Game over! The correct answer was ${replyData.flag.Country}.`);
      }
    }
  }
};
