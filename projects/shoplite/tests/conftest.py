import os

# Must be set before the app modules are imported.
os.environ["DATABASE_URL"] = "sqlite:///./test_shoplite.db"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Product, User
from app.security import hash_password


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_token(client):
    db = SessionLocal()
    db.add(
        User(
            name="Admin",
            email="admin@example.com",
            password_hash=hash_password("admin-secret-1"),
            is_admin=True,
        )
    )
    db.commit()
    db.close()
    res = client.post(
        "/auth/login", json={"email": "admin@example.com", "password": "admin-secret-1"}
    )
    return res.json()["token"]


@pytest.fixture
def user_token(client):
    res = client.post(
        "/auth/register",
        json={"name": "Mahden", "email": "mahden@example.com", "password": "supersecret1"},
    )
    return res.json()["token"]


@pytest.fixture
def catalog():
    db = SessionLocal()
    products = [
        Product(name="Mechanical Keyboard", description="Tactile switches", category="electronics", price_cents=8900, stock=5),
        Product(name="4K Webcam", description="Autofocus camera", category="electronics", price_cents=12900, stock=2),
        Product(name="Desk Lamp", description="LED lamp", category="office", price_cents=3900, stock=10),
    ]
    db.add_all(products)
    db.commit()
    ids = [p.id for p in products]
    db.close()
    return ids


def auth(token):
    return {"Authorization": f"Bearer {token}"}
