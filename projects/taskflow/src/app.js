const path = require("path");
const express = require("express");
const { createDb } = require("./db");
const authRoutes = require("./routes/auth");
const boardRoutes = require("./routes/boards");

/**
 * App factory: builds an Express app around the given SQLite path.
 * Tests pass ":memory:" to get a fresh, isolated database per suite.
 */
function createApp(dbPath) {
  const db = createDb(dbPath);
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRoutes(db));
  app.use("/api", boardRoutes(db));

  // JSON 404 for unknown API routes (static handler covers the rest).
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

  // Central error handler: malformed JSON bodies, unexpected failures.
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Malformed JSON body" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  app.locals.db = db;
  return app;
}

module.exports = { createApp };
