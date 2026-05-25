import warnings
import hashlib
from passlib.context import CryptContext

# Suppress passlib's bcrypt version warning (bcrypt>=4.x dropped __about__)
warnings.filterwarnings("ignore", ".*error reading bcrypt version.*")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _normalize(password: str) -> str:
    """SHA-256 pre-hash so passwords >72 bytes are safe with bcrypt."""
    return hashlib.sha256(password.encode()).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(_normalize(password))


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_normalize(plain), hashed)
