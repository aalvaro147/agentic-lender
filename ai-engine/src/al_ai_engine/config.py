from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mock_mode: bool = True
    log_level: str = "info"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()