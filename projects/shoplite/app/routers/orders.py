import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import CartItem, Order, OrderItem, Product, User
from ..schemas import OrderOut
from ..security import get_current_user

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/checkout", response_model=OrderOut, status_code=201)
def checkout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Turn the user's cart into a paid order.

    Stock is re-checked and decremented inside this transaction, and each
    order line snapshots the product name and unit price at purchase time,
    so later catalog edits never rewrite order history.
    """
    cart = db.scalars(
        select(CartItem)
        .options(selectinload(CartItem.product))
        .where(CartItem.user_id == user.id)
    ).all()
    if not cart:
        raise HTTPException(status_code=400, detail="Cart is empty")

    for item in cart:
        if item.quantity > item.product.stock:
            raise HTTPException(
                status_code=409,
                detail=f"Only {item.product.stock} left in stock for '{item.product.name}'",
            )

    total = sum(item.product.price_cents * item.quantity for item in cart)
    order = Order(
        user_id=user.id,
        total_cents=total,
        status="paid",
        # Stand-in for a real payment-provider charge id (e.g. Stripe).
        payment_ref=f"pay_{secrets.token_hex(8)}",
    )
    for item in cart:
        item.product.stock -= item.quantity
        order.items.append(
            OrderItem(
                product_id=item.product.id,
                product_name=item.product.name,
                unit_price_cents=item.product.price_cents,
                quantity=item.quantity,
            )
        )
        db.delete(item)

    db.add(order)
    db.commit()
    return order


@router.get("", response_model=list[OrderOut])
def list_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
    ).all()


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.user_id == user.id)
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order
