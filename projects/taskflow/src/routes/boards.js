const express = require("express");
const { requireAuth } = require("../auth");

module.exports = function boardRoutes(db) {
  const router = express.Router();
  // Scoped to the resource prefixes so unknown /api paths still reach
  // the JSON 404 handler instead of dying here with a 401.
  router.use(["/boards", "/columns", "/cards"], requireAuth);

  /* ---------- ownership helpers ---------- */

  function getOwnedBoard(boardId, userId) {
    return db
      .prepare("SELECT * FROM boards WHERE id = ? AND user_id = ?")
      .get(boardId, userId);
  }

  function getOwnedColumn(columnId, userId) {
    return db
      .prepare(
        `SELECT c.* FROM columns c
         JOIN boards b ON b.id = c.board_id
         WHERE c.id = ? AND b.user_id = ?`
      )
      .get(columnId, userId);
  }

  function getOwnedCard(cardId, userId) {
    return db
      .prepare(
        `SELECT ca.* FROM cards ca
         JOIN columns c ON c.id = ca.column_id
         JOIN boards b ON b.id = c.board_id
         WHERE ca.id = ? AND b.user_id = ?`
      )
      .get(cardId, userId);
  }

  /* ---------- boards ---------- */

  router.get("/boards", (req, res) => {
    const boards = db
      .prepare("SELECT * FROM boards WHERE user_id = ? ORDER BY created_at DESC")
      .all(req.userId);
    res.json({ boards });
  });

  router.post("/boards", (req, res) => {
    const title = (req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "title is required" });

    const info = db
      .prepare("INSERT INTO boards (user_id, title) VALUES (?, ?)")
      .run(req.userId, title);

    // Every new board starts with the classic three columns.
    const insertCol = db.prepare(
      "INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)"
    );
    ["To Do", "In Progress", "Done"].forEach((t, i) =>
      insertCol.run(info.lastInsertRowid, t, i)
    );

    const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ board });
  });

  router.get("/boards/:id", (req, res) => {
    const board = getOwnedBoard(req.params.id, req.userId);
    if (!board) return res.status(404).json({ error: "Board not found" });

    const columns = db
      .prepare("SELECT * FROM columns WHERE board_id = ? ORDER BY position")
      .all(board.id);
    const cardsByColumn = db
      .prepare(
        `SELECT ca.* FROM cards ca
         JOIN columns c ON c.id = ca.column_id
         WHERE c.board_id = ? ORDER BY ca.position`
      )
      .all(board.id)
      .reduce((acc, card) => {
        (acc[card.column_id] ??= []).push(card);
        return acc;
      }, {});

    res.json({
      board: {
        ...board,
        columns: columns.map((col) => ({ ...col, cards: cardsByColumn[col.id] || [] })),
      },
    });
  });

  router.patch("/boards/:id", (req, res) => {
    const board = getOwnedBoard(req.params.id, req.userId);
    if (!board) return res.status(404).json({ error: "Board not found" });

    const title = (req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "title is required" });

    db.prepare("UPDATE boards SET title = ? WHERE id = ?").run(title, board.id);
    res.json({ board: { ...board, title } });
  });

  router.delete("/boards/:id", (req, res) => {
    const board = getOwnedBoard(req.params.id, req.userId);
    if (!board) return res.status(404).json({ error: "Board not found" });

    db.prepare("DELETE FROM boards WHERE id = ?").run(board.id);
    res.status(204).end();
  });

  /* ---------- columns ---------- */

  router.post("/boards/:id/columns", (req, res) => {
    const board = getOwnedBoard(req.params.id, req.userId);
    if (!board) return res.status(404).json({ error: "Board not found" });

    const title = (req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "title is required" });

    const { next } = db
      .prepare("SELECT COALESCE(MAX(position) + 1, 0) AS next FROM columns WHERE board_id = ?")
      .get(board.id);
    const info = db
      .prepare("INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)")
      .run(board.id, title, next);

    const column = db.prepare("SELECT * FROM columns WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ column });
  });

  router.patch("/columns/:id", (req, res) => {
    const column = getOwnedColumn(req.params.id, req.userId);
    if (!column) return res.status(404).json({ error: "Column not found" });

    const title = (req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "title is required" });

    db.prepare("UPDATE columns SET title = ? WHERE id = ?").run(title, column.id);
    res.json({ column: { ...column, title } });
  });

  router.delete("/columns/:id", (req, res) => {
    const column = getOwnedColumn(req.params.id, req.userId);
    if (!column) return res.status(404).json({ error: "Column not found" });

    db.prepare("DELETE FROM columns WHERE id = ?").run(column.id);
    res.status(204).end();
  });

  /* ---------- cards ---------- */

  router.post("/columns/:id/cards", (req, res) => {
    const column = getOwnedColumn(req.params.id, req.userId);
    if (!column) return res.status(404).json({ error: "Column not found" });

    const title = (req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "title is required" });
    const description = (req.body?.description || "").trim();

    const { next } = db
      .prepare("SELECT COALESCE(MAX(position) + 1, 0) AS next FROM cards WHERE column_id = ?")
      .get(column.id);
    const info = db
      .prepare("INSERT INTO cards (column_id, title, description, position) VALUES (?, ?, ?, ?)")
      .run(column.id, title, description, next);

    const card = db.prepare("SELECT * FROM cards WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ card });
  });

  // Update a card's fields and/or move it to a new column/position.
  router.patch("/cards/:id", (req, res) => {
    const card = getOwnedCard(req.params.id, req.userId);
    if (!card) return res.status(404).json({ error: "Card not found" });

    const { title, description, columnId, position } = req.body || {};

    if (title !== undefined) {
      const trimmed = String(title).trim();
      if (!trimmed) return res.status(400).json({ error: "title cannot be empty" });
      db.prepare("UPDATE cards SET title = ? WHERE id = ?").run(trimmed, card.id);
    }
    if (description !== undefined) {
      db.prepare("UPDATE cards SET description = ? WHERE id = ?").run(
        String(description).trim(),
        card.id
      );
    }

    if (columnId !== undefined || position !== undefined) {
      const targetColumnId = columnId ?? card.column_id;
      const target = getOwnedColumn(targetColumnId, req.userId);
      if (!target) return res.status(404).json({ error: "Target column not found" });

      const siblings = db
        .prepare("SELECT id FROM cards WHERE column_id = ? AND id != ? ORDER BY position")
        .all(target.id, card.id);
      const insertAt = Math.max(
        0,
        Math.min(position ?? siblings.length, siblings.length)
      );
      siblings.splice(insertAt, 0, { id: card.id });

      // Renumber both affected columns in one transaction so positions
      // stay dense (0..n-1) no matter what the client sends.
      const renumber = db.transaction(() => {
        db.prepare("UPDATE cards SET column_id = ? WHERE id = ?").run(target.id, card.id);
        const update = db.prepare("UPDATE cards SET position = ? WHERE id = ?");
        siblings.forEach((s, i) => update.run(i, s.id));
        if (target.id !== card.column_id) {
          db.prepare("SELECT id FROM cards WHERE column_id = ? ORDER BY position")
            .all(card.column_id)
            .forEach((s, i) => update.run(i, s.id));
        }
      });
      renumber();
    }

    const updated = db.prepare("SELECT * FROM cards WHERE id = ?").get(card.id);
    res.json({ card: updated });
  });

  router.delete("/cards/:id", (req, res) => {
    const card = getOwnedCard(req.params.id, req.userId);
    if (!card) return res.status(404).json({ error: "Card not found" });

    db.prepare("DELETE FROM cards WHERE id = ?").run(card.id);
    res.status(204).end();
  });

  return router;
};
