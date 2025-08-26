from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import asyncio

from ..services.qwen_service import QwenService
from ..utils.logger import api_logger

router = APIRouter()

# 요청/응답 모델
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    max_length: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    system_prompt: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    model_info: Dict[str, Any]

class ChatStreamRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    max_length: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None

# 의존성 주입
def get_qwen_service() -> QwenService:
    """Qwen 서비스 인스턴스를 반환합니다."""
    # 실제 구현에서는 전역 서비스 인스턴스를 사용
    from ..main import qwen_service
    if qwen_service is None:
        raise HTTPException(status_code=503, detail="Qwen service not available")
    return qwen_service

@router.post("/generate", response_model=ChatResponse)
async def generate_response(
    request: ChatRequest,
    qwen_service: QwenService = Depends(get_qwen_service)
):
    """단일 응답을 생성합니다."""
    try:
        api_logger.info(f"Generating response for conversation: {request.conversation_id}")
        
        # 간단한 생성 사용
        response = await qwen_service.generate_simple(request.message)
        
        return ChatResponse(
            response=response,
            conversation_id=request.conversation_id or "default",
            model_info=qwen_service.get_model_info()
        )
        
    except Exception as e:
        api_logger.error(f"Error generating response: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream")
async def generate_stream_response(
    request: ChatStreamRequest,
    qwen_service: QwenService = Depends(get_qwen_service)
):
    """스트리밍 응답을 생성합니다."""
    try:
        api_logger.info(f"Generating streaming response for conversation: {request.conversation_id}")
        
        async def generate():
            async for chunk in qwen_service.generate_stream(
                user_message=request.message,
                conversation_id=request.conversation_id or "default",
                max_length=request.max_length,
                temperature=request.temperature,
                top_p=request.top_p
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
        
    except Exception as e:
        api_logger.error(f"Error generating streaming response: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conversations/{conversation_id}/history")
async def get_conversation_history(
    conversation_id: str,
    qwen_service: QwenService = Depends(get_qwen_service)
):
    """대화 히스토리를 반환합니다."""
    try:
        history = qwen_service.get_conversation_history(conversation_id)
        return {
            "conversation_id": conversation_id,
            "history": history,
            "message_count": len(history)
        }
        
    except Exception as e:
        api_logger.error(f"Error getting conversation history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/conversations/{conversation_id}")
async def clear_conversation(
    conversation_id: str,
    qwen_service: QwenService = Depends(get_qwen_service)
):
    """대화 히스토리를 삭제합니다."""
    try:
        qwen_service.clear_conversation(conversation_id)
        return {
            "message": f"Conversation {conversation_id} cleared successfully",
            "conversation_id": conversation_id
        }
        
    except Exception as e:
        api_logger.error(f"Error clearing conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/model/info")
async def get_model_info(
    qwen_service: QwenService = Depends(get_qwen_service)
):
    """모델 정보를 반환합니다."""
    try:
        return qwen_service.get_model_info()
        
    except Exception as e:
        api_logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/model/reload")
async def reload_model(
    background_tasks: BackgroundTasks,
    qwen_service: QwenService = Depends(get_qwen_service)
):
    """모델을 다시 로딩합니다."""
    try:
        # 백그라운드에서 모델 재로딩
        background_tasks.add_task(qwen_service.cleanup)
        background_tasks.add_task(qwen_service.initialize)
        
        return {
            "message": "Model reload started in background",
            "status": "reloading"
        }
        
    except Exception as e:
        api_logger.error(f"Error reloading model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check(
    qwen_service: QwenService = Depends(get_qwen_service)
):
    """채팅 서비스 상태를 확인합니다."""
    try:
        model_info = qwen_service.get_model_info()
        
        return {
            "status": "healthy" if model_info["is_initialized"] else "unhealthy",
            "model_initialized": model_info["is_initialized"],
            "device": model_info["device"],
            "conversation_count": model_info["conversation_count"]
        }
        
    except Exception as e:
        api_logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
