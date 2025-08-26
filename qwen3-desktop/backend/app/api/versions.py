from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
import json

from ..services.version_service import VersionService, VersionType
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/versions", tags=["versions"])

# 버전 서비스 인스턴스
version_service = VersionService()


# 요청/응답 모델
class CreateVersionRequest(BaseModel):
    template_id: str
    version_type: str
    description: str
    author: str
    content: Dict[str, Any]
    tags: List[str] = []
    parent_version: Optional[str] = None


class CompareVersionsRequest(BaseModel):
    version_from: str
    version_to: str


class MergeVersionsRequest(BaseModel):
    source_version: str
    target_version: str
    author: str
    description: str
    conflict_strategy: str = "manual"


class TagVersionRequest(BaseModel):
    tags: List[str]
    is_stable: bool = False


class ExportVersionRequest(BaseModel):
    format: str = "json"


class ImportVersionRequest(BaseModel):
    template_id: str
    version_data: str
    format: str = "json"


# 버전 관리 엔드포인트
@router.post("/create", response_model=Dict[str, Any])
async def create_version(request: CreateVersionRequest):
    """새 버전 생성"""
    try:
        # 버전 타입 검증
        try:
            version_type = VersionType(request.version_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 버전 타입: {request.version_type}")
        
        metadata = version_service.create_version(
            template_id=request.template_id,
            version_type=version_type,
            description=request.description,
            author=request.author,
            content=request.content,
            tags=request.tags,
            parent_version=request.parent_version
        )
        
        return {
            "success": True,
            "metadata": metadata.to_dict(),
            "message": "새 버전이 성공적으로 생성되었습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"버전 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 생성 중 오류가 발생했습니다")


@router.get("/{template_id}/{version}", response_model=Dict[str, Any])
async def get_version(template_id: str, version: str):
    """특정 버전 조회"""
    try:
        version_data = version_service.get_version(template_id, version)
        if not version_data:
            raise HTTPException(status_code=404, detail="버전을 찾을 수 없습니다")
        
        return {
            "success": True,
            "version": version_data
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"버전 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 조회 중 오류가 발생했습니다")


@router.get("/{template_id}/{version}/metadata", response_model=Dict[str, Any])
async def get_version_metadata(template_id: str, version: str):
    """버전 메타데이터 조회"""
    try:
        metadata = version_service.get_version_metadata(template_id, version)
        if not metadata:
            raise HTTPException(status_code=404, detail="버전을 찾을 수 없습니다")
        
        return {
            "success": True,
            "metadata": metadata.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"버전 메타데이터 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 메타데이터 조회 중 오류가 발생했습니다")


@router.get("/{template_id}/history", response_model=Dict[str, Any])
async def get_version_history(
    template_id: str,
    limit: Optional[int] = Query(None, description="조회할 버전 수 제한")
):
    """버전 히스토리 조회"""
    try:
        history = version_service.get_version_history(template_id, limit)
        
        return {
            "success": True,
            "history": [metadata.to_dict() for metadata in history],
            "count": len(history)
        }
    
    except Exception as e:
        logger.error(f"버전 히스토리 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 히스토리 조회 중 오류가 발생했습니다")


@router.get("/{template_id}/latest", response_model=Dict[str, Any])
async def get_latest_version(template_id: str):
    """최신 버전 조회"""
    try:
        latest_version = version_service.get_latest_version(template_id)
        
        return {
            "success": True,
            "latest_version": latest_version
        }
    
    except Exception as e:
        logger.error(f"최신 버전 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="최신 버전 조회 중 오류가 발생했습니다")


@router.get("/{template_id}/stable", response_model=Dict[str, Any])
async def get_stable_versions(template_id: str):
    """안정 버전 목록 조회"""
    try:
        stable_versions = version_service.get_stable_versions(template_id)
        
        return {
            "success": True,
            "stable_versions": [metadata.to_dict() for metadata in stable_versions],
            "count": len(stable_versions)
        }
    
    except Exception as e:
        logger.error(f"안정 버전 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="안정 버전 조회 중 오류가 발생했습니다")


# 버전 비교 및 병합 엔드포인트
@router.post("/{template_id}/compare", response_model=Dict[str, Any])
async def compare_versions(template_id: str, request: CompareVersionsRequest):
    """버전 비교"""
    try:
        diff = version_service.compare_versions(
            template_id=template_id,
            version_from=request.version_from,
            version_to=request.version_to
        )
        
        if not diff:
            raise HTTPException(status_code=404, detail="비교할 버전을 찾을 수 없습니다")
        
        return {
            "success": True,
            "diff": diff.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"버전 비교 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 비교 중 오류가 발생했습니다")


@router.post("/{template_id}/rollback", response_model=Dict[str, Any])
async def rollback_to_version(template_id: str, target_version: str):
    """특정 버전으로 롤백"""
    try:
        success = version_service.rollback_to_version(template_id, target_version)
        if not success:
            raise HTTPException(status_code=404, detail="롤백할 버전을 찾을 수 없습니다")
        
        return {
            "success": True,
            "message": f"버전 {target_version}로 롤백이 완료되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"버전 롤백 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 롤백 중 오류가 발생했습니다")


@router.post("/{template_id}/merge", response_model=Dict[str, Any])
async def merge_versions(template_id: str, request: MergeVersionsRequest):
    """버전 병합"""
    try:
        metadata = version_service.merge_versions(
            template_id=template_id,
            source_version=request.source_version,
            target_version=request.target_version,
            author=request.author,
            description=request.description,
            conflict_strategy=request.conflict_strategy
        )
        
        if not metadata:
            raise HTTPException(status_code=404, detail="병합할 버전을 찾을 수 없습니다")
        
        return {
            "success": True,
            "metadata": metadata.to_dict(),
            "message": "버전 병합이 완료되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"버전 병합 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 병합 중 오류가 발생했습니다")


# 버전 태그 관리 엔드포인트
@router.post("/{template_id}/{version}/tag", response_model=Dict[str, Any])
async def tag_version(template_id: str, version: str, request: TagVersionRequest):
    """버전 태그 설정"""
    try:
        success = version_service.tag_version(
            template_id=template_id,
            version=version,
            tags=request.tags,
            is_stable=request.is_stable
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="버전을 찾을 수 없습니다")
        
        return {
            "success": True,
            "message": "버전 태그가 성공적으로 설정되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"버전 태그 설정 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 태그 설정 중 오류가 발생했습니다")


# 버전 삭제 엔드포인트
@router.delete("/{template_id}/{version}", response_model=Dict[str, Any])
async def delete_version(template_id: str, version: str):
    """버전 삭제"""
    try:
        success = version_service.delete_version(template_id, version)
        if not success:
            raise HTTPException(status_code=404, detail="삭제할 버전을 찾을 수 없습니다")
        
        return {
            "success": True,
            "message": "버전이 성공적으로 삭제되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"버전 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 삭제 중 오류가 발생했습니다")


# 내보내기/가져오기 엔드포인트
@router.post("/{template_id}/{version}/export", response_model=Dict[str, Any])
async def export_version(template_id: str, version: str, request: ExportVersionRequest):
    """버전 내보내기"""
    try:
        exported_data = version_service.export_version(template_id, version, request.format)
        if not exported_data:
            raise HTTPException(status_code=404, detail="내보낼 버전을 찾을 수 없습니다")
        
        return {
            "success": True,
            "data": exported_data,
            "format": request.format,
            "message": "버전이 성공적으로 내보내기되었습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"버전 내보내기 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 내보내기 중 오류가 발생했습니다")


@router.post("/import", response_model=Dict[str, Any])
async def import_version(request: ImportVersionRequest):
    """버전 가져오기"""
    try:
        success = version_service.import_version(
            template_id=request.template_id,
            version_data=request.version_data,
            format=request.format
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="버전 가져오기에 실패했습니다")
        
        return {
            "success": True,
            "message": "버전이 성공적으로 가져와졌습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"버전 가져오기 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 가져오기 중 오류가 발생했습니다")


# 통계 정보 엔드포인트
@router.get("/{template_id}/statistics", response_model=Dict[str, Any])
async def get_version_statistics(template_id: str):
    """버전 통계 정보"""
    try:
        stats = version_service.get_version_statistics(template_id)
        
        return {
            "success": True,
            "statistics": stats
        }
    
    except Exception as e:
        logger.error(f"버전 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 통계 조회 중 오류가 발생했습니다")


# 버전 타입 정보 엔드포인트
@router.get("/types", response_model=Dict[str, Any])
async def get_version_types():
    """지원하는 버전 타입 목록"""
    try:
        types = [
            {
                "value": version_type.value,
                "name": version_type.name,
                "description": {
                    "major": "주요 버전 (호환성 깨짐)",
                    "minor": "부 버전 (새 기능 추가)",
                    "patch": "패치 버전 (버그 수정)",
                    "custom": "사용자 정의 버전"
                }.get(version_type.value, "버전 타입")
            }
            for version_type in VersionType
        ]
        
        return {
            "success": True,
            "types": types
        }
    
    except Exception as e:
        logger.error(f"버전 타입 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="버전 타입 조회 중 오류가 발생했습니다")


# 충돌 해결 전략 정보 엔드포인트
@router.get("/conflict-strategies", response_model=Dict[str, Any])
async def get_conflict_strategies():
    """충돌 해결 전략 목록"""
    try:
        strategies = [
            {
                "value": "manual",
                "name": "수동 해결",
                "description": "사용자가 충돌을 수동으로 해결"
            },
            {
                "value": "source_wins",
                "name": "소스 우선",
                "description": "소스 버전의 변경사항 우선 적용"
            },
            {
                "value": "target_wins",
                "name": "타겟 우선",
                "description": "타겟 버전의 변경사항 우선 적용"
            }
        ]
        
        return {
            "success": True,
            "strategies": strategies
        }
    
    except Exception as e:
        logger.error(f"충돌 해결 전략 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="충돌 해결 전략 조회 중 오류가 발생했습니다")
