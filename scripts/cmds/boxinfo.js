const fs = require("fs-extra");
const request = require("request");

module.exports = {
  config: {
    name: "boxinfo",
    aliases: ["boxinfo", "gpinfo", "groupinfo", "grpinfo"],
    version: "1.0",
    author: "Nur",
    countDown: 5,
    role: 0,
    shortDescription: "See Box info",
    longDescription: "See groupinfo",
    category: "group",
    guide: {
      en: "{p} [groupinfo|boxinfo] [thread_id]",
    }
  },

  onStart: async function ({ api, event, args }) {
    // Check if a thread ID was provided as an argument
    const threadID = args[0] ? args[0] : event.threadID;
    
    try {
      let threadInfo = await api.getThreadInfo(threadID);
      var memLength = threadInfo.participantIDs.length;
      var gendernam = [];
      var gendernu = [];
      var nope = [];

      for (let user of threadInfo.userInfo) {
        let gender = user.gender;
        let name = user.name;
        if (gender === "MALE") gendernam.push(name);
        else if (gender === "FEMALE") gendernu.push(name);
        else nope.push(name);
      }

      var nam = gendernam.length;
      var nu = gendernu.length;
      var listad = "";
      var qtv2 = threadInfo.adminIDs;
      let qtv = qtv2.length;
      let sl = threadInfo.messageCount;
      let icon = threadInfo.emoji || "𝐃𝐞𝐟𝐚𝐮𝐥𝐭";
      let threadName = threadInfo.threadName;
      let id = threadInfo.threadID;

      for (let admin of qtv2) {
        const infu = await api.getUserInfo(admin.id);
        const name = infu[admin.id].name;
        listad += `• ${name}\n`;
      }

      let approvalMode = threadInfo.approvalMode ? "Turned on" : "Turned off";

      let messageBody = `💢 𝗚𝗿𝗼𝘂𝗽 𝗡𝗮𝗺𝗲 : ${threadName}\n
💢 𝗜𝗗 : ${id}
💢 𝗔𝗽𝗽𝗿𝗼𝘃𝗮𝗹 : ${approvalMode}
💢 𝗘𝗺𝗼𝗷𝗶 : ${icon}
💢 𝗠𝗲𝗺𝗯𝗲𝗿𝘀 : ${memLength}
💢 𝗠𝗮𝗹𝗲𝘀 : ${nam}
💢 𝗙𝗲𝗺𝗮𝗹𝗲𝘀 : ${nu}
💢 𝗧𝗼𝘁𝗮𝗹 𝗔𝗱𝗺𝗶𝗻𝘀 : ${qtv}\n「 𝗔𝗱𝗺𝗶𝗻𝘀 」\n${listad}
💬 𝗧𝗼𝘁𝗮𝗹 𝗺𝗲𝘀𝘀𝗮𝗴𝗲𝘀 : ${sl} .\n\n𝐌𝐚𝐝𝐞 𝐖𝐢𝐭𝐡..ALit!`;

      // If no group image, send text message only
      if (!threadInfo.imageSrc) {
        return api.sendMessage(messageBody, event.threadID, event.messageID);
      }

      try {
        // Download the image and send with message
        const path = __dirname + "/cache/boxinfo.jpg";
        await new Promise((resolve, reject) => {
          request(encodeURI(threadInfo.imageSrc))
            .pipe(fs.createWriteStream(path))
            .on("finish", resolve)
            .on("error", reject);
        });

        return api.sendMessage(
          {
            body: messageBody,
            attachment: fs.createReadStream(path),
          },
          event.threadID,
          () => fs.unlinkSync(path),
          event.messageID
        );
      } catch (error) {
        console.error("Error downloading image:", error);
        return api.sendMessage(messageBody, event.threadID, event.messageID);
      }
    } catch (error) {
      return api.sendMessage(`Error: Could not get information for thread ID ${threadID}. Make sure the ID is correct and the bot is a member of that group.`, event.threadID, event.messageID);
    }
  }
};