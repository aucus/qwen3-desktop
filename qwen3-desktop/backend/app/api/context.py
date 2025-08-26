from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
import json

from ..services.context_service import ContextService, ContextType
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/context", tags=["context"])

# 컨텍스트 서비스 인스턴스
context_service = ContextService()


# 요청/응답 모델
class CreateSessionRequest(BaseModel):
    user_id: str
    max_size: int = 10000
    max_items: int = 100


class AddContextItemRequest(BaseModel):
    context_type: str
    content: str
    metadata: Dict[str, Any] = {}
    priority: int = 0


class UpdateContextItemRequest(BaseModel):
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    priority: Optional[int] = None


class OptimizeContextRequest(BaseModel):
    target_size: Optional[int] = None


class MergeContextsRequest(BaseModel):
    source_session_id: str
    target_session_id: str
    conflict_strategy: str = "keep_newer"


class ExportContextRequest(BaseModel):
    format: str = "json"


class ImportContextRequest(BaseModel):
    data: str
    format: str = "json"
    merge_strategy: str = "replace"


# 세션 관리 엔드포인트
@router.post("/sessions", response_model=Dict[str, Any])
async def create_session(request: CreateSessionRequest):
    """새 컨텍스트 세션 생성"""
    try:
        import uuid
        session_id = str(uuid.uuid4())
        
        session = context_service.create_session(
            session_id=session_id,
            user_id=request.user_id,
            max_size=request.max_size,
            max_items=request.max_items
        )
        
        return {
            "success": True,
            "session": session.to_dict(),
            "message": "세션이 성공적으로 생성되었습니다"
        }
    
    except Exception as e:
        logger.error(f"세션 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="세션 생성 중 오류가 발생했습니다")


@router.get("/sessions/{session_id}", response_model=Dict[str, Any])
async def get_session(session_id: str):
    """세션 조회"""
    try:
        session = context_service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        
        return {
            "success": True,
            "session": session.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"세션 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="세션 조회 중 오류가 발생했습니다")


@router.delete("/sessions/{session_id}", response_model=Dict[str, Any])
async def delete_session(session_id: str):
    """세션 삭제"""
    try:
        success = context_service.clear_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        
        return {
            "success": True,
            "message": "세션이 성공적으로 삭제되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"세션 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="세션 삭제 중 오류가 발생했습니다")


# 컨텍스트 아이템 관리 엔드포인트
@router.post("/sessions/{session_id}/items", response_model=Dict[str, Any])
async def add_context_item(session_id: str, request: AddContextItemRequest):
    """컨텍스트 아이템 추가"""
    try:
        # 컨텍스트 타입 검증
        try:
            context_type = ContextType(request.context_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 컨텍스트 타입: {request.context_type}")
        
        item = context_service.add_context_item(
            session_id=session_id,
            context_type=context_type,
            content=request.content,
            metadata=request.metadata,
            priority=request.priority
        )
        
        return {
            "success": True,
            "item": item.to_dict(),
            "message": "컨텍스트 아이템이 성공적으로 추가되었습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"컨텍스트 아이템 추가 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 아이템 추가 중 오류가 발생했습니다")


@router.get("/sessions/{session_id}/items", response_model=Dict[str, Any])
async def get_context_items(
    session_id: str,
    context_type: Optional[str] = Query(None, description="컨텍스트 타입 필터"),
    limit: Optional[int] = Query(None, description="조회할 아이템 수 제한"),
    include_compressed: bool = Query(True, description="압축된 아이템 포함 여부")
):
    """컨텍스트 아이템 조회"""
    try:
        # 컨텍스트 타입 변환
        context_type_enum = None
        if context_type:
            try:
                context_type_enum = ContextType(context_type)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"지원하지 않는 컨텍스트 타입: {context_type}")
        
        items = context_service.get_context_items(
            session_id=session_id,
            context_type=context_type_enum,
            limit=limit,
            include_compressed=include_compressed
        )
        
        return {
            "success": True,
            "items": [item.to_dict() for item in items],
            "count": len(items)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"컨텍스트 아이템 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 아이템 조회 중 오류가 발생했습니다")


@router.put("/sessions/{session_id}/items/{item_id}", response_model=Dict[str, Any])
async def update_context_item(session_id: str, item_id: str, request: UpdateContextItemRequest):
    """컨텍스트 아이템 업데이트"""
    try:
        item = context_service.update_context_item(
            session_id=session_id,
            item_id=item_id,
            content=request.content,
            metadata=request.metadata,
            priority=request.priority
        )
        
        if not item:
            raise HTTPException(status_code=404, detail="컨텍스트 아이템을 찾을 수 없습니다")
        
        return {
            "success": True,
            "item": item.to_dict(),
            "message": "컨텍스트 아이템이 성공적으로 업데이트되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"컨텍스트 아이템 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 아이템 업데이트 중 오류가 발생했습니다")


@router.delete("/sessions/{session_id}/items/{item_id}", response_model=Dict[str, Any])
async def delete_context_item(session_id: str, item_id: str):
    """컨텍스트 아이템 삭제"""
    try:
        success = context_service.remove_context_item(session_id, item_id)
        if not success:
            raise HTTPException(status_code=404, detail="컨텍스트 아이템을 찾을 수 없습니다")
        
        return {
            "success": True,
            "message": "컨텍스트 아이템이 성공적으로 삭제되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"컨텍스트 아이템 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 아이템 삭제 중 오류가 발생했습니다")


# 컨텍스트 관리 엔드포인트
@router.get("/sessions/{session_id}/summary", response_model=Dict[str, Any])
async def get_context_summary(session_id: str):
    """컨텍스트 요약 정보 조회"""
    try:
        summary = context_service.get_context_summary(session_id)
        if not summary:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        
        return {
            "success": True,
            "summary": summary
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"컨텍스트 요약 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 요약 조회 중 오류가 발생했습니다")


@router.post("/sessions/{session_id}/optimize", response_model=Dict[str, Any])
async def optimize_context(session_id: str, request: OptimizeContextRequest):
    """컨텍스트 최적화"""
    try:
        result = context_service.optimize_context(session_id, request.target_size)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return {
            "success": True,
            "optimization_result": result,
            "message": "컨텍스트 최적화가 완료되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"컨텍스트 최적화 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 최적화 중 오류가 발생했습니다")


@router.post("/merge", response_model=Dict[str, Any])
async def merge_contexts(request: MergeContextsRequest):
    """컨텍스트 병합"""
    try:
        result = context_service.merge_contexts(
            source_session_id=request.source_session_id,
            target_session_id=request.target_session_id,
            conflict_strategy=request.conflict_strategy
        )
        
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return {
            "success": True,
            "merge_result": result,
            "message": "컨텍스트 병합이 완료되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"컨텍스트 병합 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 병합 중 오류가 발생했습니다")


# 내보내기/가져오기 엔드포인트
@router.post("/sessions/{session_id}/export", response_model=Dict[str, Any])
async def export_context(session_id: str, request: ExportContextRequest):
    """컨텍스트 내보내기"""
    try:
        exported_data = context_service.export_context(session_id, request.format)
        if not exported_data:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        
        return {
            "success": True,
            "data": exported_data,
            "format": request.format,
            "message": "컨텍스트가 성공적으로 내보내기되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"컨텍스트 내보내기 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 내보내기 중 오류가 발생했습니다")


@router.post("/sessions/{session_id}/import", response_model=Dict[str, Any])
async def import_context(session_id: str, request: ImportContextRequest):
    """컨텍스트 가져오기"""
    try:
        result = context_service.import_context(
            session_id=session_id,
            data=request.data,
            format=request.format,
            merge_strategy=request.merge_strategy
        )
        
        return {
            "success": True,
            "import_result": result,
            "message": "컨텍스트가 성공적으로 가져와졌습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"컨텍스트 가져오기 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 가져오기 중 오류가 발생했습니다")


# 통계 정보 엔드포인트
@router.get("/statistics", response_model=Dict[str, Any])
async def get_statistics():
    """컨텍스트 서비스 통계 정보"""
    try:
        stats = context_service.get_statistics()
        
        return {
            "success": True,
            "statistics": stats
        }
    
    except Exception as e:
        logger.error(f"통계 정보 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="통계 정보 조회 중 오류가 발생했습니다")


# 컨텍스트 타입 정보 엔드포인트
@router.get("/types", response_model=Dict[str, Any])
async def get_context_types():
    """지원하는 컨텍스트 타입 목록"""
    try:
        types = [
            {
                "value": context_type.value,
                "name": context_type.name,
                "description": {
                    "chat": "채팅 대화 컨텍스트",
                    "system": "시스템 설정 및 프롬프트",
                    "user_profile": "사용자 프로필 정보",
                    "session": "세션 관련 정보",
                    "temporary": "임시 컨텍스트"
                }.get(context_type.value, "컨텍스트 타입")
            }
            for context_type in ContextType
        ]
        
        return {
            "success": True,
            "types": types
        }
    
    except Exception as e:
        logger.error(f"컨텍스트 타입 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="컨텍스트 타입 조회 중 오류가 발생했습니다")
