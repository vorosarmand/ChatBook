const { requiresAuth } = require("express-openid-connect");
const { getDb, saveChat } = require("../db/db");
const { openai, pusherConfig: pusher } = require("../config/config");

let conversationHistories = new Map();

const setupMessageRoutes = (app) => {
  app.post("/send-message", requiresAuth(), async (req, res) => {
    const { message, conversationId } = req.body;
    req.body = JSON.parse(JSON.stringify(req.body));

    if (!message) {
      return res
        .status(400)
        .send({ error: "Message is missing in the request" });
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
      return res
        .status(400)
        .send({ error: "Prompt is missing in the request" });
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

      pusher.trigger(`chat-${conversationId}`, "new-message", {
        role: "assistant",
        content: botMessage,
      });

      return res.send({ choices: [{ text: botMessage }] });
    } catch (error) {
      const errorMsg = error.response ? error.response.data.error : `${error}`;
      console.error(`Error getting prompt result: ${errorMsg}`);
      return res.status(500).send({ error: errorMsg });
    }
  });
};

module.exports = { setupMessageRoutes };
