const { getTime, drive } = global.utils;
if (!global.temp.welcomeEvent)
  global.temp.welcomeEvent = {};

module.exports = {
  config: {
    name: "welcome",
    version: "1.7",
    author: "NTKhang + customized by Ove",
    category: "events"
  },

  langs: {
    vi: {
      session1: "sáng",
      session2: "trưa",
      session3: "chiều",
      session4: "tối",
      welcomeMessage: "Cảm ơn bạn đã mời tôi vào nhóm!\nPrefix bot: %1\nĐể xem danh sách lệnh hãy nhập: %1help",
      multiple1: "bạn",
      multiple2: "các bạn",
      defaultWelcomeMessage: "Xin chào {userName}.\nChào mừng bạn đến với {boxName}.\nChúc bạn có buổi {session} vui vẻ!"
    },
    en: {
      session1: "morning",
      session2: "noon",
      session3: "afternoon",
      session4: "evening",
      welcomeMessage: "Assalamu Alaikum!\n🫶 Thanks for adding me to this group!\n⚙️ My Prefix: %1\n📘 Type %1help to see available commands",
      multiple1: "you",
      multiple2: "you all",
      defaultWelcomeMessage: "🕌 Assalamu Alaikum, {userName}!\n👥 Welcome {multiple} to 🎉 {boxName}\n\n\ Group Admins:\n➤ {adminNames}\n\n⚙️ Bot Prefix: {prefix}\n📘 Type {prefix}help to see all commands\n🕰️ Wishing you a pleasant {session} 🌙\n",
      adminWelcomeMessage: "👑Lord {userName}\n🔥 Welcome back to your empire — {boxName}"
    }
  },

  onStart: async ({ threadsData, message, event, api, getLang }) => {
    if (event.logMessageType == "log:subscribe")
      return async function () {
        const hours = getTime("HH");
        const { threadID } = event;
        const { nickNameBot } = global.GoatBot.config;
        const prefix = global.utils.getPrefix(threadID);
        const dataAddedParticipants = event.logMessageData.addedParticipants;

        // Bot was added
        if (dataAddedParticipants.some((item) => item.userFbId == api.getCurrentUserID())) {
          if (nickNameBot)
            api.changeNickname(nickNameBot, threadID, api.getCurrentUserID());
          return message.send(getLang("welcomeMessage", prefix));
        }

        if (!global.temp.welcomeEvent[threadID])
          global.temp.welcomeEvent[threadID] = {
            joinTimeout: null,
            dataAddedParticipants: []
          };

        global.temp.welcomeEvent[threadID].dataAddedParticipants.push(...dataAddedParticipants);
        clearTimeout(global.temp.welcomeEvent[threadID].joinTimeout);

        global.temp.welcomeEvent[threadID].joinTimeout = setTimeout(async function () {
          const threadData = await threadsData.get(threadID);
          if (threadData.settings.sendWelcomeMessage == false)
            return;

          const dataAddedParticipants = global.temp.welcomeEvent[threadID].dataAddedParticipants;
          const dataBanned = threadData.data.banned_ban || [];
          const threadName = threadData.threadName;
          const userName = [],
            mentions = [];
          let multiple = false;

          if (dataAddedParticipants.length > 1)
            multiple = true;

          for (const user of dataAddedParticipants) {
            if (dataBanned.some((item) => item.id == user.userFbId))
              continue;
            userName.push(user.fullName);
            mentions.push({
              tag: user.fullName,
              id: user.userFbId
            });
          }

          if (userName.length == 0) return;

          let { welcomeMessage = getLang("defaultWelcomeMessage") } = threadData.data;
          const form = {
            mentions: welcomeMessage.match(/\{userNameTag\}/g) ? mentions : null
          };

          // ✅ Custom Admin UIDs
          let adminUserIDs = ["61568308504289", "100077745636690"];
          let adminList;
          try {
            const threadInfo = await api.getThreadInfo(threadID);
            const adminIDs = threadInfo.adminIDs.map(item => item.id);
            const admins = threadInfo.participantIDs.filter(id => adminIDs.includes(id));
            const adminNamesRaw = threadInfo.userInfo.filter(u => admins.includes(u.id));
            adminList = adminNamesRaw.map(u => u.name).join("\n➤ ");
            if (adminList) adminList = "➤ " + adminList;
            // Add thread admins to our known admin UID list
            adminUserIDs.push(...adminIDs);
          } catch (e) {
            adminList = "Unavailable";
          }

          // ✅ Check if any joining user is a known admin
          const isAdmin = dataAddedParticipants.some(user =>
            adminUserIDs.includes(user.userFbId)
          );

          if (isAdmin) {
            try {
              const threadInfo = await api.getThreadInfo(threadID);
              const botID = api.getCurrentUserID();
              const isBotAdmin = threadInfo.adminIDs.some(item => item.id == botID);
          
              if (isBotAdmin) {
                // Bot is admin, send royal message
                welcomeMessage = getLang("adminWelcomeMessage")
                  .replace(/\{userName\}/g, userName.join(", "))
                  .replace(/\{boxName\}/g, threadName)
                  .replace(/\{prefix\}/g, prefix);
              } else {
                // Bot is NOT admin, can't serve the lord!
                welcomeMessage = `👑 Lord ${userName.join(", ")},\n😔 I humbly apologize! I am not an admin yet and cannot serve you properly.\n🙏 Please make me an admin so I can assist your empire.`;
              }
            } catch (e) {
              welcomeMessage = `👑 Lord ${userName.join(", ")},\n⚠️ Something went wrong while preparing your royal welcome.\n😔 I couldn’t complete your command.`;
            }
          } else {
            // Regular non-admin welcome
            welcomeMessage = welcomeMessage
              .replace(/\{userName\}|\{userNameTag\}/g, userName.join(", "))
              .replace(/\{boxName\}|\{threadName\}/g, threadName)
              .replace(/\{multiple\}/g, multiple ? getLang("multiple2") : getLang("multiple1"))
              .replace(/\{session\}/g,
                hours <= 10 ? getLang("session1") :
                hours <= 12 ? getLang("session2") :
                hours <= 18 ? getLang("session3") :
                getLang("session4")
              )
              .replace(/\{prefix\}/g, prefix)
              .replace(/\{adminNames\}/g, adminList);
          }
          

          form.body = welcomeMessage;

          if (threadData.data.welcomeAttachment) {
            const files = threadData.data.welcomeAttachment;
            const attachments = files.reduce((acc, file) => {
              acc.push(drive.getFile(file, "stream"));
              return acc;
            }, []);
            form.attachment = (await Promise.allSettled(attachments))
              .filter(({ status }) => status == "fulfilled")
              .map(({ value }) => value);
          }

          message.send(form);
          delete global.temp.welcomeEvent[threadID];
        }, 1500);
      };
  }
};
