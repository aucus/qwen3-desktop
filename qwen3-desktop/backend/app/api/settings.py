from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from datetime import datetime

from ..services.settings_service import SettingsService, SettingCategory
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

# 설정 서비스 인스턴스
settings_service = SettingsService()


# 요청/응답 모델
class UpdateSettingRequest(BaseModel):
    value: Any


class SettingResponse(BaseModel):
    key: str
    name: str
    description: str
    category: str
    type: str
    value: Any
    default_value: Any
    validation_rules: Dict[str, Any]
    options: List[Any]
    required: bool
    sensitive: bool


# 모든 설정 조회 엔드포인트
@router.get("/", response_model=Dict[str, Any])
async def get_all_settings():
    """모든 설정 조회"""
    try:
        settings = settings_service.get_all_settings()
        
        return {
            "success": True,
            "settings": settings
        }
    
    except Exception as e:
        logger.error(f"설정 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 조회 중 오류가 발생했습니다")


# 카테고리별 설정 조회 엔드포인트
@router.get("/category/{category}", response_model=Dict[str, Any])
async def get_settings_by_category(category: str):
    """카테고리별 설정 조회"""
    try:
        # 카테고리 검증
        try:
            setting_category = SettingCategory(category)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 카테고리: {category}")
        
        settings = settings_service.get_settings_by_category(setting_category)
        
        return {
            "success": True,
            "category": category,
            "settings": settings
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"카테고리별 설정 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="카테고리별 설정 조회 중 오류가 발생했습니다")


# 특정 설정 조회 엔드포인트
@router.get("/{key}", response_model=Dict[str, Any])
async def get_setting(key: str):
    """특정 설정 조회"""
    try:
        setting_def = settings_service.get_setting_definition(key)
        if not setting_def:
            raise HTTPException(status_code=404, detail="설정을 찾을 수 없습니다")
        
        value = settings_service.get_setting(key)
        
        return {
            "success": True,
            "setting": {
                "definition": setting_def.to_dict(),
                "value": value
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"설정 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 조회 중 오류가 발생했습니다")


# 설정 업데이트 엔드포인트
@router.put("/{key}", response_model=Dict[str, Any])
async def update_setting(key: str, request: UpdateSettingRequest):
    """설정 업데이트"""
    try:
        result = settings_service.set_setting(key, request.value, "user")
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"설정 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 업데이트 중 오류가 발생했습니다")


# 설정 초기화 엔드포인트
@router.post("/{key}/reset", response_model=Dict[str, Any])
async def reset_setting(key: str):
    """설정을 기본값으로 초기화"""
    try:
        result = settings_service.reset_setting(key)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"설정 초기화 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 초기화 중 오류가 발생했습니다")


# 카테고리별 설정 초기화 엔드포인트
@router.post("/category/{category}/reset", response_model=Dict[str, Any])
async def reset_category(category: str):
    """카테고리별 설정 초기화"""
    try:
        # 카테고리 검증
        try:
            setting_category = SettingCategory(category)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"지원하지 않는 카테고리: {category}")
        
        result = settings_service.reset_category(setting_category)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"카테고리 초기화 실패: {e}")
        raise HTTPException(status_code=500, detail="카테고리 초기화 중 오류가 발생했습니다")


# 설정 변경 이력 조회 엔드포인트
@router.get("/{key}/history", response_model=Dict[str, Any])
async def get_setting_history(key: str, limit: int = 50):
    """설정 변경 이력 조회"""
    try:
        # 설정 존재 확인
        setting_def = settings_service.get_setting_definition(key)
        if not setting_def:
            raise HTTPException(status_code=404, detail="설정을 찾을 수 없습니다")
        
        history = settings_service.get_setting_history(key, limit)
        
        return {
            "success": True,
            "key": key,
            "history": history
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"설정 이력 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 이력 조회 중 오류가 발생했습니다")


# 설정 백업 생성 엔드포인트
@router.post("/backup", response_model=Dict[str, Any])
async def create_backup():
    """설정 백업 생성"""
    try:
        result = settings_service.create_backup()
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"백업 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="백업 생성 중 오류가 발생했습니다")


# 백업 파일 목록 조회 엔드포인트
@router.get("/backup", response_model=Dict[str, Any])
async def get_backup_list():
    """백업 파일 목록 조회"""
    try:
        backups = settings_service.get_backup_list()
        
        return {
            "success": True,
            "backups": backups
        }
    
    except Exception as e:
        logger.error(f"백업 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="백업 목록 조회 중 오류가 발생했습니다")


# 설정 백업 복원 엔드포인트
@router.post("/backup/restore", response_model=Dict[str, Any])
async def restore_backup(backup_file: str):
    """설정 백업 복원"""
    try:
        result = settings_service.restore_backup(backup_file)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"백업 복원 실패: {e}")
        raise HTTPException(status_code=500, detail="백업 복원 중 오류가 발생했습니다")


# 백업 파일 업로드 및 복원 엔드포인트
@router.post("/backup/upload", response_model=Dict[str, Any])
async def upload_and_restore_backup(file: UploadFile = File(...)):
    """백업 파일 업로드 및 복원"""
    try:
        # 임시 파일로 저장
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # 백업 복원
            result = settings_service.restore_backup(temp_file_path)
            
            if not result["success"]:
                raise HTTPException(status_code=400, detail=result["error"])
            
            return result
            
        finally:
            # 임시 파일 삭제
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"백업 업로드 및 복원 실패: {e}")
        raise HTTPException(status_code=500, detail="백업 업로드 및 복원 중 오류가 발생했습니다")


