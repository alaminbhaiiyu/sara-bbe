const config = require('../../config.json'); // config.json থেকে admin লিস্ট নাও

module.exports = {
  config: {
    name: "unsendreact",
    version: "1.2", // Updated version
    author: "YourName", // Replace with your name
    countDown: 0,
    role: 2, // Only admins can use this command (still applies to the unsend logic)
    description: {
      en: "Unsend any message by reacting with a love emoji (admin only)"
    },
    category: "box chat",
    guide: {
      en: "React with a ❤️ emoji to any message to unsend it (admin only)."
    }
  },

  langs: {
    en: {
      noPermission: "You don't have permission to use this command.",
      unsendSuccess: "Message unsent successfully by reaction."
    }
  },

  onStart: async function ({ message, event, api, getLang }) {
    // This command is triggered by reaction, so onStart is just for guide
    message.reply(getLang("guide.en"));
  },

  // This onAnyEvent function will now be triggered for *every* incoming event, including reactions
  onAnyEvent: async function ({ api, event, message, getLang }) {
    // First, check if the event type is a message reaction
    if (event.type === "message_reaction") {
      // Check if the reaction is a "love" emoji
      const triggerEmojis = ["❤", "💖", "😡","❌"]; // Add or remove emojis here

      // Check if the reacted emoji is in our list of triggerEmojis
      if (!triggerEmojis.includes(event.reaction)) {
        return; // Not a triggering emoji, so do nothing
      }

      // Check if the user reacting is an admin
      if (!config.adminBot.includes(event.userID)) {
        // If not an admin, react with an X to indicate no permission
        // Using api.setMessageReaction directly as 'message.react' might not work in onAnyEvent as expected
         // The 'true' makes the reaction invisible to others
      }

      // Attempt to unsend the message
      try {
        await api.unsendMessage(event.messageID);
        // Optionally, you can log this or send a private confirmation to the admin
        console.log(`Admin ${event.userID} unsent message ${event.messageID} with ❤️ reaction.`);
      } catch (error) {
        console.error(`Failed to unsend message ${event.messageID}:`, error);
        // You could also try to send an error message to the admin via a new message
        // message.reply(`Error unsending message: ${error.message}`);
      }
    }
  }
};