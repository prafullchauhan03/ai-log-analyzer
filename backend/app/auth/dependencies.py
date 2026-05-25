from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.auth.jwt_handler import SECRET_KEY, ALGORITHM

# auto_error=False so we can return 401 instead of 403 when header is absent
security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    # HTTPBearer returns None (not raises) when auto_error=False and header missing
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated — provide a Bearer token")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Ensure the token has a subject claim
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token — missing subject")
        return payload
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {exc}")


def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
