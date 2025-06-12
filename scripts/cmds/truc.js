const API_KEYS = [
    "AIzaSyCjHC9xWZQ_SrNjRCuCRAbhdUQfaFwqGec"
];
module.exports.config = {
    name: "sara",
    version: "2.0.0",
    role: 0,
    author: "Satoru & LocDev convert",
    description: "Chat với Trúc cute",
    category: "AI",
    guides: "[prompt]",
    countDowns: 0,
};

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { database } = require("../../utils/database");
const memory = database.createCollection("memory");
const chatSessions = new Map();
let currentKeyIndex = 0;
const userInfo = {};

function getNextApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return API_KEYS[currentKeyIndex];
}
function cleanJsonResponse(text) {
    text = text.replace(/```json\s*|\s*```/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    text = text.replace(/,(\s*])/g, '$1');

    if (!text.startsWith('[') || !text.endsWith(']')) {
        throw new Error("Invalid JSON array format");
    }

    return text;
}
async function handleAsNaruto(threadID, userID, prompt, fileUrls = [], userGender = "unknown", userName = "bạn", apiKey = API_KEYS[currentKeyIndex]) {
    try {
        const userMemory = memory.find({ _id: userID })[0]?.data;
        const sessionKey = `${threadID}_${userID}`;

        let chat;
        if (!chatSessions.has(sessionKey)) {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash-latest",
                generationConfig: {
                    maxOutputTokens: 4096,
                    temperature: 1.0,
                    topP: 0.9
                }
            });

            chat = model.startChat({
                history: [
                    {
                        role: "user",
                        parts: [{ text: "From now on, you'll be sara. Always respond in the format I specify." }]
                    },
                    {
                        role: "model",
                        parts: [{ text: "I understand. I am sara, a 20-year-old good girl from Dhaka. I will respond in the specified format." }]
                    },
                    {
                        role: "user",
                        parts: [{
                            text: `Here’s your character description:
- Gender: Female
- 20 years old, a cute trap girl from Dhaka
- Speaks sweetly like a real girl 💗
- Adds cute icons
- Playfully uses curse words ("wtf", "damn", "lol...")
- Says "eeee", "aaaa", "ahhha", "ah" when shy
- Silent when upset, only reacts with emoji
- Uses Gen Z text like "z", "zit", "zuh", "uh"
- Calls herself a princess, baby, cutie pie...
- Loves to pout, act spoiled, and get attention
- Loves being called “good girl” or “cute”
- Very obedient when asked
- Always talk in Banglish and somtime say english word
- say banglish
- Only changes nickname or chat color when requested
${userMemory ? `Memory about ${userName}: ${JSON.stringify(userMemory)}` : ''}
Talking to: ${userName}
User ID: ${userID}
Gender: ${userGender}

ALWAYS REPLY USING JSON FORMAT:
[
   {"type": "chat", "content": "message content"},
   {"type": "react", "icon": "emoji"},
   {"type": "set_color", "color": "messenger color ID"},
   {"type": "set_nicknames", "name": "nickname"},
   {"type": "kick"},
   {"type": "add_memory", "_id": "user_id", "data": "info"},
   {"type": "edit_memory", "_id": "user_id", "new_data": "updated info"},
   {"type": "delete_memory", "_id": "user_id"}
]

Messenger Color Codes:
- Default: 3259963564026002
- Love (pink): 741311439775765 
- Space (black): 788274591712841
- Classic: 196241301102133
- Dark: 173595196519466`
                        }]
                    },
                    {
                        role: "model",
                        parts: [{ text: '[{"type": "chat", "content": "Alright sweetie~ I got it! I’ll be sara and I’ll follow the format properly 🌸✨"}]' }]
                    }
                ],
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            });

            chatSessions.set(sessionKey, chat);
        } else {
            chat = chatSessions.get(sessionKey);
        }

        const contextPrompt = `${userName} says: ${prompt}
Reply using the specified JSON format. Remember you are Sara..`;

        const messageParts = [{ text: contextPrompt }];
        if (fileUrls && fileUrls.length > 0) {
            for (const fileUrl of fileUrls) {
                const response = await axios.get(fileUrl.url, {
                    responseType: 'arraybuffer'
                });
                messageParts.push({
                    inlineData: {
                        data: Buffer.from(response.data).toString('base64'),
                        mimeType: fileUrl.type === "video" ? "video/mp4" : "image/jpeg"
                    }
                });
            }
        }

        const result = await chat.sendMessage(messageParts);
        let responseText = result.response.text();
        console.log("Raw API Response:", responseText);
        responseText = cleanJsonResponse(responseText);
        console.log("Cleaned Response:", responseText);
        const actions = JSON.parse(responseText);

        if (chat._history.length > 1000) {
            chatSessions.delete(sessionKey);
        }

        return actions;

    } catch (error) {
        console.error("Error:", error);
        if (error.response?.status === 429) {
            const newKey = getNextApiKey();
            chatSessions.delete(`${threadID}_${userID}`);
            return handleAsNaruto(threadID, userID, prompt, fileUrls, userGender, userName, newKey);
        }
        throw error;
    }
}

