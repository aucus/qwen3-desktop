import asyncio
import json
import logging
from typing import Dict, Any, List, Optional, Callable
from pathlib import Path
import aiofiles
from datetime import datetime

from ..config import settings
from ..utils.logger import mcp_logger

class MCPService:
    def __init__(self):
        self.servers: Dict[str, Dict[str, Any]] = {}
        self.connections: Dict[str, Any] = {}
        self.is_initialized = False
        self.message_handlers: Dict[str, Callable] = {}
        
    async def initialize(self):
        """MCP 서비스를 초기화합니다."""
        try:
            mcp_logger.info("Initializing MCP service...")
            
            # MCP 설정 파일 로드
            await self.load_mcp_config()
            
            # 기본 메시지 핸들러 등록
            self.register_default_handlers()
            
            self.is_initialized = True
            mcp_logger.info("MCP service initialized successfully")
            
        except Exception as e:
            mcp_logger.error(f"Failed to initialize MCP service: {e}")
            raise
    
    async def cleanup(self):
        """MCP 서비스 리소스를 정리합니다."""
        try:
            # 모든 서버 연결 해제
            for server_name in list(self.connections.keys()):
                await self.disconnect_server(server_name)
            
            self.is_initialized = False
            mcp_logger.info("MCP service cleaned up")
            
        except Exception as e:
            mcp_logger.error(f"Error during MCP cleanup: {e}")
    
    async def load_mcp_config(self):
        """MCP 설정 파일을 로드합니다."""
        try:
            config_path = Path(settings.MCP_CONFIG_PATH)
            if not config_path.exists():
                mcp_logger.warning(f"MCP config file not found: {config_path}")
                return
            
            async with aiofiles.open(config_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                config = json.loads(content)
            
            # 서버 목록 로드
            if 'servers' in config:
                for server_config in config['servers']:
                    server_name = server_config.get('name', 'unknown')
                    self.servers[server_name] = server_config
                    mcp_logger.info(f"Loaded MCP server config: {server_name}")
            
        except Exception as e:
            mcp_logger.error(f"Failed to load MCP config: {e}")
    
    def register_default_handlers(self):
        """기본 메시지 핸들러를 등록합니다."""
        self.message_handlers.update({
            'ping': self.handle_ping,
            'pong': self.handle_pong,
            'status': self.handle_status,
            'reconnect': self.handle_reconnect,
        })
    
    async def list_servers(self) -> List[Dict[str, Any]]:
        """사용 가능한 MCP 서버 목록을 반환합니다."""
        server_list = []
        for name, config in self.servers.items():
            server_info = {
                'name': name,
                'description': config.get('description', ''),
                'version': config.get('version', '1.0.0'),
                'capabilities': config.get('capabilities', []),
                'connected': name in self.connections,
                'config': config
            }
            server_list.append(server_info)
        
        return server_list
    
    async def get_server_info(self, server_name: str) -> Dict[str, Any]:
        """특정 MCP 서버의 정보를 반환합니다."""
        if server_name not in self.servers:
            raise ValueError(f"Server not found: {server_name}")
        
        config = self.servers[server_name]
        return {
            'name': server_name,
            'description': config.get('description', ''),
            'version': config.get('version', '1.0.0'),
            'capabilities': config.get('capabilities', []),
            'connected': server_name in self.connections,
            'config': config
        }
    
    async def connect_server(self, server_name: str) -> bool:
        """MCP 서버에 연결합니다."""
        try:
            if server_name not in self.servers:
                raise ValueError(f"Server not found: {server_name}")
            
            if server_name in self.connections:
                mcp_logger.info(f"Already connected to server: {server_name}")
                return True
            
            config = self.servers[server_name]
            connection_type = config.get('type', 'stdio')
            
            if connection_type == 'stdio':
                connection = await self._connect_stdio_server(config)
            elif connection_type == 'tcp':
                connection = await self._connect_tcp_server(config)
            elif connection_type == 'http':
                connection = await self._connect_http_server(config)
            else:
                raise ValueError(f"Unsupported connection type: {connection_type}")
            
            self.connections[server_name] = connection
            mcp_logger.info(f"Connected to MCP server: {server_name}")
            return True
            
        except Exception as e:
            mcp_logger.error(f"Failed to connect to server {server_name}: {e}")
            return False
    
    async def disconnect_server(self, server_name: str) -> bool:
        """MCP 서버 연결을 해제합니다."""
        try:
            if server_name not in self.connections:
                return True
            
            connection = self.connections[server_name]
            
            # 연결 종료
            if hasattr(connection, 'close'):
                await connection.close()
            elif hasattr(connection, 'terminate'):
                connection.terminate()
            
            del self.connections[server_name]
            mcp_logger.info(f"Disconnected from MCP server: {server_name}")
            return True
            
        except Exception as e:
            mcp_logger.error(f"Failed to disconnect from server {server_name}: {e}")
            return False
    
    async def call_method(self, method: str, params: Dict[str, Any] = None, server: str = None) -> Any:
        """MCP 메서드를 호출합니다."""
        try:
            if server and server not in self.connections:
                raise ValueError(f"Server not connected: {server}")
            
            # 서버가 지정되지 않은 경우 첫 번째 연결된 서버 사용
            if not server and self.connections:
                server = list(self.connections.keys())[0]
            
            if not server:
                raise ValueError("No MCP server connected")
            
            connection = self.connections[server]
            
            # JSON-RPC 요청 생성
            request = {
                'jsonrpc': '2.0',
                'id': self._generate_request_id(),
                'method': method,
                'params': params or {}
            }
            
            # 요청 전송
            response = await self._send_request(connection, request)
            
            if 'error' in response:
                raise Exception(f"MCP error: {response['error']}")
            
            return response.get('result')
            
        except Exception as e:
            mcp_logger.error(f"Failed to call MCP method {method}: {e}")
            raise
    
    async def handle_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """MCP 메시지를 처리합니다."""
        try:
            message_type = message.get('type')
            
            if message_type in self.message_handlers:
                handler = self.message_handlers[message_type]
                return await handler(message)
            else:
                # 기본 메시지 처리
                return await self._handle_default_message(message)
                
        except Exception as e:
            mcp_logger.error(f"Failed to handle MCP message: {e}")
            return {
                'type': 'error',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def get_status(self) -> Dict[str, Any]:
        """MCP 서비스 상태를 반환합니다."""
        return {
            'initialized': self.is_initialized,
            'connected_servers': list(self.connections.keys()),
            'available_servers': list(self.servers.keys()),
            'total_servers': len(self.servers),
            'total_connections': len(self.connections),
            'timestamp': datetime.utcnow().isoformat()
        }
    
    # 내부 메서드들
    async def _connect_stdio_server(self, config: Dict[str, Any]) -> Any:
        """stdio 서버에 연결합니다."""
        command = config.get('command', [])
        if not command:
            raise ValueError("No command specified for stdio server")
        
        process = await asyncio.create_subprocess_exec(
            *command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        return process
    
    async def _connect_tcp_server(self, config: Dict[str, Any]) -> Any:
        """TCP 서버에 연결합니다."""
        host = config.get('host', 'localhost')
        port = config.get('port', 8080)
        
        reader, writer = await asyncio.open_connection(host, port)
        return {'reader': reader, 'writer': writer}
    
    async def _connect_http_server(self, config: Dict[str, Any]) -> Any:
        """HTTP 서버에 연결합니다."""
        url = config.get('url', 'http://localhost:8080')
        return {'url': url}
    
    async def _send_request(self, connection: Any, request: Dict[str, Any]) -> Dict[str, Any]:
        """요청을 전송하고 응답을 받습니다."""
        request_json = json.dumps(request) + '\n'
        
        if hasattr(connection, 'stdin'):
            # stdio 연결
            connection.stdin.write(request_json.encode())
            await connection.stdin.drain()
            
            # 응답 읽기
            line = await connection.stdout.readline()
            return json.loads(line.decode().strip())
        
        elif 'writer' in connection:
            # TCP 연결
            writer = connection['writer']
            writer.write(request_json.encode())
            await writer.drain()
            
            reader = connection['reader']
            line = await reader.readline()
            return json.loads(line.decode().strip())
        
        elif 'url' in connection:
            # HTTP 연결
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    connection['url'],
                    json=request,
                    headers={'Content-Type': 'application/json'}
                ) as response:
                    return await response.json()
        
        else:
            raise ValueError("Unsupported connection type")
    
    def _generate_request_id(self) -> str:
        """요청 ID를 생성합니다."""
        return f"req_{datetime.utcnow().timestamp()}_{id(self)}"
    
    async def _handle_default_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """기본 메시지 처리"""
        return {
            'type': 'response',
            'message': 'Message received',
            'data': message,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    # 메시지 핸들러들
    async def handle_ping(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """핑 메시지 처리"""
        return {
            'type': 'pong',
            'timestamp': datetime.utcnow().isoformat(),
            'data': message.get('data', {})
        }
    
    async def handle_pong(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """퐁 메시지 처리"""
        return {
            'type': 'response',
            'message': 'Pong received',
            'timestamp': datetime.utcnow().isoformat()
        }
    
    async def handle_status(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """상태 요청 처리"""
        return await self.get_status()
    
    async def handle_reconnect(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """재연결 요청 처리"""
        # 모든 연결 해제 후 재연결
        for server_name in list(self.connections.keys()):
            await self.disconnect_server(server_name)
        
        # 설정된 서버들 재연결
        for server_name in self.servers.keys():
            await self.connect_server(server_name)
        
        return {
            'type': 'response',
            'message': 'Reconnection completed',
            'timestamp': datetime.utcnow().isoformat()
        }
