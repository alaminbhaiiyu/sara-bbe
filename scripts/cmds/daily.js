const { MongoClient } = require("mongodb");

// IMPORTANT: Ensure these match your balance and dice commands' DB details!
const mongoURL = "mongodb+srv://ikalaminss:uchR2FJzOGBS1flG@cluster0.lugxuhr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = "bank";          // Use the same database
const collectionName = "balance"; // Use the same collection

const client = new MongoClient(mongoURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const DAILY_BONUS_AMOUNT = 500; // Define the amount users get daily

function getCurrentDate() {
  const now = new Date();
  // Format as YYYY-MM-DD to easily compare dates
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

module.exports = {
  config: {
    name: "daily",
    version: "1.0",
    author: "Alamin (MongoDB Native)", // Your name
    countDown: 5, // Cooldown in seconds before a user can use it again
    role: 0, // 0 for everyone, 1 for admin, 2 for super admin
    shortDescription: { en: "Claim your daily money!" },
    longDescription: { en: "Claim a daily bonus amount to add to your balance." },
    category: "economy",
    guide: { en: "{pn}" }
  },

  onStart: async function ({ event, message, usersData }) {
    const uid = event.senderID;

    try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      let user = await collection.findOne({ uid });
      const currentName = await usersData.getName(uid);
      const today = getCurrentDate();

      // If user doesn't exist, create a new entry
      if (!user) {
        user = {
          uid: uid,
          name: currentName,
          balance: 0, // Start with 0 or your initial balance if different
          win: 0,
          loss: 0,
          streak: 0,
          last_daily: null // New field for last daily claim date
        };
        await collection.insertOne(user);
      } else {
        // Update user's name if it's "friend" or empty/null
        if (!user.name || user.name.toLowerCase() === "friend") {
          await collection.updateOne(
            { uid: uid },
            { $set: { name: currentName } }
          );
          user.name = currentName; // Update local user object
        }
        // Ensure the last_daily field exists for older users
        if (typeof user.last_daily === 'undefined') {
          user.last_daily = null;
        }
      }

      // Check if user has already claimed daily today
      if (user.last_daily === today) {
        return message.reply(`⏰ | ${user.name}, you have already claimed your daily bonus for today! Come back tomorrow.`);
      }

      // User can claim the daily bonus
      user.balance += DAILY_BONUS_AMOUNT;
      user.last_daily = today; // Update last claimed date

      // Save updated user data to MongoDB
      await collection.updateOne(
        { uid: uid },
        { $set: user },
        { upsert: true } // Creates document if it doesn't exist (useful for first-time daily claim if user wasn't created by other cmds)
      );

      message.reply(`🎉 | ${user.name}, you have successfully claimed ৳${DAILY_BONUS_AMOUNT} as your daily bonus! Your new balance is ৳${user.balance}.`);

    } catch (err) {
      console.error("Daily command error:", err);
      message.reply("❌ Server error: " + err.message);
    } finally {
      // Again, consider managing the MongoDB client connection globally
      // rather than closing it after each command.
      // await client.close();
    }
  }
};