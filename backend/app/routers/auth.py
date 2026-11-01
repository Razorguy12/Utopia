from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import hashlib, secrets, re
from ..config import MUNICIPAL_USERS
from ..schemas.auth import LoginRequest, TokenResponse
from ..services.auth import create_access_token, get_current_user
from ..database import get_db
from ..models.issue import CitizenUser
from ..models.contractor import Contractor

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class CitizenAuthIn(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)
    name: str = Field(min_length=2, max_length=100)

def _citizen_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    return salt.hex() + ":" + hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310000).hex()

def _citizen_token(user: CitizenUser):
    profile = {"sub": f"citizen:{user.id}", "citizen_id": user.id, "email": user.email, "name": user.name, "role": "citizen"}
    return {"access_token": create_access_token(profile), "token_type": "bearer", "user": profile}

@router.post('/citizen/register')
def citizen_register(req: CitizenAuthIn, s: Session = Depends(get_db)):
    email = req.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(422, "Enter a valid email address.")
    if s.query(CitizenUser).filter_by(email=email).first():
        raise HTTPException(409, "An account with this email already exists.")
    user = CitizenUser(email=email, name=req.name.strip(), password_hash=_citizen_hash(req.password))
    s.add(user); s.commit(); s.refresh(user)
    return _citizen_token(user)

class CitizenLoginIn(BaseModel):
    email: str
    password: str

@router.post('/citizen/login')
def citizen_login(req: CitizenLoginIn, s: Session = Depends(get_db)):
    user = s.query(CitizenUser).filter_by(email=req.email.strip().lower()).first()
    try:
        salt_hex, expected = user.password_hash.split(":", 1) if user else ("", "")
        actual = hashlib.pbkdf2_hmac("sha256", req.password.encode(), bytes.fromhex(salt_hex), 310000).hex()
    except (ValueError, AttributeError):
        actual = ""
    if not user or not secrets.compare_digest(actual, expected):
        raise HTTPException(401, "Invalid email or password.")
    return _citizen_token(user)

@router.post('/contractor/login')
def contractor_login(req: CitizenLoginIn, s: Session = Depends(get_db)):
    c=s.query(Contractor).filter_by(email=req.email.strip().lower(),is_active=True).first()
    try:
        salt_hex, expected=c.password_hash.split(':',1) if c and c.password_hash else ('','')
        actual=hashlib.pbkdf2_hmac('sha256',req.password.encode(),bytes.fromhex(salt_hex),310000).hex()
    except (ValueError,AttributeError): actual=''
    if not c or not secrets.compare_digest(actual,expected): raise HTTPException(401,'Invalid contractor email or password.')
    profile={'sub':f'contractor:{c.id}','email':c.email,'name':c.name,'role':'contractor','contractor_id':c.id,'department':c.department,'designation':'Registered Contractor','badge_id':c.registration_number}
    return {'access_token':create_access_token(profile),'token_type':'bearer','user':profile}

@router.post('/login', response_model=TokenResponse)
def login(req: LoginRequest):
    clean_id = (req.employee_id or req.email or "").strip().lower()
    
    # Try finding user by email, badge_id, or alias
    user_info = None
    target_email = None
    
    for em, u in MUNICIPAL_USERS.items():
        aliases = [a.lower() for a in u.get("aliases", [])]
        aliases.extend([em.lower(), u.get("badge_id", "").lower()])
        if clean_id in aliases:
            user_info = u
            target_email = em
            break

    if not user_info or user_info["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid official credentials or password.")

    # Department validation if specified
    if req.department and req.department != "Greater Chennai Corporation (Admin)":
        req_dept_clean = req.department.lower().replace("&", "and").strip()
        user_dept_clean = user_info["department"].lower().replace("&", "and").strip()
        if user_info["role"] != "admin" and (req_dept_clean not in user_dept_clean and user_dept_clean not in req_dept_clean):
            raise HTTPException(status_code=403, detail=f"Access denied: You belong to {user_info['department']}")

    token_data = {
        "sub": target_email,
        "email": target_email,
        "name": user_info["name"],
        "role": user_info["role"],
        "department": user_info["department"],
        "designation": user_info["designation"],
        "badge_id": user_info["badge_id"]
    }
    access_token = create_access_token(token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": token_data
    }

@router.get('/me')
def get_me(user: dict = Depends(get_current_user)):
    return user
