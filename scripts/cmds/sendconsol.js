const logs = [];

(function hookConsole() {
  const oldLog = console.log;
  console.log = function (...args) {
    logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
    if (logs.length > 50) logs.shift(); // সর্বোচ্চ ৫০ লাইন মেমোরিতে রাখো
    oldLog.apply(console, args);
  };
})();

module.exports = {
  config: {
    name: "sendconsol",
    version: "1.0",
    author: "YourName",
    description: "Send last console logs to chat",
    usage: ".sendconsol",
    category: "system",
    cooldown: 5,
  },

  onStart: async function ({ message, args, event }) {
    if (logs.length === 0)
      return message.reply("❌ কোনো কনসোল লগ পাওয়া যায়নি।");

    const recentLogs = logs.slice(-20).join("\n"); // শেষ ২০টা লগ দেখাও

    if (recentLogs.length > 20000) {
      return message.reply("⚠️ লগ অনেক বড়, ছোট করে নাও।");
    }

    return message.reply("📦 শেষ কনসোল লগ:\n\n" + recentLogs);
  }
};