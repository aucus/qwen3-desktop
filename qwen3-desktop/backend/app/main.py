from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import asyncio
import json
from typing import Dict, Any
import logging

from .config import settings
from .services.qwen_service import QwenService
from .services.mcp_service import MCPService
from .api.chat import router as chat_router
from .api.files import router as files_router
from .api.mcp import router as mcp_router
from .api.health import router as health_router

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WebSocket 연결 관리
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")

    async def send_personal_message(self, message: str, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")

manager = ConnectionManager()

# 서비스 인스턴스
qwen_service = None
mcp_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시 실행
    global qwen_service, mcp_service
    
    logger.info("Starting Qwen 3 Desktop Assistant backend...")
    
    # Qwen 서비스 초기화
    try:
        qwen_service = QwenService()
        await qwen_service.initialize()
        logger.info("Qwen service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Qwen service: {e}")
        qwen_service = None
    
    # MCP 서비스 초기화
    try:
        mcp_service = MCPService()
        await mcp_service.initialize()
        logger.info("MCP service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize MCP service: {e}")
        mcp_service = None
    
    yield
    
    # 종료 시 실행
    logger.info("Shutting down Qwen 3 Desktop Assistant backend...")
    
    if qwen_service:
        await qwen_service.cleanup()
    
    if mcp_service:
        await mcp_service.cleanup()

# FastAPI 앱 생성
app = FastAPI(
    title="Qwen 3 Desktop Assistant API",
    description="Qwen 3 LLM을 위한 데스크톱 어시스턴트 백엔드 API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(health_router, prefix="/api/health", tags=["health"])
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])
app.include_router(files_router, prefix="/api/files", tags=["files"])
app.include_router(mcp_router, prefix="/api/mcp", tags=["mcp"])

# WebSocket 엔드포인트
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # 메시지 타입에 따른 처리
            if message.get("type") == "chat":
                await handle_chat_message(websocket, client_id, message)
            elif message.get("type") == "mcp":
                await handle_mcp_message(websocket, client_id, message)
            else:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Unknown message type"
                }))
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(client_id)

async def handle_chat_message(websocket: WebSocket, client_id: str, message: Dict[str, Any]):
    """채팅 메시지 처리"""
    try:
        if not qwen_service:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "Qwen service not available"
            }))
            return
        
        user_message = message.get("content", "")
        conversation_id = message.get("conversation_id", "")
        
        # 스트리밍 응답 생성
        async def generate_response():
            try:
                async for chunk in qwen_service.generate_stream(user_message, conversation_id):
                    yield f"data: {json.dumps(chunk)}\n\n"
            except Exception as e:
                error_chunk = {
                    "type": "error",
                    "content": f"Error generating response: {str(e)}"
                }
                yield f"data: {json.dumps(error_chunk)}\n\n"
        
        # 스트리밍 응답 전송
        for chunk in generate_response():
            await websocket.send_text(chunk)
            
    except Exception as e:
        logger.error(f"Error handling chat message: {e}")
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Internal server error: {str(e)}"
        }))

async def handle_mcp_message(websocket: WebSocket, client_id: str, message: Dict[str, Any]):
    """MCP 메시지 처리"""
    try:
        if not mcp_service:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": "MCP service not available"
            }))
            return
        
        # MCP 서비스로 메시지 전달
        response = await mcp_service.handle_message(message)
        await websocket.send_text(json.dumps({
            "type": "mcp_response",
            "data": response
        }))
        
    except Exception as e:
        logger.error(f"Error handling MCP message: {e}")
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Internal server error: {str(e)}"
        }))

# 루트 엔드포인트
@app.get("/")
async def root():
    return {
        "message": "Qwen 3 Desktop Assistant API",
        "version": "0.1.0",
        "status": "running"
    }

# API 정보 엔드포인트
@app.get("/api/info")
async def api_info():
    return {
        "name": "Qwen 3 Desktop Assistant API",
        "version": "0.1.0",
        "description": "Qwen 3 LLM을 위한 데스크톱 어시스턴트 백엔드 API",
        "endpoints": {
            "health": "/api/health",
            "chat": "/api/chat",
            "files": "/api/files",
            "mcp": "/api/mcp",
            "websocket": "/ws/{client_id}"
        },
        "services": {
            "qwen": qwen_service is not None,
            "mcp": mcp_service is not None
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
