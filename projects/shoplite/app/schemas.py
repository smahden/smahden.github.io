from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth ----------

class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    is_admin: bool


class TokenOut(BaseModel):
    token: str
    user: UserOut


# ---------- products ----------

class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    category: str = Field(min_length=1, max_length=80)
    price_cents: int = Field(gt=0)
    stock: int = Field(ge=0)


class ProductOut(ORMModel):
    id: int
    name: str
    description: str
    category: str
    price_cents: int
    stock: int


class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int


# ---------- cart ----------

class CartItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=99)


class CartItemOut(ORMModel):
    id: int
    quantity: int
    product: ProductOut


class CartOut(BaseModel):
    items: list[CartItemOut]
    subtotal_cents: int


# ---------- orders ----------

class OrderItemOut(ORMModel):
    product_id: int
    product_name: str
    unit_price_cents: int
    quantity: int


class OrderOut(ORMModel):
    id: int
    total_cents: int
    status: str
    payment_ref: str
    created_at: datetime
    items: list[OrderItemOut]
