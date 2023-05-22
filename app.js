import express from "express";
import { join } from "path";
import { auth } from "express-openid-connect";
import { setupMiddleware } from "./middleware/middleware.js";
import { setupAuthRoutes } from "./routes/authRoutes.js";
import { setupChatRoutes } from "./routes/chatRoutes.js";
import { setupMessageRoutes } from "./routes/messageRoutes.js";
import { authConfig } from "./config/config.js";
import { connectDB } from "./db/db.js";

const app = express();

app.use(express.static(join(__dirname, "client")));

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
