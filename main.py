# backend/main.py
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
import jwt, bcrypt, uuid, os
from dotenv import load_dotenv
import google.generativeai as genai
from sqlalchemy.orm import Session

# DB Imports
from database import engine, Base, get_db
import models

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

# ── Config ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "serenity-secret-key-change-in-production")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="Serenity API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ── Models (Pydantic) ────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class StressAnswers(BaseModel):
    sleep: str
    workload: int
    mood: str
    social: str
    anxiety: int
    energy: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    language: str = "en"
    stress_score: Optional[int] = None
    situation: Optional[str] = None

class SessionCreate(BaseModel):
    before_score: int
    after_score: int
    situation: Optional[str] = ""
    reason: Optional[str] = ""
    duration_minutes: int = 10

class SessionResponse(BaseModel):
    id: str
    user_id: str
    before_score: int
    after_score: int
    improvement: int
    situation: str
    duration_minutes: int
    created_at: str

# ── Auth Utils ───────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_stress(answers: StressAnswers) -> int:
    score = 0
    sleep_map = {"Less than 4h": 30, "4–6h": 20, "6–8h": 8, "8h+": 0}
    score += sleep_map.get(answers.sleep, 10)
    score += answers.workload * 3
    mood_map = {"Very Low": 20, "Low": 14, "Neutral": 8, "Good": 3, "Excellent": 0}
    score += mood_map.get(answers.mood, 8)
    social_map = {"Very Unsatisfied": 16, "Unsatisfied": 11, "Neutral": 6, "Satisfied": 2, "Very Satisfied": 0}
    score += social_map.get(answers.social, 6)
    score += answers.anxiety * 2.5
    energy_map = {"Exhausted": 12, "Tired": 8, "Okay": 4, "Energized": 1, "Very Energized": 0}
    score += energy_map.get(answers.energy, 4)
    return min(100, round(score))

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Serenity API v1.0", "status": "running"}

@app.post("/auth/register", response_model=Token)
def register(data: UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    new_user = models.User(
        id=user_id,
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        avatar=data.name[0].upper()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_token({"sub": user_id, "email": data.email})
    safe_user = {"id": new_user.id, "name": new_user.name, "email": new_user.email, "avatar": new_user.avatar}
    return {"access_token": token, "token_type": "bearer", "user": safe_user}

@app.post("/auth/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token({"sub": user.id, "email": user.email})
    safe_user = {"id": user.id, "name": user.name, "email": user.email, "avatar": user.avatar}
    return {"access_token": token, "token_type": "bearer", "user": safe_user}

@app.get("/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email, "avatar": current_user.avatar}

@app.post("/stress/calculate")
def calculate(answers: StressAnswers, current_user: models.User = Depends(get_current_user)):
    score = calculate_stress(answers)
    if score >= 70: level, emoji = "High", "🔴"
    elif score >= 40: level, emoji = "Moderate", "🟡"
    else: level, emoji = "Low", "🟢"

    def get_recommendations(s):
        if s >= 70: return ["Deep breathing exercises", "5-min meditation", "Listen to calm music", "Take a short walk"]
        if s >= 40: return ["Light stretching", "Listen to upbeat music", "Talk to a friend", "Watch something funny"]
        return ["Maintain your routine", "Celebrate your wellness", "Help someone else today"]

    return {
        "score": score,
        "level": level,
        "emoji": emoji,
        "message": f"Your stress level is {level.lower()} at {score}%.",
        "recommendations": get_recommendations(score),
    }

@app.post("/sessions", response_model=SessionResponse)
def create_session(data: SessionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    session_id = str(uuid.uuid4())
    new_session = models.Session(
        id=session_id,
        user_id=current_user.id,
        before_score=data.before_score,
        after_score=data.after_score,
        improvement=max(0, data.before_score - data.after_score),
        situation=data.situation or "",
        reason=data.reason or "",
        duration_minutes=data.duration_minutes
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return {
        "id": new_session.id, "user_id": new_session.user_id, "before_score": new_session.before_score,
        "after_score": new_session.after_score, "improvement": new_session.improvement,
        "situation": new_session.situation, "duration_minutes": new_session.duration_minutes,
        "created_at": new_session.created_at.isoformat()
    }

@app.get("/sessions", response_model=List[SessionResponse])
def get_sessions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user_sessions = db.query(models.Session).filter(models.Session.user_id == current_user.id).all()
    return [{
        "id": s.id, "user_id": s.user_id, "before_score": s.before_score,
        "after_score": s.after_score, "improvement": s.improvement,
        "situation": s.situation, "duration_minutes": s.duration_minutes,
        "created_at": s.created_at.isoformat()
    } for s in user_sessions]
