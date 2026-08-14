const express = require("express");
const bcrypt = require("bcryptjs");
const { signToken, requireAuth } = require("../auth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

module.exports = function authRoutes(db) {
  const router = express.Router();

  router.post("/register", (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
      .run(name.trim(), email.trim(), hash);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  });

  router.post("/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      // Same message for both cases so attackers can't probe which emails exist.
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  });

  router.get("/me", requireAuth, (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: publicUser(user) });
  });

  return router;
};
