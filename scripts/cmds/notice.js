const { getStreamsFromAttachment } = global.utils;

module.exports = {
  config: {
    name: "notice",
    version: "3.0",
    author: "Alamin Modified",
    role: 2,
    shortDescription: "Send notice to user/group",
    longDescription: "Send notice to inbox, group or selected numbers",
    category: "owner",
    guide: ".notice <message> : all | allgc | user <rank/uid> | group <rank/uid>"
  },

  onStart: async function ({ api, event, message, args }) {
    const fullInput = args.join(" ").trim();

    // যদি ইনপুট ফাঁকা হয়, বা শুধুমাত্র লিস্ট দেখতে চায়
    if (!fullInput.includes(":")) {
      // ইউজার ও গ্রুপ লিস্ট দেখাও
      const allThreads = await api.getThreadList(1000, null, ["INBOX"]);
      const users = allThreads.filter(t => !t.isGroup);
      const groups = allThreads.filter(t => t.isGroup);

      let reply = `🧑‍💻 ইউজার তালিকা:\n`;
      users.forEach((u, i) => {
        reply += `${i + 1}. ${u.name || "Unknown"} (${u.threadID})\n`;
      });

      reply += `\n👥 গ্রুপ তালিকা:\n`;
      groups.forEach((g, i) => {
        reply += `${i + 1}. ${g.name || "Unknown"} (${g.threadID})\n`;
      });

      reply += `\n💡 ব্যবহার:\n.notice <message> : all | allgc | user <rank/uid> | group <rank/uid>`;
      return message.reply(reply);
    }

    // এখানে message আর command দুই ভাগে ভাগ করবো
    const splitIndex = fullInput.indexOf(":");
    const msg = fullInput.slice(0, splitIndex).trim();
    let cmd = fullInput.slice(splitIndex + 1).trim().toLowerCase();

    // আলাদা করে message ফরম্যাট করা
    const decoratedMsg = `━━━━━━━━━━━━━━━━━━\n🔊 𝐌𝐞𝐬𝐬𝐚𝐠𝐞 𝐅𝐫𝐨𝐦 𝐀𝐝𝐦𝐢𝐧\n━━━━━━━━━━━━━━━━━━\n\n${msg}`;

    const formSend = {
      body: decoratedMsg,
      attachment: await getStreamsFromAttachment([
        ...event.attachments,
        ...(event.messageReply?.attachments || [])
      ])
    };

    const allThreads = await api.getThreadList(1000, null, ["INBOX"]);
    const users = allThreads.filter(t => !t.isGroup);
    const groups = allThreads.filter(t => t.isGroup);
    let targets = [];

    // যদি শুধু সংখ্যা (rank) দেওয়া হয়, সেটা বুঝিয়ে ফেলি
    // যদি cmd হয় শুধুমাত্র সংখ্যা, তাহলে ধরে নেব user list থেকে
    if (/^\d+$/.test(cmd)) {
      const index = parseInt(cmd) - 1;
      if (users[index]) {
        targets = [users[index]];
      }
    } else if (cmd === "all") {
      targets = [...users, ...groups];
    } else if (cmd === "allgc") {
      targets = [...groups];
    } else if (cmd.startsWith("user ")) {
      const key = cmd.slice(5).trim();
      const index = parseInt(key) - 1;
      if (!isNaN(index) && users[index]) {
        targets = [users[index]];
      } else {
        const found = users.find(u => u.threadID === key);
        if (found) targets = [found];
      }
    } else if (cmd.startsWith("group ")) {
      const key = cmd.slice(6).trim();
      const index = parseInt(key) - 1;
      if (!isNaN(index) && groups[index]) {
        targets = [groups[index]];
      } else {
        const found = groups.find(g => g.threadID === key);
        if (found) targets = [found];
      }
    } else {
      return message.reply(
        "❌ ভুল ফরম্যাট! সঠিকভাবে ব্যবহার করুন:\n.notice <msg> : all | allgc | user <rank/uid> | group <rank/uid>\nঅথবা শুধুমাত্র সংখ্যা লিখে ইউজার সিলেক্ট করুন।"
      );
    }

    if (targets.length === 0) {
      return message.reply("কোনো বৈধ লক্ষ্য পাওয়া যায়নি।");
    }

    let success = 0;
    let fail = [];

    for (const t of targets) {
      try {
        await api.sendMessage(formSend, t.threadID);
        success++;
      } catch (e) {
        fail.push(t.threadID);
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    message.reply(
      `✅ সফলভাবে পাঠানো হয়েছে ${success} জনকে।${fail.length ? `\n❌ ব্যর্থ UID: ${fail.join(", ")}` : ""}`
    );
  }
};
