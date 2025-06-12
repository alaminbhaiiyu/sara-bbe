const axios = require("axios");
const fs = require("fs-extra");
const request = require("request");

module.exports = {
	config: {
		name: "join",
		version: "2.0",
		author: "Kshitiz",
		countDown: 5,
		role: 0,
		shortDescription: "Join the group that bot is in",
		longDescription: "",
		category: "owner",
		guide: {
			en: "{p}{n}",
		},
	},

	onStart: async function ({ api, event }) {
		try {
			const groupList = await api.getThreadList(20, null, ['INBOX']);
	
			const filteredList = groupList.filter(
				group => group.isGroup
			);
	
			if (filteredList.length === 0) {
				api.sendMessage('❌ No group chats found.', event.threadID);
				return;
			}
	
			const detailedList = await Promise.all(
				filteredList.map(async group => {
					const info = await api.getThreadInfo(group.threadID);
					return {
						threadID: group.threadID,
						threadName: info.threadName || "Unnamed Group",
						memberCount: info.participantIDs.length
					};
				})
			);
	
			const formattedList = detailedList.map((group, index) =>
				`│${index + 1}. ${group.threadName}\n│𝐓𝐈𝐃: ${group.threadID}\n│𝐌𝐞𝐦𝐛𝐞𝐫𝐬: ${group.memberCount}\n│`
			);
	
			const message = `╭──── 𝐆𝐑𝐎𝐔𝐏 𝐋𝐈𝐒𝐓 ────╮\n${formattedList.join("\n")}\n╰──────────────────────╯\n📌 Max Members per Group = 250\n\n📥 Reply with the number of the group you want to join.`;
	
			const sentMessage = await api.sendMessage(message, event.threadID);
			global.GoatBot.onReply.set(sentMessage.messageID, {
				commandName: 'join',
				messageID: sentMessage.messageID,
				author: event.senderID,
				groupList: detailedList
			});
	
		} catch (error) {
			console.error("❌ Error listing group chats:", error);
			api.sendMessage("❌ Error occurred while retrieving group list.", event.threadID);
		}
	},
	

	onReply: async function ({ api, event, Reply, args }) {
		const { author, commandName } = Reply;

		if (event.senderID !== author) {
			return;
		}

		const groupIndex = parseInt(args[0], 10);

		if (isNaN(groupIndex) || groupIndex <= 0) {
			api.sendMessage('Invalid input.\nPlease provide a valid number.', event.threadID, event.messageID);
			return;
		}

		try {
			const groupList = await api.getThreadList(10, null, ['INBOX']);
			const filteredList = groupList.filter(group => group.threadName !== null);

			if (groupIndex > filteredList.length) {
				api.sendMessage('Invalid group number.\nPlease choose a number within the range.', event.threadID, event.messageID);
				return;
			}

			const selectedGroup = filteredList[groupIndex - 1];
			const groupID = selectedGroup.threadID;

			// Check if the user is already in the group
			const memberList = await api.getThreadInfo(groupID);
			if (memberList.participantIDs.includes(event.senderID)) {
				api.sendMessage(`Can't add you, you are already in the group chat: \n${selectedGroup.threadName}`, event.threadID, event.messageID);
				return;
			}

			// Check if group is full
			if (memberList.participantIDs.length >= 250) {
				api.sendMessage(`Can't add you, the group chat is full: \n${selectedGroup.threadName}`, event.threadID, event.messageID);
				return;
			}

			await api.addUserToGroup(event.senderID, groupID);
			api.sendMessage(`You have joined the group chat: ${selectedGroup.threadName}`, event.threadID, event.messageID);
		} catch (error) {
			console.error("Error joining group chat", error);
			api.sendMessage('An error occurred while joining the group chat.\nPlease try again later.', event.threadID, event.messageID);
		} finally {
			global.GoatBot.onReply.delete(event.messageID);
		}
	},
};