import json
import base64
import zlib
from typing import Dict, Any, Union, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class MessageSerializer:
    """MCP 메시지 직렬화/역직렬화 클래스"""
    
    @staticmethod
    def serialize(message: Dict[str, Any], compress: bool = False) -> str:
        """메시지를 직렬화합니다."""
        try:
            # 타임스탬프 추가
            if 'timestamp' not in message:
                message['timestamp'] = datetime.utcnow().isoformat()
            
            # JSON 직렬화
            json_str = json.dumps(message, ensure_ascii=False, separators=(',', ':'))
            
            # 압축 (선택사항)
            if compress:
                compressed = zlib.compress(json_str.encode('utf-8'))
                encoded = base64.b64encode(compressed).decode('utf-8')
                return f"COMPRESSED:{encoded}"
            
            return json_str
            
        except Exception as e:
            logger.error(f"Failed to serialize message: {e}")
            raise
    
    @staticmethod
    def deserialize(data: str) -> Dict[str, Any]:
        """메시지를 역직렬화합니다."""
        try:
            # 압축된 데이터 확인
            if data.startswith("COMPRESSED:"):
                encoded = data[11:]  # "COMPRESSED:" 제거
                compressed = base64.b64decode(encoded)
                json_str = zlib.decompress(compressed).decode('utf-8')
            else:
                json_str = data
            
            # JSON 역직렬화
            message = json.loads(json_str)
            
            # 타임스탬프 파싱
            if 'timestamp' in message:
                try:
                    message['timestamp'] = datetime.fromisoformat(message['timestamp'].replace('Z', '+00:00'))
                except:
                    pass  # 타임스탬프 파싱 실패 시 원본 유지
            
            return message
            
        except Exception as e:
            logger.error(f"Failed to deserialize message: {e}")
            raise
    
    @staticmethod
    def validate_message(message: Dict[str, Any]) -> bool:
        """메시지 유효성을 검증합니다."""
        try:
            # 필수 필드 확인
            required_fields = ['type']
            for field in required_fields:
                if field not in message:
                    return False
            
            # 타입별 검증
            message_type = message.get('type')
            
            if message_type == 'chat':
                return MessageSerializer._validate_chat_message(message)
            elif message_type == 'mcp':
                return MessageSerializer._validate_mcp_message(message)
            elif message_type == 'system':
                return MessageSerializer._validate_system_message(message)
            elif message_type == 'error':
                return MessageSerializer._validate_error_message(message)
            else:
                return False
                
        except Exception as e:
            logger.error(f"Message validation error: {e}")
            return False
    
    @staticmethod
    def _validate_chat_message(message: Dict[str, Any]) -> bool:
        """채팅 메시지 검증"""
        required_fields = ['type', 'data']
        for field in required_fields:
            if field not in message:
                return False
        
        data = message.get('data', {})
        if not isinstance(data, dict):
            return False
        
        # 채팅 메시지 데이터 검증
        if 'message' not in data:
            return False
        
        return True
    
    @staticmethod
    def _validate_mcp_message(message: Dict[str, Any]) -> bool:
        """MCP 메시지 검증"""
        required_fields = ['type', 'data']
        for field in required_fields:
            if field not in message:
                return False
        
        data = message.get('data', {})
        if not isinstance(data, dict):
            return False
        
        # MCP 메시지 데이터 검증
        if 'method' not in data:
            return False
        
        return True
    
    @staticmethod
    def _validate_system_message(message: Dict[str, Any]) -> bool:
        """시스템 메시지 검증"""
        required_fields = ['type', 'data']
        for field in required_fields:
            if field not in message:
                return False
        
        data = message.get('data', {})
        if not isinstance(data, dict):
            return False
        
        # 시스템 메시지 데이터 검증
        if 'action' not in data:
            return False
        
        return True
    
    @staticmethod
    def _validate_error_message(message: Dict[str, Any]) -> bool:
        """에러 메시지 검증"""
        required_fields = ['type', 'data']
        for field in required_fields:
            if field not in message:
                return False
        
        data = message.get('data', {})
        if not isinstance(data, dict):
            return False
        
        # 에러 메시지 데이터 검증
        if 'error' not in data:
            return False
        
        return True

