const express = require("express");
const path = require("path");
const { auth } = require("express-openid-connect");
const { requiresAuth } = require("express-openid-connect");
const { setupMiddleware } = require("./middleware/middleware");
const { setupAuthRoutes } = require("./routes/authRoutes");
const { setupChatRoutes } = require("./routes/chatRoutes");
const { setupMessageRoutes } = require("./routes/messageRoutes");
const { authConfig } = require("./config/config");
const { connectDB } = require("./db/db");

const app = express();

app.use(express.static(path.join(__dirname, "client")));

app.use(auth(authConfig));
setupMiddleware(app);

setupAuthRoutes(app);
setupChatRoutes(app);
setupMessageRoutes(app);

connectDB()
  .then(() => {
    const port = process.env.PORT || 3000;
    app.listen(port, () =>
      console.log(`Server is running on http://localhost:${port}`)
    );
  })
  .catch((error) => console.error("Failed to connect to MongoDB:", error));