# 오래된 백업 정리 엔드포인트
@router.post("/backup/cleanup", response_model=Dict[str, Any])
async def cleanup_backups(keep_count: int = 10):
    """오래된 백업 파일 정리"""
    try:
        result = settings_service.cleanup_old_backups(keep_count)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"백업 정리 실패: {e}")
        raise HTTPException(status_code=500, detail="백업 정리 중 오류가 발생했습니다")


# 설정 내보내기 엔드포인트
@router.get("/export", response_model=Dict[str, Any])
async def export_settings():
    """설정 내보내기"""
    try:
        result = settings_service.export_settings()
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"설정 내보내기 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 내보내기 중 오류가 발생했습니다")


# 설정 가져오기 엔드포인트
@router.post("/import", response_model=Dict[str, Any])
async def import_settings(import_data: Dict[str, Any]):
    """설정 가져오기"""
    try:
        result = settings_service.import_settings(import_data)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"설정 가져오기 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 가져오기 중 오류가 발생했습니다")


# 설정 파일 업로드 및 가져오기 엔드포인트
@router.post("/import/file", response_model=Dict[str, Any])
async def import_settings_from_file(file: UploadFile = File(...)):
    """설정 파일 업로드 및 가져오기"""
    try:
        import json
        
        # 파일 내용 읽기
        content = await file.read()
        import_data = json.loads(content.decode('utf-8'))
        
        # 설정 가져오기
        result = settings_service.import_settings(import_data)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="유효하지 않은 JSON 파일입니다")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"설정 파일 가져오기 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 파일 가져오기 중 오류가 발생했습니다")


# 설정 정의 목록 조회 엔드포인트
@router.get("/definitions", response_model=Dict[str, Any])
async def get_setting_definitions():
    """설정 정의 목록 조회"""
    try:
        definitions = settings_service.get_all_setting_definitions()
        
        return {
            "success": True,
            "definitions": [definition.to_dict() for definition in definitions]
        }
    
    except Exception as e:
        logger.error(f"설정 정의 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 정의 조회 중 오류가 발생했습니다")


# 카테고리 목록 조회 엔드포인트
@router.get("/categories", response_model=Dict[str, Any])
async def get_categories():
    """설정 카테고리 목록 조회"""
    try:
        categories = [
            {
                "value": category.value,
                "name": {
                    "general": "일반",
                    "model": "모델",
                    "performance": "성능",
                    "security": "보안",
                    "ui": "사용자 인터페이스",
                    "plugins": "플러그인",
                    "backup": "백업"
                }.get(category.value, category.value),
                "description": {
                    "general": "일반적인 애플리케이션 설정",
                    "model": "AI 모델 관련 설정",
                    "performance": "성능 최적화 설정",
                    "security": "보안 관련 설정",
                    "ui": "사용자 인터페이스 설정",
                    "plugins": "플러그인 관련 설정",
                    "backup": "백업 및 복원 설정"
                }.get(category.value, "")
            }
            for category in SettingCategory
        ]
        
        return {
            "success": True,
            "categories": categories
        }
    
    except Exception as e:
        logger.error(f"카테고리 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="카테고리 목록 조회 중 오류가 발생했습니다")


# 설정 통계 조회 엔드포인트
@router.get("/statistics", response_model=Dict[str, Any])
async def get_settings_statistics():
    """설정 통계 정보"""
    try:
        all_settings = settings_service.get_all_settings()
        definitions = settings_service.get_all_setting_definitions()
        
        # 카테고리별 설정 수
        category_counts = {}
        for definition in definitions:
            category = definition.category.value
            category_counts[category] = category_counts.get(category, 0) + 1
        
        # 타입별 설정 수
        type_counts = {}
        for definition in definitions:
            setting_type = definition.type.value
            type_counts[setting_type] = type_counts.get(setting_type, 0) + 1
        
        # 민감한 설정 수
        sensitive_count = sum(1 for definition in definitions if definition.sensitive)
        
        # 필수 설정 수
        required_count = sum(1 for definition in definitions if definition.required)
        
        return {
            "success": True,
            "statistics": {
                "total_settings": len(all_settings),
                "total_definitions": len(definitions),
                "category_distribution": category_counts,
                "type_distribution": type_counts,
                "sensitive_settings": sensitive_count,
                "required_settings": required_count,
                "last_updated": datetime.now().isoformat()
            }
        }
    
    except Exception as e:
        logger.error(f"설정 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 통계 조회 중 오류가 발생했습니다")


# 설정 검색 엔드포인트
@router.get("/search", response_model=Dict[str, Any])
async def search_settings(q: str = "", category: str = ""):
    """설정 검색"""
    try:
        all_settings = settings_service.get_all_settings()
        filtered_settings = {}
        
        for key, setting_data in all_settings.items():
            definition = setting_data["definition"]
            
            # 검색어 필터링
            if q and q.lower() not in definition["name"].lower() and q.lower() not in definition["description"].lower():
                continue
            
            # 카테고리 필터링
            if category and definition["category"] != category:
                continue
            
            filtered_settings[key] = setting_data
        
        return {
            "success": True,
            "settings": filtered_settings,
            "count": len(filtered_settings),
            "query": q,
            "category": category
        }
    
    except Exception as e:
        logger.error(f"설정 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="설정 검색 중 오류가 발생했습니다")
