from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "射箭赛事积分统计系统"
    debug: bool = False

    database_url: str

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


@lru_cache()
def get_settings():
    return Settings()
