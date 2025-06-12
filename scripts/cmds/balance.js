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
    name: "balance",
    aliases: ["bal"],
    version: "1.1",
    author: "kalamin",
    countDown: 2,
    role: 0,
    shortDescription: {
      en: "Check your or others' balance"
    },
    longDescription: {
      en: "Check balance of yourself, mentioned user, or any uid. Creates new user if not found."
    },
    category: "economy",
    guide: {
      en: "{pn} (optional: @mention or uid)"
    }
  },

  onStart: async function ({ event, message, args, usersData }) {
    let targetID;
  
    if (args[0] && /^\d+$/.test(args[0])) {
      targetID = args[0]; // if uid given
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
      targetID = Object.keys(event.mentions)[0]; // if mention
    } else {
      targetID = event.senderID; // default: self
    }
  
    try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);
  
      let user = await collection.findOne({ uid: targetID });
      let currentName = await usersData.getName(targetID);
  
      // If no user found, create one with currentName
      if (!user) {
        user = {
          uid: targetID,
          name: currentName,
          balance: 0,
          win: 0,
          loss: 0
        };
        await collection.insertOne(user);
      } else {
        // If user found, but name is "friend" or empty or null, update it from currentName
        if (!user.name || user.name.toLowerCase() === "friend") {
          await collection.updateOne(
            { uid: targetID },
            { $set: { name: currentName } }
          );
          user.name = currentName;
        }
      }
  
      const msg = `${user.name}, Your current balance ${user.balance}৳ `;
      message.reply(msg);
    } catch (err) {
      message.reply("❌ Server error: " + err.message);
    } finally {
      await client.close();
    }
  }
  
};
