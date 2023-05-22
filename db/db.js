import { MongoClient } from "mongodb";
//require("dotenv").config();

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let connectedDb;

export async function connectDB() {
  if (!connectedDb) {
    try {
      await client.connect();
      connectedDb = client.db("cbdata");
      console.log("Connected to MongoDB");
      return connectedDb;
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
    }
  } else {
    return connectedDb;
  }
}

export async function createUser({ user_id, date_created, active }) {
  try {
    const usersCollection = connectedDb.collection("users");
    await usersCollection.insertOne({
      user_id,
      date_created,
      active,
    });
  } catch (error) {
    console.error(`Error creating user: ${error}`);
  }
}

export async function saveChat({
  chat_id,
  date_created,
  deleted_bool,
  content,
}) {
  try {
    const chatsCollection = connectedDb.collection("chats");
    await chatsCollection.updateOne(
      { chat_id },
      {
        $set: {
          date_created,
          deleted_bool,
        },
        $push: { content: { $each: content } },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`Error saving chat: ${error}`);
  }
}

export function getDb() {
  return connectedDb;
}
