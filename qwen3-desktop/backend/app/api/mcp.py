from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json

from ..services.mcp_service import MCPService
from ..utils.logger import api_logger

router = APIRouter()

class MCPRequest(BaseModel):
    method: str
    params: Optional[Dict[str, Any]] = None
    server: Optional[str] = None

class MCPResponse(BaseModel):
    result: Any
    error: Optional[str] = None

# 의존성 주입
def get_mcp_service() -> MCPService:
    """MCP 서비스 인스턴스를 반환합니다."""
    from ..main import mcp_service
    if mcp_service is None:
        raise HTTPException(status_code=503, detail="MCP service not available")
    return mcp_service

@router.post("/call")
async def call_mcp_method(
    request: MCPRequest,
    mcp_service: MCPService = Depends(get_mcp_service)
) -> MCPResponse:
    """MCP 메서드를 호출합니다."""
    try:
        api_logger.info(f"MCP method call: {request.method}")
        
        result = await mcp_service.call_method(
            method=request.method,
            params=request.params or {},
            server=request.server
        )
        
        return MCPResponse(result=result)
        
    except Exception as e:
        api_logger.error(f"MCP method call failed: {e}")
        return MCPResponse(result=None, error=str(e))

@router.get("/servers")
async def list_mcp_servers(
    mcp_service: MCPService = Depends(get_mcp_service)
) -> List[Dict[str, Any]]:
    """사용 가능한 MCP 서버 목록을 반환합니다."""
    try:
        servers = await mcp_service.list_servers()
        return servers
        
    except Exception as e:
        api_logger.error(f"Failed to list MCP servers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/servers/{server_name}/info")
async def get_server_info(
    server_name: str,
    mcp_service: MCPService = Depends(get_mcp_service)
) -> Dict[str, Any]:
    """특정 MCP 서버의 정보를 반환합니다."""
    try:
        info = await mcp_service.get_server_info(server_name)
        return info
        
    except Exception as e:
        api_logger.error(f"Failed to get server info for {server_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/servers/{server_name}/connect")
async def connect_server(
    server_name: str,
    mcp_service: MCPService = Depends(get_mcp_service)
) -> Dict[str, str]:
    """MCP 서버에 연결합니다."""
    try:
        await mcp_service.connect_server(server_name)
        return {"message": f"Connected to server: {server_name}"}
        
    except Exception as e:
        api_logger.error(f"Failed to connect to server {server_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/servers/{server_name}/disconnect")
async def disconnect_server(
    server_name: str,
    mcp_service: MCPService = Depends(get_mcp_service)
) -> Dict[str, str]:
    """MCP 서버 연결을 해제합니다."""
    try:
        await mcp_service.disconnect_server(server_name)
        return {"message": f"Disconnected from server: {server_name}"}
        
    except Exception as e:
        api_logger.error(f"Failed to disconnect from server {server_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_mcp_status(
    mcp_service: MCPService = Depends(get_mcp_service)
) -> Dict[str, Any]:
    """MCP 서비스 상태를 반환합니다."""
    try:
        status = await mcp_service.get_status()
        return status
        
    except Exception as e:
        api_logger.error(f"Failed to get MCP status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/handle")
async def handle_mcp_message(
    message: Dict[str, Any],
    mcp_service: MCPService = Depends(get_mcp_service)
) -> Dict[str, Any]:
    """MCP 메시지를 처리합니다."""
    try:
        response = await mcp_service.handle_message(message)
        return response
        
    except Exception as e:
        api_logger.error(f"Failed to handle MCP message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
