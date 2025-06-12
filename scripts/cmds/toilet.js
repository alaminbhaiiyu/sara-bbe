const axios = require('axios');
const jimp = require("jimp");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "toilet",
    aliases: ["toilet"],
    version: "1.1",
    author: "Upen Basnet",
    countDown: 2,
    role: 0,
    shortDescription: "Face on toilet",
    longDescription: "Generate a toilet meme with someone's avatar",
    category: "funny",
    guide: {
      vi: "{pn} [@tag | reply | để trống | uid]",
      en: "{pn} [@tag | reply | leave empty for yourself | uid]"
    }
  },

  onStart: async function ({ message, event, args, usersData }) {
    let uid;
    
    // Check if a UID was provided as an argument
    if (args.length > 0 && /^\d+$/.test(args[0])) {
      uid = args[0];
    }
    // Check if the message is a reply
    else if (event.messageReply) {
      uid = event.messageReply.senderID;
    } 
    // Check if there's a mention
    else if (Object.keys(event.mentions).length > 0) {
      uid = Object.keys(event.mentions)[0];
    } 
    // If no reply, mention, or UID argument, use the sender's ID
    else {
      uid = event.senderID;
    }

    // Protected ID - add your own ID here
    if (uid === "100034630383353") {
      return message.reply("Dure jaye mor 🐸🐸.");
    }

    try {
      // Ensure tmp directory exists
      const tmpDir = path.join(__dirname, "tmp");
      if (!fs.existsSync(tmpDir)){
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      // Get username for better response
      let username = "this person";
      if (usersData && typeof usersData.get === 'function') {
        const userData = await usersData.get(uid);
        if (userData && userData.name) {
          username = userData.name;
        }
      }
      
      // Generate the toilet image
      const pathSave = await generateToiletImage(event.senderID, uid);
      
      await message.reply({
        body: `${username} deserves this place! 🚽🐸`,
        attachment: fs.createReadStream(pathSave),
      });
      
      // Clean up the temporary file after use
      setTimeout(() => {
        if (fs.existsSync(pathSave)) {
          fs.unlinkSync(pathSave);
        }
      }, 5000); // Delete after 5 seconds
    } catch (error) {
      console.error("Error while processing the toilet command:", error);
      message.reply("An error occurred while processing the image.");
    }
  }
};

async function generateToiletImage(one, two) {
  try {    
    // Only get the target user's avatar
    let avatar = await jimp.read(`https://graph.facebook.com/${two}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`);
    avatar.circle();
    
    const pathSave = path.join(__dirname, "tmp", `${two}_Toilet.png`);
    let img = await jimp.read("https://i.imgur.com/sZW2vlz.png");

    img.resize(1080, 1350)
       .composite(avatar.resize(450, 450), 300, 660); // Only place the target's avatar in the toilet

    await img.writeAsync(pathSave);
    return pathSave;
  } catch (error) {
    console.error("Error generating toilet image:", error);
    throw error;
  }
}