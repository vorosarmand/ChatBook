const { requiresAuth } = require("express-openid-connect");
const { getDb } = require("../db/db");

let conversationHistories = new Map();

const setupChatRoutes = (app) => {
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
        console.error(`Stack trace: ${error.stack}`);
        res.status(500).send("Error fetching chat history");
      }
    }
  );
};

module.exports = {
  setupChatRoutes,
};
