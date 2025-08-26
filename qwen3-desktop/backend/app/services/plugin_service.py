import json
import os
import shutil
import zipfile
import hashlib
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
import importlib.util
import sys
import subprocess
import asyncio
import aiofiles

from ..utils.logger import get_logger

logger = get_logger(__name__)


class PluginStatus(Enum):
    """플러그인 상태"""
    INSTALLED = "installed"
    ENABLED = "enabled"
    DISABLED = "disabled"
    ERROR = "error"
    UPDATING = "updating"
    INSTALLING = "installing"


class PluginType(Enum):
    """플러그인 타입"""
    MCP_SERVER = "mcp_server"
    UI_COMPONENT = "ui_component"
    UTILITY = "utility"
    THEME = "theme"
    LANGUAGE = "language"


@dataclass
class PluginMetadata:
    """플러그인 메타데이터"""
    name: str
    version: str
    description: str
    author: str
    plugin_type: PluginType
    dependencies: List[str]
    permissions: List[str]
    entry_point: str
    config_schema: Dict[str, Any]
    icon: Optional[str] = None
    homepage: Optional[str] = None
    repository: Optional[str] = None
    license: Optional[str] = None
    tags: List[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "author": self.author,
            "plugin_type": self.plugin_type.value,
            "dependencies": self.dependencies,
            "permissions": self.permissions,
            "entry_point": self.entry_point,
            "config_schema": self.config_schema,
            "icon": self.icon,
            "homepage": self.homepage,
            "repository": self.repository,
            "license": self.license,
            "tags": self.tags
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PluginMetadata':
        """딕셔너리에서 생성"""
        data["plugin_type"] = PluginType(data["plugin_type"])
        return cls(**data)


@dataclass
class PluginInfo:
    """플러그인 정보"""
    metadata: PluginMetadata
    status: PluginStatus
    installed_at: datetime
    enabled_at: Optional[datetime] = None
    last_updated: Optional[datetime] = None
    config: Dict[str, Any] = None
    error_message: Optional[str] = None
    
    def __post_init__(self):
        if self.config is None:
            self.config = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "metadata": self.metadata.to_dict(),
            "status": self.status.value,
            "installed_at": self.installed_at.isoformat(),
            "enabled_at": self.enabled_at.isoformat() if self.enabled_at else None,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "config": self.config,
            "error_message": self.error_message
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PluginInfo':
        """딕셔너리에서 생성"""
        data["metadata"] = PluginMetadata.from_dict(data["metadata"])
        data["status"] = PluginStatus(data["status"])
        data["installed_at"] = datetime.fromisoformat(data["installed_at"])
        if data["enabled_at"]:
            data["enabled_at"] = datetime.fromisoformat(data["enabled_at"])
        if data["last_updated"]:
            data["last_updated"] = datetime.fromisoformat(data["last_updated"])
        return cls(**data)


class PluginService:
    """플러그인 관리 서비스"""
    
    def __init__(self, plugins_dir: str = "data/plugins", marketplace_url: str = None):
        self.plugins_dir = Path(plugins_dir)
        self.plugins_dir.mkdir(parents=True, exist_ok=True)
        self.marketplace_url = marketplace_url
        self.plugins: Dict[str, PluginInfo] = {}
        self.loaded_plugins: Dict[str, Any] = {}
        self.plugin_config_file = self.plugins_dir / "plugins.json"
        
        # 플러그인 디렉토리 구조
        self.installed_dir = self.plugins_dir / "installed"
        self.temp_dir = self.plugins_dir / "temp"
        self.cache_dir = self.plugins_dir / "cache"
        
        for dir_path in [self.installed_dir, self.temp_dir, self.cache_dir]:
            dir_path.mkdir(exist_ok=True)
        
        self._load_plugins()
        logger.info("플러그인 서비스 초기화 완료")
    
    def _load_plugins(self):
        """설치된 플러그인 로드"""
        if self.plugin_config_file.exists():
            try:
                with open(self.plugin_config_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for plugin_data in data.get("plugins", []):
                        plugin_info = PluginInfo.from_dict(plugin_data)
                        self.plugins[plugin_info.metadata.name] = plugin_info
            except Exception as e:
                logger.error(f"플러그인 설정 로드 실패: {e}")
    
    def _save_plugins(self):
        """플러그인 설정 저장"""
        try:
            data = {
                "plugins": [plugin.to_dict() for plugin in self.plugins.values()],
                "last_updated": datetime.now().isoformat()
            }
            with open(self.plugin_config_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"플러그인 설정 저장 실패: {e}")
    
    async def install_plugin(self, plugin_file: str, plugin_name: str = None) -> Dict[str, Any]:
        """플러그인 설치"""
        try:
            # 임시 디렉토리에 압축 해제
            temp_plugin_dir = self.temp_dir / f"plugin_{datetime.now().timestamp()}"
            temp_plugin_dir.mkdir(exist_ok=True)
            
            with zipfile.ZipFile(plugin_file, 'r') as zip_ref:
                zip_ref.extractall(temp_plugin_dir)
            
            # 플러그인 메타데이터 읽기
            metadata_file = temp_plugin_dir / "plugin.json"
            if not metadata_file.exists():
                raise ValueError("plugin.json 파일을 찾을 수 없습니다")
            
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata_data = json.load(f)
            
            metadata = PluginMetadata.from_dict(metadata_data)
            
            # 의존성 확인
            await self._check_dependencies(metadata.dependencies)
            
            # 플러그인 설치
            plugin_dir = self.installed_dir / metadata.name
            if plugin_dir.exists():
                shutil.rmtree(plugin_dir)
            
            shutil.copytree(temp_plugin_dir, plugin_dir)
            
            # 플러그인 정보 생성
            plugin_info = PluginInfo(
                metadata=metadata,
                status=PluginStatus.INSTALLED,
                installed_at=datetime.now()
            )
            
            self.plugins[metadata.name] = plugin_info
            self._save_plugins()
            
            # 임시 디렉토리 정리
            shutil.rmtree(temp_plugin_dir)
            
            logger.info(f"플러그인 설치 완료: {metadata.name} v{metadata.version}")
            
            return {
                "success": True,
                "plugin": plugin_info.to_dict(),
                "message": f"플러그인 {metadata.name}이 성공적으로 설치되었습니다"
            }
            
        except Exception as e:
            logger.error(f"플러그인 설치 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "플러그인 설치 중 오류가 발생했습니다"
            }
    
    async def uninstall_plugin(self, plugin_name: str) -> Dict[str, Any]:
        """플러그인 제거"""
        try:
            if plugin_name not in self.plugins:
                raise ValueError(f"플러그인을 찾을 수 없습니다: {plugin_name}")
            
            plugin_info = self.plugins[plugin_name]
            
            # 플러그인 비활성화
            if plugin_info.status == PluginStatus.ENABLED:
                await self.disable_plugin(plugin_name)
            
            # 플러그인 디렉토리 삭제
            plugin_dir = self.installed_dir / plugin_name
            if plugin_dir.exists():
                shutil.rmtree(plugin_dir)
            
            # 플러그인 정보 제거
            del self.plugins[plugin_name]
            self._save_plugins()
            
            logger.info(f"플러그인 제거 완료: {plugin_name}")
            
            return {
                "success": True,
                "message": f"플러그인 {plugin_name}이 성공적으로 제거되었습니다"
            }
            
        except Exception as e:
            logger.error(f"플러그인 제거 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "플러그인 제거 중 오류가 발생했습니다"
            }
    
    async def enable_plugin(self, plugin_name: str) -> Dict[str, Any]:
        """플러그인 활성화"""
        try:
            if plugin_name not in self.plugins:
                raise ValueError(f"플러그인을 찾을 수 없습니다: {plugin_name}")
            
            plugin_info = self.plugins[plugin_name]
            
            if plugin_info.status == PluginStatus.ENABLED:
                return {
                    "success": True,
                    "message": f"플러그인 {plugin_name}은 이미 활성화되어 있습니다"
                }
            
            # 플러그인 로드
            await self._load_plugin_module(plugin_name, plugin_info)
            
            # 상태 업데이트
            plugin_info.status = PluginStatus.ENABLED
            plugin_info.enabled_at = datetime.now()
            plugin_info.error_message = None
            self._save_plugins()
            
            logger.info(f"플러그인 활성화 완료: {plugin_name}")
            
            return {
                "success": True,
                "message": f"플러그인 {plugin_name}이 성공적으로 활성화되었습니다"
            }
            
        except Exception as e:
            logger.error(f"플러그인 활성화 실패: {e}")
            plugin_info.status = PluginStatus.ERROR
            plugin_info.error_message = str(e)
            self._save_plugins()
            
            return {
                "success": False,
                "error": str(e),
                "message": "플러그인 활성화 중 오류가 발생했습니다"
            }
    
    async def disable_plugin(self, plugin_name: str) -> Dict[str, Any]:
        """플러그인 비활성화"""
        try:
            if plugin_name not in self.plugins:
                raise ValueError(f"플러그인을 찾을 수 없습니다: {plugin_name}")
            
            plugin_info = self.plugins[plugin_name]
            
            if plugin_info.status != PluginStatus.ENABLED:
                return {
                    "success": True,
                    "message": f"플러그인 {plugin_name}은 이미 비활성화되어 있습니다"
                }
            
            # 플러그인 언로드
            await self._unload_plugin_module(plugin_name)
            
            # 상태 업데이트
            plugin_info.status = PluginStatus.DISABLED
            plugin_info.enabled_at = None
            self._save_plugins()
            
            logger.info(f"플러그인 비활성화 완료: {plugin_name}")
            
            return {
                "success": True,
                "message": f"플러그인 {plugin_name}이 성공적으로 비활성화되었습니다"
            }
            
        except Exception as e:
            logger.error(f"플러그인 비활성화 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "플러그인 비활성화 중 오류가 발생했습니다"
            }
    
    async def update_plugin(self, plugin_name: str, plugin_file: str = None) -> Dict[str, Any]:
        """플러그인 업데이트"""
        try:
            if plugin_name not in self.plugins:
                raise ValueError(f"플러그인을 찾을 수 없습니다: {plugin_name}")
            
            plugin_info = self.plugins[plugin_name]
            plugin_info.status = PluginStatus.UPDATING
            
            # 플러그인 비활성화
            if plugin_info.status == PluginStatus.ENABLED:
                await self.disable_plugin(plugin_name)
            
            # 새 버전 설치
            if plugin_file:
                result = await self.install_plugin(plugin_file, plugin_name)
                if not result["success"]:
                    return result
            
            # 플러그인 재활성화
            if plugin_info.status == PluginStatus.ENABLED:
                await self.enable_plugin(plugin_name)
            
            plugin_info.last_updated = datetime.now()
            self._save_plugins()
            
            logger.info(f"플러그인 업데이트 완료: {plugin_name}")
            
            return {
                "success": True,
                "message": f"플러그인 {plugin_name}이 성공적으로 업데이트되었습니다"
            }
            
        except Exception as e:
            logger.error(f"플러그인 업데이트 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "플러그인 업데이트 중 오류가 발생했습니다"
            }
    
    def get_plugin_info(self, plugin_name: str) -> Optional[PluginInfo]:
        """플러그인 정보 조회"""
        return self.plugins.get(plugin_name)
    
    def get_all_plugins(self) -> List[PluginInfo]:
        """모든 플러그인 목록 조회"""
        return list(self.plugins.values())
    
    def get_enabled_plugins(self) -> List[PluginInfo]:
        """활성화된 플러그인 목록 조회"""
        return [plugin for plugin in self.plugins.values() if plugin.status == PluginStatus.ENABLED]
    
    def get_plugins_by_type(self, plugin_type: PluginType) -> List[PluginInfo]:
        """타입별 플러그인 목록 조회"""
        return [plugin for plugin in self.plugins.values() if plugin.metadata.plugin_type == plugin_type]
    
    async def update_plugin_config(self, plugin_name: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """플러그인 설정 업데이트"""
        try:
            if plugin_name not in self.plugins:
                raise ValueError(f"플러그인을 찾을 수 없습니다: {plugin_name}")
            
            plugin_info = self.plugins[plugin_name]
            
            # 설정 스키마 검증
            self._validate_config(config, plugin_info.metadata.config_schema)
            
            # 설정 업데이트
            plugin_info.config.update(config)
            self._save_plugins()
            
            # 활성화된 플러그인의 경우 설정 적용
            if plugin_info.status == PluginStatus.ENABLED and plugin_name in self.loaded_plugins:
                await self._apply_plugin_config(plugin_name, config)
            
            logger.info(f"플러그인 설정 업데이트 완료: {plugin_name}")
            
            return {
                "success": True,
                "message": f"플러그인 {plugin_name}의 설정이 업데이트되었습니다"
            }
            
        except Exception as e:
            logger.error(f"플러그인 설정 업데이트 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "플러그인 설정 업데이트 중 오류가 발생했습니다"
            }
    
    async def get_plugin_config(self, plugin_name: str) -> Dict[str, Any]:
        """플러그인 설정 조회"""
        if plugin_name not in self.plugins:
            return {}
        
        plugin_info = self.plugins[plugin_name]
        return plugin_info.config.copy()
    
    async def _check_dependencies(self, dependencies: List[str]) -> bool:
        """의존성 확인"""
        for dependency in dependencies:
            try:
                importlib.import_module(dependency)
            except ImportError:
                # pip를 통한 설치 시도
                try:
                    subprocess.check_call([sys.executable, "-m", "pip", "install", dependency])
                except subprocess.CalledProcessError:
                    raise ValueError(f"의존성 설치 실패: {dependency}")
        return True
    
    async def _load_plugin_module(self, plugin_name: str, plugin_info: PluginInfo):
        """플러그인 모듈 로드"""
        plugin_dir = self.installed_dir / plugin_name
        entry_file = plugin_dir / plugin_info.metadata.entry_point
        
        if not entry_file.exists():
            raise ValueError(f"엔트리 포인트 파일을 찾을 수 없습니다: {entry_file}")
        
        # 모듈 로드
        spec = importlib.util.spec_from_file_location(plugin_name, entry_file)
        module = importlib.util.module_from_spec(spec)
        sys.modules[plugin_name] = module
        spec.loader.exec_module(module)
        
        # 플러그인 초기화
        if hasattr(module, 'initialize'):
            await module.initialize(plugin_info.config)
        
        self.loaded_plugins[plugin_name] = module
        
        logger.info(f"플러그인 모듈 로드 완료: {plugin_name}")
    
    async def _unload_plugin_module(self, plugin_name: str):
        """플러그인 모듈 언로드"""
        if plugin_name in self.loaded_plugins:
            module = self.loaded_plugins[plugin_name]
            
            # 플러그인 정리
            if hasattr(module, 'cleanup'):
                await module.cleanup()
            
            # 모듈 제거
            del self.loaded_plugins[plugin_name]
            if plugin_name in sys.modules:
                del sys.modules[plugin_name]
            
            logger.info(f"플러그인 모듈 언로드 완료: {plugin_name}")
    
    async def _apply_plugin_config(self, plugin_name: str, config: Dict[str, Any]):
        """플러그인 설정 적용"""
        if plugin_name in self.loaded_plugins:
            module = self.loaded_plugins[plugin_name]
            if hasattr(module, 'update_config'):
                await module.update_config(config)
    
    def _validate_config(self, config: Dict[str, Any], schema: Dict[str, Any]):
        """설정 스키마 검증"""
        # 간단한 스키마 검증 (실제로는 JSON Schema 등을 사용)
        for key, value in config.items():
            if key not in schema:
                raise ValueError(f"알 수 없는 설정 키: {key}")
            
            expected_type = schema[key].get("type")
            if expected_type and not isinstance(value, self._get_python_type(expected_type)):
                raise ValueError(f"설정 타입 오류: {key}은 {expected_type}이어야 합니다")
    
    def _get_python_type(self, type_name: str):
        """타입 이름을 Python 타입으로 변환"""
        type_map = {
            "string": str,
            "number": (int, float),
            "integer": int,
            "boolean": bool,
            "array": list,
            "object": dict
        }
        return type_map.get(type_name, str)
    
    async def get_marketplace_plugins(self) -> List[Dict[str, Any]]:
        """마켓플레이스 플러그인 목록 조회"""
        if not self.marketplace_url:
            return []
        
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(self.marketplace_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("plugins", [])
        except Exception as e:
            logger.error(f"마켓플레이스 조회 실패: {e}")
        
        return []
    
    def get_plugin_statistics(self) -> Dict[str, Any]:
        """플러그인 통계 정보"""
        total_plugins = len(self.plugins)
        enabled_plugins = len([p for p in self.plugins.values() if p.status == PluginStatus.ENABLED])
        
        type_counts = {}
        for plugin in self.plugins.values():
            plugin_type = plugin.metadata.plugin_type.value
            type_counts[plugin_type] = type_counts.get(plugin_type, 0) + 1
        
        return {
            "total_plugins": total_plugins,
            "enabled_plugins": enabled_plugins,
            "disabled_plugins": total_plugins - enabled_plugins,
            "type_distribution": type_counts,
            "last_updated": datetime.now().isoformat()
        }
