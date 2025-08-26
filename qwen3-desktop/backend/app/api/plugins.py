from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import json
import tempfile
import os

from ..services.plugin_service import PluginService, PluginType
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/plugins", tags=["plugins"])

# 플러그인 서비스 인스턴스
plugin_service = PluginService()


# 요청/응답 모델
class PluginConfigRequest(BaseModel):
    config: Dict[str, Any]


class PluginSearchRequest(BaseModel):
    query: str
    plugin_type: Optional[str] = None
    tags: List[str] = []


class PluginInstallRequest(BaseModel):
    plugin_name: str
    version: Optional[str] = None


# 플러그인 관리 엔드포인트
@router.post("/install", response_model=Dict[str, Any])
async def install_plugin(file: UploadFile = File(...)):
    """플러그인 설치"""
    try:
        # 임시 파일로 저장
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            result = await plugin_service.install_plugin(temp_file_path)
            return result
        finally:
            # 임시 파일 삭제
            os.unlink(temp_file_path)
    
    except Exception as e:
        logger.error(f"플러그인 설치 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 설치 중 오류가 발생했습니다")


@router.delete("/{plugin_name}", response_model=Dict[str, Any])
async def uninstall_plugin(plugin_name: str):
    """플러그인 제거"""
    try:
        result = await plugin_service.uninstall_plugin(plugin_name)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"플러그인 제거 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 제거 중 오류가 발생했습니다")


@router.post("/{plugin_name}/enable", response_model=Dict[str, Any])
async def enable_plugin(plugin_name: str):
    """플러그인 활성화"""
    try:
        result = await plugin_service.enable_plugin(plugin_name)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"플러그인 활성화 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 활성화 중 오류가 발생했습니다")


@router.post("/{plugin_name}/disable", response_model=Dict[str, Any])
async def disable_plugin(plugin_name: str):
    """플러그인 비활성화"""
    try:
        result = await plugin_service.disable_plugin(plugin_name)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"플러그인 비활성화 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 비활성화 중 오류가 발생했습니다")


@router.post("/{plugin_name}/update", response_model=Dict[str, Any])
async def update_plugin(plugin_name: str, file: UploadFile = File(None)):
    """플러그인 업데이트"""
    try:
        temp_file_path = None
        if file:
            # 임시 파일로 저장
            with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_file_path = temp_file.name
        
        try:
            result = await plugin_service.update_plugin(plugin_name, temp_file_path)
            if not result["success"]:
                raise HTTPException(status_code=400, detail=result["error"])
            
            return result
        finally:
            # 임시 파일 삭제
            if temp_file_path:
                os.unlink(temp_file_path)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"플러그인 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 업데이트 중 오류가 발생했습니다")


# 플러그인 정보 조회 엔드포인트
@router.get("/", response_model=Dict[str, Any])
async def get_all_plugins():
    """모든 플러그인 목록 조회"""
    try:
        plugins = plugin_service.get_all_plugins()
        
        return {
            "success": True,
            "plugins": [plugin.to_dict() for plugin in plugins],
            "count": len(plugins)
        }
    
    except Exception as e:
        logger.error(f"플러그인 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 목록 조회 중 오류가 발생했습니다")


@router.get("/{plugin_name}", response_model=Dict[str, Any])
async def get_plugin_info(plugin_name: str):
    """특정 플러그인 정보 조회"""
    try:
        plugin_info = plugin_service.get_plugin_info(plugin_name)
        if not plugin_info:
            raise HTTPException(status_code=404, detail="플러그인을 찾을 수 없습니다")
        
        return {
            "success": True,
            "plugin": plugin_info.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"플러그인 정보 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 정보 조회 중 오류가 발생했습니다")


