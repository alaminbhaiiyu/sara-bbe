const { MongoClient } = require("mongodb");

// --- IMPORTANT DATABASE CONFIGURATION ---
// Ensure these match your 'balance' and 'daily' commands for consistent data.
const mongoURL = "mongodb+srv://ikalaminss:uchR2FJzOGBS1flG@cluster0.lugxuhr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "bank";          // Consistent with 'balance' and 'daily' commands
const collectionName = "balance"; // Consistent with 'balance' and 'daily' commands

const client = new MongoClient(mongoURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Helper: get or create user by uid, fetch FB name if missing
async function getOrCreateUser(collection, uid, api) {
  let user = await collection.findOne({ uid });
  if (!user) {
    // Fetch FB name
    let name = "Unknown User";
    try {
      const fbInfo = await api.getUserInfo(uid);
      name = fbInfo[uid]?.name || name;
    } catch (e) {
      console.error("FB API error:", e.message);
    }

    user = {
      uid,
      name,
      balance: 1000,
      win: 0,
      loss: 0,
      streak: 0,
      last_bonus: null,
    };
    await collection.insertOne(user);
  }
  return user;
}

module.exports = {
  config: {
    name: "transfer",
    aliases: ["give"],
    version: "1.0",
    author: "ChatGPT",
    role: 0,
    shortDescription: { en: "Transfer money to another user" },
    longDescription: { en: "Send money to a user by replying, mentioning, or giving their UID" },
    category: "economy",
    guide: {
      en: "{pn} <amount> [reply/mention/uid] - Transfer money to user"
    }
  },

  onStart: async function({ api, event, args }) {
    if (args.length < 1) {
      return api.sendMessage("❌ Please specify amount to transfer.", event.threadID, event.messageID);
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      return api.sendMessage("❌ Invalid amount.", event.threadID, event.messageID);
    }

    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Sender is always the command sender
    const fromUID = event.senderID;

    // Detect recipient UID: priority - reply message sender > mention > argument uid
    let toUID = null;
    if (event.messageReply && event.messageReply.senderID) {
      toUID = event.messageReply.senderID;
    } else if (event.mentions && Object.keys(event.mentions).length > 0) {
      toUID = Object.keys(event.mentions)[0];
    } else if (args.length >= 2) {
      toUID = args[1];
    }

    if (!toUID) {
      return api.sendMessage("❌ Please reply to, mention, or provide UID of the recipient.", event.threadID, event.messageID);
    }

    if (toUID === fromUID) {
      return api.sendMessage("❌ You cannot transfer money to yourself.", event.threadID, event.messageID);
    }

    try {
      // Get or create sender and receiver
      const sender = await getOrCreateUser(collection, fromUID, api);
      const receiver = await getOrCreateUser(collection, toUID, api);

      if (sender.balance < amount && sender.uid !== "100077745636690") {
        return api.sendMessage(`❌ Insufficient balance. Your balance is ৳${sender.balance}.`, event.threadID, event.messageID);
      }

      // Deduct from sender (except admin uid)
      if (sender.uid !== "100077745636690") {
        sender.balance -= amount;
        await collection.updateOne({ uid: fromUID }, { $set: { balance: sender.balance } });
      }

      // Add to receiver
      receiver.balance += amount;
      await collection.updateOne({ uid: toUID }, { $set: { balance: receiver.balance } });

      const msg = `✅ Successfully transferred ৳${amount} from ${sender.name} to ${receiver.name}.\n\n` +
                  `💼 Your new balance: ৳${sender.balance}\n` +
                  `💼 ${receiver.name}'s new balance: ৳${receiver.balance}`;

      return api.sendMessage(msg, event.threadID, event.messageID);
    } catch (err) {
      console.error("Transfer command error:", err);
      return api.sendMessage("⚠️ An error occurred during transfer. Please try again later.", event.threadID, event.messageID);
    }
  }
};
