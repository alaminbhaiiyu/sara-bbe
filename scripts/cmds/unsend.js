const config = require('../../config.json'); // config.json থেকে admin লিস্ট নাও

module.exports = {
  config: {
    name: "unsend",
    version: "1.2",
    author: "NTKhang",
    countDown: 0,
    role: 0, // role 2 মানে শুধুমাত্র admin ব্যবহার করতে পারবে
    aliases: ["u", "unsent"],
    description: {
      en: "Unsend a message sent by the bot"
    },
    category: "box chat",
    guide: {
      en: "Reply to the bot's message you want to unsend and use the command {pn}"
    }
  },

  langs: {
    en: {
      syntaxError: "Please reply to the bot's message you want to unsend",
      noPermission: "You don't have permission to use this command."
    }
  },

  onStart: async function ({ message, event, api, getLang }) {
    // Admin permission চেক
    if (!config.adminBot.includes(event.senderID)) {
      return message.reply(getLang("noPermission"));
    }

    // চেক করো reply আছে কি না এবং reply করা ম্যাসেজ বটের কি না
    if (!event.messageReply || event.messageReply.senderID !== api.getCurrentUserID()) {
      return message.reply(getLang("syntaxError"));
    }

    // Unsend করো reply করা ম্যাসেজটা
    message.unsend(event.messageReply.messageID);
  }
};
