import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime

from .mcp_servers.filesystem_server import FilesystemMCPServer
from .mcp_servers.web_search_server import WebSearchMCPServer
from .mcp_servers.terminal_server import TerminalMCPServer
from .mcp_servers.database_server import DatabaseMCPServer
from ..utils.logger import mcp_logger

class MCPServerManager:
    """MCP 서버들을 통합 관리하는 매니저"""
    
    def __init__(self):
        self.servers: Dict[str, Any] = {}
        self.server_configs: Dict[str, Dict[str, Any]] = {}
        self.is_initialized = False
        
    async def initialize(self, config: Dict[str, Any] = None):
        """MCP 서버 매니저를 초기화합니다."""
        try:
            mcp_logger.info("Initializing MCP server manager")
            
            # 기본 설정
            default_config = {
                'filesystem': {
                    'enabled': True,
                    'root_path': None,  # 홈 디렉토리 사용
                    'max_file_size': 10 * 1024 * 1024  # 10MB
                },
                'web_search': {
                    'enabled': True,
                    'api_key': None,
                    'max_results': 10,
                    'timeout': 30
                },
                'terminal': {
                    'enabled': True,
                    'working_directory': None,  # 현재 디렉토리 사용
                    'allowed_commands': [
                        'ls', 'cat', 'grep', 'find', 'pwd', 'echo', 'head', 'tail',
                        'wc', 'sort', 'uniq', 'cut', 'awk', 'sed', 'tr', 'diff',
                        'file', 'stat', 'du', 'df', 'ps', 'top', 'free', 'uptime'
                    ]
                },
                'database': {
                    'enabled': True,
                    'database_path': 'qwen_desktop.db',
                    'allowed_operations': ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
                }
            }
            
            # 사용자 설정으로 덮어쓰기
            if config:
                for server_name, server_config in config.items():
                    if server_name in default_config:
                        default_config[server_name].update(server_config)
            
            self.server_configs = default_config
            
            # 서버 초기화
            await self._initialize_servers()
            
            self.is_initialized = True
            mcp_logger.info("MCP server manager initialized successfully")
            
        except Exception as e:
            mcp_logger.error(f"Failed to initialize MCP server manager: {e}")
            raise
    
    async def cleanup(self):
        """모든 서버 리소스를 정리합니다."""
        try:
            mcp_logger.info("Cleaning up MCP server manager")
            
            for server_name, server in self.servers.items():
                try:
                    if hasattr(server, 'cleanup'):
                        await server.cleanup()
                    mcp_logger.info(f"Cleaned up server: {server_name}")
                except Exception as e:
                    mcp_logger.error(f"Error cleaning up server {server_name}: {e}")
            
            self.servers.clear()
            self.is_initialized = False
            mcp_logger.info("MCP server manager cleaned up")
            
        except Exception as e:
            mcp_logger.error(f"Error during MCP server manager cleanup: {e}")
    
    async def handle_request(self, method: str, params: Dict[str, Any]) -> Any:
        """요청을 적절한 서버로 라우팅합니다."""
        try:
            if not self.is_initialized:
                raise RuntimeError("MCP server manager not initialized")
            
            # 메서드에서 서버 타입 추출
            server_type = self._extract_server_type(method)
            
            if server_type not in self.servers:
                raise ValueError(f"Server not available: {server_type}")
            
            server = self.servers[server_type]
            
            # 서버로 요청 전달
            return await server.handle_request(method, params)
            
        except Exception as e:
            mcp_logger.error(f"Error handling request {method}: {e}")
            raise
    
    async def get_server_status(self) -> Dict[str, Any]:
        """모든 서버의 상태를 반환합니다."""
        try:
            status = {
                'manager_initialized': self.is_initialized,
                'servers': {},
                'total_servers': len(self.servers),
                'timestamp': datetime.now().isoformat()
            }
            
            for server_name, server in self.servers.items():
                try:
                    if hasattr(server, 'get_status'):
                        server_status = await server.get_status({})
                    else:
                        server_status = {'status': 'running'}
                    
                    status['servers'][server_name] = {
                        'enabled': True,
                        'status': server_status.get('status', 'unknown'),
                        'config': self.server_configs.get(server_name, {})
                    }
                    
                except Exception as e:
                    status['servers'][server_name] = {
                        'enabled': True,
                        'status': 'error',
                        'error': str(e)
                    }
            
            return status
            
        except Exception as e:
            mcp_logger.error(f"Error getting server status: {e}")
            raise
    
    async def list_available_methods(self) -> Dict[str, Any]:
        """사용 가능한 모든 메서드를 반환합니다."""
        try:
            methods = {}
            
            for server_name, server in self.servers.items():
                if hasattr(server, 'methods'):
                    methods[server_name] = list(server.methods.keys())
                else:
                    methods[server_name] = []
            
            return {
                'methods': methods,
                'total_servers': len(methods),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error listing available methods: {e}")
            raise
    
    async def reload_server(self, server_name: str) -> Dict[str, Any]:
        """특정 서버를 재로드합니다."""
        try:
            if server_name not in self.server_configs:
                raise ValueError(f"Server not configured: {server_name}")
            
            # 기존 서버 정리
            if server_name in self.servers:
                old_server = self.servers[server_name]
                if hasattr(old_server, 'cleanup'):
                    await old_server.cleanup()
                del self.servers[server_name]
            
            # 서버 재초기화
            await self._initialize_server(server_name, self.server_configs[server_name])
            
            return {
                'server': server_name,
                'reloaded': True,
                'reloaded_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error reloading server {server_name}: {e}")
            raise
    
    async def enable_server(self, server_name: str) -> Dict[str, Any]:
        """서버를 활성화합니다."""
        try:
            if server_name not in self.server_configs:
                raise ValueError(f"Server not configured: {server_name}")
            
            if server_name in self.servers:
                return {
                    'server': server_name,
                    'enabled': True,
                    'already_enabled': True
                }
            
            # 서버 초기화
            await self._initialize_server(server_name, self.server_configs[server_name])
            
            return {
                'server': server_name,
                'enabled': True,
                'enabled_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error enabling server {server_name}: {e}")
            raise
    
    async def disable_server(self, server_name: str) -> Dict[str, Any]:
        """서버를 비활성화합니다."""
        try:
            if server_name not in self.servers:
                return {
                    'server': server_name,
                    'disabled': True,
                    'already_disabled': True
                }
            
            # 서버 정리
            server = self.servers[server_name]
            if hasattr(server, 'cleanup'):
                await server.cleanup()
            
            del self.servers[server_name]
            
            return {
                'server': server_name,
                'disabled': True,
                'disabled_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error disabling server {server_name}: {e}")
            raise
    
    # 내부 메서드들
    async def _initialize_servers(self):
        """모든 서버를 초기화합니다."""
        for server_name, config in self.server_configs.items():
            if config.get('enabled', True):
                await self._initialize_server(server_name, config)
    
    async def _initialize_server(self, server_name: str, config: Dict[str, Any]):
        """특정 서버를 초기화합니다."""
        try:
            mcp_logger.info(f"Initializing server: {server_name}")
            
            if server_name == 'filesystem':
                server = FilesystemMCPServer(
                    root_path=config.get('root_path'),
                )
            elif server_name == 'web_search':
                server = WebSearchMCPServer(
                    api_key=config.get('api_key'),
                )
            elif server_name == 'terminal':
                server = TerminalMCPServer(
                    working_directory=config.get('working_directory'),
                    allowed_commands=config.get('allowed_commands'),
                )
            elif server_name == 'database':
                server = DatabaseMCPServer(
                    database_path=config.get('database_path'),
                    allowed_operations=config.get('allowed_operations'),
                )
            else:
                raise ValueError(f"Unknown server type: {server_name}")
            
            await server.initialize()
            self.servers[server_name] = server
            
            mcp_logger.info(f"Server initialized successfully: {server_name}")
            
        except Exception as e:
            mcp_logger.error(f"Failed to initialize server {server_name}: {e}")
            raise
    
    def _extract_server_type(self, method: str) -> str:
        """메서드에서 서버 타입을 추출합니다."""
        if method.startswith('filesystem/'):
            return 'filesystem'
        elif method.startswith('web/'):
            return 'web_search'
        elif method.startswith('terminal/'):
            return 'terminal'
        elif method.startswith('database/'):
            return 'database'
        else:
            raise ValueError(f"Unknown method prefix: {method}")
    
    def get_server_info(self, server_name: str) -> Dict[str, Any]:
        """서버 정보를 반환합니다."""
        if server_name not in self.server_configs:
            raise ValueError(f"Server not configured: {server_name}")
        
        config = self.server_configs[server_name]
        is_running = server_name in self.servers
        
        return {
            'name': server_name,
            'enabled': config.get('enabled', True),
            'running': is_running,
            'config': config,
            'available_methods': list(self.servers[server_name].methods.keys()) if is_running else []
        }
    
    def list_servers(self) -> List[Dict[str, Any]]:
        """모든 서버 정보를 반환합니다."""
        servers = []
        
        for server_name in self.server_configs.keys():
            try:
                server_info = self.get_server_info(server_name)
                servers.append(server_info)
            except Exception as e:
                mcp_logger.error(f"Error getting info for server {server_name}: {e}")
        
        return servers
