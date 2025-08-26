import json
import asyncio
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class JSONRPCClient:
    """JSON-RPC 클라이언트"""
    
    def __init__(self):
        self.request_id = 0
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.message_handlers: Dict[str, Callable] = {}
        
    def _generate_id(self) -> str:
        """요청 ID를 생성합니다."""
        self.request_id += 1
        return f"req_{self.request_id}_{datetime.utcnow().timestamp()}"
    
    def create_request(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """JSON-RPC 요청을 생성합니다."""
        return {
            "jsonrpc": "2.0",
            "id": self._generate_id(),
            "method": method,
            "params": params or {}
        }
    
    def create_notification(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """JSON-RPC 알림을 생성합니다."""
        return {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {}
        }
    
    def create_response(self, request_id: str, result: Any = None, error: Dict[str, Any] = None) -> Dict[str, Any]:
        """JSON-RPC 응답을 생성합니다."""
        response = {
            "jsonrpc": "2.0",
            "id": request_id
        }
        
        if error:
            response["error"] = error
        else:
            response["result"] = result
            
        return response
    
    def parse_message(self, message: str) -> Dict[str, Any]:
        """JSON-RPC 메시지를 파싱합니다."""
        try:
            data = json.loads(message)
            
            # 필수 필드 검증
            if "jsonrpc" not in data or data["jsonrpc"] != "2.0":
                raise ValueError("Invalid JSON-RPC version")
            
            return data
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e}")
    
    def validate_request(self, data: Dict[str, Any]) -> bool:
        """요청 메시지를 검증합니다."""
        required_fields = ["jsonrpc", "method"]
        
        for field in required_fields:
            if field not in data:
                return False
        
        if data["jsonrpc"] != "2.0":
            return False
            
        return True
    
    def validate_response(self, data: Dict[str, Any]) -> bool:
        """응답 메시지를 검증합니다."""
        required_fields = ["jsonrpc", "id"]
        
        for field in required_fields:
            if field not in data:
                return False
        
        if data["jsonrpc"] != "2.0":
            return False
            
        # result 또는 error 중 하나는 있어야 함
        if "result" not in data and "error" not in data:
            return False
            
        return True
    
    def validate_notification(self, data: Dict[str, Any]) -> bool:
        """알림 메시지를 검증합니다."""
        required_fields = ["jsonrpc", "method"]
        
        for field in required_fields:
            if field not in data:
                return False
        
        if data["jsonrpc"] != "2.0":
            return False
            
        # 알림은 id가 없어야 함
        if "id" in data:
            return False
            
        return True

class JSONRPCServer:
    """JSON-RPC 서버"""
    
    def __init__(self):
        self.methods: Dict[str, Callable] = {}
        self.notification_handlers: Dict[str, Callable] = {}
        
    def register_method(self, name: str, handler: Callable):
        """메서드를 등록합니다."""
        self.methods[name] = handler
        logger.info(f"Registered JSON-RPC method: {name}")
    
    def register_notification(self, name: str, handler: Callable):
        """알림 핸들러를 등록합니다."""
        self.notification_handlers[name] = handler
        logger.info(f"Registered JSON-RPC notification: {name}")
    
    async def handle_message(self, message: str) -> Optional[str]:
        """메시지를 처리합니다."""
        try:
            data = json.loads(message)
            
            # JSON-RPC 버전 검증
            if data.get("jsonrpc") != "2.0":
                return self._create_error_response(None, -32600, "Invalid Request")
            
            # 요청인지 알림인지 확인
            if "id" in data:
                return await self._handle_request(data)
            else:
                await self._handle_notification(data)
                return None
                
        except json.JSONDecodeError:
            return self._create_error_response(None, -32700, "Parse error")
        except Exception as e:
            logger.error(f"Error handling JSON-RPC message: {e}")
            return self._create_error_response(None, -32603, "Internal error")
    
    async def _handle_request(self, data: Dict[str, Any]) -> str:
        """요청을 처리합니다."""
        request_id = data.get("id")
        method = data.get("method")
        params = data.get("params", {})
        
        # 메서드 존재 여부 확인
        if method not in self.methods:
            return self._create_error_response(request_id, -32601, "Method not found")
        
        try:
            # 메서드 실행
            handler = self.methods[method]
            if asyncio.iscoroutinefunction(handler):
                result = await handler(params)
            else:
                result = handler(params)
            
            return self._create_success_response(request_id, result)
            
        except Exception as e:
            logger.error(f"Error executing method {method}: {e}")
            return self._create_error_response(request_id, -32603, "Internal error", str(e))
    
    async def _handle_notification(self, data: Dict[str, Any]):
        """알림을 처리합니다."""
        method = data.get("method")
        params = data.get("params", {})
        
        if method in self.notification_handlers:
            try:
                handler = self.notification_handlers[method]
                if asyncio.iscoroutinefunction(handler):
                    await handler(params)
                else:
                    handler(params)
            except Exception as e:
                logger.error(f"Error handling notification {method}: {e}")
    
    def _create_success_response(self, request_id: Any, result: Any) -> str:
        """성공 응답을 생성합니다."""
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result
        }
        return json.dumps(response)
    
    def _create_error_response(self, request_id: Any, code: int, message: str, data: str = None) -> str:
        """에러 응답을 생성합니다."""
        error = {
            "code": code,
            "message": message
        }
        
        if data:
            error["data"] = data
        
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": error
        }
        return json.dumps(response)

# JSON-RPC 에러 코드
class JSONRPCError:
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    SERVER_ERROR_START = -32000
    SERVER_ERROR_END = -32099

# 유틸리티 함수들
def create_batch_request(requests: List[Dict[str, Any]]) -> str:
    """배치 요청을 생성합니다."""
    return json.dumps(requests)

def parse_batch_response(response: str) -> List[Dict[str, Any]]:
    """배치 응답을 파싱합니다."""
    return json.loads(response)

def is_batch_message(message: str) -> bool:
    """배치 메시지인지 확인합니다."""
    try:
        data = json.loads(message)
        return isinstance(data, list)
    except:
        return False
