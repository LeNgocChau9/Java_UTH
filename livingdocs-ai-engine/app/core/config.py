import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.path.dirname(os.path.dirname(CURRENT_DIR))
ROOT_DIR = os.path.dirname(ENGINE_DIR)

class Settings(BaseSettings):
    mode: str = "real"
    host: str = "0.0.0.0"
    port: int = 8000
    fastapi_port: int = 8000
    gemini_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=[
            os.path.join(ROOT_DIR, ".env"),
            os.path.join(ENGINE_DIR, ".env"),
        ],
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache()
def get_settings() -> Settings:
    return Settings()
