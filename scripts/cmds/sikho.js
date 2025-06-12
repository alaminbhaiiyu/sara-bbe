const axios = require("axios");

module.exports = {
  config: {
    name: "sikho",
    aliases: ["teach","shiko","shikho"],
    version: "1.3",
    author: "Al Amin",
    countDown: 5,
    role: 0,
    shortDescription: "Shikhai question answer",
    longDescription: "Multiple question-answer pair ek sathe shikhai",
    category: "ai",
    guide: {
      en: ".sikho Question1:Ans1,Ans2\nQuestion2:Ans1"
    }
  },

  onStart: async function ({ message, event, args, usersData }) {
    const input = args.join(" ").trim();

    if (!input.includes(":")) {
      return message.reply("Please provide in correct format:\n.sikho Question:Ans1,Ans2");
    }

    const lines = input.split("\n");
    const userInfo = await usersData.get(event.senderID);
    const teacher = userInfo?.name || "Unknown";

    let questions = [];
    let answers = [];

    for (const line of lines) {
      const [rawQ, rawA] = line.split(":");
      if (!rawQ || !rawA) continue;

      const question = rawQ.trim();
      const ansList = rawA
        .split(",")
        .map(ans => ans.trim())
        .filter(Boolean)
        .join(",");

      if (question && ansList) {
        questions.push(question);
        answers.push(ansList);
      }
    }

    if (questions.length === 0 || answers.length === 0) {
      return message.reply("Kono valid question-answer pair deya hoyni.");
    }

    const apiURL = `https://alit-x-api.onrender.com/api/sikho?question=${encodeURIComponent(
      questions.join("-")
    )}&answer=${encodeURIComponent(answers.join("-"))}&teacher=${encodeURIComponent(teacher)}`;

    try {
      const res = await axios.get(apiURL);
      const data = res.data;

      if (!data || !data.learned) {
        return message.reply("API response thik moto aseni.");
      }

      const msg = `Learned ${data.learned} questions from ${data.teacher}\nYou teach total ${data.learnedQuestions} questions and ${data.learnedAnser} answers.`;

      return message.reply(msg);
    } catch (err) {
      console.error(err);
      return message.reply("API call e somossa hoyeche.");
    }
  }
};