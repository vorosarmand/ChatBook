import { json } from "express";
import cors from "cors";
import pkg from "express-openid-connect";
const { requiresAuth } = pkg;
import session from "express-session";

export const setupMiddleware = (app) => {
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
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    next();
  });
  app.use(json());
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
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
};
