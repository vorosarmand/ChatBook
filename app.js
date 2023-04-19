// Import required modules and functions
const { connectDB, saveChat } = require("./db");
const express = require("express");
const { Configuration, OpenAIApi } = require("openai");
const cors = require("cors");
require("dotenv").config();

// Initialize OpenAI API client with the API key
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Create a map to store conversation histories
const conversationHistories = new Map();

// Define the port to be used for the server
const port = process.env.PORT || 3001;

// Configure express app with middlewares and routes
const app = express();
app.use(cors());
app.use(express.json());
app.use("/", express.static(__dirname + "/client"));

// Route to handle the post request for getting a prompt result from GPT-3.5
app.post("/get-prompt-result", async (req, res) => {
  const { prompt, conversationId } = req.body;

  // Return an error if the prompt is missing in the request
  if (!prompt) {
    return res.status(400).send({ error: "Prompt is missing in the request" });
  }
  // Return an error if the conversation ID is missing in the request
  if (!conversationId) {
    return res
      .status(400)
      .send({ error: "Conversation ID is missing in the request" });
  }

  try {
    let messages;

    // Check if conversation history exists, otherwise create a new one
    if (conversationHistories.has(conversationId)) {
      messages = conversationHistories.get(conversationId);
    } else {
      messages = [];
      conversationHistories.set(conversationId, messages);
    }

    // Add user's message to the conversation history
    messages.push({ role: "user", content: prompt });

    // Call OpenAI API to get the bot response
    const result = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages,
    });
    const botMessage = result.data.choices[0]?.message?.content;

    // Add bot's response to the conversation history and save it to the database
    messages.push({ role: "assistant", content: botMessage });
    await saveChat({
      chat_id: conversationId,
      date_created: new Date(),
      deleted_bool: false,
      content: messages.map((message, index) => ({
        index: index + 1,
        timestamp: new Date(),
        ...message,
      })),
    });

    // Send the bot's response back to the client
    return res.send(botMessage);
  } catch (error) {
    // Handle errors and return a 500 status code with the error message
    const errorMsg = error.response ? error.response.data.error : `${error}`;
    console.error(errorMsg);
    return res.status(500).send(errorMsg);
  }
});

// Define an asynchronous function to start the server
async function startServer() {
  try {
    await connectDB();
    console.log("Connected to the database");
    app.listen(port, () => console.log(`Listening on port ${port}`));
  } catch (error) {
    console.error(`Error connecting to database: ${error}`);
  }
}

// Start the server
startServer();
