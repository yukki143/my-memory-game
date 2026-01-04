# --- database.py の 全体を以下に書き換え ---

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# 環境変数からURLを取得
database_url = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

# RenderのPostgreSQL(postgres://)をSQLAlchemyが解釈できる形式(postgresql://)に変換
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

SQLALCHEMY_DATABASE_URL = database_url

# エンジンの作成
if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
else:
    # SQLiteの場合の設定
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()