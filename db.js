const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let db;

async function connectDB() {
  if (!db) {
    try {
      await client.connect();
      db = client.db("cbdata");
      console.log("Connected to MongoDB");
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
    }
  }
}

async function createUser({ user_id, date_created, active }) {
  try {
    const usersCollection = db.collection("users");
    await usersCollection.insertOne({
      user_id,
      date_created,
      active,
    });
  } catch (error) {
    console.error(`Error creating user: ${error}`);
  }
}

async function saveChat({ chat_id, date_created, deleted_bool, content }) {
  try {
    const chatsCollection = db.collection("chats");
    await chatsCollection.updateOne(
      { chat_id },
      {
        $set: {
          date_created,
          deleted_bool,
          content,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`Error saving chat: ${error}`);
  }
}

module.exports = {
  connectDB,
  saveChat,
  createUser,
};
