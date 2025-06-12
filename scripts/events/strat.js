const fs = require("fs");
const path = require("path");

// ✅ ঠিক path দিয়ে SQLite মডেল গুলো ইমপোর্ট
const threadModel = require("../../database/models/sqlite/thread.js");
const userModel = require("../../database/models/sqlite/user.js");
const dashBoardModel = require("../../database/models/sqlite/userDashBoard.js");
const globalModel = require("../../database/models/sqlite/global.js");

module.exports = {
  config: {
    name: "db",
    version: "1.1",
		author: "alit",
		description: "database",
		category: "events"
  },

  onStart: async function () {
    try {
      console.log("[⏳] Loading SQLite models and dumping data...");

      // Sequelize মডেল হিসেবে findAll() ইউজ করো
      const threads = await threadModel.findAll();
      const users = await userModel.findAll();
      const dashboards = await dashBoardModel.findAll();
      const globals = await globalModel.findAll();

      // শুধু plain JSON দরকার
      const finalData = {
        threads: threads.map(t => t.toJSON()),
        users: users.map(u => u.toJSON()),
        dashboards: dashboards.map(d => d.toJSON()),
        globals: globals.map(g => g.toJSON()),
        dumpedAt: new Date()
      };

      // ফোল্ডার চেক ও তৈরি
      const dir = path.join(__dirname, "../../data");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);

      // সেভ ফাইল
      const filePath = path.join(dir, "database.json");
      fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));

      console.log("[✅] SQLite database dumped to: data/database.json");

    } catch (err) {
      console.error("[❌] Error during SQLite dump:", err);
    }
  }
};
