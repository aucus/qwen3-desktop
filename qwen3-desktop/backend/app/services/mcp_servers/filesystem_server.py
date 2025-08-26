import asyncio
import json
import os
import shutil
import glob
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import aiofiles

from ...utils.logger import mcp_logger

class FilesystemMCPServer:
    """파일시스템 MCP 서버"""
    
    def __init__(self, root_path: str = None):
        self.root_path = Path(root_path) if root_path else Path.home()
        self.allowed_extensions = ['.txt', '.md', '.py', '.js', '.ts', '.json', '.csv', '.xml', '.html', '.css']
        self.max_file_size = 10 * 1024 * 1024  # 10MB
        
    async def initialize(self):
        """서버를 초기화합니다."""
        try:
            mcp_logger.info(f"Initializing filesystem MCP server with root: {self.root_path}")
            
            # 루트 디렉토리 확인
            if not self.root_path.exists():
                self.root_path.mkdir(parents=True, exist_ok=True)
            
            # 기본 메서드 등록
            self.methods = {
                'filesystem/read': self.read_file,
                'filesystem/write': self.write_file,
                'filesystem/list': self.list_directory,
                'filesystem/search': self.search_files,
                'filesystem/create_directory': self.create_directory,
                'filesystem/delete': self.delete_file,
                'filesystem/copy': self.copy_file,
                'filesystem/move': self.move_file,
                'filesystem/get_info': self.get_file_info,
            }
            
            mcp_logger.info("Filesystem MCP server initialized successfully")
            
        except Exception as e:
            mcp_logger.error(f"Failed to initialize filesystem MCP server: {e}")
            raise
    
    async def handle_request(self, method: str, params: Dict[str, Any]) -> Any:
        """요청을 처리합니다."""
        try:
            if method not in self.methods:
                raise ValueError(f"Unknown method: {method}")
            
            handler = self.methods[method]
            return await handler(params)
            
        except Exception as e:
            mcp_logger.error(f"Error handling filesystem request {method}: {e}")
            raise
    
    async def read_file(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """파일을 읽습니다."""
        try:
            file_path = params.get('path')
            if not file_path:
                raise ValueError("Path parameter is required")
            
            full_path = self._resolve_path(file_path)
            
            # 보안 검증
            self._validate_path(full_path)
            
            # 파일 존재 확인
            if not full_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            if not full_path.is_file():
                raise ValueError(f"Path is not a file: {file_path}")
            
            # 파일 크기 확인
            file_size = full_path.stat().st_size
            if file_size > self.max_file_size:
                raise ValueError(f"File too large: {file_size} bytes (max: {self.max_file_size})")
            
            # 파일 읽기
            async with aiofiles.open(full_path, 'r', encoding='utf-8') as f:
                content = await f.read()
            
            return {
                'path': str(full_path),
                'content': content,
                'size': file_size,
                'modified': datetime.fromtimestamp(full_path.stat().st_mtime).isoformat(),
                'encoding': 'utf-8'
            }
            
        except Exception as e:
            mcp_logger.error(f"Error reading file {params.get('path')}: {e}")
            raise
    
    async def write_file(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """파일을 씁니다."""
        try:
            file_path = params.get('path')
            content = params.get('content', '')
            overwrite = params.get('overwrite', False)
            
            if not file_path:
                raise ValueError("Path parameter is required")
            
            full_path = self._resolve_path(file_path)
            
            # 보안 검증
            self._validate_path(full_path)
            
            # 파일 존재 확인
            if full_path.exists() and not overwrite:
                raise FileExistsError(f"File already exists: {file_path}")
            
            # 디렉토리 생성
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 파일 쓰기
            async with aiofiles.open(full_path, 'w', encoding='utf-8') as f:
                await f.write(content)
            
            return {
                'path': str(full_path),
                'size': len(content),
                'created': datetime.now().isoformat(),
                'overwritten': full_path.exists()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error writing file {params.get('path')}: {e}")
            raise
    
    async def list_directory(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """디렉토리를 나열합니다."""
        try:
            dir_path = params.get('path', '.')
            include_hidden = params.get('include_hidden', False)
            recursive = params.get('recursive', False)
            
            full_path = self._resolve_path(dir_path)
            
            # 보안 검증
            self._validate_path(full_path)
            
            # 디렉토리 존재 확인
            if not full_path.exists():
                raise FileNotFoundError(f"Directory not found: {dir_path}")
            
            if not full_path.is_dir():
                raise ValueError(f"Path is not a directory: {dir_path}")
            
            items = []
            
            if recursive:
                # 재귀적 나열
                for item in full_path.rglob('*'):
                    if not include_hidden and item.name.startswith('.'):
                        continue
                    
                    items.append(self._get_item_info(item, full_path))
            else:
                # 단일 레벨 나열
                for item in full_path.iterdir():
                    if not include_hidden and item.name.startswith('.'):
                        continue
                    
                    items.append(self._get_item_info(item, full_path))
            
            return {
                'path': str(full_path),
                'items': items,
                'total': len(items),
                'include_hidden': include_hidden,
                'recursive': recursive
            }
            
        except Exception as e:
            mcp_logger.error(f"Error listing directory {params.get('path')}: {e}")
            raise
    
    async def search_files(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """파일을 검색합니다."""
        try:
            pattern = params.get('pattern', '*')
            search_path = params.get('path', '.')
            case_sensitive = params.get('case_sensitive', False)
            file_type = params.get('file_type', 'any')  # 'file', 'directory', 'any'
            
            full_path = self._resolve_path(search_path)
            
            # 보안 검증
            self._validate_path(full_path)
            
            # 디렉토리 존재 확인
            if not full_path.exists():
                raise FileNotFoundError(f"Search path not found: {search_path}")
            
            if not full_path.is_dir():
                raise ValueError(f"Search path is not a directory: {search_path}")
            
            # 검색 패턴 생성
            search_pattern = str(full_path / pattern)
            
            # 파일 검색
            found_items = []
            for item in glob.glob(search_pattern, recursive=True):
                item_path = Path(item)
                
                # 파일 타입 필터링
                if file_type == 'file' and not item_path.is_file():
                    continue
                elif file_type == 'directory' and not item_path.is_dir():
                    continue
                
                # 대소문자 구분 검색
                if not case_sensitive:
                    if pattern.lower() not in item_path.name.lower():
                        continue
                else:
                    if pattern not in item_path.name:
                        continue
                
                found_items.append(self._get_item_info(item_path, full_path))
            
            return {
                'pattern': pattern,
                'search_path': str(full_path),
                'results': found_items,
                'total': len(found_items),
                'case_sensitive': case_sensitive,
                'file_type': file_type
            }
            
        except Exception as e:
            mcp_logger.error(f"Error searching files with pattern {params.get('pattern')}: {e}")
            raise
    
    async def create_directory(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """디렉토리를 생성합니다."""
        try:
            dir_path = params.get('path')
            if not dir_path:
                raise ValueError("Path parameter is required")
            
            full_path = self._resolve_path(dir_path)
            
            # 보안 검증
            self._validate_path(full_path)
            
            # 디렉토리 생성
            full_path.mkdir(parents=True, exist_ok=True)
            
            return {
                'path': str(full_path),
                'created': datetime.now().isoformat(),
                'exists': full_path.exists()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error creating directory {params.get('path')}: {e}")
            raise
    
    async def delete_file(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """파일을 삭제합니다."""
        try:
            file_path = params.get('path')
            if not file_path:
                raise ValueError("Path parameter is required")
            
            full_path = self._resolve_path(file_path)
            
            # 보안 검증
            self._validate_path(full_path)
            
            # 파일 존재 확인
            if not full_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # 삭제
            if full_path.is_file():
                full_path.unlink()
            elif full_path.is_dir():
                shutil.rmtree(full_path)
            
            return {
                'path': str(full_path),
                'deleted': True,
                'deleted_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error deleting file {params.get('path')}: {e}")
            raise
    
    async def copy_file(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """파일을 복사합니다."""
        try:
            source_path = params.get('source')
            dest_path = params.get('destination')
            
            if not source_path or not dest_path:
                raise ValueError("Source and destination parameters are required")
            
            source_full = self._resolve_path(source_path)
            dest_full = self._resolve_path(dest_path)
            
            # 보안 검증
            self._validate_path(source_full)
            self._validate_path(dest_full)
            
            # 소스 파일 존재 확인
            if not source_full.exists():
                raise FileNotFoundError(f"Source file not found: {source_path}")
            
            # 복사
            if source_full.is_file():
                shutil.copy2(source_full, dest_full)
            elif source_full.is_dir():
                shutil.copytree(source_full, dest_full, dirs_exist_ok=True)
            
            return {
                'source': str(source_full),
                'destination': str(dest_full),
                'copied': True,
                'copied_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error copying file from {params.get('source')} to {params.get('destination')}: {e}")
            raise
    
    async def move_file(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """파일을 이동합니다."""
        try:
            source_path = params.get('source')
            dest_path = params.get('destination')
            
            if not source_path or not dest_path:
                raise ValueError("Source and destination parameters are required")
            
            source_full = self._resolve_path(source_path)
            dest_full = self._resolve_path(dest_path)
            
            # 보안 검증
            self._validate_path(source_full)
            self._validate_path(dest_full)
            
            # 소스 파일 존재 확인
            if not source_full.exists():
                raise FileNotFoundError(f"Source file not found: {source_path}")
            
            # 이동
            shutil.move(source_full, dest_full)
            
            return {
                'source': str(source_full),
                'destination': str(dest_full),
                'moved': True,
                'moved_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error moving file from {params.get('source')} to {params.get('destination')}: {e}")
            raise
    
    async def get_file_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """파일 정보를 가져옵니다."""
        try:
            file_path = params.get('path')
            if not file_path:
                raise ValueError("Path parameter is required")
            
            full_path = self._resolve_path(file_path)
            
            # 보안 검증
            self._validate_path(full_path)
            
            # 파일 존재 확인
            if not full_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            return self._get_item_info(full_path, full_path.parent)
            
        except Exception as e:
            mcp_logger.error(f"Error getting file info for {params.get('path')}: {e}")
            raise
    
    # 내부 메서드들
    def _resolve_path(self, path: str) -> Path:
        """경로를 해석합니다."""
        if os.path.isabs(path):
            return Path(path)
        else:
            return self.root_path / path
    
    def _validate_path(self, path: Path):
        """경로 보안을 검증합니다."""
        # 루트 경로 밖으로 나가는지 확인
        try:
            path.resolve().relative_to(self.root_path.resolve())
        except ValueError:
            raise ValueError(f"Access denied: {path}")
    
    def _get_item_info(self, item: Path, base_path: Path) -> Dict[str, Any]:
        """아이템 정보를 가져옵니다."""
        stat = item.stat()
        
        info = {
            'name': item.name,
            'path': str(item.relative_to(base_path)),
            'full_path': str(item),
            'type': 'file' if item.is_file() else 'directory',
            'size': stat.st_size if item.is_file() else None,
            'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            'permissions': oct(stat.st_mode)[-3:],
            'owner': stat.st_uid,
            'group': stat.st_gid,
        }
        
        # 파일 확장자
        if item.is_file():
            info['extension'] = item.suffix
            info['mime_type'] = self._get_mime_type(item.suffix)
        
        return info
    
    def _get_mime_type(self, extension: str) -> str:
        """MIME 타입을 가져옵니다."""
        mime_types = {
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.py': 'text/x-python',
            '.js': 'application/javascript',
            '.ts': 'application/typescript',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.xml': 'application/xml',
            '.html': 'text/html',
            '.css': 'text/css',
        }
        
        return mime_types.get(extension.lower(), 'application/octet-stream')
