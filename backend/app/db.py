from collections.abc import Generator

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
database_url: str | URL = settings.database_url
if settings.database_host:
    database_url = URL.create(
        "postgresql+psycopg2",
        username=settings.database_user,
        password=settings.database_password,
        host=settings.database_host,
        port=settings.database_port,
        database=settings.database_name,
    )

connect_args = {"check_same_thread": False} if str(database_url).startswith("sqlite") else {}
engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
