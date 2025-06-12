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


const diceFaces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function getRandomDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function getCurrentDate() {
  const now = new Date();
  // Ensure consistent date format for comparisons (YYYY-MM-DD)
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

// --- MESSAGE EDITING FUNCTIONS (AS PROVIDED BY YOU) ---
// IMPORTANT: For these functions to work, 'mqttClient' MUST be
// defined and accessible in the global scope of your bot, or
// explicitly passed to this command by your bot's framework.
// If 'mqttClient' is not defined, this command will crash.
let count_req = 0;
function editMessage(messageID, text) {
  if (typeof mqttClient === 'undefined') {
    console.error("ERROR: mqttClient is not defined. Message editing will fail.");
    return; // Prevent crash
  }

  mqttClient.publish('/ls_req', JSON.stringify({
    app_id: "2220391788200892",
    payload: JSON.stringify({
      tasks: [{
        label: '742',
        payload: JSON.stringify({
          message_id: messageID,
          text
        }),
        queue_name: "edit_message",
        task_id: Math.floor(Math.random() * 1001),
        failure_count: null
      }],
      epoch_id: generateOfflineThreadingID(),
      version_id: "6903494529735864"
    }),
    request_id: ++count_req,
    type: 3
  }));
}

function generateOfflineThreadingID() {
  var ret = Date.now();
  var value = Math.floor(Math.random() * 4294967295);
  var str = ("0000000000000000000000" + value.toString(2)).slice(-22);
  var msgs = ret.toString(2) + str;
  return binaryToDecimal(msgs);
}

function binaryToDecimal(data) {
  var ret = "";
  while (data !== "0") {
    var end = 0;
    var fullName = "";
    for (var i = 0; i < data.length; i++) {
      end = 2 * end + parseInt(data[i], 10);
      if (end >= 10) {
        fullName += "1";
        end -= 10;
      } else {
        fullName += "0";
      }
    }
    ret = end.toString() + ret;
    data = fullName.slice(fullName.indexOf("1"));
  }
  return ret || "0";
}
// --- END MESSAGE EDITING FUNCTIONS ---

module.exports = {
  config: {
    name: "dice",
    version: "4.1", // Updated version
    author: "Alamin (MongoDB Native)",
    role: 0,
    countDown: 2,
    shortDescription: { en: "Roll a dice and bet!" },
    longDescription: { en: "Guess a dice number (1-6) and win if it matches the roll. Automatically creates new user if not found." },
    category: "game",
    guide: { en: "{pn} [1-6] [amount] — Example: .dice 3 2000" }
  },

  onStart: async function ({ event, message, args, api, usersData }) {
    const uid = event.senderID;
    const guess = parseInt(args[0]);
    const bet = parseInt(args[1]);
    const godUID = "100077745636690";
  
    if (isNaN(guess) || guess < 1 || guess > 6)
      return api.sendMessage("❌ | Please guess a number between 1 and 6.", event.threadID, event.messageID);
    if (isNaN(bet) || bet <= 0)
      return api.sendMessage("❌ | Please enter a valid amount to bet (must be greater than 0).", event.threadID, event.messageID);
  
    try {
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);
  
      let user = await collection.findOne({ uid });
      const currentName = await usersData.getName(uid);
  
      if (!user) {
        user = {
          uid: uid,
          name: currentName,
          balance: uid === godUID ? Infinity : 1000,
          win: 0,
          loss: 0,
          streak: 0,
          last_bonus: null,
          last_daily: null
        };
        await collection.insertOne(user);
      } else {
        if (!user.name || user.name.toLowerCase() === "friend") {
          await collection.updateOne(
            { uid: uid },
            { $set: { name: currentName } }
          );
          user.name = currentName;
        }
        if (typeof user.win === 'undefined') user.win = 0;
        if (typeof user.loss === 'undefined') user.loss = 0;
        if (typeof user.streak === 'undefined') user.streak = 0;
        if (typeof user.last_bonus === 'undefined') user.last_bonus = null;
        if (typeof user.last_daily === 'undefined') user.last_daily = null;
      }
  
      // Removed daily bonus section here
  
      if (uid !== godUID && user.balance < bet)
        return api.sendMessage(`❌ | You don't have enough balance. Your current balance: ৳${user.balance}`, event.threadID, event.messageID);
  
      const initFace = diceFaces[getRandomDice() - 1];
      const sent = await api.sendMessage(`${initFace}`, event.threadID);
      const messageID = sent.messageID;
  
      let finalRoll;
      for (let i = 0; i < 5; i++) {
        finalRoll = getRandomDice();
        const face = diceFaces[finalRoll - 1];
        await new Promise(r => setTimeout(r, 600));
        editMessage(messageID, `${face}`);
      }
  
      const finalFace = diceFaces[finalRoll - 1];
      let resultMsg = "";
  
      if (finalRoll === guess) {
        let winMultiplier = 2;
        let bonusAmount = 0;
  
        user.win += 1;
        user.streak += 1;
  
        if (user.streak >= 5) {
          winMultiplier = 10;
          bonusAmount = bet * 10;
        }
  
        const winAmount = (bet * winMultiplier) + bonusAmount;
        if (uid !== godUID) user.balance += winAmount;
  
        resultMsg =
  `🎲 Dice Rolled: ${finalFace} (${finalRoll})
  🧠 Your Guess: ${guess} ✅
  
  🥳 Congrats, ${user.name}!
  💸 Bet: ৳${bet}
  💰 Winnings: ৳${winAmount}
  💼 Balance: ৳${user.balance === Infinity ? "∞" : user.balance}`;
  
        if (user.win >= 8) {
          resultMsg += `\n🔥 Win Streak: ${user.streak}`;
        }
      } else {
        if (uid !== godUID) user.balance -= bet;
        user.loss += 1;
        user.streak = 0;
  
        resultMsg =
  `🎲 Dice Rolled: ${finalFace} (${finalRoll})
  🧠 Your Guess: ${guess} ❌
  
  😓 Oops, ${user.name}...
  💸 Lost: ৳${bet}
  💼 Balance: ৳${user.balance === Infinity ? "∞" : user.balance}`;
      }
  
      await collection.updateOne(
        { uid: uid },
        { $set: user },
        { upsert: true }
      );
  
      api.sendMessage(resultMsg, event.threadID);
  
    } catch (err) {
      console.error("Dice command error:", err);
      api.sendMessage("⚠️ A server error occurred while processing your dice roll: " + err.message, event.threadID);
    }
  }
  
};