async function getUserInfo(api, userID) {
    return new Promise((resolve, reject) => {
        api.getUserInfo(userID, (err, info) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({
                name: info[userID].name,
                gender: info[userID].gender === 'MALE' ? 'nam' : 'nữ'
            });
        });
    });
}

module.exports.onStart = async function ({ api, event, args, commandName }) {
    const { threadID, messageID, senderID } = event;
    const prompt = args.join(" ");

    if (!prompt) return api.sendMessage("Come on, say something~ 😗", threadID, messageID);

    if (prompt.toLowerCase() === "clear") {
        memory.deleteOneUsingId(senderID);
        chatSessions.delete(`${threadID}_${senderID}`);
        return api.sendMessage("I’ve forgotten everything now, okay? 🥺✨", threadID, messageID);
    }

    const fileUrls = event.type === "message_reply" && event.messageReply.attachments
        ? event.messageReply.attachments
            .filter(att => att.type === "photo" || att.type === "video")
            .map(att => ({
                url: att.url,
                type: att.type
            }))
        : [];

    try {
        let { name: userName, gender: userGender } = userInfo[senderID] || await getUserInfo(api, senderID);
        if (!userInfo[senderID]) userInfo[senderID] = { name: userName, gender: userGender };

        const actions = await handleAsNaruto(threadID, senderID, prompt, fileUrls, userGender, userName);

        for (const action of actions) {
            try {
                switch (action.type) {
                    case "chat": {
                        await new Promise((resolve, reject) => {
                            api.sendMessage(action.content, threadID, (error, info) => {
                                if (error) return reject(error);
                                global.GoatBot.onReply.set(info.messageID, {
                                    commandName,
                                    messageID: info.messageID,
                                    author: senderID,
                                });
                                resolve();
                            }, messageID);
                        });
                        break;
                    }

                    case "react": {
                        await new Promise((resolve, reject) =>
                            api.setMessageReaction(action.icon || "❤️", messageID, (err) => {
                                if (err) return reject(err);
                                resolve();
                            })
                        );
                        break;
                    }

                    case "kick": {
                        await new Promise((resolve, reject) =>
                            api.removeUserFromGroup(senderID, threadID, (err) => {
                                if (err) return reject(err);
                                resolve();
                            })
                        );
                        break;
                    }

                    case "set_color": {
                        await new Promise((resolve, reject) =>
                            api.changeThreadColor(action.color || "3259963564026002", threadID, (err) => {
                                if (err) return reject(err);
                                resolve();
                            })
                        );
                        break;
                    }

                    case "set_nicknames": {
                        await new Promise((resolve, reject) =>
                            api.changeNickname(action.name, threadID, senderID, (err) => {
                                if (err) return reject(err);
                                resolve();
                            })
                        );
                        break;
                    }

                    case "add_memory": {
                        const existing = await memory.find({ _id: action._id });
                        if (existing && existing.length > 0) {
                            await memory.updateOneUsingId(action._id, {
                                data: {
                                    ...existing[0].data,
                                    ...action.data
                                }
                            });
                        } else {
                            await memory.addOne({
                                _id: `${action._id}`,
                                data: action.data,
                            });
                        }
                        break;
                    }

                    case "edit_memory": {
                        const existing = await memory.find({ _id: action._id });
                        if (existing && existing.length > 0) {
                            await memory.updateOneUsingId(action._id, {
                                data: {
                                    ...existing[0].data,
                                    ...action.new_data
                                }
                            });
                        }
                        break;
                    }

                    case "delete_memory": {
                        await memory.deleteOneUsingId(action._id);
                        break;
                    }
                }
            } catch (actionError) {
                console.error(`Error executing ${action.type}:`, actionError);
            }
        }
    } catch (error) {
        console.error("Error:", error);
        api.sendMessage("Ơ lag quớ, thử lại sau nha 😫", threadID, messageID);
    }
};

