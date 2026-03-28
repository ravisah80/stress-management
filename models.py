# backend/models.py
from sqlalchemy import Column, String, Integer, DateTime
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255))
    email = Column(String(255), unique=True, index=True)
    password_hash = Column(String(255))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    avatar = Column(String(10))

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), index=True)
    before_score = Column(Integer)
    after_score = Column(Integer)
    improvement = Column(Integer)
    situation = Column(String(1000))
    reason = Column(String(1000))
    duration_minutes = Column(Integer)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
