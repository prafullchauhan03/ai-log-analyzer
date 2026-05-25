"""
/users               GET    – paginated user list (admin only)
/users/me            GET    – current user profile
/users/me            PATCH  – update own profile (username, email)
/users/me/password   PATCH  – change own password
/users/{id}          GET    – single user (admin)
/users/{id}/role     PATCH  – change role (admin)
/users/{id}          DELETE – delete user (admin)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.database.database import get_db
from app.database.models import User
from app.auth.dependencies import get_current_user, require_admin
from app.auth.password_handler import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["Users"])


def _ser(u: User) -> dict:
    return {
        "id":         u.id,
        "username":   u.username,
        "email":      u.email,
        "role":       u.role,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email:    Optional[EmailStr] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str

class ChangeRoleRequest(BaseModel):
    role: str


@router.get("")
def list_users(
    search: Optional[str] = Query(None),
    role:   Optional[str] = Query(None),
    limit:  int           = Query(50, ge=1, le=200),
    offset: int           = Query(0,  ge=0),
    db:     Session       = Depends(get_db),
    _user                 = Depends(require_admin),
):
    q = db.query(User)
    if search:
        q = q.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )
    if role:
        q = q.filter(User.role == role)

    total = q.count()
    users = q.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    total_users  = db.query(func.count(User.id)).scalar()
    total_admins = db.query(func.count(User.id)).filter(User.role == "admin").scalar()

    return {
        "total":   total,
        "offset":  offset,
        "limit":   limit,
        "users":   [_ser(u) for u in users],
        "summary": {"total_users": total_users, "total_admins": total_admins},
    }


@router.get("/me")
def get_me(db: Session = Depends(get_db), user = Depends(get_current_user)):
    db_user = db.query(User).filter(User.email == user["sub"]).first()
    if not db_user:
        raise HTTPException(404, "User not found")
    return _ser(db_user)


@router.patch("/me")
def update_me(body: UpdateProfileRequest, db: Session = Depends(get_db), user = Depends(get_current_user)):
    db_user = db.query(User).filter(User.email == user["sub"]).first()
    if not db_user:
        raise HTTPException(404, "User not found")
    if body.username and body.username != db_user.username:
        if db.query(User).filter(User.username == body.username).first():
            raise HTTPException(400, "Username already taken")
        db_user.username = body.username
    if body.email and body.email != db_user.email:
        if db.query(User).filter(User.email == body.email).first():
            raise HTTPException(400, "Email already in use")
        db_user.email = body.email
    db.commit()
    db.refresh(db_user)
    return _ser(db_user)


@router.patch("/me/password")
def change_password(body: ChangePasswordRequest, db: Session = Depends(get_db), user = Depends(get_current_user)):
    db_user = db.query(User).filter(User.email == user["sub"]).first()
    if not db_user:
        raise HTTPException(404, "User not found")
    if not verify_password(body.current_password, db_user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    db_user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db), _user = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    return _ser(u)


@router.patch("/{user_id}/role")
def change_role(user_id: int, body: ChangeRoleRequest, db: Session = Depends(get_db), user = Depends(require_admin)):
    if body.role not in ("viewer", "analyst", "admin"):
        raise HTTPException(400, "Role must be 'user' or 'admin'")
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    if u.email == user["sub"] and body.role != "admin":
        raise HTTPException(400, "Cannot demote yourself")
    u.role = body.role
    db.commit()
    db.refresh(u)
    return _ser(u)


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), user = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    if u.email == user["sub"]:
        raise HTTPException(400, "Cannot delete your own account")
    db.delete(u)
    db.commit()
    return {"deleted": user_id}