class MessageBuilder:
    """MCP 메시지 빌더 클래스"""
    
    @staticmethod
    def create_chat_message(message: str, conversation_id: str = None, **kwargs) -> Dict[str, Any]:
        """채팅 메시지를 생성합니다."""
        data = {
            'message': message,
            'conversation_id': conversation_id,
            **kwargs
        }
        
        return {
            'type': 'chat',
            'data': data,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def create_mcp_message(method: str, params: Dict[str, Any] = None, server: str = None, **kwargs) -> Dict[str, Any]:
        """MCP 메시지를 생성합니다."""
        data = {
            'method': method,
            'params': params or {},
            'server': server,
            **kwargs
        }
        
        return {
            'type': 'mcp',
            'data': data,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def create_system_message(action: str, data: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """시스템 메시지를 생성합니다."""
        message_data = {
            'action': action,
            'data': data or {},
            **kwargs
        }
        
        return {
            'type': 'system',
            'data': message_data,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def create_error_message(error: str, details: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """에러 메시지를 생성합니다."""
        data = {
            'error': error,
            'details': details or {},
            **kwargs
        }
        
        return {
            'type': 'error',
            'data': data,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def create_response_message(original_message: Dict[str, Any], result: Any = None, error: str = None) -> Dict[str, Any]:
        """응답 메시지를 생성합니다."""
        if error:
            return MessageBuilder.create_error_message(error, {
                'original_message': original_message
            })
        else:
            return {
                'type': 'response',
                'data': {
                    'result': result,
                    'original_message': original_message
                },
                'timestamp': datetime.utcnow().isoformat()
            }

class MessageFormatter:
    """메시지 포맷터 클래스"""
    
    @staticmethod
    def format_for_logging(message: Dict[str, Any]) -> str:
        """로깅용 메시지 포맷"""
        try:
            message_type = message.get('type', 'unknown')
            timestamp = message.get('timestamp', 'unknown')
            
            if message_type == 'chat':
                data = message.get('data', {})
                content = data.get('message', '')[:50] + '...' if len(data.get('message', '')) > 50 else data.get('message', '')
                return f"[{timestamp}] CHAT: {content}"
            
            elif message_type == 'mcp':
                data = message.get('data', {})
                method = data.get('method', 'unknown')
                return f"[{timestamp}] MCP: {method}"
            
            elif message_type == 'system':
                data = message.get('data', {})
                action = data.get('action', 'unknown')
                return f"[{timestamp}] SYSTEM: {action}"
            
            elif message_type == 'error':
                data = message.get('data', {})
                error = data.get('error', 'unknown error')
                return f"[{timestamp}] ERROR: {error}"
            
            else:
                return f"[{timestamp}] {message_type.upper()}: {str(message)[:100]}"
                
        except Exception as e:
            return f"Message formatting error: {e}"
    
    @staticmethod
    def format_for_display(message: Dict[str, Any]) -> str:
        """표시용 메시지 포맷"""
        try:
            message_type = message.get('type', 'unknown')
            
            if message_type == 'chat':
                data = message.get('data', {})
                return data.get('message', '')
            
            elif message_type == 'mcp':
                data = message.get('data', {})
                method = data.get('method', 'unknown')
                return f"MCP: {method}"
            
            elif message_type == 'system':
                data = message.get('data', {})
                action = data.get('action', 'unknown')
                return f"System: {action}"
            
            elif message_type == 'error':
                data = message.get('data', {})
                error = data.get('error', 'unknown error')
                return f"Error: {error}"
            
            else:
                return str(message)
                
        except Exception as e:
            return f"Format error: {e}"
