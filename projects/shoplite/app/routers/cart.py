from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import CartItem, Product, User
from ..schemas import CartItemIn, CartOut
from ..security import get_current_user

router = APIRouter(prefix="/cart", tags=["cart"])


def _load_cart(db: Session, user: User) -> CartOut:
    items = db.scalars(
        select(CartItem)
        .options(selectinload(CartItem.product))
        .where(CartItem.user_id == user.id)
        .order_by(CartItem.id)
    ).all()
    subtotal = sum(item.product.price_cents * item.quantity for item in items)
    return CartOut(items=items, subtotal_cents=subtotal)


@router.get("", response_model=CartOut)
def get_cart(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _load_cart(db, user)


@router.post("/items", response_model=CartOut, status_code=201)
def add_item(
    body: CartItemIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.get(Product, body.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = db.scalar(
        select(CartItem).where(
            CartItem.user_id == user.id, CartItem.product_id == product.id
        )
    )
    new_quantity = body.quantity + (existing.quantity if existing else 0)
    if new_quantity > product.stock:
        raise HTTPException(
            status_code=409,
            detail=f"Only {product.stock} in stock for '{product.name}'",
        )

    if existing:
        existing.quantity = new_quantity
    else:
        db.add(CartItem(user_id=user.id, product_id=product.id, quantity=body.quantity))
    db.commit()
    return _load_cart(db, user)


@router.put("/items/{product_id}", response_model=CartOut)
def set_quantity(
    product_id: int,
    body: CartItemIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.scalar(
        select(CartItem).where(
            CartItem.user_id == user.id, CartItem.product_id == product_id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Item not in cart")
    if body.quantity > item.product.stock:
        raise HTTPException(
            status_code=409,
            detail=f"Only {item.product.stock} in stock for '{item.product.name}'",
        )
    item.quantity = body.quantity
    db.commit()
    return _load_cart(db, user)


@router.delete("/items/{product_id}", response_model=CartOut)
def remove_item(
    product_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.scalar(
        select(CartItem).where(
            CartItem.user_id == user.id, CartItem.product_id == product_id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Item not in cart")
    db.delete(item)
    db.commit()
    return _load_cart(db, user)
