const moment = require("moment-timezone");
const config = require("../../config.json"); // adminBot UID list

module.exports = {
  config: {
    name: "accept",
    aliases: ['acp'],
    version: "1.1",
    author: "alit+ Modded",
    countDown: 8,
    role: 2,
    shortDescription: "Accept/Delete your friend requests",
    longDescription: "Only allows admin UIDs from config to accept/delete their own friend requests",
    category: "Owner",
  },

  onReply: async function ({ message, Reply, event, api, commandName }) {
    const { author, listRequest, messageID } = Reply;
    if (author !== event.senderID) return;

    const args = event.body.replace(/ +/g, " ").toLowerCase().split(" ");
    clearTimeout(Reply.unsendTimeout);

    const form = {
      av: api.getCurrentUserID(),
      fb_api_caller_class: "RelayModern",
      variables: {
        input: {
          source: "friends_tab",
          actor_id: api.getCurrentUserID(),
          client_mutation_id: Math.round(Math.random() * 19).toString()
        },
        scale: 3,
        refresh_num: 0
      }
    };

    const success = [];
    const failed = [];

    if (args[0] === "add") {
      form.fb_api_req_friendly_name = "FriendingCometFriendRequestConfirmMutation";
      form.doc_id = "3147613905362928";
    } else if (args[0] === "del") {
      form.fb_api_req_friendly_name = "FriendingCometFriendRequestDeleteMutation";
      form.doc_id = "4108254489275063";
    } else {
      return api.sendMessage(
        "⚠️ Please use the correct format:\n\n📌 Examples:\n- add 1\n- del 3\n- add all",
        event.threadID,
        event.messageID
      );
    }

    let targetIDs = args.slice(1);
    if (args[1] === "all") {
      targetIDs = listRequest.map((_, index) => index + 1);
    }

    const newTargetIDs = [];
    const promiseFriends = [];

    for (const stt of targetIDs) {
      const u = listRequest[parseInt(stt) - 1];
      if (!u) {
        failed.push(`❌ Invalid index: #${stt}`);
        continue;
      }

      form.variables.input.friend_requester_id = u.node.id;
      form.variables = JSON.stringify(form.variables);
      newTargetIDs.push(u);
      promiseFriends.push(api.httpPost("https://www.facebook.com/api/graphql/", form));
      form.variables = JSON.parse(form.variables);
    }

    for (let i = 0; i < newTargetIDs.length; i++) {
      try {
        const friendRequest = await promiseFriends[i];
        if (JSON.parse(friendRequest).errors) {
          failed.push(newTargetIDs[i].node.name);
        } else {
          success.push(newTargetIDs[i].node.name);
        }
      } catch (e) {
        failed.push(newTargetIDs[i].node.name);
      }
    }

    if (success.length > 0) {
      api.sendMessage(
        `✅ Successfully ${args[0] === 'add' ? 'accepted' : 'deleted'} ${success.length} friend request(s):\n\n🔹 ${success.join("\n🔹 ")}` +
        (failed.length > 0 ? `\n\n❌ Failed to process ${failed.length}:\n🔻 ${failed.join("\n🔻 ")}` : ""),
        event.threadID,
        event.messageID
      );
    } else {
      api.unsendMessage(messageID);
      api.sendMessage("❌ No requests were processed. Possibly invalid input or all failed.", event.threadID);
    }

    api.unsendMessage(messageID);
  },

  onStart: async function ({ event, api, commandName }) {
    const adminList = config.adminBot || [];
    if (!adminList.includes(event.senderID)) {
      return api.sendMessage("⛔ You are not authorized to use this command.", event.threadID, event.messageID);
    }

    const form = {
      av: api.getCurrentUserID(),
      fb_api_req_friendly_name: "FriendingCometFriendRequestsRootQueryRelayPreloader",
      fb_api_caller_class: "RelayModern",
      doc_id: "4499164963466303",
      variables: JSON.stringify({ input: { scale: 3 } })
    };

    try {
      const listRequest = JSON.parse(await api.httpPost("https://www.facebook.com/api/graphql/", form))
        .data.viewer.friending_possibilities.edges;

      if (listRequest.length === 0) {
        return api.sendMessage("🎉 You have no pending friend requests.", event.threadID, event.messageID);
      }

      let msg = `👥 Pending Friend Requests (${listRequest.length}):\n`;

      listRequest.forEach((user, index) => {
        msg += `\n${index + 1}. 📛 Name: ${user.node.name}` +
               `\n🆔 ID: ${user.node.id}` +
               `\n🔗 Profile: ${user.node.url.replace("www.facebook", "fb")}` +
               `\n⏰ Requested At: ${moment(user.time * 1009).tz("Asia/Manila").format("DD/MM/YYYY hh:mm:ss A")}\n`;
      });

      msg += `\n📌 Reply with:\n- add <number>\n- del <number>\n- add all`;

      api.sendMessage(msg, event.threadID, (e, info) => {
        global.GoatBot.onReply.set(info.messageID, {
          commandName,
          messageID: info.messageID,
          listRequest,
          author: event.senderID,
          unsendTimeout: setTimeout(() => {
            api.unsendMessage(info.messageID);
          }, this.config.countDown * 20000)
        });
      }, event.messageID);

    } catch (err) {
      api.sendMessage("⚠️ Error fetching friend requests.", event.threadID, event.messageID);
      console.error(err);
    }
  }
};