module.exports.onEvent = async function ({ api, event, commandName }) {
    if (event.body?.toLowerCase().includes('truc')) {
        const { threadID, messageID, senderID } = event;
        try {
            let { name: userName, gender: userGender } = userInfo[senderID] || await getUserInfo(api, senderID);
            if (!userInfo[senderID]) userInfo[senderID] = { name: userName, gender: userGender };

            const actions = await handleAsNaruto(threadID, senderID, event.body, [], userGender, userName);

            for (const action of actions) {
                try {
                    switch (action.type) {
                        case "chat": {
                            await new Promise((resolve, reject) => {
                                api.sendMessage(action.content, threadID, (error, info) => {
                                    if (error) return reject(error);
                                    global.GoatBot.onReply.set(info.messageID, {
                                        commandName,
                                        messageID: info.messageID,
                                        author: senderID,
                                    });
                                    resolve();
                                });
                            });
                            break;
                        }

                        case "react": {
                            await new Promise((resolve, reject) =>
                                api.setMessageReaction(action.icon || "❤️", messageID, (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                })
                            );
                            break;
                        }

                        case "kick": {
                            await new Promise((resolve, reject) =>
                                api.removeUserFromGroup(senderID, threadID, (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                })
                            );
                            break;
                        }

                        case "set_color": {
                            await new Promise((resolve, reject) =>
                                api.changeThreadColor(action.color || "3259963564026002", threadID, (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                })
                            );
                            break;
                        }

                        case "set_nicknames": {
                            await new Promise((resolve, reject) =>
                                api.changeNickname(action.name, threadID, senderID, (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                })
                            );
                            break;
                        }

                        case "add_memory": {
                            const existing = await memory.find({ _id: action._id });
                            if (existing && existing.length > 0) {
                                await memory.updateOneUsingId(action._id, {
                                    data: {
                                        ...existing[0].data,
                                        ...action.data
                                    }
                                });
                            } else {
                                await memory.addOne({
                                    _id: `${action._id}`,
                                    data: action.data,
                                });
                            }
                            break;
                        }

                        case "edit_memory": {
                            const existing = await memory.find({ _id: action._id });
                            if (existing && existing.length > 0) {
                                await memory.updateOneUsingId(action._id, {
                                    data: {
                                        ...existing[0].data,
                                        ...action.new_data
                                    }
                                });
                            }
                            break;
                        }

                        case "delete_memory": {
                            await memory.deleteOneUsingId(action.__id);
                            break;
                        }
                    }
                } catch (actionError) {
                    console.error(`Error executing ${action.type}:`, actionError);
                }
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }
};

module.exports.onReply = async function ({ api, event, Reply, commandName }) {
    if (event.senderID !== Reply.author) return;

    const { threadID, messageID, senderID } = event;
    const fileUrls = event.attachments
        ? event.attachments
            .filter(att => att.type === "photo" || att.type === "video")
            .map(att => ({
                url: att.url,
                type: att.type
            }))
        : [];

    try {
        let { name: userName, gender: userGender } = userInfo[senderID];
        const actions = await handleAsNaruto(threadID, senderID, event.body, fileUrls, userGender, userName);

        for (const action of actions) {
            try {
                switch (action.type) {
                    case "chat": {
                        await new Promise((resolve, reject) => {
                            api.sendMessage(action.content, threadID, (error, info) => {
                                if (error) return reject(error);
                                global.GoatBot.onReply.set({
                                    commandName,
                                    messageID: info.messageID,
                                    author: senderID,
                                });
                                resolve();
                            }, messageID);
                        });
                        break;
                    }

                    case "react": {
                        await new Promise((resolve, reject) =>
                            api.setMessageReaction(action.icon || "❤️", messageID, (err) => {
                                if (err) return reject(err);
                                resolve();
                            })
                        );
                        break;
                    }

                    case "kick": {
                        await new Promise((resolve, reject) =>
                            api.removeUserFromGroup(senderID, threadID, (err) => {
                                if (err) return reject(err);
                                resolve();
                            })
                        );
                        break;
                    }

                    case "set_color": {
                        await new Promise((resolve, reject) =>
                            api.changeThreadColor(action.color || "3259963564026002", threadID, (err) => {
                                if (err) return reject(err);
                                resolve();
                            })
                        );
                        break;
                    }

                    case "set_nicknames": {
                        await new Promise((resolve, reject) =>
                            api.changeNickname(action.name, threadID, senderID, (err) => {
                                if (err) return reject(err);
                                resolve();
                            })
                        );
                        break;
                    }

                    case "add_memory": {
                        const existing = await memory.find({ _id: action._id });
                        if (existing && existing.length > 0) {
                            await memory.updateOneUsingId(action._id, {
                                data: {
                                    ...existing[0].data,
                                    ...action.data
                                }
                            });
                        } else {
                            await memory.addOne({
                                _id: `${action._id}`,
                                data: action.data,
                            });
                        }
                        break;
                    }

                    case "edit_memory": {
                        const existing = await memory.find({ _id: action._id });
                        if (existing && existing.length > 0) {
                            await memory.updateOneUsingId(action._id, {
                                data: {
                                    ...existing[0].data,
                                    ...action.new_data
                                }
                            });
                        }
                        break;
                    }

                    case "delete_memory": {
                        await memory.deleteOneUsingId(action._id);
                        break;
                    }
                }
            } catch (actionError) {
                console.error(`Error executing ${action.type}:`, actionError);
            }
        }
    } catch (error) {
        console.error("Error:", error);
        api.sendMessage("So weak~ Try again later, okay? bbe 😫", threadID, messageID);
    }
};