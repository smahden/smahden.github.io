from .conftest import auth


class TestAuth:
    def test_register_returns_token_and_user(self, client):
        res = client.post(
            "/auth/register",
            json={"name": "Mahden", "email": "m@example.com", "password": "supersecret1"},
        )
        assert res.status_code == 201
        body = res.json()
        assert body["token"]
        assert body["user"]["email"] == "m@example.com"
        assert "password_hash" not in body["user"]

    def test_register_rejects_short_password(self, client):
        res = client.post(
            "/auth/register",
            json={"name": "M", "email": "m@example.com", "password": "short"},
        )
        assert res.status_code == 422

    def test_register_rejects_duplicate_email_case_insensitive(self, client, user_token):
        res = client.post(
            "/auth/register",
            json={"name": "Clone", "email": "MAHDEN@example.com", "password": "supersecret1"},
        )
        assert res.status_code == 409

    def test_login_wrong_password_same_error_as_unknown_email(self, client, user_token):
        wrong = client.post(
            "/auth/login", json={"email": "mahden@example.com", "password": "nope-nope-nope"}
        )
        unknown = client.post(
            "/auth/login", json={"email": "ghost@example.com", "password": "whatever123"}
        )
        assert wrong.status_code == unknown.status_code == 401
        assert wrong.json()["detail"] == unknown.json()["detail"]

    def test_me_requires_token(self, client):
        assert client.get("/auth/me").status_code == 401
        assert client.get("/auth/me", headers=auth("garbage")).status_code == 401

    def test_me_returns_current_user(self, client, user_token):
        res = client.get("/auth/me", headers=auth(user_token))
        assert res.status_code == 200
        assert res.json()["email"] == "mahden@example.com"


class TestProducts:
    def test_list_is_public_and_paginated(self, client, catalog):
        res = client.get("/products", params={"page_size": 2})
        assert res.status_code == 200
        body = res.json()
        assert body["total"] == 3
        assert len(body["items"]) == 2

    def test_search_matches_name_and_description(self, client, catalog):
        by_name = client.get("/products", params={"q": "keyboard"}).json()
        assert [p["name"] for p in by_name["items"]] == ["Mechanical Keyboard"]

        by_description = client.get("/products", params={"q": "autofocus"}).json()
        assert [p["name"] for p in by_description["items"]] == ["4K Webcam"]

    def test_category_filter(self, client, catalog):
        res = client.get("/products", params={"category": "OFFICE"}).json()
        assert [p["name"] for p in res["items"]] == ["Desk Lamp"]

    def test_get_missing_product_404(self, client):
        assert client.get("/products/9999").status_code == 404

    def test_create_requires_admin(self, client, user_token):
        payload = {
            "name": "Gadget", "category": "misc", "price_cents": 100, "stock": 1,
        }
        assert client.post("/products", json=payload).status_code == 401
        assert (
            client.post("/products", json=payload, headers=auth(user_token)).status_code
            == 403
        )

    def test_admin_can_create_update_delete(self, client, admin_token):
        created = client.post(
            "/products",
            json={"name": "Gadget", "category": "misc", "price_cents": 500, "stock": 3},
            headers=auth(admin_token),
        )
        assert created.status_code == 201
        pid = created.json()["id"]

        updated = client.put(
            f"/products/{pid}",
            json={"name": "Gadget v2", "category": "misc", "price_cents": 600, "stock": 4},
            headers=auth(admin_token),
        )
        assert updated.json()["name"] == "Gadget v2"

        assert client.delete(f"/products/{pid}", headers=auth(admin_token)).status_code == 204
        assert client.get(f"/products/{pid}").status_code == 404

    def test_rejects_nonpositive_price(self, client, admin_token):
        res = client.post(
            "/products",
            json={"name": "Free?", "category": "misc", "price_cents": 0, "stock": 1},
            headers=auth(admin_token),
        )
        assert res.status_code == 422


