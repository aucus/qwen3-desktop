import asyncio
import subprocess
import shlex
import os
import signal
from typing import Dict, Any, List, Optional
from datetime import datetime
import tempfile
import json

from ...utils.logger import mcp_logger

class TerminalMCPServer:
    """터미널 MCP 서버"""
    
    def __init__(self, working_directory: str = None, allowed_commands: List[str] = None):
        self.working_directory = working_directory or os.getcwd()
        self.allowed_commands = allowed_commands or [
            'ls', 'cat', 'grep', 'find', 'pwd', 'echo', 'head', 'tail',
            'wc', 'sort', 'uniq', 'cut', 'awk', 'sed', 'tr', 'diff',
            'file', 'stat', 'du', 'df', 'ps', 'top', 'free', 'uptime'
        ]
        self.running_processes: Dict[str, asyncio.subprocess.Process] = {}
        self.command_history: List[Dict[str, Any]] = []
        self.max_history = 100
        
    async def initialize(self):
        """서버를 초기화합니다."""
        try:
            mcp_logger.info(f"Initializing terminal MCP server with working directory: {self.working_directory}")
            
            # 작업 디렉토리 확인
            if not os.path.exists(self.working_directory):
                os.makedirs(self.working_directory, exist_ok=True)
            
            # 기본 메서드 등록
            self.methods = {
                'terminal/execute': self.execute_command,
                'terminal/list': self.list_commands,
                'terminal/history': self.get_history,
                'terminal/kill': self.kill_process,
                'terminal/status': self.get_status,
                'terminal/change_directory': self.change_directory,
            }
            
            mcp_logger.info("Terminal MCP server initialized successfully")
            
        except Exception as e:
            mcp_logger.error(f"Failed to initialize terminal MCP server: {e}")
            raise
    
    async def cleanup(self):
        """서버 리소스를 정리합니다."""
        try:
            # 실행 중인 프로세스 종료
            for process_id, process in self.running_processes.items():
                try:
                    process.terminate()
                    await asyncio.wait_for(process.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
                except Exception as e:
                    mcp_logger.warning(f"Error terminating process {process_id}: {e}")
            
            self.running_processes.clear()
            mcp_logger.info("Terminal MCP server cleaned up")
            
        except Exception as e:
            mcp_logger.error(f"Error during terminal cleanup: {e}")
    
    async def handle_request(self, method: str, params: Dict[str, Any]) -> Any:
        """요청을 처리합니다."""
        try:
            if method not in self.methods:
                raise ValueError(f"Unknown method: {method}")
            
            handler = self.methods[method]
            return await handler(params)
            
        except Exception as e:
            mcp_logger.error(f"Error handling terminal request {method}: {e}")
            raise
    
    async def execute_command(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """명령어를 실행합니다."""
        try:
            command = params.get('command')
            timeout = params.get('timeout', 30)
            working_dir = params.get('working_directory', self.working_directory)
            
            if not command:
                raise ValueError("Command parameter is required")
            
            # 명령어 보안 검증
            self._validate_command(command)
            
            mcp_logger.info(f"Executing command: {command}")
            
            # 명령어 파싱
            if isinstance(command, str):
                cmd_parts = shlex.split(command)
            else:
                cmd_parts = command
            
            # 프로세스 ID 생성
            process_id = f"proc_{datetime.now().timestamp()}_{len(self.running_processes)}"
            
            # 프로세스 실행
            process = await asyncio.create_subprocess_exec(
                *cmd_parts,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir,
                env=os.environ.copy()
            )
            
            # 프로세스 등록
            self.running_processes[process_id] = process
            
            try:
                # 타임아웃 설정
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
                
                # 결과 처리
                exit_code = process.returncode
                output = stdout.decode('utf-8', errors='ignore')
                error_output = stderr.decode('utf-8', errors='ignore')
                
                result = {
                    'process_id': process_id,
                    'command': command,
                    'exit_code': exit_code,
                    'stdout': output,
                    'stderr': error_output,
                    'success': exit_code == 0,
                    'executed_at': datetime.now().isoformat(),
                    'working_directory': working_dir,
                    'timeout': timeout
                }
                
                # 히스토리에 추가
                self._add_to_history(result)
                
                return result
                
            finally:
                # 프로세스 등록 해제
                if process_id in self.running_processes:
                    del self.running_processes[process_id]
            
        except asyncio.TimeoutError:
            # 타임아웃 처리
            if process_id in self.running_processes:
                process = self.running_processes[process_id]
                process.terminate()
                del self.running_processes[process_id]
            
            return {
                'process_id': process_id,
                'command': command,
                'exit_code': -1,
                'stdout': '',
                'stderr': f'Command timed out after {timeout} seconds',
                'success': False,
                'executed_at': datetime.now().isoformat(),
                'working_directory': working_dir,
                'timeout': timeout,
                'timed_out': True
            }
            
        except Exception as e:
            mcp_logger.error(f"Error executing command {params.get('command')}: {e}")
            raise
    
    async def list_commands(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """사용 가능한 명령어 목록을 반환합니다."""
        try:
            command_type = params.get('type', 'all')  # 'all', 'basic', 'system'
            
            if command_type == 'basic':
                commands = [cmd for cmd in self.allowed_commands if cmd in ['ls', 'cat', 'grep', 'find', 'pwd', 'echo']]
            elif command_type == 'system':
                commands = [cmd for cmd in self.allowed_commands if cmd in ['ps', 'top', 'free', 'uptime', 'df', 'du']]
            else:
                commands = self.allowed_commands.copy()
            
            return {
                'commands': commands,
                'total': len(commands),
                'type': command_type,
                'working_directory': self.working_directory
            }
            
        except Exception as e:
            mcp_logger.error(f"Error listing commands: {e}")
            raise
    
    async def get_history(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """명령어 실행 히스토리를 반환합니다."""
        try:
            limit = params.get('limit', 50)
            include_output = params.get('include_output', False)
            
            # 히스토리 필터링
            history = self.command_history[-limit:] if limit > 0 else self.command_history.copy()
            
            # 출력 포함 여부에 따라 필터링
            if not include_output:
                for item in history:
                    if 'stdout' in item:
                        del item['stdout']
                    if 'stderr' in item:
                        del item['stderr']
            
            return {
                'history': history,
                'total': len(history),
                'limit': limit,
                'include_output': include_output
            }
            
        except Exception as e:
            mcp_logger.error(f"Error getting command history: {e}")
            raise
    
    async def kill_process(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """실행 중인 프로세스를 종료합니다."""
        try:
            process_id = params.get('process_id')
            signal_type = params.get('signal', 'TERM')  # 'TERM', 'KILL'
            
            if not process_id:
                raise ValueError("Process ID parameter is required")
            
            if process_id not in self.running_processes:
                raise ValueError(f"Process not found: {process_id}")
            
            process = self.running_processes[process_id]
            
            if signal_type == 'KILL':
                process.kill()
            else:
                process.terminate()
            
            # 프로세스 종료 대기
            try:
                await asyncio.wait_for(process.wait(), timeout=5.0)
                exit_code = process.returncode
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                exit_code = -1
            
            # 프로세스 등록 해제
            del self.running_processes[process_id]
            
            return {
                'process_id': process_id,
                'signal': signal_type,
                'killed': True,
                'exit_code': exit_code,
                'killed_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error killing process {params.get('process_id')}: {e}")
            raise
    
    async def get_status(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """터미널 서버 상태를 반환합니다."""
        try:
            return {
                'working_directory': self.working_directory,
                'running_processes': len(self.running_processes),
                'command_history_count': len(self.command_history),
                'allowed_commands_count': len(self.allowed_commands),
                'process_ids': list(self.running_processes.keys()),
                'status': 'running',
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error getting terminal status: {e}")
            raise
    
    async def change_directory(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """작업 디렉토리를 변경합니다."""
        try:
            new_directory = params.get('directory')
            if not new_directory:
                raise ValueError("Directory parameter is required")
            
            # 절대 경로 또는 상대 경로 처리
            if os.path.isabs(new_directory):
                target_dir = new_directory
            else:
                target_dir = os.path.join(self.working_directory, new_directory)
            
            # 디렉토리 존재 확인
            if not os.path.exists(target_dir):
                raise FileNotFoundError(f"Directory not found: {target_dir}")
            
            if not os.path.isdir(target_dir):
                raise ValueError(f"Path is not a directory: {target_dir}")
            
            # 권한 확인
            if not os.access(target_dir, os.R_OK | os.X_OK):
                raise PermissionError(f"Permission denied: {target_dir}")
            
            old_directory = self.working_directory
            self.working_directory = target_dir
            
            return {
                'old_directory': old_directory,
                'new_directory': self.working_directory,
                'changed': True,
                'changed_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error changing directory to {params.get('directory')}: {e}")
            raise
    
    # 내부 메서드들
    def _validate_command(self, command: str):
        """명령어 보안을 검증합니다."""
        if isinstance(command, str):
            cmd_parts = shlex.split(command)
        else:
            cmd_parts = command
        
        if not cmd_parts:
            raise ValueError("Empty command")
        
        base_command = cmd_parts[0]
        
        # 허용된 명령어인지 확인
        if base_command not in self.allowed_commands:
            raise ValueError(f"Command not allowed: {base_command}")
        
        # 위험한 명령어 패턴 확인
        dangerous_patterns = [
            'rm -rf', 'dd if=', '> /dev/', '| bash', '| sh',
            'sudo', 'su', 'chmod 777', 'chown root'
        ]
        
        command_str = ' '.join(cmd_parts)
        for pattern in dangerous_patterns:
            if pattern in command_str:
                raise ValueError(f"Dangerous command pattern detected: {pattern}")
    
    def _add_to_history(self, result: Dict[str, Any]):
        """결과를 히스토리에 추가합니다."""
        history_item = {
            'command': result['command'],
            'exit_code': result['exit_code'],
            'success': result['success'],
            'executed_at': result['executed_at'],
            'working_directory': result['working_directory']
        }
        
        self.command_history.append(history_item)
        
        # 히스토리 크기 제한
        if len(self.command_history) > self.max_history:
            self.command_history = self.command_history[-self.max_history:]
    
    def _get_system_info(self) -> Dict[str, Any]:
        """시스템 정보를 가져옵니다."""
        try:
            import platform
            import psutil
            
            return {
                'platform': platform.system(),
                'platform_version': platform.version(),
                'architecture': platform.machine(),
                'processor': platform.processor(),
                'cpu_count': psutil.cpu_count(),
                'memory_total': psutil.virtual_memory().total,
                'memory_available': psutil.virtual_memory().available,
                'disk_usage': psutil.disk_usage('/')._asdict(),
                'uptime': psutil.boot_time()
            }
        except ImportError:
            return {
                'platform': 'unknown',
                'error': 'psutil not available'
            }