@router.get("/enabled", response_model=Dict[str, Any])
async def get_enabled_plugins():
    """활성화된 플러그인 목록 조회"""
    try:
        plugins = plugin_service.get_enabled_plugins()
        
        return {
            "success": True,
            "plugins": [plugin.to_dict() for plugin in plugins],
            "count": len(plugins)
        }
    
    except Exception as e:
        logger.error(f"활성화된 플러그인 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="활성화된 플러그인 목록 조회 중 오류가 발생했습니다")


@router.get("/type/{plugin_type}", response_model=Dict[str, Any])
async def get_plugins_by_type(plugin_type: str):
    """타입별 플러그인 목록 조회"""
    try:
        try:
            plugin_type_enum = PluginType(plugin_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 플러그인 타입: {plugin_type}")
        
        plugins = plugin_service.get_plugins_by_type(plugin_type_enum)
        
        return {
            "success": True,
            "plugins": [plugin.to_dict() for plugin in plugins],
            "count": len(plugins)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"타입별 플러그인 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="타입별 플러그인 목록 조회 중 오류가 발생했습니다")


# 플러그인 설정 관리 엔드포인트
@router.get("/{plugin_name}/config", response_model=Dict[str, Any])
async def get_plugin_config(plugin_name: str):
    """플러그인 설정 조회"""
    try:
        config = await plugin_service.get_plugin_config(plugin_name)
        
        return {
            "success": True,
            "config": config
        }
    
    except Exception as e:
        logger.error(f"플러그인 설정 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 설정 조회 중 오류가 발생했습니다")


@router.put("/{plugin_name}/config", response_model=Dict[str, Any])
async def update_plugin_config(plugin_name: str, request: PluginConfigRequest):
    """플러그인 설정 업데이트"""
    try:
        result = await plugin_service.update_plugin_config(plugin_name, request.config)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"플러그인 설정 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 설정 업데이트 중 오류가 발생했습니다")


# 마켓플레이스 엔드포인트
@router.get("/marketplace", response_model=Dict[str, Any])
async def get_marketplace_plugins():
    """마켓플레이스 플러그인 목록 조회"""
    try:
        plugins = await plugin_service.get_marketplace_plugins()
        
        return {
            "success": True,
            "plugins": plugins,
            "count": len(plugins)
        }
    
    except Exception as e:
        logger.error(f"마켓플레이스 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="마켓플레이스 조회 중 오류가 발생했습니다")


@router.post("/marketplace/search", response_model=Dict[str, Any])
async def search_marketplace_plugins(request: PluginSearchRequest):
    """마켓플레이스 플러그인 검색"""
    try:
        plugins = await plugin_service.get_marketplace_plugins()
        
        # 검색 필터링
        filtered_plugins = []
        for plugin in plugins:
            # 쿼리 검색
            if request.query.lower() in plugin.get("name", "").lower() or \
               request.query.lower() in plugin.get("description", "").lower():
                
                # 타입 필터링
                if request.plugin_type and plugin.get("plugin_type") != request.plugin_type:
                    continue
                
                # 태그 필터링
                if request.tags and not any(tag in plugin.get("tags", []) for tag in request.tags):
                    continue
                
                filtered_plugins.append(plugin)
        
        return {
            "success": True,
            "plugins": filtered_plugins,
            "count": len(filtered_plugins)
        }
    
    except Exception as e:
        logger.error(f"마켓플레이스 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="마켓플레이스 검색 중 오류가 발생했습니다")


# 통계 정보 엔드포인트
@router.get("/statistics", response_model=Dict[str, Any])
async def get_plugin_statistics():
    """플러그인 통계 정보"""
    try:
        stats = plugin_service.get_plugin_statistics()
        
        return {
            "success": True,
            "statistics": stats
        }
    
    except Exception as e:
        logger.error(f"플러그인 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 통계 조회 중 오류가 발생했습니다")


# 플러그인 타입 정보 엔드포인트
@router.get("/types", response_model=Dict[str, Any])
async def get_plugin_types():
    """지원하는 플러그인 타입 목록"""
    try:
        types = [
            {
                "value": plugin_type.value,
                "name": plugin_type.name,
                "description": {
                    "mcp_server": "MCP 서버 플러그인",
                    "ui_component": "UI 컴포넌트 플러그인",
                    "utility": "유틸리티 플러그인",
                    "theme": "테마 플러그인",
                    "language": "언어 패키지 플러그인"
                }.get(plugin_type.value, "플러그인 타입")
            }
            for plugin_type in PluginType
        ]
        
        return {
            "success": True,
            "types": types
        }
    
    except Exception as e:
        logger.error(f"플러그인 타입 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 타입 조회 중 오류가 발생했습니다")


# 플러그인 상태 정보 엔드포인트
@router.get("/status", response_model=Dict[str, Any])
async def get_plugin_status():
    """플러그인 상태 정보"""
    try:
        plugins = plugin_service.get_all_plugins()
        
        status_counts = {}
        for plugin in plugins:
            status = plugin.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            "success": True,
            "status_counts": status_counts,
            "total_plugins": len(plugins)
        }
    
    except Exception as e:
        logger.error(f"플러그인 상태 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="플러그인 상태 조회 중 오류가 발생했습니다")
