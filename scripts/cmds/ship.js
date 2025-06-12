const { resolve } = require("path");
const { existsSync, mkdirSync } = require("fs-extra");

module.exports = {
  config: {
    name: "ship",
    author: "Otineeeeeyyyyyyy",
    countDown: 5,
    role: 0,
    category: "fun",
    shortDescription: {
      en: "Randomly pairs you with someone in the group and shows your match with an image.",
    },
  },

  // Runs when the bot is loaded
  onLoad: async function () {
    const { downloadFile } = global.utils;
    const dirMaterial = __dirname + "/cache/canvas/";
    const path = resolve(__dirname, "cache/canvas", "pairing.jpg");

    // Create the folder if it doesn't exist
    if (!existsSync(dirMaterial)) mkdirSync(dirMaterial, { recursive: true });

    // Download the base image if it doesn't exist
    if (!existsSync(path)) {
      await downloadFile("https://i.pinimg.com/736x/15/fa/9d/15fa9d71cdd07486bb6f728dae2fb264.jpg", path);
    }
  },

  // Generates the image with both profile pictures
  makeImage: async function ({ one, two }) {
    const fs = require("fs-extra");
    const path = require("path");
    const axios = require("axios");
    const jimp = require("jimp");

    const __root = path.resolve(__dirname, "cache", "canvas");
    let pairing_img = await jimp.read(__root + "/pairing.jpg");

    let outputPath = __root + `/pairing_${one}_${two}.png`;
    let avatarOnePath = __root + `/avLt_${one}.png`;
    let avatarTwoPath = __root + `/avLt_${two}.png`;

    // Download profile pictures
    let avatarOneData = (await axios.get(`https://graph.facebook.com/${one}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`, { responseType: 'arraybuffer' })).data;
    fs.writeFileSync(avatarOnePath, Buffer.from(avatarOneData, 'utf-8'));

    let avatarTwoData = (await axios.get(`https://graph.facebook.com/${two}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`, { responseType: 'arraybuffer' })).data;
    fs.writeFileSync(avatarTwoPath, Buffer.from(avatarTwoData, 'utf-8'));

    // Process and place circular avatars on the base image
    let circleOne = await jimp.read(await this.circle(avatarOnePath));
    let circleTwo = await jimp.read(await this.circle(avatarTwoPath));

    pairing_img.composite(circleOne.resize(85, 85), 355, 100);
    pairing_img.composite(circleTwo.resize(75, 75), 250, 140);

    // Save the final image
    let finalImage = await pairing_img.getBufferAsync("image/png");
    fs.writeFileSync(outputPath, finalImage);

    // Clean up temporary avatar files
    fs.unlinkSync(avatarOnePath);
    fs.unlinkSync(avatarTwoPath);

    return outputPath;
  },

  // Make avatar image circular
  circle: async function (image) {
    const jimp = require("jimp");
    image = await jimp.read(image);
    image.circle();
    return await image.getBufferAsync("image/png");
  },

  // Main function when user runs the command
  onStart: async function ({ api, event, args, usersData, threadsData }) {
    const axios = require("axios");
    const fs = require("fs-extra");
    const { threadID, messageID, senderID } = event;

    const compatibility = ['21%', '67%', '19%', '37%', '17%', '96%', '52%', '62%', '76%', '83%', '100%', '99%', "0%", "48%"];
    const matchPercent = compatibility[Math.floor(Math.random() * compatibility.length)];

    // Get sender info
    let senderData = await api.getUserInfo(senderID);
    let senderName = senderData[senderID].name;

    // Get a random person from the group
    let threadInfo = await api.getThreadInfo(threadID);
    let members = threadInfo.participantIDs;
    let randomID = members[Math.floor(Math.random() * members.length)];

    // Get matched user's info
    let matchedData = await api.getUserInfo(randomID);
    let matchedName = matchedData[randomID].name;

    // Mentions
    let mentions = [
      { id: senderID, tag: senderName },
      { id: randomID, tag: matchedName }
    ];

    // Determine gender label
    let gender = matchedData[randomID].gender;
    let genderText = gender === 2 ? "Male 🧑" : gender === 1 ? "Female 👩‍" : "Unknown";

    // Generate and send image
    return this.makeImage({ one: senderID, two: randomID }).then(async imagePath => {
      const message = {
        body: `💘 ${senderName} is paired with ${matchedName} (${genderText}) 💘\n\nTags: ${mentions.map(tag => `@${tag.tag}`).join(" ")}`,
        mentions: mentions,
        attachment: fs.createReadStream(imagePath),
      };

      api.sendMessage(message, threadID, async () => {
        try {
          fs.unlinkSync(imagePath); // Delete image after sending
        } catch (e) {
          console.log(e);
        }
      }, messageID);
    }).catch(e => console.log(e));
  },
};
