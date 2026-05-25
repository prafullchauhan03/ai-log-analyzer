from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database.database import get_db
from app.database.models import User
from app.auth.password_handler import hash_password, verify_password
from app.auth.jwt_handler import create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully", "username": new_user.username}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == body.email).first()
    if not db_user or not verify_password(body.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": db_user.email, "role": db_user.role, "username": db_user.username})
    return {"access_token": token, "token_type": "bearer", "username": db_user.username, "role": db_user.role}


from app.auth.dependencies import get_current_user as _get_current_user

@router.get("/me")
def get_me(user=Depends(_get_current_user)):
    """Return current user info from JWT — used by AuthContext to validate session on load."""
    return {
        "username": user.get("username"),
        "role":     user.get("role"),
        "email":    user.get("sub"),
    }
