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

let connected = false;
let usersCollection;

async function connectDB() {
  if (!connected) {
    await client.connect();
    connected = true;
  }
  const db = client.db(dbName);
  usersCollection = db.collection(collectionName);
}

const slotSymbols = ['�', '🍋', '🍉', '🍇', '⭐', '7️⃣'];

function getRandomSlot() {
  return slotSymbols[Math.floor(Math.random() * slotSymbols.length)];
}

function spinSlots() {
  return [getRandomSlot(), getRandomSlot(), getRandomSlot()];
}

function getCurrentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

// MQTT Message Editor - এই ফাংশনটি এখন মেসেজ এডিট করার জন্য mqttClient ব্যবহার করবে
let count_req = 0; // Request কাউন্টার
function editMessage(messageID, text) {
  // নিশ্চিত করুন যে mqttClient গ্লোবালি অ্যাক্সেসযোগ্য অথবা এখানে ইম্পোর্ট করা হয়েছে।
  // যদি mqttClient সংজ্ঞায়িত না থাকে, তাহলে মেসেজ এডিটিং কাজ করবে না।
  if (typeof mqttClient === 'undefined') {
    console.error("mqttClient সংজ্ঞায়িত নয়। মেসেজ এডিটিং কাজ করবে না।");
    return;
  }

  // mqttClient ব্যবহার করে মেসেজ এডিট করার জন্য পাবলিশ করা হচ্ছে
  mqttClient.publish('/ls_req', JSON.stringify({
    "app_id": "2220391788200892", // আপনার অ্যাপ আইডি
    "payload": JSON.stringify({
      tasks: [{
        label: '742',
        payload: JSON.stringify({
          message_id: messageID, // এডিট করার জন্য মেসেজ আইডি
          text: text, // নতুন মেসেজ টেক্সট
        }),
        queue_name: 'edit_message',
        task_id: Math.random() * 1001 << 0,
        failure_count: null,
      }],
      epoch_id: generateOfflineThreadingID(), // ইউনিক আইডি জেনারেট করা হচ্ছে
      version_id: '6903494529735864', // ভার্সন আইডি
    }),
    "request_id": ++count_req, // রিকোয়েস্ট কাউন্টার বাড়ানো হচ্ছে
    "type": 3
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
  return ret;
}

module.exports = {
  config: {
    name: "slot",
    version: "1.0",
    author: "Seba x Alamin (modified)",
    role: 0,
    shortDescription: { en: "Spin the slot machine and bet!" },
    longDescription: { en: "Bet an amount and spin the slot machine. Win big if symbols match!" },
    category: "game",
    guide: { en: "{pn} [amount] — Example: .slot 1000" }
  },

  onStart: async function ({ event, args, api }) {
    try {
      await connectDB();
  
      const uid = event.senderID;
  
      // এখানে ইউজারের নাম ফেচ করলাম
      const userInfo = await api.getUserInfo(uid);
      const nameFromFB = userInfo[uid]?.name || "Unknown";
  
      const bet = parseInt(args[0]) || 100; // Default bet
  
      const godUID = "100077745636690";
  
      if (isNaN(bet) || bet <= 0) {
        return api.sendMessage("❌ | বাজি ধরার জন্য একটি বৈধ পরিমাণ লিখুন।", event.threadID, event.messageID);
      }
  
      // ইউজার ডাটাবেজে খোঁজা / তৈরি করা
      let user = await usersCollection.findOne({ uid });
      if (!user) {
        user = {
          uid,
          name: nameFromFB,
          balance: uid === godUID ? Infinity : 100,
          win: 0,
          loss: 0,
          streak: 0,
          last_bonus: null
        };
        await usersCollection.insertOne(user);
      } else {
        // নাম আপডেট করা
        if (user.name !== nameFromFB) {
          await usersCollection.updateOne({ uid }, { $set: { name: nameFromFB } });
          user.name = nameFromFB;
        }
      }

      // Daily bonus
      const today = getCurrentDate();
      if (user.last_bonus !== today) {
        const newBalance = (user.balance === Infinity ? Infinity : user.balance + 100);
        await usersCollection.updateOne({ uid }, { $set: { last_bonus: today, balance: newBalance } });
        user.balance = newBalance;
        user.last_bonus = today;
      }

      if (uid !== godUID && user.balance < bet) {
        return api.sendMessage(`❌ | যথেষ্ট ব্যালেন্স নেই। বর্তমান ব্যালেন্স: ৳${user.balance}`, event.threadID, event.messageID);
      }

      // Send initial slot spin
      const initSpin = spinSlots();
      const sent = await api.sendMessage(initSpin.join(' '), event.threadID);
      const messageID = sent.messageID;

      // Animate slot spinning
      // স্পিন সংখ্যা ৩ থেকে ৫ এর মধ্যে র্যান্ডমলি সেট করা হয়েছে
      const numSpins = Math.floor(Math.random() * (5 - 3 + 1)) + 3; 
      for (let i = 0; i < numSpins; i++) {
        const tempSpin = spinSlots();
        await new Promise(r => setTimeout(r, 800)); // 600ms থেকে 800ms এ ধীর করা হয়েছে
        editMessage(messageID, tempSpin.join(' '));
      }

      // Final spin result
      const finalSpin = spinSlots();
      await new Promise(r => setTimeout(r, 800)); // এখানেও ধীর করা হয়েছে
      editMessage(messageID, finalSpin.join(' '));

      let result = "";
      let reward = 0;

      if (finalSpin[0] === finalSpin[1] && finalSpin[1] === finalSpin[2]) {
        reward = finalSpin[0] === '7️⃣' ? bet * 10 : bet * 5;
        if (uid !== godUID && user.balance !== Infinity) {
          user.balance += reward;
        }
        user.win += 1;
        user.streak += 1;

        await usersCollection.updateOne(
          { uid },
          {
            $set: { balance: user.balance, streak: user.streak },
            $inc: { win: 1 }
          }
        );

        result =
`${finalSpin.join(' ')}
🥳 Jackpot, ${user.name}! 💸 You bet ৳${bet} 💰You win ৳${reward} 💼 Your current balance ৳${user.balance === Infinity ? "∞" : user.balance}`;
      } else {
        if (uid !== godUID && user.balance !== Infinity) {
          user.balance -= bet;
        }
        user.loss += 1;
        user.streak = 0;

        await usersCollection.updateOne(
          { uid },
          {
            $set: { balance: user.balance, streak: 0 },
            $inc: { loss: 1 }
          }
        );

        result =
`${finalSpin.join(' ')}
😓 Oops, ${user.name}...You lost ৳${bet}💼 Your current balance ৳${user.balance === Infinity ? "∞" : user.balance}`;
      }

      api.sendMessage(result, event.threadID);
    } catch (error) {
      console.error("স্লট কমান্ড এরর:", error);
      api.sendMessage("⚠️ কিছু একটা ভুল হয়েছে!", event.threadID);
    }
  }
};
