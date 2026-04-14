from functools import lru_cache
from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _build_postgres_url(user: str, password: str, host: str, port: int, name: str) -> str:
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "射箭赛事积分统计系统"
    debug: bool = False

    database_url: str | None = None
    db_user: str = "archery_user"
    db_password: str = "archery_pass"
    db_name: str = "archery_db"
    db_host: str = "localhost"
    db_port: int = 5432

    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    @field_validator("debug", mode="before")
    @classmethod
    def normalize_debug(cls, value):
        if isinstance(value, bool) or value is None:
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "prod", "production"}:
                return False
        return value

    @model_validator(mode="after")
    def populate_database_url(self):
        if not self.database_url:
            self.database_url = _build_postgres_url(
                user=self.db_user,
                password=self.db_password,
                host=self.db_host,
                port=self.db_port,
                name=self.db_name,
            )
        return self


@lru_cache()
def get_settings():
    return Settings()
