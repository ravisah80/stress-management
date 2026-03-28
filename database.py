# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# Update this with your actual MySQL credentials in your .env file
# Example: mysql+pymysql://root:password@localhost:3306/serenity_db
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost/serenity")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
