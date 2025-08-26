from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from datetime import datetime

from ..services.conversation_service import ConversationService, MessageRole, ConversationStatus
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

# 대화 서비스 인스턴스
conversation_service = ConversationService()


# 요청/응답 모델
class CreateConversationRequest(BaseModel):
    title: str
    initial_message: Optional[str] = None
    tags: List[str] = []
    metadata: Dict[str, Any] = {}


class AddMessageRequest(BaseModel):
    role: str
    content: str
    metadata: Dict[str, Any] = {}
    parent_id: Optional[str] = None


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class CreateBranchRequest(BaseModel):
    branch_name: str
    description: Optional[str] = None
    created_by: str = "user"


class MergeConversationsRequest(BaseModel):
    source_conversation_id: str
    target_conversation_id: str
    merge_strategy: str = "append"


# 대화 생성 엔드포인트
@router.post("/", response_model=Dict[str, Any])
async def create_conversation(request: CreateConversationRequest):
    """새 대화 생성"""
    try:
        result = conversation_service.create_conversation(
            title=request.title,
            initial_message=request.initial_message,
            tags=request.tags,
            metadata=request.metadata
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 생성 중 오류가 발생했습니다")


# 모든 대화 목록 조회 엔드포인트
@router.get("/", response_model=Dict[str, Any])
async def get_conversations(status: Optional[str] = None, limit: int = 100, offset: int = 0):
    """모든 대화 목록 조회"""
    try:
        conversation_status = None
        if status:
            try:
                conversation_status = ConversationStatus(status)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"지원하지 않는 상태: {status}")
        
        conversations = conversation_service.get_all_conversations(
            status=conversation_status,
            limit=limit,
            offset=offset
        )
        
        return {
            "success": True,
            "conversations": [conv.to_dict() for conv in conversations],
            "count": len(conversations)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 목록 조회 중 오류가 발생했습니다")


# 특정 대화 조회 엔드포인트
@router.get("/{conversation_id}", response_model=Dict[str, Any])
async def get_conversation(conversation_id: str):
    """특정 대화 조회"""
    try:
        conversation = conversation_service.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")
        
        return {
            "success": True,
            "conversation": conversation.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 조회 중 오류가 발생했습니다")


# 대화 메시지 목록 조회 엔드포인트
@router.get("/{conversation_id}/messages", response_model=Dict[str, Any])
async def get_messages(conversation_id: str, limit: int = 100, offset: int = 0):
    """대화 메시지 목록 조회"""
    try:
        # 대화 존재 확인
        conversation = conversation_service.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")
        
        messages = conversation_service.get_messages(conversation_id, limit, offset)
        
        return {
            "success": True,
            "messages": [msg.to_dict() for msg in messages],
            "count": len(messages)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메시지 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="메시지 목록 조회 중 오류가 발생했습니다")


# 메시지 추가 엔드포인트
@router.post("/{conversation_id}/messages", response_model=Dict[str, Any])
async def add_message(conversation_id: str, request: AddMessageRequest):
    """메시지 추가"""
    try:
        # 역할 검증
        try:
            role = MessageRole(request.role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 역할: {request.role}")
        
        result = conversation_service.add_message(
            conversation_id=conversation_id,
            role=role,
            content=request.content,
            metadata=request.metadata,
            parent_id=request.parent_id
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"메시지 추가 실패: {e}")
        raise HTTPException(status_code=500, detail="메시지 추가 중 오류가 발생했습니다")


# 대화 업데이트 엔드포인트
@router.put("/{conversation_id}", response_model=Dict[str, Any])
async def update_conversation(conversation_id: str, request: UpdateConversationRequest):
    """대화 정보 업데이트"""
    try:
        # 상태 검증
        conversation_status = None
        if request.status:
            try:
                conversation_status = ConversationStatus(request.status)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"지원하지 않는 상태: {request.status}")
        
        result = conversation_service.update_conversation(
            conversation_id=conversation_id,
            title=request.title,
            status=conversation_status,
            tags=request.tags,
            metadata=request.metadata
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 업데이트 중 오류가 발생했습니다")


# 대화 삭제 엔드포인트
@router.delete("/{conversation_id}", response_model=Dict[str, Any])
async def delete_conversation(conversation_id: str, permanent: bool = False):
    """대화 삭제"""
    try:
        result = conversation_service.delete_conversation(conversation_id, permanent)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 삭제 중 오류가 발생했습니다")


# 대화 분기 생성 엔드포인트
@router.post("/{conversation_id}/branches", response_model=Dict[str, Any])
async def create_branch(conversation_id: str, request: CreateBranchRequest):
    """대화 분기 생성"""
    try:
        result = conversation_service.create_branch(
            conversation_id=conversation_id,
            branch_name=request.branch_name,
            description=request.description,
            created_by=request.created_by
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 분기 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 분기 생성 중 오류가 발생했습니다")


# 대화 병합 엔드포인트
@router.post("/merge", response_model=Dict[str, Any])
async def merge_conversations(request: MergeConversationsRequest):
    """대화 병합"""
    try:
        result = conversation_service.merge_conversations(
            source_conversation_id=request.source_conversation_id,
            target_conversation_id=request.target_conversation_id,
            merge_strategy=request.merge_strategy
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 병합 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 병합 중 오류가 발생했습니다")


# 대화 내보내기 엔드포인트
@router.get("/{conversation_id}/export", response_model=Dict[str, Any])
async def export_conversation(conversation_id: str, format: str = "json"):
    """대화 내보내기"""
    try:
        result = conversation_service.export_conversation(conversation_id, format)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 내보내기 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 내보내기 중 오류가 발생했습니다")


# 대화 가져오기 엔드포인트
@router.post("/import", response_model=Dict[str, Any])
async def import_conversation(import_data: Dict[str, Any], format: str = "json"):
    """대화 가져오기"""
    try:
        result = conversation_service.import_conversation(import_data, format)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 가져오기 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 가져오기 중 오류가 발생했습니다")


# 대화 파일 업로드 및 가져오기 엔드포인트
@router.post("/import/file", response_model=Dict[str, Any])
async def import_conversation_from_file(file: UploadFile = File(...), format: str = "json"):
    """대화 파일 업로드 및 가져오기"""
    try:
        import json
        
        # 파일 내용 읽기
        content = await file.read()
        
        if format == "json":
            import_data = json.loads(content.decode('utf-8'))
        elif format == "markdown":
            import_data = {"content": content.decode('utf-8')}
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 형식입니다")
        
        # 대화 가져오기
        result = conversation_service.import_conversation(import_data, format)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="유효하지 않은 JSON 파일입니다")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 파일 가져오기 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 파일 가져오기 중 오류가 발생했습니다")


# 대화 검색 엔드포인트
@router.get("/search", response_model=Dict[str, Any])
async def search_conversations(q: str, search_type: str = "content"):
    """대화 검색"""
    try:
        if search_type not in ["content", "title", "tags"]:
            raise HTTPException(status_code=400, detail="지원하지 않는 검색 타입입니다")
        
        results = conversation_service.search_conversations(q, search_type)
        
        return {
            "success": True,
            "results": results,
            "count": len(results),
            "query": q,
            "search_type": search_type
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 검색 중 오류가 발생했습니다")


# 대화 통계 조회 엔드포인트
@router.get("/statistics", response_model=Dict[str, Any])
async def get_conversation_statistics():
    """대화 통계 정보"""
    try:
        stats = conversation_service.get_conversation_statistics()
        
        return {
            "success": True,
            "statistics": stats
        }
    
    except Exception as e:
        logger.error(f"대화 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 통계 조회 중 오류가 발생했습니다")


# 대화 필터링 엔드포인트
@router.get("/filter", response_model=Dict[str, Any])
async def filter_conversations(
    status: Optional[str] = None,
    tags: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """대화 필터링"""
    try:
        # 상태 검증
        conversation_status = None
        if status:
            try:
                conversation_status = ConversationStatus(status)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"지원하지 않는 상태: {status}")
        
        # 기본적으로 활성 대화만 조회
        if not conversation_status:
            conversation_status = ConversationStatus.ACTIVE
        
        conversations = conversation_service.get_all_conversations(
            status=conversation_status,
            limit=limit,
            offset=offset
        )
        
        # 태그 필터링
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',')]
            conversations = [
                conv for conv in conversations
                if any(tag in conv.tags for tag in tag_list)
            ]
        
        # 날짜 필터링
        if date_from:
            try:
                from_date = datetime.fromisoformat(date_from)
                conversations = [
                    conv for conv in conversations
                    if conv.created_at >= from_date
                ]
            except ValueError:
                raise HTTPException(status_code=400, detail="유효하지 않은 시작 날짜입니다")
        
        if date_to:
            try:
                to_date = datetime.fromisoformat(date_to)
                conversations = [
                    conv for conv in conversations
                    if conv.created_at <= to_date
                ]
            except ValueError:
                raise HTTPException(status_code=400, detail="유효하지 않은 종료 날짜입니다")
        
        return {
            "success": True,
            "conversations": [conv.to_dict() for conv in conversations],
            "count": len(conversations),
            "filters": {
                "status": status,
                "tags": tags,
                "date_from": date_from,
                "date_to": date_to
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 필터링 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 필터링 중 오류가 발생했습니다")


# 대화 태그 관리 엔드포인트
@router.get("/tags", response_model=Dict[str, Any])
async def get_all_tags():
    """모든 태그 목록 조회"""
    try:
        conversations = conversation_service.get_all_conversations()
        
        # 모든 태그 수집
        all_tags = set()
        for conversation in conversations:
            all_tags.update(conversation.tags)
        
        # 태그별 대화 수 계산
        tag_counts = {}
        for conversation in conversations:
            for tag in conversation.tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        
        return {
            "success": True,
            "tags": list(all_tags),
            "tag_counts": tag_counts
        }
    
    except Exception as e:
        logger.error(f"태그 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="태그 목록 조회 중 오류가 발생했습니다")


# 대화 복제 엔드포인트
@router.post("/{conversation_id}/duplicate", response_model=Dict[str, Any])
async def duplicate_conversation(conversation_id: str, new_title: Optional[str] = None):
    """대화 복제"""
    try:
        # 원본 대화 조회
        original_conversation = conversation_service.get_conversation(conversation_id)
        if not original_conversation:
            raise HTTPException(status_code=404, detail="대화를 찾을 수 없습니다")
        
        # 새 제목 설정
        if not new_title:
            new_title = f"{original_conversation.title} (복사본)"
        
        # 새 대화 생성
        result = conversation_service.create_conversation(
            title=new_title,
            tags=original_conversation.tags + ["duplicate"],
            metadata={
                **original_conversation.metadata,
                "duplicated_from": conversation_id,
                "duplicated_at": datetime.now().isoformat()
            }
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        new_conversation_id = result["conversation"]["id"]
        
        # 메시지 복사
        messages = conversation_service.get_messages(conversation_id)
        for message in messages:
            conversation_service.add_message(
                conversation_id=new_conversation_id,
                role=message.role,
                content=message.content,
                metadata={
                    **message.metadata,
                    "duplicated_from": message.id,
                    "duplicated_at": datetime.now().isoformat()
                }
            )
        
        return {
            "success": True,
            "new_conversation_id": new_conversation_id,
            "message": "대화가 성공적으로 복제되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"대화 복제 실패: {e}")
        raise HTTPException(status_code=500, detail="대화 복제 중 오류가 발생했습니다")
