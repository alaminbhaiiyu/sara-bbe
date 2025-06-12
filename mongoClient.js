// mongoClient.js
const { MongoClient } = require("mongodb");
const fs = require("fs");

const config = JSON.parse(fs.readFileSync("/mongo.json", "utf8"));
const client = new MongoClient(config.mongoURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

let dbInstance = null;

async function connectMongo() {
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db(config.dbName);
    console.log("✅ MongoDB Connected.");
  }
  return dbInstance;
}

module.exports = {
  connectMongo,
  getCollection: async () => {
    const db = await connectMongo();
    return db.collection(config.collectionName);
  }
};
