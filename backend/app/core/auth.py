import threading
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from jose.backends import ECKey

from app.core.config import settings

security = HTTPBearer()

# JWKS を起動時に1回フェッチしてキャッシュ（スレッドセーフ）
_jwks_cache: list[dict[str, Any]] = []
_jwks_lock = threading.Lock()


def _get_jwks() -> list[dict[str, Any]]:
    global _jwks_cache
    with _jwks_lock:
        if _jwks_cache:
            return _jwks_cache
        url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        try:
            resp = httpx.get(url, timeout=5)
            resp.raise_for_status()
            _jwks_cache = resp.json().get("keys", [])
        except Exception:
            _jwks_cache = []
        return _jwks_cache


def _decode_jwt(token: str) -> dict[str, Any]:
    """Try ES256 via JWKS first, then fall back to HS256 for legacy keys."""
    jwks = _get_jwks()

    # --- ES256 / RS256 via JWKS ---
    if jwks:
        # Unverified header to pick the matching key
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            alg = header.get("alg", "ES256")
        except JWTError:
            raise

        for key_data in jwks:
            if kid and key_data.get("kid") != kid:
                continue
            try:
                return jwt.decode(
                    token,
                    key_data,
                    algorithms=[alg],
                    options={"verify_aud": False},
                )
            except JWTError:
                continue

    # --- HS256 fallback (older Supabase projects) ---
    import base64
    try:
        secret = base64.b64decode(settings.supabase_jwt_secret)
    except Exception:
        secret = settings.supabase_jwt_secret.encode()
    return jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    token = credentials.credentials
    try:
        payload = _decode_jwt(token)
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
