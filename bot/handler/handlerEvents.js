const fs = require("fs-extra");
const mongoose = require("mongoose");
const config = require("../../config.json"); // উপরের ফোল্ডার অনুসারে

mongoose.connect(config.requestdb, {
	useNewUrlParser: true,
	useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Schema & Model
const requestSchema = new mongoose.Schema({
	threadID: String,
	status: String,
	expiresAt: Number
});

const RequestModel = mongoose.model("Request", requestSchema);

const nullAndUndefined = [undefined, null];

function getType(obj) {
	return Object.prototype.toString.call(obj).slice(8, -1);
}

function getRole(threadData, senderID) {
	const adminBot = global.GoatBot.config.adminBot || [];
	if (!senderID)
		return 0;
	const adminBox = threadData ? threadData.adminIDs || [] : [];
	return adminBot.includes(senderID) ? 2 : adminBox.includes(senderID) ? 1 : 0;
}



function getText(type, reason, time, targetID, lang) {
	const utils = global.utils;
	if (type == "userBanned")
		return utils.getText({ lang, head: "handlerEvents" }, "userBanned", reason, time, targetID);
	else if (type == "threadBanned")
		return utils.getText({ lang, head: "handlerEvents" }, "threadBanned", reason, time, targetID);
	else if (type == "onlyAdminBox")
		return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBox");
	else if (type == "onlyAdminBot")
		return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBot");
}


const fontStylesPath = process.cwd() + "/text.json";
let fontStyles = fs.existsSync(fontStylesPath) ? require(fontStylesPath) : {};
global.selectedFontStyle = "normal"; // default style

function applyFontStyle(input, styleName = global.selectedFontStyle) {
	if (!fontStyles[styleName]) return input;
  
	const source = Array.isArray(fontStyles["normal"]) ? fontStyles["normal"] : (fontStyles["normal"] + "").split("");

	const target = fontStyles[styleName]; // এটা অবশ্যই Array হতে হবে
  
	let result = "";
  
	for (const char of input) {
	  const lowerChar = char.toLowerCase();
	  const index = source.indexOf(lowerChar);
  
	  if (index !== -1) {
		const styledChar = target[index];
  
		// যদি অক্ষরটি বড় থাকে, styledChar-ও বড় করা চেষ্টা করো (Unicode big font না থাকলে একই থাকবে)
		result += (char === char.toUpperCase() && /[a-z]/i.test(char))
		  ? styledChar.toUpperCase()
		  : styledChar;
	  } else {
		// না মেললে যেমন space, emoji, etc.
		result += char;
	  }
	}
  
	return result;
  }
  
  


function replaceShortcutInLang(text, prefix, commandName) {
	return text
		.replace(/\{(?:p|prefix)\}/g, prefix)
		.replace(/\{(?:n|name)\}/g, commandName)
		.replace(/\{pn\}/g, `${prefix}${commandName}`);
}

function getRoleConfig(utils, command, isGroup, threadData, commandName) {
	let roleConfig;
	if (utils.isNumber(command.config.role)) {
		roleConfig = {
			onStart: command.config.role
		};
	}
	else if (typeof command.config.role == "object" && !Array.isArray(command.config.role)) {
		if (!command.config.role.onStart)
			command.config.role.onStart = 0;
		roleConfig = command.config.role;
	}
	else {
		roleConfig = {
			onStart: 0
		};
	}

	if (isGroup)
		roleConfig.onStart = threadData.data.setRole?.[commandName] ?? roleConfig.onStart;

	for (const key of ["onChat", "onStart", "onReaction", "onReply"]) {
		if (roleConfig[key] == undefined)
			roleConfig[key] = roleConfig.onStart;
	}

	return roleConfig;
	// {
	// 	onChat,
	// 	onStart,
	// 	onReaction,
	// 	onReply
	// }
}

function isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, lang) {
	const config = global.GoatBot.config;
	const { adminBot, hideNotiMessage } = config;

	
	// check if user banned
	const infoBannedUser = userData.banned;
	if (infoBannedUser.status == true) {
		const { reason, date } = infoBannedUser;
		if (hideNotiMessage.userBanned == false)
			message.reply(getText("userBanned", reason, date, senderID, lang));
		return true;
	}

	// check if only admin bot
	if (
		config.adminOnly.enable == true
		&& !adminBot.includes(senderID)
		&& !config.adminOnly.ignoreCommand.includes(commandName)
	) {
		if (hideNotiMessage.adminOnly == false)
			message.reply(getText("onlyAdminBot", null, null, null, lang));
		return true;
	}

	// ==========    Check Thread    ========== //
	if (isGroup == true) {
		if (
			threadData.data.onlyAdminBox === true
			&& !threadData.adminIDs.includes(senderID)
			&& !(threadData.data.ignoreCommanToOnlyAdminBox || []).includes(commandName)
		) {
			// check if only admin box
			if (!threadData.data.hideNotiMessageOnlyAdminBox)
				message.reply(getText("onlyAdminBox", null, null, null, lang));
			return true;
		}

		// check if thread banned
		const infoBannedThread = threadData.banned;
		if (infoBannedThread.status == true) {
			const { reason, date } = infoBannedThread;
			if (hideNotiMessage.threadBanned == false)
				message.reply(getText("threadBanned", reason, date, threadID, lang));
			return true;
		}
	}
	return false;
}

const requestPath = process.cwd() + "/request.json";
let requestData = fs.existsSync(requestPath) ? require(requestPath) : {};

// "null" string হলে null বানাও
for (const threadID in requestData) {
  if (requestData[threadID].expiresAt === "null") {
    requestData[threadID].expiresAt = null;
  }
}

// Add real-time watching for request.json
let isSyncing = false;

fs.watch(requestPath, async (eventType, filename) => {
  if (eventType === 'change') {
    if (isSyncing) return; // যদি আমরা নিজেরা সিঙ্ক করি, তখন skip করো

    try {
      delete require.cache[require.resolve(requestPath)];
      requestData = require(requestPath);

      // "null" string হলে null বানাও
      for (const threadID in requestData) {
        if (requestData[threadID].expiresAt === "null") {
          requestData[threadID].expiresAt = null;
        }
      }

      console.log('✅ request.json updated and reloaded.');

      // MongoDB তে আপডেট
      for (const [threadID, data] of Object.entries(requestData)) {
        await RequestModel.findOneAndUpdate(
          { threadID },
          { $set: data },
          { upsert: true }
        );
      }
      console.log("✅ MongoDB updated from request.json");

      // এখন MongoDB থেকে সব ডেটা ডাউনলোড করে আবার request.json এ overwrite করবো
      const allData = await RequestModel.find({});
      const newRequestData = {};
      for (const doc of allData) {
        newRequestData[doc.threadID] = {
          status: doc.status,
          expiresAt: doc.expiresAt === null ? "null" : doc.expiresAt
        };
      }

      // ফ্ল্যাগ অন করে ফাইল লিখবো, যেন loop না হয়
      isSyncing = true;
      fs.writeFileSync(requestPath, JSON.stringify(newRequestData, null, 2));
      console.log("✅ request.json synced from MongoDB");
      setTimeout(() => isSyncing = false, 1000);

    } catch (err) {
      console.error('❌ Error syncing request.json with MongoDB:', err);
      isSyncing = false;
    }
  }
});


async function checkGroupAccess(threadID, senderID, commandName, message, prefix, threadsData, usersData) {
  if (!requestData[threadID]) {
    requestData[threadID] = {
      status: "locked",
      expiresAt: null
    };
    const tempData = JSON.parse(JSON.stringify(requestData));
    for (const tid in tempData) {
      if (tempData[tid].expiresAt === null) tempData[tid].expiresAt = "null";
    }
    fs.writeFileSync(requestPath, JSON.stringify(tempData, null, 2));
  }

  const groupStatus = requestData[threadID];

  // auto-lock if time expired
  if (groupStatus.status === "unlocked" && groupStatus.expiresAt && Date.now() > groupStatus.expiresAt) {
    groupStatus.status = "locked";
    const tempData = JSON.parse(JSON.stringify(requestData));
    for (const tid in tempData) {
      if (tempData[tid].expiresAt === null) tempData[tid].expiresAt = "null";
    }
    fs.writeFileSync(requestPath, JSON.stringify(tempData, null, 2));
  }

  if (groupStatus.status === "locked" && commandName !== "request") {
    const threadData = await threadsData.get(threadID);
    const userData = await usersData.get(senderID);

    const groupName = threadData ? threadData.threadName : "Unknown Group";
    const userName = userData ? userData.name : "Unknown User";

    message.reply(`🔐 Access Restricted in ${groupName}
This group is currently locked to general users.

📌 Only the command ${prefix}request is available.

📝 To request access, simply type:
${prefix}request — An admin will be notified to review your request.

🙏 Thank you for your patience!`);

    return true;
  }
  return false;
}


function createGetText2(langCode, pathCustomLang, prefix, command) {
	const commandType = command.config.countDown ? "command" : "command event";
	const commandName = command.config.name;
	let customLang = {};
	let getText2 = () => { };
	if (fs.existsSync(pathCustomLang))
		customLang = require(pathCustomLang)[commandName]?.text || {};
	if (command.langs || customLang || {}) {
		getText2 = function (key, ...args) {
			let lang = command.langs?.[langCode]?.[key] || customLang[key] || "";
			lang = replaceShortcutInLang(lang, prefix, commandName);
			for (let i = args.length - 1; i >= 0; i--)
				lang = lang.replace(new RegExp(`%${i + 1}`, "g"), args[i]);
			return lang || `❌ Can't find text on language "${langCode}" for ${commandType} "${commandName}" with key "${key}"`;
		};
	}
	return getText2;
}

module.exports = function (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
	return async function (event, message) {

		const { utils, client, GoatBot } = global;
		const { getPrefix, removeHomeDir, log, getTime } = utils;
		const { config, configCommands: { envGlobal, envCommands, envEvents } } = GoatBot;
		const { autoRefreshThreadInfoFirstTime } = config.database;
		let { hideNotiMessage = {} } = config;

		const { body, messageID, threadID, isGroup } = event;

		// Check if has threadID
		if (!threadID)
			return;

		const senderID = event.userID || event.senderID || event.author;

		let threadData = global.db.allThreadData.find(t => t.threadID == threadID);
		let userData = global.db.allUserData.find(u => u.userID == senderID);

		if (!userData && !isNaN(senderID))
			userData = await usersData.create(senderID);

		if (!threadData && !isNaN(threadID)) {
			if (global.temp.createThreadDataError.includes(threadID))
				return;
			threadData = await threadsData.create(threadID);
			global.db.receivedTheFirstMessage[threadID] = true;
		}
		else {
			if (
				autoRefreshThreadInfoFirstTime === true
				&& !global.db.receivedTheFirstMessage[threadID]
			) {
				global.db.receivedTheFirstMessage[threadID] = true;
				await threadsData.refreshInfo(threadID);
			}
		}

		if (typeof threadData.settings.hideNotiMessage == "object")
			hideNotiMessage = threadData.settings.hideNotiMessage;

		const prefix = getPrefix(threadID);
		const role = getRole(threadData, senderID);

		const parameters = {
			api, usersData, threadsData, message, event,
			userModel, threadModel, prefix, dashBoardModel,
			globalModel, dashBoardData, globalData, envCommands,
			envEvents, envGlobal, role,
			removeCommandNameFromBody: function removeCommandNameFromBody(body_, prefix_, commandName_) {
				if ([body_, prefix_, commandName_].every(x => nullAndUndefined.includes(x)))
					throw new Error("Please provide body, prefix and commandName to use this function, this function without parameters only support for onStart");
				for (let i = 0; i < arguments.length; i++)
					if (typeof arguments[i] != "string")
						throw new Error(`The parameter "${i + 1}" must be a string, but got "${getType(arguments[i])}"`);

				return body_.replace(new RegExp(`^${prefix_}(\\s+|)${commandName_}`, "i"), "").trim();
			}
		};
		const langCode = threadData.data.lang || config.language || "en";

		function createMessageSyntaxError(commandName) {
			message.SyntaxError = async function () {
				return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "commandSyntaxError", prefix, commandName));
			};
		}

		// Override message.reply and api.sendMessage
const originalReply = message.reply;
message.reply = function (msg, ...rest) {
  if (typeof msg === "string") {
    msg = applyFontStyle(msg);
  } else if (msg && typeof msg.body === "string") {
    msg.body = applyFontStyle(msg.body);
  }
  return originalReply.call(this, msg, ...rest);
};

const originalSendMessage = api.sendMessage;
api.sendMessage = function (msg, threadID, cb, mid) {
  if (typeof msg === "string") {
    msg = applyFontStyle(msg);
  } else if (msg && typeof msg.body === "string") {
    msg.body = applyFontStyle(msg.body);
  }
  return originalSendMessage.call(this, msg, threadID, cb, mid);
};


		/*
			+-----------------------------------------------+
			|							 WHEN CALL COMMAND								|
			+-----------------------------------------------+
		*/
		let isUserCallCommand = false;
		async function onStart() {

			
						




			// —————————————— CHECK USE BOT —————————————— //
			if (!body || !body.startsWith(prefix))
				return;
			const dateNow = Date.now();
			const args = body.slice(prefix.length).trim().split(/ +/);
			// ————————————  CHECK HAS COMMAND ——————————— //
			let commandName = args.shift().toLowerCase();
			let command = GoatBot.commands.get(commandName) || GoatBot.commands.get(GoatBot.aliases.get(commandName));
			// ———————— CHECK ALIASES SET BY GROUP ———————— //
			const aliasesData = threadData.data.aliases || {};
			for (const cmdName in aliasesData) {
				if (aliasesData[cmdName].includes(commandName)) {
					command = GoatBot.commands.get(cmdName);
					break;
				}
			}
			// ————————————— SET COMMAND NAME ————————————— //
			if (command)
				commandName = command.config.name;
			// ——————— FUNCTION REMOVE COMMAND NAME ———————— //
			function removeCommandNameFromBody(body_, prefix_, commandName_) {
				if (arguments.length) {
					if (typeof body_ != "string")
						throw new Error(`The first argument (body) must be a string, but got "${getType(body_)}"`);
					if (typeof prefix_ != "string")
						throw new Error(`The second argument (prefix) must be a string, but got "${getType(prefix_)}"`);
					if (typeof commandName_ != "string")
						throw new Error(`The third argument (commandName) must be a string, but got "${getType(commandName_)}"`);

					return body_.replace(new RegExp(`^${prefix_}(\\s+|)${commandName_}`, "i"), "").trim();
				}
				else {
					return body.replace(new RegExp(`^${prefix}(\\s+|)${commandName}`, "i"), "").trim();
				}
			}

			if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
				return;
			if (await checkGroupAccess(threadID, senderID, commandName, message, prefix, threadsData, usersData))
				return;
			// —————  CHECK BANNED OR ONLY ADMIN BOX  ————— //
			function findSimilarCommands(input, commands, threshold = 0.6) {
				const similar = [];
				const inputLower = input.toLowerCase();
			
				for (const cmd of commands) {
					const cmdLower = cmd.toLowerCase();
			
					// Skip exact match (shouldn't happen here)
					if (cmdLower === inputLower) continue;
			
					// Check if input is contained in command or vice versa
					if (cmdLower.includes(inputLower) || inputLower.includes(cmdLower)) {
						similar.push(cmd);
						continue;
					}
			
					// Calculate similarity ratio
					const distance = levenshteinDistance(inputLower, cmdLower);
					const ratio = 1 - (distance / Math.max(inputLower.length, cmdLower.length));
			
					if (ratio >= threshold) {
						similar.push(cmd);
					}
				}
			
				return similar.sort((a, b) => {
					// Sort by similarity (more similar first)
					const aDist = levenshteinDistance(inputLower, a.toLowerCase());
					const bDist = levenshteinDistance(inputLower, b.toLowerCase());
					return aDist - bDist;
				});


			}
			
			function levenshteinDistance(a, b) {
				const matrix = [];
				for (let i = 0; i <= b.length; i++) {
					matrix[i] = [i];
				}
				for (let j = 0; j <= a.length; j++) {
					matrix[0][j] = j;
				}
				for (let i = 1; i <= b.length; i++) {
					for (let j = 1; j <= a.length; j++) {
						if (b.charAt(i - 1) === a.charAt(j - 1)) {
							matrix[i][j] = matrix[i - 1][j - 1];
						} else {
							matrix[i][j] = Math.min(
								matrix[i - 1][j - 1] + 1,
								matrix[i][j - 1] + 1,
								matrix[i - 1][j] + 1
							);
						}
					}
				}
				return matrix[b.length][a.length];
			}
			
			if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
				return;
			
			if (!command) {
				if (!hideNotiMessage.commandNotFound) {
					if (commandName) {
						// Get all available commands and aliases
						const allPossibleCommands = Array.from(GoatBot.commands.keys());
			
						// Find similar commands
						const similarCommands = findSimilarCommands(commandName, allPossibleCommands);
			
						if (similarCommands.length > 0) {
							// Format suggestions
							let suggestions;
							if (similarCommands.length === 1) {
								suggestions = `Did you mean "${similarCommands[0]}"?`;
							} else if (similarCommands.length >= 2) {
								suggestions = `Did you mean "${similarCommands[0]}" or "${similarCommands[1]}"?`;
							}
			
							return await message.reply(
								`Command "${commandName}" does not exist. ${suggestions}`
							);
						} else {
							// No similar commands found
							return await message.reply(
								`Command "${commandName}" not found.`
							);
						}
					} else {
						// No command name provided
						return await message.reply(
							`Sensi, type "${prefix}help" to see all available commands.\ndattabayo!`
						);
					}
				} else {
					// Notifications are disabled
					return true;
				}
			}


			// ————————————— CHECK PERMISSION ———————————— //
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const needRole = roleConfig.onStart;

			if (needRole > role) {
				if (!hideNotiMessage.needRoleToUseCmd) {
					if (needRole == 1)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdmin", commandName));
					else if (needRole == 2)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2", commandName));
				}
				else {
					return true;
				}
			}
			// ———————————————— countDown ———————————————— //
			if (!client.countDown[commandName])
				client.countDown[commandName] = {};
			const timestamps = client.countDown[commandName];
			let getCoolDown = command.config.countDown;
			if (!getCoolDown && getCoolDown != 0 || isNaN(getCoolDown))
				getCoolDown = 1;
			const cooldownCommand = getCoolDown * 1000;
			if (timestamps[senderID]) {
				const expirationTime = timestamps[senderID] + cooldownCommand;
				if (dateNow < expirationTime)
					return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "waitingForCommand", ((expirationTime - dateNow) / 1000).toString().slice(0, 3)));
			}
			// ——————————————— RUN COMMAND ——————————————— //
			const time = getTime("DD/MM/YYYY HH:mm:ss");
			isUserCallCommand = true;
			try {
				// analytics command call
				(async () => {
					const analytics = await globalData.get("analytics", "data", {});
					if (!analytics[commandName])
						analytics[commandName] = 0;
					analytics[commandName]++;
					await globalData.set("analytics", analytics, "data");
				})();

				createMessageSyntaxError(commandName);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
				await command.onStart({
					...parameters,
					args,
					commandName,
					getLang: getText2,
					removeCommandNameFromBody
				});
				timestamps[senderID] = dateNow;
				log.info("CALL COMMAND", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
			}
			catch (err) {
				log.err("CALL COMMAND", `An error occurred when calling the command ${commandName}`, err);
				return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
			}
		}


		/*
		 +------------------------------------------------+
		 |                    ON CHAT                     |
		 +------------------------------------------------+
		*/
		async function onChat() {
			const allOnChat = GoatBot.onChat || [];
			const args = body ? body.split(/ +/) : [];
			for (const key of allOnChat) {
				const command = GoatBot.commands.get(key);
				if (!command)
					continue;
				const commandName = command.config.name;

				// —————————————— CHECK PERMISSION —————————————— //
				const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
				const needRole = roleConfig.onChat;
				if (needRole > role)
					continue;

				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				createMessageSyntaxError(commandName);

				if (getType(command.onChat) == "Function") {
					const defaultOnChat = command.onChat;
					// convert to AsyncFunction
					command.onChat = async function () {
						return defaultOnChat(...arguments);
					};
				}

				command.onChat({
					...parameters,
					isUserCallCommand,
					args,
					commandName,
					getLang: getText2
				})
					.then(async (handler) => {
						if (typeof handler == "function") {
							if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
								return;
							try {
								await handler();
								log.info("onChat", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
							}
							catch (err) {
								await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred2", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
							}
						}
					})
					.catch(err => {
						log.err("onChat", `An error occurred when calling the command onChat ${commandName}`, err);
					});
			}
		}


		/*
		 +------------------------------------------------+
		 |                   ON ANY EVENT                 |
		 +------------------------------------------------+
		*/
		async function onAnyEvent() {
			const allOnAnyEvent = GoatBot.onAnyEvent || [];
			let args = [];
			if (typeof event.body == "string" && event.body.startsWith(prefix))
				args = event.body.split(/ +/);

			for (const key of allOnAnyEvent) {
				if (typeof key !== "string")
					continue;
				const command = GoatBot.commands.get(key);
				if (!command)
					continue;
				const commandName = command.config.name;
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				createMessageSyntaxError(commandName);

				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, command);

				if (getType(command.onAnyEvent) == "Function") {
					const defaultOnAnyEvent = command.onAnyEvent;
					// convert to AsyncFunction
					command.onAnyEvent = async function () {
						return defaultOnAnyEvent(...arguments);
					};
				}

				command.onAnyEvent({
					...parameters,
					args,
					commandName,
					getLang: getText2
				})
					.then(async (handler) => {
						if (typeof handler == "function") {
							try {
								await handler();
								log.info("onAnyEvent", `${commandName} | ${senderID} | ${userData.name} | ${threadID}`);
							}
							catch (err) {
								message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred7", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
								log.err("onAnyEvent", `An error occurred when calling the command onAnyEvent ${commandName}`, err);
							}
						}
					})
					.catch(err => {
						log.err("onAnyEvent", `An error occurred when calling the command onAnyEvent ${commandName}`, err);
					});
			}
		}

		/*
		 +------------------------------------------------+
		 |                  ON FIRST CHAT                 |
		 +------------------------------------------------+
		*/
		async function onFirstChat() {
			const allOnFirstChat = GoatBot.onFirstChat || [];
			const args = body ? body.split(/ +/) : [];

			for (const itemOnFirstChat of allOnFirstChat) {
				const { commandName, threadIDsChattedFirstTime } = itemOnFirstChat;
				if (threadIDsChattedFirstTime.includes(threadID))
					continue;
				const command = GoatBot.commands.get(commandName);
				if (!command)
					continue;

				itemOnFirstChat.threadIDsChattedFirstTime.push(threadID);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				createMessageSyntaxError(commandName);

				if (getType(command.onFirstChat) == "Function") {
					const defaultOnFirstChat = command.onFirstChat;
					// convert to AsyncFunction
					command.onFirstChat = async function () {
						return defaultOnFirstChat(...arguments);
					};
				}

				command.onFirstChat({
					...parameters,
					isUserCallCommand,
					args,
					commandName,
					getLang: getText2
				})
					.then(async (handler) => {
						if (typeof handler == "function") {
							if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
								return;
							try {
								await handler();
								log.info("onFirstChat", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
							}
							catch (err) {
								await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred2", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
							}
						}
					})
					.catch(err => {
						log.err("onFirstChat", `An error occurred when calling the command onFirstChat ${commandName}`, err);
					});
			}
		}


		/* +------------------------------------------------+
		 |                    ON REPLY                    |
		 +------------------------------------------------+
		*/
		async function onReply() {
			if (!event.messageReply)
				return;
			const { onReply } = GoatBot;
			const Reply = onReply.get(event.messageReply.messageID);
			if (!Reply)
				return;
			Reply.delete = () => onReply.delete(messageID);
			const commandName = Reply.commandName;
			if (!commandName) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommandName"));
				return log.err("onReply", `Can't find command name to execute this reply!`, Reply);
			}
			const command = GoatBot.commands.get(commandName);
			if (!command) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommand", commandName));
				return log.err("onReply", `Command "${commandName}" not found`, Reply);
			}

			// —————————————— CHECK PERMISSION —————————————— //
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const needRole = roleConfig.onReply;
			if (needRole > role) {
				if (!hideNotiMessage.needRoleToUseCmdOnReply) {
					if (needRole == 1)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminToUseOnReply", commandName));
					else if (needRole == 2)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2ToUseOnReply", commandName));
				}
				else {
					return true;
				}
			}

			const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
			const time = getTime("DD/MM/YYYY HH:mm:ss");
			try {
				if (!command)
					throw new Error(`Cannot find command with commandName: ${commandName}`);
				const args = body ? body.split(/ +/) : [];
				createMessageSyntaxError(commandName);
				if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
					return;
				await command.onReply({
					...parameters,
					Reply,
					args,
					commandName,
					getLang: getText2
				});
				log.info("onReply", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
			}
			catch (err) {
				log.err("onReply", `An error occurred when calling the command onReply ${commandName}`, err);
				await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred3", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
			}
		}


		/*
		 +------------------------------------------------+
		 |                   ON REACTION                  |
		 +------------------------------------------------+
		*/
		async function onReaction() {
			const { onReaction } = GoatBot;
			const Reaction = onReaction.get(messageID);
			if (!Reaction)
				return;
			Reaction.delete = () => onReaction.delete(messageID);
			const commandName = Reaction.commandName;
			if (!commandName) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommandName"));
				return log.err("onReaction", `Can't find command name to execute this reaction!`, Reaction);
			}
			const command = GoatBot.commands.get(commandName);
			if (!command) {
				message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommand", commandName));
				return log.err("onReaction", `Command "${commandName}" not found`, Reaction);
			}

			// —————————————— CHECK PERMISSION —————————————— //
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const needRole = roleConfig.onReaction;
			if (needRole > role) {
				if (!hideNotiMessage.needRoleToUseCmdOnReaction) {
					if (needRole == 1)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminToUseOnReaction", commandName));
					else if (needRole == 2)
						return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2ToUseOnReaction", commandName));
				}
				else {
					return true;
				}
			}
			// —————————————————————————————————————————————— //

			const time = getTime("DD/MM/YYYY HH:mm:ss");
			try {
				if (!command)
					throw new Error(`Cannot find command with commandName: ${commandName}`);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
				const args = [];
				createMessageSyntaxError(commandName);
				if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
					return;
				await command.onReaction({
					...parameters,
					Reaction,
					args,
					commandName,
					getLang: getText2
				});
				log.info("onReaction", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${event.reaction}`);
			}
			catch (err) {
				log.err("onReaction", `An error occurred when calling the command onReaction ${commandName}`, err);
				await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred4", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
			}
		}


		/*
		 +------------------------------------------------+
		 |                 EVENT COMMAND                  |
		 +------------------------------------------------+
		*/
		async function handlerEvent() {
			const { author } = event;
			const allEventCommand = GoatBot.eventCommands.entries();
			for (const [key] of allEventCommand) {
				const getEvent = GoatBot.eventCommands.get(key);
				if (!getEvent)
					continue;
				const commandName = getEvent.config.name;
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, getEvent);
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				try {
					const handler = await getEvent.onStart({
						...parameters,
						commandName,
						getLang: getText2
					});
					if (typeof handler == "function") {
						await handler();
						log.info("EVENT COMMAND", `Event: ${commandName} | ${author} | ${userData.name} | ${threadID}`);
					}
				}
				catch (err) {
					log.err("EVENT COMMAND", `An error occurred when calling the command event ${commandName}`, err);
					await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred5", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
				}
			}
		}


		/*
		 +------------------------------------------------+
		 |                    ON EVENT                    |
		 +------------------------------------------------+
		*/
		async function onEvent() {
			const allOnEvent = GoatBot.onEvent || [];
			const args = [];
			const { author } = event;
			for (const key of allOnEvent) {
				if (typeof key !== "string")
					continue;
				const command = GoatBot.commands.get(key);
				if (!command)
					continue;
				const commandName = command.config.name;
				const time = getTime("DD/MM/YYYY HH:mm:ss");
				createMessageSyntaxError(commandName);

				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, command);

				if (getType(command.onEvent) == "Function") {
					const defaultOnEvent = command.onEvent;
					// convert to AsyncFunction
					command.onEvent = async function () {
						return defaultOnEvent(...arguments);
					};
				}

				command.onEvent({
					...parameters,
					args,
					commandName,
					getLang: getText2
				})
					.then(async (handler) => {
						if (typeof handler == "function") {
							try {
								await handler();
								log.info("onEvent", `${commandName} | ${author} | ${userData.name} | ${threadID}`);
							}
							catch (err) {
								message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred6", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
								log.err("onEvent", `An error occurred when calling the command onEvent ${commandName}`, err);
							}
						}
					})
					.catch(err => {
						log.err("onEvent", `An error occurred when calling the command onEvent ${commandName}`, err);
					});
			}
		}

		/*
		 +------------------------------------------------+
		 |                    PRESENCE                    |
		 +------------------------------------------------+
		*/
		async function presence() {
			// Your code here
		}

		/*
		 +------------------------------------------------+
		 |                  READ RECEIPT                  |
		 +------------------------------------------------+
		*/
		async function read_receipt() {
			// Your code here
		}

		/*
		 +------------------------------------------------+
		 |                   		 TYP                    	|
		 +------------------------------------------------+
		*/
		async function typ() {
			// Your code here
		}

		return {
			onAnyEvent,
			onFirstChat,
			onChat,
			onStart,
			onReaction,
			onReply,
			onEvent,
			handlerEvent,
			presence,
			read_receipt,
			typ
		};
	};
};