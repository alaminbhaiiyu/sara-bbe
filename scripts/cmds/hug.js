const axios = require("axios");
const fs = require("fs-extra");

module.exports = {
    config: {
        name: "hug",
        version: "1.1",
        author: "SiAM",
        countDown: 5,
        role: 0,
        shortDescription: {
            en: "Send a hug gif to one or two users via mention, reply, or uid.",
        },
        longDescription: {
            en: "This command sends a hug gif to one or two users. Works with mentions, replies, or direct uid input.",
        },
        category: "funny",
        guide: {
            en: "To use this command:\n- Type /hug @user to hug someone\n- Type /hug @user1 @user2 for two users hugging\n- Reply to someone's message with /hug\n- Type /hug UID to hug by user ID",
        },
    },

    onStart: async function ({
        api,
        args,
        message,
        event,
        threadsData,
        usersData,
        dashBoardData,
        globalData,
        threadModel,
        userModel,
        dashBoardModel,
        globalModel,
        role,
        commandName,
        getLang,
    }) {
        const { getPrefix } = global.utils;
        const p = getPrefix(event.threadID);
        const approvedmain = JSON.parse(fs.readFileSync(`${__dirname}/assist_json/approved_main.json`));
        const bypassmain = JSON.parse(fs.readFileSync(`${__dirname}/assist_json/bypass_id.json`));
        const bypassmUid = event.senderID;
        
        // Permission check
        if (bypassmain.includes(bypassmUid)) {
            console.log(`User ${bypassmUid} is in bypass list. Skipping the main approval check.`);
        } else {
            const threadmID = event.threadID;
            if (!approvedmain.includes(threadmID)) {
                const msgSend = message.reply(`cmd 'hug' is locked 🔒...\n Reason : Bot's main cmd \nyou need permission to use all main cmds.\n\nType ${p}requestMain to send a request to admin`);
                setTimeout(async () => {
                    message.unsend((await msgSend).messageID);
                }, 40000);
                return;
            }
        }

        let uid1 = null;
        let uid2 = null;
        const input = args.join(" ");

        // Check if there's a reply
        if (event.messageReply) {
            uid1 = event.senderID; // Person who replied
            uid2 = event.messageReply.senderID; // Person being replied to
        }
        // Check for mentions
        else if (event.mentions && Object.keys(event.mentions).length > 0) {
            if (Object.keys(event.mentions).length === 2) {
                uid1 = Object.keys(event.mentions)[0];
                uid2 = Object.keys(event.mentions)[1];
            } else {
                uid1 = event.senderID;
                uid2 = Object.keys(event.mentions)[0];
            }
        }
        // Check for direct UID input
        else if (args.length > 0 && /^\d+$/.test(args[0])) {
            uid1 = event.senderID;
            uid2 = args[0];
            
            // Check for second UID if provided
            if (args.length > 1 && /^\d+$/.test(args[1])) {
                uid1 = args[0];
                uid2 = args[1];
            }
        } else {
            return message.reply("Please mention a user, reply to a message, or provide a user ID to send a hug gif.");
        }

        // Special case check for SiAM
        const siamUID = '100034630383353';
        if ((uid1 === siamUID || uid2 === siamUID) && uid1 !== siamUID && uid2 !== siamUID) {
            message.reply("sorry🥱💁\n\nI only hug Nur 😌💗");
            return;
        }

        try {
            // Get user info for both users
            const userInfo1 = await api.getUserInfo(uid1);
            const userInfo2 = await api.getUserInfo(uid2);
            
            if (!userInfo1[uid1] || !userInfo2[uid2]) {
                return message.reply("Could not find user information. Please check the provided user IDs.");
            }
            
            const userName1 = userInfo1[uid1].name.split(' ').pop();
            const userName2 = userInfo2[uid2].name.split(' ').pop();

            const apiUrl = "https://nekos.best/api/v2/hug?amount=1";
            const response = await axios.get(apiUrl);
            const gifUrl = response.data.results[0].url;
            
            const imageResponse = await axios.get(gifUrl, { responseType: "arraybuffer" });
            const outputBuffer = Buffer.from(imageResponse.data, "binary");
            const outputPath = `${__dirname}/cache/${uid1}_${uid2}_hug.gif`;
            
            fs.writeFileSync(outputPath, outputBuffer);

            message.reply({
                body: `${userName1} 🤗 ${userName2}`,
                attachment: fs.createReadStream(outputPath),
            }, () => fs.unlinkSync(outputPath));
            
        } catch (error) {
            console.error(error);
            message.reply("There was an error processing the hug gif. Please try again later.");
        }
    },
};