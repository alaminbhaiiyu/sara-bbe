module.exports = {
  config: {
    name: "alamin",
    aliases: ["a", "alamin"],
    version: "1.0",
    author: "Alamin",
    countDown: 5,
    role: 0,
    longDescription: "Provides information about Alamin and shares contact",
    category: "info",
    guide: {
      en: "{pn}"
    }
  },

  onStart: async function ({ api, event, message }) {
    const { threadID } = event;

    const id = "100077745636690"; // ✅ নির্দিষ্ট ফেসবুক আইডি

    // 📤 প্রথমে পরিচিতি টেক্সট ও কন্টাক্ট একসাথে পাঠাও
    api.shareContact(
      "👋 Hi! I'm Alamin – a graphic designer, developer, and digital creator.\n📞 Here's how you can reach me:",
      id,
      threadID
    );
  }
};
