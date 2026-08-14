"""Seed the database with an admin user and a sample catalog.

Usage:  python -m app.seed
"""

from .database import Base, SessionLocal, engine
from .models import Product, User
from .security import hash_password

CATALOG = [
    ("Mechanical Keyboard", "Hot-swappable 75% board with tactile switches.", "electronics", 8900, 25),
    ("4K Webcam", "Sharp low-light webcam with autofocus.", "electronics", 12900, 18),
    ("USB-C Dock", "11-in-1 dock: dual HDMI, ethernet, 100W PD.", "electronics", 7400, 30),
    ("Standing Desk Mat", "Anti-fatigue mat for long standing sessions.", "office", 4500, 40),
    ("Ergonomic Chair", "Breathable mesh chair with lumbar support.", "office", 27900, 10),
    ("Desk Lamp", "Adjustable color-temperature LED lamp.", "office", 3900, 55),
    ("Pour-Over Kettle", "Gooseneck kettle with temperature control.", "kitchen", 6900, 22),
    ("Espresso Grinder", "48mm conical burr hand grinder.", "kitchen", 9900, 15),
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add(
                User(
                    name="Admin",
                    email="admin@shoplite.dev",
                    password_hash=hash_password("admin-password-1"),
                    is_admin=True,
                )
            )
        if db.query(Product).count() == 0:
            for name, description, category, price_cents, stock in CATALOG:
                db.add(
                    Product(
                        name=name,
                        description=description,
                        category=category,
                        price_cents=price_cents,
                        stock=stock,
                    )
                )
        db.commit()
        print(f"Seeded: {db.query(User).count()} users, {db.query(Product).count()} products")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
