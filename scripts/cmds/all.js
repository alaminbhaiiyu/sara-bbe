module.exports = {
	config: {
		name: "all",
		version: "2.0",
		author: "Modified by Alamin",
		countDown: 5,
		role: 1,
		description: {
			vi: "Tag tất cả thành viên trong nhóm kèm nội dung",
			en: "Mention all members in the group with custom message"
		},
		category: "box chat",
		guide: {
			vi: "   {pn} [nội dung]",
			en: "   {pn} [content]"
		}
	},

	onStart: async function ({ message, event, args }) {
		const { participantIDs } = event;
		if (!args[0]) return message.reply("দয়া করে একটি মেসেজ দিন যেন সবাইকে mention করার সাথে সেটাও পাঠানো যায়।");

		const customText = args.join(" ");
		const mentions = [];

		for (const uid of participantIDs) {
			mentions.push({
				tag: "@everyone",
				id: uid
			});
		}

		message.reply({
			body: customText,
			mentions
		});
	}
};
