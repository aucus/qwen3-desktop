from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from datetime import datetime, timedelta
import time

from ..services.api_key_service import APIKeyService, KeyPermission, KeyStatus
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/keys", tags=["api_keys"])

# API 키 서비스 인스턴스
api_key_service = APIKeyService()


# 요청/응답 모델
class CreateAPIKeyRequest(BaseModel):
    name: str
    permissions: List[str]
    expires_at: Optional[datetime] = None
    description: Optional[str] = None
    tags: List[str] = []


class UpdateAPIKeyRequest(BaseModel):
    name: Optional[str] = None
    permissions: Optional[List[str]] = None
    expires_at: Optional[datetime] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class APIKeyResponse(BaseModel):
    id: str
    name: str
    permissions: List[str]
    created_at: str
    expires_at: Optional[str]
    last_used: Optional[str]
    usage_count: int
    status: str
    description: Optional[str]
    tags: List[str]


# API 키 생성 엔드포인트
@router.post("/", response_model=Dict[str, Any])
async def create_api_key(request: CreateAPIKeyRequest):
    """API 키 생성"""
    try:
        # 권한 변환
        permissions = []
        for perm in request.permissions:
            try:
                permissions.append(KeyPermission(perm))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"지원하지 않는 권한: {perm}")
        
        result = api_key_service.create_api_key(
            name=request.name,
            permissions=permissions,
            expires_at=request.expires_at,
            description=request.description,
            tags=request.tags
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 생성 중 오류가 발생했습니다")


# API 키 목록 조회 엔드포인트
@router.get("/", response_model=Dict[str, Any])
async def get_api_keys():
    """모든 API 키 목록 조회"""
    try:
        api_keys = api_key_service.get_all_api_keys()
        
        return {
            "success": True,
            "keys": [key.to_dict() for key in api_keys],
            "count": len(api_keys)
        }
    
    except Exception as e:
        logger.error(f"API 키 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 목록 조회 중 오류가 발생했습니다")


# 특정 API 키 조회 엔드포인트
@router.get("/{key_id}", response_model=Dict[str, Any])
async def get_api_key(key_id: str):
    """특정 API 키 정보 조회"""
    try:
        api_key = api_key_service.get_api_key(key_id)
        if not api_key:
            raise HTTPException(status_code=404, detail="API 키를 찾을 수 없습니다")
        
        return {
            "success": True,
            "key": api_key.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 조회 중 오류가 발생했습니다")


# API 키 업데이트 엔드포인트
@router.put("/{key_id}", response_model=Dict[str, Any])
async def update_api_key(key_id: str, request: UpdateAPIKeyRequest):
    """API 키 정보 업데이트"""
    try:
        # 권한 변환
        permissions = None
        if request.permissions:
            permissions = []
            for perm in request.permissions:
                try:
                    permissions.append(KeyPermission(perm))
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"지원하지 않는 권한: {perm}")
        
        result = api_key_service.update_api_key(
            key_id=key_id,
            name=request.name,
            permissions=permissions,
            expires_at=request.expires_at,
            description=request.description,
            tags=request.tags
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 업데이트 중 오류가 발생했습니다")


# API 키 폐기 엔드포인트
@router.post("/{key_id}/revoke", response_model=Dict[str, Any])
async def revoke_api_key(key_id: str):
    """API 키 폐기"""
    try:
        result = api_key_service.revoke_api_key(key_id)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 폐기 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 폐기 중 오류가 발생했습니다")


# API 키 삭제 엔드포인트
@router.delete("/{key_id}", response_model=Dict[str, Any])
async def delete_api_key(key_id: str):
    """API 키 삭제"""
    try:
        result = api_key_service.delete_api_key(key_id)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 삭제 중 오류가 발생했습니다")


# API 키 사용 기록 조회 엔드포인트
@router.get("/{key_id}/usage", response_model=Dict[str, Any])
async def get_key_usage(key_id: str, limit: int = 100):
    """API 키 사용 기록 조회"""
    try:
        # API 키 존재 확인
        api_key = api_key_service.get_api_key(key_id)
        if not api_key:
            raise HTTPException(status_code=404, detail="API 키를 찾을 수 없습니다")
        
        usage_records = api_key_service.get_key_usage(key_id, limit)
        
        return {
            "success": True,
            "usage": [record.to_dict() for record in usage_records],
            "count": len(usage_records)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 사용 기록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 사용 기록 조회 중 오류가 발생했습니다")


# API 키 통계 조회 엔드포인트
@router.get("/statistics", response_model=Dict[str, Any])
async def get_key_statistics():
    """API 키 통계 정보"""
    try:
        stats = api_key_service.get_key_statistics()
        
        return {
            "success": True,
            "statistics": stats
        }
    
    except Exception as e:
        logger.error(f"API 키 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 통계 조회 중 오류가 발생했습니다")


# API 키 내보내기 엔드포인트
@router.get("/export", response_model=Dict[str, Any])
async def export_api_keys():
    """API 키 내보내기"""
    try:
        result = api_key_service.export_keys()
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 내보내기 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 내보내기 중 오류가 발생했습니다")


# API 키 가져오기 엔드포인트
@router.post("/import", response_model=Dict[str, Any])
async def import_api_keys(import_data: Dict[str, Any]):
    """API 키 가져오기"""
    try:
        result = api_key_service.import_keys(import_data)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 가져오기 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 가져오기 중 오류가 발생했습니다")


# API 키 정리 엔드포인트
@router.post("/cleanup", response_model=Dict[str, Any])
async def cleanup_expired_keys():
    """만료된 API 키 정리"""
    try:
        count = api_key_service.cleanup_expired_keys()
        
        return {
            "success": True,
            "cleaned_count": count,
            "message": f"{count}개의 만료된 API 키가 정리되었습니다"
        }
    
    except Exception as e:
        logger.error(f"API 키 정리 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 정리 중 오류가 발생했습니다")


# 권한 목록 조회 엔드포인트
@router.get("/permissions", response_model=Dict[str, Any])
async def get_permissions():
    """지원하는 권한 목록"""
    try:
        permissions = [
            {
                "value": perm.value,
                "name": perm.name,
                "description": {
                    "read": "읽기 권한",
                    "write": "쓰기 권한",
                    "admin": "관리자 권한",
                    "plugin": "플러그인 권한",
                    "file_access": "파일 접근 권한",
                    "mcp_access": "MCP 접근 권한"
                }.get(perm.value, "권한")
            }
            for perm in KeyPermission
        ]
        
        return {
            "success": True,
            "permissions": permissions
        }
    
    except Exception as e:
        logger.error(f"권한 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="권한 목록 조회 중 오류가 발생했습니다")


# API 키 검증 엔드포인트 (내부용)
@router.post("/validate", response_model=Dict[str, Any])
async def validate_api_key(request: Request):
    """API 키 검증 (내부용)"""
    try:
        # 요청 헤더에서 API 키 추출
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            raise HTTPException(status_code=401, detail="API 키가 제공되지 않았습니다")
        
        # API 키 검증
        key_info = api_key_service.validate_api_key(api_key)
        if not key_info:
            raise HTTPException(status_code=401, detail="유효하지 않은 API 키입니다")
        
        # 사용 기록 업데이트
        start_time = time.time()
        response_time = time.time() - start_time
        
        api_key_service.update_key_usage(
            key_id=key_info.id,
            endpoint=str(request.url.path),
            method=request.method,
            status_code=200,
            response_time=response_time,
            ip_address=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("User-Agent", "unknown")
        )
        
        return {
            "success": True,
            "valid": True,
            "key_info": {
                "id": key_info.id,
                "name": key_info.name,
                "permissions": [perm.value for perm in key_info.permissions],
                "status": key_info.status.value
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 검증 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 검증 중 오류가 발생했습니다")


# API 키 상태별 조회 엔드포인트
@router.get("/status/{status}", response_model=Dict[str, Any])
async def get_keys_by_status(status: str):
    """상태별 API 키 목록 조회"""
    try:
        # 상태 검증
        try:
            key_status = KeyStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 상태: {status}")
        
        # 모든 키 조회 후 필터링
        all_keys = api_key_service.get_all_api_keys()
        filtered_keys = [key for key in all_keys if key.status == key_status]
        
        return {
            "success": True,
            "keys": [key.to_dict() for key in filtered_keys],
            "count": len(filtered_keys),
            "status": status
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"상태별 API 키 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="상태별 API 키 조회 중 오류가 발생했습니다")


# API 키 검색 엔드포인트
@router.get("/search", response_model=Dict[str, Any])
async def search_api_keys(q: str = "", tag: str = ""):
    """API 키 검색"""
    try:
        all_keys = api_key_service.get_all_api_keys()
        filtered_keys = []
        
        for key in all_keys:
            # 검색어 필터링
            if q and q.lower() not in key.name.lower() and q.lower() not in (key.description or "").lower():
                continue
            
            # 태그 필터링
            if tag and tag not in key.tags:
                continue
            
            filtered_keys.append(key)
        
        return {
            "success": True,
            "keys": [key.to_dict() for key in filtered_keys],
            "count": len(filtered_keys),
            "query": q,
            "tag": tag
        }
    
    except Exception as e:
        logger.error(f"API 키 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 검색 중 오류가 발생했습니다")


# API 키 사용량 통계 엔드포인트
@router.get("/{key_id}/usage-stats", response_model=Dict[str, Any])
async def get_key_usage_stats(key_id: str, days: int = 30):
    """API 키 사용량 통계"""
    try:
        # API 키 존재 확인
        api_key = api_key_service.get_api_key(key_id)
        if not api_key:
            raise HTTPException(status_code=404, detail="API 키를 찾을 수 없습니다")
        
        # 사용 기록 조회
        usage_records = api_key_service.get_key_usage(key_id, limit=1000)
        
        # 날짜별 통계 계산
        stats = {}
        for record in usage_records:
            date = record.timestamp.date().isoformat()
            if date not in stats:
                stats[date] = {
                    "count": 0,
                    "total_time": 0,
                    "success_count": 0,
                    "error_count": 0
                }
            
            stats[date]["count"] += 1
            stats[date]["total_time"] += record.response_time
            
            if 200 <= record.status_code < 400:
                stats[date]["success_count"] += 1
            else:
                stats[date]["error_count"] += 1
        
        return {
            "success": True,
            "key_id": key_id,
            "stats": stats,
            "total_records": len(usage_records)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"API 키 사용량 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="API 키 사용량 통계 조회 중 오류가 발생했습니다")
