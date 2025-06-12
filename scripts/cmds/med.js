const fs = require("fs");
const path = require("path");
const fuzzysort = require("fuzzysort");

module.exports = {
  config: {
    name: "med",
    aliases: [],
    version: "1.0",
    author: "YourName",
    description: "Search medicine info using fuzzy matching",
    usage: "<keyword>",
    category: "search",
    cooldown: 3
  },

  onStart: async function ({ message, args }) {
    if (!args[0]) return message.reply("🔍 দয়া করে একটি মেডিসিন নাম বা keyword দিন।");

    const query = args.join(" ").toLowerCase();
    const filePath = path.join(__dirname, 
      "alit", "med.json");

    if (!fs.existsSync(filePath)) {
      return message.reply("❌ med.json ফাইল পাওয়া যায়নি।");
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    let bestMatch = null;
    let highestScore = -Infinity;

    for (const item of data) {
      const fields = [
        item["Medicine Name"] || "",
        item["Dosage Form"] || "",
        item["Strength"] || "",
        item["Manufactur By"] || ""
      ].join(" ");

      const result = fuzzysort.single(query, fields);
      if (result && result.score > highestScore) {
        highestScore = result.score;
        bestMatch = item;
      }
    }

    if (!bestMatch) {
      return message.reply("😓 কোনো মেডিসিন মেলেনি। আবার চেষ্টা করুন অন্য কীওয়ার্ড দিয়ে।");
    }

    const info = `🧾 **মেডিসিন তথ্য**

🔹 **নাম:** ${bestMatch["Medicine Name"]}
🔸 **ডোজ ফর্ম:** ${bestMatch["Dosage Form"]}
💊 **স্ট্রেংথ:** ${bestMatch["Strength"]}
🏭 **প্রস্তুতকারক:** ${bestMatch["Manufactur By"]}

📦 **প্যাকেট:** ${bestMatch["Unit"] || "তথ্য নেই"}
💵 **দাম:** ${bestMatch["Per Piece"] || bestMatch["Strip Price"] || "উল্লেখ নেই"}
`;

    message.reply(info);
  }
};
