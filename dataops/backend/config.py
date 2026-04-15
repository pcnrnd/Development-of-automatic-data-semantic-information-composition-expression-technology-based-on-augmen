from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "DataOps Backend"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
