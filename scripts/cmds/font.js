const fs = require("fs");
const path = require("path");

let fontStyles = {};

module.exports = {
  config: {
    name: "font",
    version: "3.2",
    author: "Alamin + ChatGPT",
    countDown: 5,
    role: 2,
    shortDescription: "Change font style",
    longDescription: "Select font style by number or name from text.json",
    category: "tools",
    guide: "{pn} [style name or number]"
  },

  // ... আগের সব একই

  // ... আগের সব একই

  onStart: async function ({ args, message, event }) {
    const fontPath = path.join(process.cwd(), "text.json");
    if (!fs.existsSync(fontPath)) return message.reply("❌ text.json ফাইল খুঁজে পাওয়া যায়নি।");

    delete require.cache[require.resolve(fontPath)];
    const fontStylesRaw = require(fontPath);

    const normalChars = Array.isArray(fontStylesRaw.normal)
      ? fontStylesRaw.normal
      : Array.from(fontStylesRaw.normal);

    const styleKeys = ["normal", ...Object.keys(fontStylesRaw).filter(key => key !== "normal")];

    fontStyles = { normal: normalChars };

    for (const key of styleKeys) {
      const chars = Array.isArray(fontStylesRaw[key])
        ? fontStylesRaw[key]
        : Array.from(fontStylesRaw[key]);

      if (chars.length !== normalChars.length) {
        return message.reply(`❌ "${key}" স্টাইলের ক্যারেক্টার সংখ্যা ${chars.length}, কিন্তু normal-এ আছে ${normalChars.length}। ঠিক করো।`);
      }
      fontStyles[key] = chars;
    }

    const input = args[0];

    if (!input) {
      const list = styleKeys.map((name, index) => {
        const styled = applyFontStyle(name.toUpperCase(), name);
        return `${index + 1}. ${styled}`;
      }).join("\n");

      return message.reply(
        `📑 ᴀᴠᴀɪʟᴀʙʟᴇ ꜰᴏɴᴛ sᴛʏʟᴇs:\n${list}\n\n✏️ Reply with a number and name।`,
        (err, info) => {
          global.GoatBot.onReply.set(info.messageID, {
            commandName: "font",
            messageID: info.messageID,
            styleKeys
          });
        }
      );
    }

    return selectStyle(input, styleKeys, message);
  },

  onReply: async function ({ message, event, Reply }) {
    const input = event.body.trim();
    return selectStyle(input, Reply.styleKeys, message);
  }
};

function selectStyle(input, styleKeys, message) {
  let selectedStyle = null;

  if (!isNaN(input)) {
    const index = parseInt(input) - 1;
    if (index >= 0 && index < styleKeys.length) {
      selectedStyle = styleKeys[index];
    } else {
      return message.reply("❌ not found this number");
    }
  } else {
    if (!fontStyles[input]) {
      return message.reply("❌ Style not found.\nAvailable: " + styleKeys.join(", "));
    }
    selectedStyle = input;
  }

  global.selectedFontStyle = selectedStyle;
  return message.reply(`✅ Font style set to "${selectedStyle}"\nPreview: ${applyFontStyle("Selected Style", selectedStyle)}`);
}


// ফন্ট অ্যাপ্লাই করার ফাংশন
function applyFontStyle(input, styleName = global.selectedFontStyle || "normal") {
  if (!fontStyles[styleName]) return input;

  const source = fontStyles["normal"];
  const target = fontStyles[styleName];

  let result = "";

  for (const char of input) {
    const lowerChar = char.toLowerCase();
    const index = source.indexOf(lowerChar);

    if (index !== -1) {
      const styledChar = target[index];
      result += (char === char.toUpperCase() && /[a-z]/i.test(char))
        ? styledChar.toUpperCase()
        : styledChar;
    } else {
      result += char;
    }
  }

  return result;
}
