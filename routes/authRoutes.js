const { requiresAuth } = require("express-openid-connect");

const setupAuthRoutes = (app) => {
  app.get("/api/auth/token", requiresAuth(), (req, res) => {
    console.log("Access token on server:", req.oidc.idToken);
    res.send({ access_token: req.oidc.idToken });
  });
};

module.exports = {
  setupAuthRoutes,
};
