// Import the required modules
const { MongoClient } = require("mongodb");
require("dotenv").config();

// Retrieve the MongoDB URI from environment variables
const uri = process.env.MONGODB_URI;

// Create a new MongoDB client with necessary options
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Declare a variable to store the database instance
let db;

// Define an asynchronous function to connect to the MongoDB database
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

// Define an asynchronous function to save a chat to the database
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

// Export the connectDB and saveChat functions for use in other modules
module.exports = {
  connectDB,
  saveChat,
};
