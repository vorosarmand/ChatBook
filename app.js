require("dotenv").config();
const { connectDB, saveChat } = require("./db");
const express = require("express");
const { Configuration, OpenAIApi } = require("openai");
const cors = require("cors");
const { auth, requiresAuth } = require("express-openid-connect");
const session = require("express-session");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const conversationHistories = new Map();

const port = process.env.PORT || 3001;

const app = express();
app.use(cors());
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

app.use("/", requiresAuth(), express.static(__dirname + "/client"));

app.get("/api/auth/token", requiresAuth(), (req, res) => {
  console.log("Access token on server:", req.oidc.idToken);
  res.send({ access_token: req.oidc.idToken });
});

app.post("/get-prompt-result", requiresAuth(), async (req, res) => {
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

    const result = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages,
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

    return res.send(botMessage);
  } catch (error) {
    const errorMsg = error.response ? error.response.data.error : `${error}`;
    console.error(errorMsg);
    return res.status(500).send(errorMsg);
  }
});

async function startServer() {
  try {
    await connectDB();
    console.log("Connected to the database");
    app.listen(port, () => console.log(`Listening on port ${port}`));
  } catch (error) {
    console.error(`Error connecting to database: ${error}`);
  }
}

startServer();
