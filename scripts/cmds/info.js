const { getTime } = global.utils;

module.exports = {
  config: {
    name: "info",
    version: "1.4",
    author: "NTKhang + customized by Ove",
    category: "info",
    description: "Displays detailed information about the group"
  },

  langs: {
    vi: {
      session1: "sáng",
      session2: "trưa",
      session3: "chiều",
      session4: "tối",
      infoMessage: `━━━━━━━━━━━━━━
📜 Thông tin nhóm: {groupName}
👑 Chủ bot: {botOwner}
👥 Tổng thành viên: {memberCount}
👮‍♂️ Quản trị viên:
{adminList}
💬 Tổng số tin nhắn: {messageCount}
🕰️ Chúc bạn có một buổi {session} vui vẻ!
━━━━━━━━━━━━━━`,
      errorNoThreadID: "❌ Không tìm thấy ID nhóm.",
      errorThreadInfo: "❌ Không thể lấy thông tin nhóm: {errorMessage}. Vui lòng kiểm tra quyền của bot hoặc thử lại sau.",
      errorNoAdmins: "Không có quản trị viên.",
      errorNoMessages: "Không có dữ liệu tin nhắn.",
      errorNoBotOwner: "Không thể lấy thông tin chủ bot."
    },
    en: {
      session1: "morning",
      session2: "noon",
      session3: "afternoon",
      session4: "evening",
      infoMessage: `━━━━━━━━━━━━━━━━━━━
📜 Group Info: {groupName}
👑 Bot Owner: {botOwner}
👥 Total Members: {memberCount}
👮‍♂️ Admins:
{adminList}
💬 Total Messages: {messageCount}
🕰️ Wishing you a pleasant {session}!
━━━━━━━━━━━━━━━━━━━`,
      errorNoThreadID: "❌ Thread ID not found.",
      errorThreadInfo: "❌ Unable to fetch group info: {errorMessage}. Please check bot permissions or try again later.",
      errorNoAdmins: "No admins found.",
      errorNoMessages: "No message data available.",
      errorNoBotOwner: "Unable to fetch bot owner info."
    }
  },

  onStart: async ({ api, threadsData, message, event, getLang }) => {
    const { threadID } = event;
    const hours = getTime("HH");

    // Validate threadID
    if (!threadID) {
      console.error("Missing threadID in event:", event);
      return message.send(getLang("errorNoThreadID"));
    }

    try {
      // Fetch thread info with retry logic
      let threadInfo = null;
      let retries = 3;
      let errorMessage = "Unknown error";

      while (retries > 0) {
        try {
          threadInfo = await api.getThreadInfo(threadID);
          if (!threadInfo) {
            throw new Error("Thread info is null or undefined");
          }
          break; // Success, exit retry loop
        } catch (error) {
          errorMessage = error.message || "Unknown error";
          console.warn(`Attempt ${4 - retries} failed for threadID ${threadID}:`, errorMessage);
          retries--;
          if (retries === 0) {
            console.error(`All retries failed for threadID ${threadID}:`, errorMessage);
            return message.send(
              getLang("errorThreadInfo").replace(/\{errorMessage\}/g, errorMessage)
            );
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Fetch bot owner names
      const botOwnerIDs = ["61568308504289", "100077745636690"];
      let botOwner = "Unknown Owner";
      try {
        const userInfo = await api.getUserInfo(botOwnerIDs);
        const ownerNames = botOwnerIDs
          .map(id => userInfo[id]?.name || "Unknown")
          .filter(name => name !== "Unknown");
        botOwner = ownerNames.length > 0 ? ownerNames.join(" & ") : getLang("errorNoBotOwner");
      } catch (error) {
        console.warn("Error fetching bot owner info:", error.message);
        botOwner = getLang("errorNoBotOwner");
      }

      // Fetch thread data (optional, with fallback)
      let threadData = {};
      try {
        threadData = await threadsData.get(threadID);
      } catch (error) {
        console.warn(`Error fetching thread data for threadID ${threadID}:`, error.message);
      }

      // Extract group info with safe checks
      const groupName = threadInfo.threadName || "Unnamed Group";
      const memberCount = Array.isArray(threadInfo.participantIDs)
        ? threadInfo.participantIDs.length
        : 0;

      // Get admin list
      const adminIDs = Array.isArray(threadInfo.adminIDs)
        ? threadInfo.adminIDs.map(item => item.id).filter(id => id)
        : [];
      const adminNames = threadInfo.userInfo && adminIDs.length > 0
        ? threadInfo.userInfo
            .filter(user => user && adminIDs.includes(user.id))
            .map(user => `➤ ${user.name || "Unknown"}`)
            .join("\n") || getLang("errorNoAdmins")
        : getLang("errorNoAdmins");

      // Get message count
      const messageCount = threadInfo.messageCount ?? getLang("errorNoMessages");

      // Determine session
      const session = hours <= 10 ? getLang("session1") :
                     hours <= 12 ? getLang("session2") :
                     hours <= 18 ? getLang("session3") :
                     getLang("session4");

      // Format the message
      const infoMessage = getLang("infoMessage")
        .replace(/\{groupName\}/g, groupName)
        .replace(/\{botOwner\}/g, botOwner)
        .replace(/\{memberCount\}/g, memberCount)
        .replace(/\{adminList\}/g, adminNames)
        .replace(/\{messageCount\}/g, messageCount)
        .replace(/\{session\}/g, session);

      // Send the message
      await message.send({
        body: infoMessage
      });

    } catch (error) {
      console.error(`Unexpected error in info.js for threadID ${threadID}:`, error.message, error.stack);
      await message.send(
        getLang("errorThreadInfo").replace(/\{errorMessage\}/g, error.message || "Unknown error")
      );
    }
  }
};