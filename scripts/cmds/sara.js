const axios = require("axios");

module.exports = {
  config: {
    name: "alit",
    version: "1.0",
    author: "Alamin",
    countDown: 0,
    role: 0,
    description: {
      en: "Auto chat & learning bot using Alit API"
    },
    category: "ai"
  },

  onStart: async function () {},

  onChat: async function({ api, event }) {
    const message = event.body?.toLowerCase().trim();
    if (!message) return;

    const triggerWords = ["bby", "bbe", "hi", "hlw", "yo", "hey"];
    if (!triggerWords.includes(message)) return;

    try {
      const res = await axios.get(`https://alit-x-api.onrender.com/api/sarachat?text=${encodeURIComponent(message)}`);
      const data = res.data;

      if (data?.answer && !data?.error) {
        return api.sendMessage(data.answer, event.threadID, (err, info) => {
          if (!err && info) {
            global.GoatBot.onReply.set(info.messageID, {
              commandName: "alit",
              messageID: info.messageID,
              question: message,
              fromApi: true,
              canLearn: true,
              senderName: event.senderID
            });
          }
        }, event.messageID);
      } else {
        return api.sendMessage("ami eita jani nah... reply din sikhe nebo!", event.threadID, (err, info) => {
          if (!err && info) {
            global.GoatBot.onReply.set(info.messageID, {
              commandName: "alit",
              messageID: info.messageID,
              question: message,
              fromApi: false,
              canLearn: true,
              senderName: event.senderID
            });
          }
        }, event.messageID);
      }
    } catch (e) {
      return api.sendMessage("server error", event.threadID, event.messageID);
    }
  },

  onReply: async function({ api, event, Reply }) {
    const userReply = event.body?.trim();
    if (!userReply) return;

    try {
      const senderInfo = await api.getUserInfo(event.senderID);
      const teacherName = senderInfo?.[event.senderID]?.name || "Unknown";

      // Jodi unknown question er answer hoy
      if (!Reply.fromApi && Reply.canLearn) {
        const learnURL = `https://alit-x-api.onrender.com/api/sikho?question=${encodeURIComponent(Reply.question)}&answer=${encodeURIComponent(userReply)}&teacher=${encodeURIComponent(teacherName)}`;
        const res = await axios.get(learnURL);

        if (res.data?.learnedQuestions) {
          // done react
          api.setMessageReaction("✅", event.messageID, () => {}, true);

          // ask a random question
          const randomRes = await axios.get("https://alit-x-api.onrender.com/api/random-q=");
          const randomData = randomRes.data;

          if (randomData?.question) {
            return api.sendMessage(randomData.question, event.threadID, (err, info) => {
              if (!err && info) {
                global.GoatBot.onReply.set(info.messageID, {
                  commandName: "alit",
                  messageID: info.messageID,
                  question: randomData.question,
                  fromApi: true,
                  canLearn: true,
                  senderName: event.senderID
                });
              }
            });
          }
        }
      }

      // jodi eta random question er uttor hoy
      if (Reply.fromApi && Reply.canLearn) {
        const res = await axios.get(`https://alit-x-api.onrender.com/api/sarachat?text=${encodeURIComponent(userReply)}`);
        const data = res.data;

        if (data?.answer && !data?.error) {
          return api.sendMessage(data.answer, event.threadID, (err, info) => {
            if (!err && info) {
              global.GoatBot.onReply.set(info.messageID, {
                commandName: "alit",
                messageID: info.messageID,
                question: userReply,
                fromApi: true,
                canLearn: true,
                senderName: event.senderID
              });
            }
          }, event.messageID);
        } else {
          return api.sendMessage("ami eita jani nah... reply din sikhe nebo!", event.threadID, (err, info) => {
            if (!err && info) {
              global.GoatBot.onReply.set(info.messageID, {
                commandName: "alit",
                messageID: info.messageID,
                question: userReply,
                fromApi: false,
                canLearn: true,
                senderName: event.senderID
              });
            }
          }, event.messageID);
        }
      }

    } catch (e) {
      return api.sendMessage("Failed teaching", event.threadID, event.messageID);
    }
  }
};