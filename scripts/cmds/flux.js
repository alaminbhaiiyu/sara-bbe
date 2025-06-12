const axios = require("axios");

class Command {
  constructor(config) {
    this.config = config;
    this.count_req = 0;
  }

  async onStart({ event, args, api }) {
    const prompt = args.join(" ");
    const senderID = event.senderID;
    const threadID = event.threadID;
    const messageID = event.messageID;

    if (!prompt) return api.sendMessage("Please provide a prompt to generate image.", threadID, messageID);
    if (senderID == api.getCurrentUserID()) return;

    api.setMessageReaction("⏳", messageID, () => {}, true);

    // Better animation texts with emojis
    const animFrames = [
      "⏳ Generating.",
      "⏳ Generating..",
      "⏳ Generating...",
      "⏳ Generating....",
      "⏳ Please wait",
      "⏳ Please wait..",
      "⏳ Please wait...",
      "⏳ Please wait....",
    ];

    let frameIndex = 0;
    let stopped = false;

    // Step 1: Send initial animated message
    const { messageID: animMessageID } = await api.sendMessage(animFrames[0], threadID);

    // Step 2: Animation loop
    const interval = setInterval(() => {
      if (stopped) return clearInterval(interval);
      this.editMessage(animMessageID, animFrames[frameIndex++ % animFrames.length]);
    }, 500); // smoother & faster animation
    try {
      const startTime = Date.now();
      const apiUrl = `https://alit-x-api.onrender.com/api/fluxv2?prompt=${encodeURIComponent(prompt)}`;
      const res = await axios.get(apiUrl);
      const imageUrl = res.data.url;
      if (!imageUrl) throw new Error("No image URL");

      const endTime = Date.now();
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
      stopped = true;

      await api.unsendMessage(animMessageID);

      await api.sendMessage({
        body: `✨ | Image generated!\n⏱️ Took: ${timeTaken}s`,
        attachment: await global.utils.getStreamFromURL(imageUrl)
      }, threadID);

      api.setMessageReaction("✅", messageID, () => {}, true);
    } catch (err) {
      stopped = true;
      this.editMessage(animMessageID, "❌ Failed to generate image.");
      console.error(err);
      api.setMessageReaction("❌", messageID, () => {}, true);
    }
  }

  editMessage(messageID, text) {
    mqttClient.publish('/ls_req', JSON.stringify({
      "app_id": "2220391788200892",
      "payload": JSON.stringify({
        tasks: [{
          label: '742',
          payload: JSON.stringify({
            message_id: messageID,
            text: text,
          }),
          queue_name: 'edit_message',
          task_id: Math.random() * 1001 << 0,
          failure_count: null,
        }],
        epoch_id: this.generateOfflineThreadingID(),
        version_id: '6903494529735864',
      }),
      "request_id": ++this.count_req,
      "type": 3
    }));
  }

  generateOfflineThreadingID() {
    var ret = Date.now();
    var value = Math.floor(Math.random() * 4294967295);
    var str = ("0000000000000000000000" + value.toString(2)).slice(-22);
    var msgs = ret.toString(2) + str;
    return this.binaryToDecimal(msgs);
  }

  binaryToDecimal(data) {
    var ret = "";
    while (data !== "0") {
      var end = 0;
      var fullName = "";
      var i = 0;
      for (; i < data.length; i++) {
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
}

module.exports = new Command({
  name: "flux",
  aliases: ["f"],
  version: "1.3",
  role: 0,
  author: "DC-Nam x Alamin",
  shortDescription: "Generate AI image with animation",
  longDescription: "Generate image using Flux API with rich animation and auto unsend",
  category: "ai",
  guide: "{pn} <prompt>",
  countDown: 2,
});