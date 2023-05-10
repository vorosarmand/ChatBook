require("dotenv").config();
const { connectDB, saveChat, getDb } = require("./db");
const express = require("express");
const { Configuration, OpenAIApi } = require("openai");
const cors = require("cors");
const { auth, requiresAuth } = require("express-openid-connect");
const session = require("express-session");

const Pusher = require("pusher");

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const conversationHistories = new Map();

const port = process.env.PORT || 3001;

const app = express();
const corsOptions = {
  origin: "*",
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    baseURL: process.env.AUTH0_BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    secret: process.env.AUTH0_SECRET,
    idpLogout: true,
  })
);

app.use(
  "/",
  requiresAuth(),
  (req, res, next) => {
    req.app.locals.pusherAppKey = process.env.PUSHER_KEY;
    req.app.locals.pusherCluster = process.env.PUSHER_CLUSTER;
    next();
  },
  express.static(__dirname + "/client")
);

app.get("/api/auth/token", requiresAuth(), (req, res) => {
  console.log("Access token on server:", req.oidc.idToken);
  res.send({ access_token: req.oidc.idToken });
});

app.get(
  "/api/chat-history/:conversationId",
  requiresAuth(),
  async (req, res) => {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res
        .status(400)
        .send({ error: "Conversation ID is missing in the request" });
    }

    try {
      const chatsCollection = getDb().collection("chats");
      const chat = await chatsCollection.findOne({ chat_id: conversationId });

      if (chat) {
        conversationHistories.set(conversationId, chat.content);
        res.status(200).send(chat.content);
      } else {
        res.status(200).send([]);
      }
    } catch (error) {
      console.error(`Error fetching chat history: ${error}`);
      res.status(500).send("Error fetching chat history");
    }
  }
);

app.post("/send-message", requiresAuth(), async (req, res) => {
  const { message, conversationId } = req.body;
  req.body = JSON.parse(JSON.stringify(req.body));

  if (!message) {
    return res.status(400).send({ error: "Message is missing in the request" });
  }
  if (!conversationId) {
    return res
      .status(400)
      .send({ error: "Conversation ID is missing in the request" });
  }

  try {
    const messages = conversationHistories.get(conversationId) || [];
    messages.push({ role: "user", content: message });

    pusher.trigger(`chat-${conversationId}`, "new-message", {
      role: "user",
      content: message,
    });

    conversationHistories.set(conversationId, messages);
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

    const channel = `chat-${conversationId}`;
    pusher.trigger(`chat-${conversationId}`, "new-message", {
      role: "assistant",
      content: botMessage,
    });

    console.log("Event triggered for conversation ID:", conversationId);

    res.status(200).send("Message sent and event triggered");
  } catch (error) {
    console.error(`Error sending message: ${error}`);
    res.status(500).send("Error sending message");
  }
});

app.post("/api/get-prompt-result", requiresAuth(), async (req, res) => {
  const { prompt, conversationId } = req.body;

  if (!prompt) {
    return res.status(400).send({ error: "Prompt is missing in the request" });
  }
  if (!conversationId) {
    return res
      .status(400)
      .send({ error: "Conversation ID is missing in the request" });
  }

  try {
    let messages;

    if (conversationHistories.has(conversationId)) {
      messages = conversationHistories.get(conversationId);
    } else {
      messages = [];
      conversationHistories.set(conversationId, messages);
    }

    messages.push({ role: "user", content: prompt });

    pusher.trigger(`chat-${conversationId}`, "new-message", {
      role: "user",
      content: prompt,
    });

    const apiMessages = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const result = await openai.createChatCompletion({
      model: "gpt-4",
      messages: apiMessages,
    });
    const botMessage = result.data.choices[0]?.message?.content;

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
    console.log("Emitting new-message event on server-side");
    pusher.trigger(`chat-${conversationId}`, "new-message", {
      role: "assistant",
      content: botMessage,
    });

    return res.send(botMessage);
  } catch (error) {
    const errorMsg = error.response ? error.response.data.error : `${error}`;
    console.error(errorMsg);
    return res.status(500).send(errorMsg);
  }
});

async function startServer() {
  try {
    const db = await connectDB();
    console.log("Connected to the database");
    app.listen(port, () => console.log(`Listening on port ${port}`));
  } catch (error) {
    console.error(`Error connecting to database: ${error}`);
  }
}

startServer();