class TestCart:
    def test_cart_starts_empty(self, client, user_token):
        res = client.get("/cart", headers=auth(user_token))
        assert res.json() == {"items": [], "subtotal_cents": 0}

    def test_add_and_merge_quantities(self, client, user_token, catalog):
        keyboard = catalog[0]
        client.post(
            "/cart/items", json={"product_id": keyboard, "quantity": 2},
            headers=auth(user_token),
        )
        res = client.post(
            "/cart/items", json={"product_id": keyboard, "quantity": 1},
            headers=auth(user_token),
        )
        body = res.json()
        assert len(body["items"]) == 1
        assert body["items"][0]["quantity"] == 3
        assert body["subtotal_cents"] == 3 * 8900

    def test_cannot_exceed_stock(self, client, user_token, catalog):
        webcam = catalog[1]  # stock = 2
        res = client.post(
            "/cart/items", json={"product_id": webcam, "quantity": 3},
            headers=auth(user_token),
        )
        assert res.status_code == 409

    def test_update_and_remove_item(self, client, user_token, catalog):
        lamp = catalog[2]
        client.post(
            "/cart/items", json={"product_id": lamp, "quantity": 1},
            headers=auth(user_token),
        )
        updated = client.put(
            f"/cart/items/{lamp}", json={"product_id": lamp, "quantity": 4},
            headers=auth(user_token),
        )
        assert updated.json()["items"][0]["quantity"] == 4

        removed = client.delete(f"/cart/items/{lamp}", headers=auth(user_token))
        assert removed.json()["items"] == []

    def test_carts_are_per_user(self, client, user_token, catalog):
        client.post(
            "/cart/items", json={"product_id": catalog[0], "quantity": 1},
            headers=auth(user_token),
        )
        other = client.post(
            "/auth/register",
            json={"name": "Other", "email": "other@example.com", "password": "supersecret1"},
        ).json()["token"]
        res = client.get("/cart", headers=auth(other))
        assert res.json()["items"] == []


class TestCheckout:
    def test_empty_cart_cannot_checkout(self, client, user_token):
        res = client.post("/orders/checkout", headers=auth(user_token))
        assert res.status_code == 400

    def test_checkout_creates_order_decrements_stock_clears_cart(
        self, client, user_token, catalog
    ):
        keyboard, _, lamp = catalog
        client.post(
            "/cart/items", json={"product_id": keyboard, "quantity": 2},
            headers=auth(user_token),
        )
        client.post(
            "/cart/items", json={"product_id": lamp, "quantity": 1},
            headers=auth(user_token),
        )

        res = client.post("/orders/checkout", headers=auth(user_token))
        assert res.status_code == 201
        order = res.json()
        assert order["total_cents"] == 2 * 8900 + 3900
        assert order["status"] == "paid"
        assert order["payment_ref"].startswith("pay_")
        assert len(order["items"]) == 2

        # Stock went down, cart is empty.
        assert client.get(f"/products/{keyboard}").json()["stock"] == 3
        assert client.get("/cart", headers=auth(user_token)).json()["items"] == []

    def test_order_prices_are_snapshots(self, client, user_token, admin_token, catalog):
        keyboard = catalog[0]
        client.post(
            "/cart/items", json={"product_id": keyboard, "quantity": 1},
            headers=auth(user_token),
        )
        order = client.post("/orders/checkout", headers=auth(user_token)).json()

        # Admin doubles the price afterwards…
        client.put(
            f"/products/{keyboard}",
            json={
                "name": "Mechanical Keyboard", "category": "electronics",
                "price_cents": 17800, "stock": 4,
            },
            headers=auth(admin_token),
        )

        # …but the order still shows what was actually paid.
        fetched = client.get(f"/orders/{order['id']}", headers=auth(user_token)).json()
        assert fetched["items"][0]["unit_price_cents"] == 8900

    def test_orders_are_private(self, client, user_token, catalog):
        client.post(
            "/cart/items", json={"product_id": catalog[0], "quantity": 1},
            headers=auth(user_token),
        )
        order = client.post("/orders/checkout", headers=auth(user_token)).json()

        other = client.post(
            "/auth/register",
            json={"name": "Other", "email": "other2@example.com", "password": "supersecret1"},
        ).json()["token"]
        assert client.get(f"/orders/{order['id']}", headers=auth(other)).status_code == 404
        assert client.get("/orders", headers=auth(other)).json() == []
