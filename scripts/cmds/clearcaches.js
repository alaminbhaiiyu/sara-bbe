const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "clearcache",
    aliases: ["clearc", "cc", "cache", "tmp"],
    version: "1.2",
    author: "nur",
    countDown: 5,
    role: 1,
    shortDescription: {
      en: "Clear all cache folders"
    },
    description: {
      en: "Recursively clears files/folders inside cache, caches, cacher, and tmp directories"
    },
    category: "system",
    guide: {
      en: "Use: {p}clearcache - Clears all temporary and cache files"
    }
  },

  langs: {
    en: {
      clearing: "🧹 Clearing all cache folders...",
      success: "✅ Successfully cleared cache!\n%1 items removed.\nTotal space freed: %2",
      noFiles: "📂 No files to clear in any cache folder.",
      error: "❌ Failed to clear cache: %1"
    }
  },

  onStart: async function ({ message, getLang }) {
    const folders = ["cache", "caches", "cacher", "tmp"];
    let totalSize = 0;
    let deletedCount = 0;
    let foundAny = false;

    await message.reply(getLang("clearing"));

    try {
      for (const folder of folders) {
        const targetPath = path.join(__dirname, folder);
        if (!fs.existsSync(targetPath)) continue;

        const { deleted, size } = deleteRecursive(targetPath);
        if (deleted > 0) foundAny = true;

        deletedCount += deleted;
        totalSize += size;
      }

      if (!foundAny) return message.reply(getLang("noFiles"));
      return message.reply(getLang("success", deletedCount, formatBytes(totalSize)));
    } catch (err) {
      console.error(err);
      return message.reply(getLang("error", err.message));
    }
  }
};

// Recursive deletion function
function deleteRecursive(dirPath) {
  let deleted = 0;
  let size = 0;

  if (!fs.existsSync(dirPath)) return { deleted, size };

  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const result = deleteRecursive(fullPath);
        deleted += result.deleted;
        size += result.size;
        fs.rmdirSync(fullPath);
        deleted++;
      } else {
        size += stat.size;
        fs.unlinkSync(fullPath);
        deleted++;
      }
    } catch (err) {
      console.error(`Failed to delete ${fullPath}: ${err.message}`);
    }
  }

  return { deleted, size };
}

// Format size
function formatBytes(bytes, decimals = 2) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i];
}
