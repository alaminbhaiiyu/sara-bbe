const { createCanvas, loadImage } = require('canvas'); const fs = require('fs-extra'); const path = require('path');

module.exports = { config: { name: "gcimg", aliases: [], version: "1.0", author: "ChatGPT", countDown: 10, role: 0, description: "Generate group collage with profile images and top 5 members", category: "group", guide: { en: "{pn}" } },

onStart: async function ({ api, event, message, usersData, threadsData }) { const threadID = event.threadID; api.setMessageReaction("⏳", event.messageID, () => {}, true);

const threadInfo = await api.getThreadInfo(threadID);
const threadData = await threadsData.get(threadID);
const groupName = threadInfo.threadName || "Group Chat";
const groupPhotoURL = threadInfo.imageSrc;
const adminIDs = threadInfo.adminIDs.map(admin => admin.id);
const allMembers = threadInfo.participantIDs;
const normalMembers = allMembers.filter(id => !adminIDs.includes(id));

const canvasWidth = 1500;
const avatarSize = 120;
const padding = 30;
const gap = 25;
const fontSize = 20;
const rowHeight = avatarSize + fontSize + gap;

const adminColumns = Math.min(adminIDs.length, 8);
const adminRowHeight = adminIDs.length ? rowHeight + 40 : 0;

const columns = Math.floor((canvasWidth - padding * 2) / (avatarSize + gap));
const rows = Math.ceil(normalMembers.length / columns);
const canvasHeight = 300 + adminRowHeight + rows * rowHeight + padding;

const canvas = createCanvas(canvasWidth, canvasHeight);
const ctx = canvas.getContext("2d");

// Background white
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, canvasWidth, canvasHeight);

// Group Image
if (groupPhotoURL) {
  try {
    const groupImg = await loadImage(groupPhotoURL);
    ctx.drawImage(groupImg, canvasWidth / 2 - 60, 30, 120, 120);
  } catch {}
}

// Group Name
ctx.fillStyle = "#000000";
ctx.font = "bold 36px Arial";
ctx.textAlign = "center";
ctx.fillText(groupName, canvasWidth / 2, 180);

// Top 5 Members
let sorted = [...(threadData.members || [])].sort((a, b) => b.count - a.count);
let topMembers = sorted.slice(0, 5).map(m => `${m.name}: ${m.count}`).join(" | ");
ctx.font = "20px Arial";
ctx.fillText(`Top 5: ${topMembers}`, canvasWidth / 2, 220);

// Admins row
let startY = 250;
if (adminIDs.length) {
  ctx.font = "22px Arial";
  ctx.fillStyle = "#000";
  ctx.fillText("Admins:", canvasWidth / 2, startY);

  for (let i = 0; i < adminIDs.length; i++) {
    const id = adminIDs[i];
    const name = await usersData.getName(id);
    const url = await usersData.getAvatarUrl(id);

    const x = padding + i * (avatarSize + gap);
    const y = startY + 20;

    try {
      const img = await loadImage(url);
      ctx.save();
      ctx.strokeStyle = "gold";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.closePath();
      ctx.restore();

      ctx.drawImage(img, x, y, avatarSize, avatarSize);
      ctx.font = "16px Arial";
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.fillText(name.length > 16 ? name.slice(0, 15) + "…" : name, x + avatarSize / 2, y + avatarSize + 18);
    } catch (e) {
      console.error(`Failed to load admin avatar ${id}: ${e.message}`);
    }
  }
  startY += avatarSize + 60;
}

// Members
for (let i = 0; i < normalMembers.length; i++) {
  const id = normalMembers[i];
  const name = await usersData.getName(id);
  const url = await usersData.getAvatarUrl(id);

  const col = i % columns;
  const row = Math.floor(i / columns);
  const x = padding + col * (avatarSize + gap);
  const y = startY + row * rowHeight;

  try {
    const img = await loadImage(url);
    ctx.drawImage(img, x, y, avatarSize, avatarSize);
    ctx.font = "16px Arial";
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.fillText(name.length > 16 ? name.slice(0, 15) + "…" : name, x + avatarSize / 2, y + avatarSize + 18);
  } catch (e) {
    console.error(`Failed to load member avatar ${id}: ${e.message}`);
  }
}

const outputPath = path.join(__dirname, `cache/gcimg-${threadID}.png`);
await fs.ensureDir(path.dirname(outputPath));
fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));

api.setMessageReaction("✅", event.messageID, () => {}, true);
message.reply({
  body: `Group Image: ${groupName}`,
  attachment: fs.createReadStream(outputPath)
});

} };