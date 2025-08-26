from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import psutil
import os
from datetime import datetime

from ..utils.logger import api_logger

router = APIRouter()

@router.get("/")
async def health_check() -> Dict[str, Any]:
    """기본 헬스 체크"""
    try:
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "Qwen 3 Desktop Assistant Backend"
        }
    except Exception as e:
        api_logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail="Service unhealthy")

@router.get("/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """상세한 헬스 체크"""
    try:
        # 시스템 정보 수집
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # 프로세스 정보
        process = psutil.Process(os.getpid())
        process_memory = process.memory_info()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "Qwen 3 Desktop Assistant Backend",
            "system": {
                "cpu_percent": cpu_percent,
                "memory_total": memory.total,
                "memory_available": memory.available,
                "memory_percent": memory.percent,
                "disk_total": disk.total,
                "disk_free": disk.free,
                "disk_percent": disk.percent
            },
            "process": {
                "pid": process.pid,
                "memory_rss": process_memory.rss,
                "memory_vms": process_memory.vms,
                "cpu_percent": process.cpu_percent(),
                "num_threads": process.num_threads(),
                "create_time": datetime.fromtimestamp(process.create_time()).isoformat()
            }
        }
    except Exception as e:
        api_logger.error(f"Detailed health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@router.get("/ready")
async def readiness_check() -> Dict[str, Any]:
    """서비스 준비 상태 확인"""
    try:
        # 여기에 서비스 의존성 체크 추가
        # 예: 데이터베이스 연결, 모델 로딩 상태 등
        
        return {
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
            "dependencies": {
                "database": "connected",  # 실제 구현에서는 실제 상태 확인
                "model": "loaded",        # 실제 구현에서는 실제 상태 확인
                "mcp": "available"        # 실제 구현에서는 실제 상태 확인
            }
        }
    except Exception as e:
        api_logger.error(f"Readiness check failed: {e}")
        return {
            "status": "not_ready",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@router.get("/live")
async def liveness_check() -> Dict[str, Any]:
    """서비스 생존 상태 확인"""
    try:
        return {
            "status": "alive",
            "timestamp": datetime.utcnow().isoformat(),
            "uptime": "running"
        }
    except Exception as e:
        api_logger.error(f"Liveness check failed: {e}")
        raise HTTPException(status_code=500, detail="Service not alive")
