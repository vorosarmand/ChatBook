import pkg from "express-openid-connect";
const { requiresAuth } = pkg;

export const setupAuthRoutes = (app) => {
  app.get("/api/auth/token", requiresAuth(), (req, res) => {
    console.log("Access token on server:", req.oidc.idToken);
    res.send({ access_token: req.oidc.idToken });
  });
};
