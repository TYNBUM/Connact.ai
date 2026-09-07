from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

ROOT = (
    Path(__file__).resolve().parents[1]
)  # backend directory; .env lives one level above


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT.parent / ".env", ROOT / ".env"), extra="ignore"
    )
    database_url: str = (
        "postgresql+psycopg://meridian:meridian@127.0.0.1:54329/meridian"
    )
    workspace_id: str = "local-personal"
    upload_dir: str = str(ROOT.parent / "data" / "uploads")
    people_mode: Literal["mock", "live"] = "mock"
    public_search_mode: Literal["mock", "live"] = "mock"
    ai_mode: Literal["mock", "live"] = "mock"
    apollo_api_key: str = ""
    serpapi_api_key: str = ""
    ai_api_key: str = ""
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = "gpt-4.1-mini"
    provider_calls_per_minute: int = 20

    @field_validator("upload_dir")
    @classmethod
    def local_upload_path(cls, value):
        path = Path(value)
        return str(path if path.is_absolute() else (ROOT.parent / path).resolve())


settings = Settings()
