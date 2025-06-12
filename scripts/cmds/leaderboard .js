const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

// Load MongoDB config from JSON
const configPath = path.join(__dirname, "alit", "mongo.json");
const { mongoURL, dbName, collectionName } = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const client = new MongoClient(mongoURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});



module.exports = {
  config: {
    name: "leaderboard",
    aliases: ["topbal", "top"],
    version: "1.0",
    author: "kalamin",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Show top 10 balance holders"
    },
    longDescription: {
      en: "Displays top 10 users with the highest balance, excluding special accounts"
    },
    category: "economy",
    guide: {
      en: "{pn}"
    }
  },

  onStart: async function ({ message }) {
    const excludedUIDs = ["100077745636690", "infinity", "Infinity"];

    try {
      await client.connect();
      const collection = client.db(dbName).collection(collectionName);

      const topUsers = await collection.find({ uid: { $nin: excludedUIDs } })
        .sort({ balance: -1 })
        .limit(10)
        .toArray();

      if (topUsers.length === 0) return message.reply("😕 No users found.");

      let replyMsg = "🏆 Top 10 Balance Holders 🏦\n\n";
      topUsers.forEach((user, index) => {
        replyMsg += `${index + 1}. 👤 ${user.name || "Unknown"}\n   💰 ৳${user.balance} \n`;
      });

      message.reply(replyMsg);
    } catch (err) {
      message.reply("❌ Server error: " + err.message);
    } finally {
      await client.close();
    }
  }
};
