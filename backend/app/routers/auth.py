from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.security import create_admin_access_token, verify_plaintext_password

settings = get_settings()
router = APIRouter(prefix="/api/auth", tags=["认证"])


class AdminLoginRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=256)


@router.post("/login", summary="管理员密码认证")
def admin_login(body: AdminLoginRequest):
    if not verify_plaintext_password(body.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="密码验证失败")

    token = create_admin_access_token()
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_minutes": settings.access_token_expire_minutes,
    }
