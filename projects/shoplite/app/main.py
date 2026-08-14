from fastapi import FastAPI

from .database import Base, engine
from .routers import auth, cart, orders, products


def create_app() -> FastAPI:
    Base.metadata.create_all(bind=engine)

    app = FastAPI(
        title="ShopLite",
        description="A production-style e-commerce REST API: catalog with search, "
        "cart, and checkout with stock control and price snapshots.",
        version="1.0.0",
    )

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(products.router)
    app.include_router(cart.router)
    app.include_router(orders.router)
    return app


app = create_app()
