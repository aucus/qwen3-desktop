from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from pathlib import Path

class Settings(BaseSettings):
    # 기본 설정
    APP_NAME: str = "Qwen 3 Desktop Assistant"
    VERSION: str = "0.1.0"
    DEBUG: bool = False
    
    # 서버 설정
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # CORS 설정
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "file://*"  # Electron 앱용
    ]
    
    # Qwen 모델 설정
    QWEN_MODEL_PATH: Optional[str] = None
    QWEN_MODEL_NAME: str = "Qwen/Qwen2.5-7B-Instruct"
    QWEN_DEVICE: str = "auto"  # auto, cpu, cuda, mps
    QWEN_MAX_LENGTH: int = 2048
    QWEN_TEMPERATURE: float = 0.7
    QWEN_TOP_P: float = 0.9
    QWEN_REPETITION_PENALTY: float = 1.1
    
    # MCP 설정
    MCP_SERVERS: List[str] = [
        "filesystem",
        "search",
        "terminal",
        "database"
    ]
    MCP_CONFIG_PATH: str = "../mcp_servers/config"
    
    # 파일 업로드 설정
    UPLOAD_DIR: str = "../data/uploads"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_FILE_TYPES: List[str] = [
        "text/plain",
        "text/markdown",
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/json",
        "text/csv"
    ]
    
    # 보안 설정
    SECRET_KEY: str = "your-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # 로깅 설정
    LOG_LEVEL: str = "INFO"
    LOG_FILE: Optional[str] = "../data/logs/app.log"
    
    # 데이터베이스 설정 (선택사항)
    DATABASE_URL: Optional[str] = None
    
    # 캐시 설정
    CACHE_TTL: int = 3600  # 1시간
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

# 설정 인스턴스 생성
settings = Settings()

# 필요한 디렉토리 생성
def create_directories():
    """필요한 디렉토리들을 생성합니다."""
    directories = [
        Path(settings.UPLOAD_DIR),
        Path("../data/logs"),
        Path("../data/conversations"),
        Path("../data/settings"),
        Path("../data/cache"),
        Path(settings.MCP_CONFIG_PATH),
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)

# 앱 시작 시 디렉토리 생성
create_directories()
