const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const jimp = require("jimp");

module.exports = {
  config: {
    name: "married",
    aliases: ["biya","biye","marriage","marry"],
    version: "2.1",
    author: "Nur",
    countDown: 5,
    role: 0,
    shortDescription: {
  en: "Get married to someone"
},
longDescription: {
  en: "Create a marriage certificate with profile pictures"
},
category: "funny",
guide: {
  en: "{@mention} or {@mention1} {@mention2}"
}
  },

  onLoad: async function () {
    const { downloadFile } = global.utils;
    const dirMaterial = path.resolve(__dirname, "cache", "canvas");
    const certificatePath = path.join(dirMaterial, "marriagecertificate.jpg");

    fs.mkdirSync(dirMaterial, { recursive: true });
    if (!fs.existsSync(certificatePath)) {
      const imageURL = "https://i.ibb.co/gZrBtNsY/1747552348342-image.jpg";
      await downloadFile(imageURL, certificatePath);
    }
  },

  squareImage: async function(imagePath) {
    const image = await jimp.read(imagePath);
    
    const size = Math.min(image.getWidth(), image.getHeight());
    
    const x = (image.getWidth() - size) / 2;
    const y = (image.getHeight() - size) / 2;
    
    image.crop(x, y, size, size);
    
    return await image.getBufferAsync("image/png");
  },
  makeImage: async function ({ firstUser, secondUser }) {
    const __root = path.resolve(__dirname, "cache", "canvas");
    const certificatePath = path.join(__root, "marriagecertificate.jpg");
    const outputPath = path.join(__root, `married_${firstUser}_${secondUser}.png`);
    const firstAvatarPath = path.join(__root, `avt_${firstUser}.png`);
    const secondAvatarPath = path.join(__root, `avt_${secondUser}.png`);

    const accessToken = "6628568379|c1e620fa708a1d5696fb991c1bde5662";

    const getAvatar = async (uid, filePath) => {
      try {
        const res = await axios.get(`https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=${accessToken}`, {
          responseType: 'arraybuffer'
        });
        fs.writeFileSync(filePath, Buffer.from(res.data));
        return true;
      } catch (error) {
        console.error(`Error fetching avatar for ${uid}:`, error.message);
        return false;
      }
    };
    await getAvatar(firstUser, firstAvatarPath);
    await getAvatar(secondUser, secondAvatarPath);

    const squaredFirstAvatar = await this.squareImage(firstAvatarPath);
    const squaredSecondAvatar = await this.squareImage(secondAvatarPath);
    
    fs.writeFileSync(firstAvatarPath, squaredFirstAvatar);
    fs.writeFileSync(secondAvatarPath, squaredSecondAvatar);

    const avatar1 = await jimp.read(firstAvatarPath);
    const avatar2 = await jimp.read(secondAvatarPath);
    const certificate = await jimp.read(certificatePath);
    
    const avatarSize = 300; 
    const spacing = 20; 
    const totalWidth = avatarSize * 2 + spacing;
    const avatarHeight = avatarSize;
    const certificateHeight = certificate.getHeight();
    
    const finalImage = new jimp(totalWidth, avatarHeight + certificateHeight, 0xFFFFFFFF);
    
    finalImage.composite(avatar1.resize(avatarSize, avatarSize), 0, 0);
    finalImage.composite(avatar2.resize(avatarSize, avatarSize), avatarSize + spacing, 0);
    finalImage.composite(certificate.resize(totalWidth, certificateHeight), 0, avatarHeight);
    
    const finalBuffer = await finalImage.getBufferAsync("image/png");
    fs.writeFileSync(outputPath, finalBuffer);
    
    fs.unlinkSync(firstAvatarPath);
    fs.unlinkSync(secondAvatarPath);
    
    return outputPath;
  },

  onStart: async function ({ event, api, args }) {
    const { threadID, messageID, senderID, mentions } = event;
    const mentionKeys = Object.keys(mentions);
    
    let firstUser, secondUser;
    
    if (mentionKeys.length === 0) {
      return api.sendMessage("Please mention Your Crush/love to marry.", threadID, messageID);
    } 
    else if (mentionKeys.length === 1) {
      firstUser = senderID;
      secondUser = mentionKeys[0];
    } 
    else {
      firstUser = mentionKeys[0];
      secondUser = mentionKeys[1];
    }
    
    try {
      const imagePath = await this.makeImage({ 
        firstUser, 
        secondUser
      });
      
      const mentions = [];
      let firstUserInfo, secondUserInfo;
      try {
        firstUserInfo = await api.getUserInfo(firstUser);
        secondUserInfo = await api.getUserInfo(secondUser);
      } catch (err) {
        console.error("Error getting user info:", err);
      }
      
      const firstName = firstUserInfo && firstUserInfo[firstUser] ? firstUserInfo[firstUser].name : "User 1";
      const secondName = secondUserInfo && secondUserInfo[secondUser] ? secondUserInfo[secondUser].name : "User 2";
      const messageBody = `${firstName} & ${secondName} got married🫣❤️‍🩹,\nMarriage certificate💖!`;
      
      mentions.push({
        id: firstUser,
        tag: firstName,
        fromIndex: 0
      });
      
      mentions.push({
        id: secondUser,
        tag: secondName,
        fromIndex: firstName.length + 3 
      });
      
      return api.sendMessage(
        {
          body: messageBody,
          mentions: mentions,
          attachment: fs.createReadStream(imagePath)
        },
        threadID,
        () => fs.unlinkSync(imagePath),
        messageID
      );
    } catch (err) {
      console.error(err);
      return api.sendMessage("❌ Failed  to  marry.", threadID, messageID);
    }
  }
};
