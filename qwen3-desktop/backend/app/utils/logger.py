import logging
import sys
from pathlib import Path
from loguru import logger
from typing import Optional
from ..config import settings

class InterceptHandler(logging.Handler):
    """표준 라이브러리 로깅을 loguru로 리다이렉트"""
    
    def emit(self, record):
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )

def setup_logging(
    log_file: Optional[str] = None,
    log_level: str = "INFO",
    rotation: str = "10 MB",
    retention: str = "7 days",
    compression: str = "zip"
):
    """로깅 시스템을 설정합니다."""
    
    # 기존 loguru 핸들러 제거
    logger.remove()
    
    # 콘솔 출력 설정
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level=log_level,
        colorize=True,
        backtrace=True,
        diagnose=True
    )
    
    # 파일 출력 설정 (지정된 경우)
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        logger.add(
            log_file,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
            level=log_level,
            rotation=rotation,
            retention=retention,
            compression=compression,
            backtrace=True,
            diagnose=True
        )
    
    # 표준 라이브러리 로깅을 loguru로 리다이렉트
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    
    # uvicorn 로깅 설정
    logging.getLogger("uvicorn").handlers = [InterceptHandler()]
    logging.getLogger("uvicorn.access").handlers = [InterceptHandler()]
    
    # FastAPI 로깅 설정
    logging.getLogger("fastapi").handlers = [InterceptHandler()]
    
    return logger

# 기본 로깅 설정
def get_logger(name: str = __name__):
    """로거 인스턴스를 반환합니다."""
    return logger.bind(name=name)

# 로깅 설정 초기화
setup_logging(
    log_file=settings.LOG_FILE,
    log_level=settings.LOG_LEVEL
)

# 기본 로거
app_logger = get_logger("app")
qwen_logger = get_logger("qwen")
mcp_logger = get_logger("mcp")
api_logger = get_logger("api")
