from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product, User
from ..schemas import ProductIn, ProductOut, ProductPage
from ..security import require_admin

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=ProductPage)
def list_products(
    q: str | None = Query(None, description="Search in name and description"),
    category: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = select(Product)
    if q:
        pattern = f"%{q.lower()}%"
        query = query.where(
            or_(
                func.lower(Product.name).like(pattern),
                func.lower(Product.description).like(pattern),
            )
        )
    if category:
        query = query.where(func.lower(Product.category) == category.lower())

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(
        query.order_by(Product.name).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return ProductPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductOut, status_code=201)
def create_product(
    body: ProductIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    product = Product(**body.model_dump())
    db.add(product)
    db.commit()
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    body: ProductIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in body.model_dump().items():
        setattr(product, field, value)
    db.commit()
    return product


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
