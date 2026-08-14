const request = require("supertest");
const { createApp } = require("../src/app");

let app;

beforeEach(() => {
  app = createApp(":memory:");
});

afterEach(() => {
  app.locals.db.close();
});

async function registerAndLogin(email = "mahden@example.com") {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Mahden", email, password: "supersecret1" });
  return res.body.token;
}

describe("health", () => {
  test("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("auth", () => {
  test("registers a new user and returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Mahden", email: "m@example.com", password: "supersecret1" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ name: "Mahden", email: "m@example.com" });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test.each([
    [{ email: "m@example.com", password: "supersecret1" }, "missing name"],
    [{ name: "M", email: "not-an-email", password: "supersecret1" }, "bad email"],
    [{ name: "M", email: "m@example.com", password: "short" }, "short password"],
  ])("rejects invalid registration (%#: %s)", async (body) => {
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(400);
  });

  test("rejects duplicate email with 409", async () => {
    await registerAndLogin("dup@example.com");
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Other", email: "DUP@example.com", password: "supersecret1" });
    expect(res.status).toBe(409);
  });

  test("logs in with correct credentials", async () => {
    await registerAndLogin("login@example.com");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "supersecret1" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test("rejects wrong password with the same error as unknown email", async () => {
    await registerAndLogin("secure@example.com");
    const wrongPw = await request(app)
      .post("/api/auth/login")
      .send({ email: "secure@example.com", password: "wrong-password" });
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever123" });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.error).toBe(unknown.body.error);
  });

  test("GET /api/auth/me returns the current user", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("mahden@example.com");
  });

  test("protected routes reject missing or garbage tokens", async () => {
    expect((await request(app).get("/api/boards")).status).toBe(401);
    expect(
      (await request(app).get("/api/boards").set("Authorization", "Bearer nope")).status
    ).toBe(401);
  });
});

describe("boards", () => {
  test("creates a board with default columns", async () => {
    const token = await registerAndLogin();
    const created = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Launch plan" });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/api/boards/${created.body.board.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.board.columns.map((c) => c.title)).toEqual([
      "To Do",
      "In Progress",
      "Done",
    ]);
  });

  test("rejects a board without a title", async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "   " });
    expect(res.status).toBe(400);
  });

  test("users cannot see or delete each other's boards", async () => {
    const alice = await registerAndLogin("alice@example.com");
    const bob = await registerAndLogin("bob@example.com");

    const created = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${alice}`)
      .send({ title: "Alice's board" });
    const boardId = created.body.board.id;

    const peek = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${bob}`);
    expect(peek.status).toBe(404);

    const del = await request(app)
      .delete(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${bob}`);
    expect(del.status).toBe(404);

    // Alice still has it.
    const mine = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${alice}`);
    expect(mine.status).toBe(200);
  });

  test("renames and deletes a board", async () => {
    const token = await registerAndLogin();
    const { body } = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Old name" });

    const renamed = await request(app)
      .patch(`/api/boards/${body.board.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "New name" });
    expect(renamed.body.board.title).toBe("New name");

    const del = await request(app)
      .delete(`/api/boards/${body.board.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const gone = await request(app)
      .get(`/api/boards/${body.board.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(gone.status).toBe(404);
  });
});

describe("cards", () => {
  async function setupBoard(token) {
    const { body } = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Board" });
    const res = await request(app)
      .get(`/api/boards/${body.board.id}`)
      .set("Authorization", `Bearer ${token}`);
    return res.body.board;
  }

  async function addCard(token, columnId, title) {
    const res = await request(app)
      .post(`/api/columns/${columnId}/cards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title });
    return res.body.card;
  }

  test("creates cards with dense positions", async () => {
    const token = await registerAndLogin();
    const board = await setupBoard(token);
    const col = board.columns[0];

    const a = await addCard(token, col.id, "First");
    const b = await addCard(token, col.id, "Second");
    expect(a.position).toBe(0);
    expect(b.position).toBe(1);
  });

  test("moves a card between columns and renumbers both", async () => {
    const token = await registerAndLogin();
    const board = await setupBoard(token);
    const [todo, doing] = board.columns;

    const a = await addCard(token, todo.id, "A");
    const b = await addCard(token, todo.id, "B");
    await addCard(token, doing.id, "X");

    // Move A to "In Progress" at position 0.
    const moved = await request(app)
      .patch(`/api/cards/${a.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ columnId: doing.id, position: 0 });
    expect(moved.status).toBe(200);
    expect(moved.body.card.column_id).toBe(doing.id);
    expect(moved.body.card.position).toBe(0);

    const res = await request(app)
      .get(`/api/boards/${board.id}`)
      .set("Authorization", `Bearer ${token}`);
    const cols = res.body.board.columns;
    expect(cols[0].cards.map((c) => c.title)).toEqual(["B"]);
    expect(cols[0].cards[0].position).toBe(0); // B renumbered after A left
    expect(cols[1].cards.map((c) => c.title)).toEqual(["A", "X"]);
    expect(b.id).toBe(cols[0].cards[0].id);
  });

  test("clamps out-of-range target positions", async () => {
    const token = await registerAndLogin();
    const board = await setupBoard(token);
    const col = board.columns[0];
    const card = await addCard(token, col.id, "Solo");

    const res = await request(app)
      .patch(`/api/cards/${card.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ position: 999 });
    expect(res.status).toBe(200);
    expect(res.body.card.position).toBe(0);
  });

  test("cannot move a card into another user's column", async () => {
    const alice = await registerAndLogin("alice2@example.com");
    const bob = await registerAndLogin("bob2@example.com");
    const aliceBoard = await setupBoard(alice);
    const bobBoard = await setupBoard(bob);
    const card = await addCard(alice, aliceBoard.columns[0].id, "Private");

    const res = await request(app)
      .patch(`/api/cards/${card.id}`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ columnId: bobBoard.columns[0].id });
    expect(res.status).toBe(404);
  });

  test("updates title and description", async () => {
    const token = await registerAndLogin();
    const board = await setupBoard(token);
    const card = await addCard(token, board.columns[0].id, "Draft");

    const res = await request(app)
      .patch(`/api/cards/${card.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Final", description: "Ship it" });
    expect(res.body.card).toMatchObject({ title: "Final", description: "Ship it" });
  });

  test("deleting a column cascades to its cards", async () => {
    const token = await registerAndLogin();
    const board = await setupBoard(token);
    const col = board.columns[0];
    const card = await addCard(token, col.id, "Doomed");

    await request(app)
      .delete(`/api/columns/${col.id}`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/cards/${card.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Still here?" });
    expect(res.status).toBe(404);
  });
});

describe("error handling", () => {
  test("malformed JSON gets a 400, not a crash", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
  });

  test("unknown API route returns JSON 404", async () => {
    const res = await request(app).get("/api/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});
