from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from pydantic import BaseModel
import json

from ..models.prompt import (
    PromptTemplate, PromptVariable, PromptCategory, 
    PromptVersion, PromptSearchResult
)
from ..services.prompt_service import PromptService
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/prompts", tags=["prompts"])

# 프롬프트 서비스 인스턴스
prompt_service = PromptService()


# 요청/응답 모델
class CreateTemplateRequest(BaseModel):
    name: str
    description: str = ""
    category: str = "general"
    content: str
    variables: List[Dict[str, Any]] = []
    tags: List[str] = []
    is_favorite: bool = False
    is_system_prompt: bool = False


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None
    is_favorite: Optional[bool] = None
    is_system_prompt: Optional[bool] = None


class CreateCategoryRequest(BaseModel):
    name: str
    description: str = ""
    icon: str = "📝"
    color: str = "#3B82F6"


class RenderTemplateRequest(BaseModel):
    template_id: str
    values: Dict[str, Any] = {}


class SearchRequest(BaseModel):
    query: str
    limit: int = 10


# 템플릿 CRUD 엔드포인트
@router.post("/templates", response_model=Dict[str, Any])
async def create_template(request: CreateTemplateRequest):
    """템플릿 생성"""
    try:
        # 변수 객체 생성
        variables = []
        for var_data in request.variables:
            variables.append(PromptVariable(**var_data))
        
        # 템플릿 생성
        template = PromptTemplate(
            name=request.name,
            description=request.description,
            category=request.category,
            content=request.content,
            variables=variables,
            tags=request.tags,
            is_favorite=request.is_favorite,
            is_system_prompt=request.is_system_prompt
        )
        
        created_template = prompt_service.create_template(template)
        
        return {
            "success": True,
            "template": created_template.to_dict(),
            "message": "템플릿이 성공적으로 생성되었습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"템플릿 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 생성 중 오류가 발생했습니다")


@router.get("/templates", response_model=Dict[str, Any])
async def get_templates(
    category: Optional[str] = Query(None, description="카테고리 필터"),
    favorite_only: bool = Query(False, description="즐겨찾기만 조회"),
    system_only: bool = Query(False, description="시스템 프롬프트만 조회")
):
    """템플릿 목록 조회"""
    try:
        if favorite_only:
            templates = prompt_service.get_favorite_templates()
        elif system_only:
            templates = prompt_service.get_system_templates()
        elif category:
            templates = prompt_service.get_templates_by_category(category)
        else:
            templates = prompt_service.get_all_templates()
        
        return {
            "success": True,
            "templates": [template.to_dict() for template in templates],
            "count": len(templates)
        }
    
    except Exception as e:
        logger.error(f"템플릿 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 조회 중 오류가 발생했습니다")


@router.get("/templates/{template_id}", response_model=Dict[str, Any])
async def get_template(template_id: str):
    """템플릿 상세 조회"""
    try:
        template = prompt_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다")
        
        return {
            "success": True,
            "template": template.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"템플릿 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 조회 중 오류가 발생했습니다")


@router.put("/templates/{template_id}", response_model=Dict[str, Any])
async def update_template(template_id: str, request: UpdateTemplateRequest):
    """템플릿 업데이트"""
    try:
        # 업데이트할 필드만 추출
        updates = {}
        for field, value in request.dict().items():
            if value is not None:
                if field == "variables":
                    # 변수 객체로 변환
                    updates[field] = [PromptVariable(**var_data) for var_data in value]
                else:
                    updates[field] = value
        
        updated_template = prompt_service.update_template(template_id, updates)
        
        return {
            "success": True,
            "template": updated_template.to_dict(),
            "message": "템플릿이 성공적으로 업데이트되었습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"템플릿 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 업데이트 중 오류가 발생했습니다")


@router.delete("/templates/{template_id}", response_model=Dict[str, Any])
async def delete_template(template_id: str):
    """템플릿 삭제"""
    try:
        success = prompt_service.delete_template(template_id)
        if not success:
            raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다")
        
        return {
            "success": True,
            "message": "템플릿이 성공적으로 삭제되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"템플릿 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 삭제 중 오류가 발생했습니다")


@router.post("/templates/{template_id}/duplicate", response_model=Dict[str, Any])
async def duplicate_template(template_id: str, new_name: Optional[str] = None):
    """템플릿 복제"""
    try:
        duplicated_template = prompt_service.duplicate_template(template_id, new_name)
        
        return {
            "success": True,
            "template": duplicated_template.to_dict(),
            "message": "템플릿이 성공적으로 복제되었습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"템플릿 복제 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 복제 중 오류가 발생했습니다")


# 카테고리 관리 엔드포인트
@router.post("/categories", response_model=Dict[str, Any])
async def create_category(request: CreateCategoryRequest):
    """카테고리 생성"""
    try:
        category = PromptCategory(**request.dict())
        created_category = prompt_service.create_category(category)
        
        return {
            "success": True,
            "category": created_category.dict(),
            "message": "카테고리가 성공적으로 생성되었습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"카테고리 생성 실패: {e}")
        raise HTTPException(status_code=500, detail="카테고리 생성 중 오류가 발생했습니다")


@router.get("/categories", response_model=Dict[str, Any])
async def get_categories():
    """카테고리 목록 조회"""
    try:
        categories = prompt_service.get_all_categories()
        
        return {
            "success": True,
            "categories": [category.dict() for category in categories],
            "count": len(categories)
        }
    
    except Exception as e:
        logger.error(f"카테고리 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="카테고리 조회 중 오류가 발생했습니다")


@router.get("/categories/{category_name}", response_model=Dict[str, Any])
async def get_category(category_name: str):
    """카테고리 상세 조회"""
    try:
        category = prompt_service.get_category(category_name)
        if not category:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다")
        
        return {
            "success": True,
            "category": category.dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"카테고리 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="카테고리 조회 중 오류가 발생했습니다")


@router.put("/categories/{category_name}", response_model=Dict[str, Any])
async def update_category(category_name: str, updates: Dict[str, Any]):
    """카테고리 업데이트"""
    try:
        updated_category = prompt_service.update_category(category_name, updates)
        
        return {
            "success": True,
            "category": updated_category.dict(),
            "message": "카테고리가 성공적으로 업데이트되었습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"카테고리 업데이트 실패: {e}")
        raise HTTPException(status_code=500, detail="카테고리 업데이트 중 오류가 발생했습니다")


@router.delete("/categories/{category_name}", response_model=Dict[str, Any])
async def delete_category(category_name: str):
    """카테고리 삭제"""
    try:
        success = prompt_service.delete_category(category_name)
        if not success:
            raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다")
        
        return {
            "success": True,
            "message": "카테고리가 성공적으로 삭제되었습니다"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"카테고리 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail="카테고리 삭제 중 오류가 발생했습니다")


# 버전 관리 엔드포인트
@router.get("/templates/{template_id}/versions", response_model=Dict[str, Any])
async def get_template_versions(template_id: str):
    """템플릿 버전 목록 조회"""
    try:
        versions = prompt_service.get_template_versions(template_id)
        
        return {
            "success": True,
            "versions": [version.to_dict() for version in versions],
            "count": len(versions)
        }
    
    except Exception as e:
        logger.error(f"템플릿 버전 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 버전 조회 중 오류가 발생했습니다")


@router.post("/templates/{template_id}/rollback", response_model=Dict[str, Any])
async def rollback_template(template_id: str, version: str):
    """템플릿 롤백"""
    try:
        rolled_back_template = prompt_service.rollback_template(template_id, version)
        
        return {
            "success": True,
            "template": rolled_back_template.to_dict(),
            "message": f"템플릿이 버전 {version}으로 롤백되었습니다"
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"템플릿 롤백 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 롤백 중 오류가 발생했습니다")


# 검색 및 렌더링 엔드포인트
@router.post("/search", response_model=Dict[str, Any])
async def search_templates(request: SearchRequest):
    """템플릿 검색"""
    try:
        results = prompt_service.search_templates(request.query, request.limit)
        
        return {
            "success": True,
            "results": [result.to_dict() for result in results],
            "count": len(results),
            "query": request.query
        }
    
    except Exception as e:
        logger.error(f"템플릿 검색 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 검색 중 오류가 발생했습니다")


@router.post("/render", response_model=Dict[str, Any])
async def render_template(request: RenderTemplateRequest):
    """템플릿 렌더링"""
    try:
        rendered_content = prompt_service.render_template(request.template_id, request.values)
        
        return {
            "success": True,
            "rendered_content": rendered_content,
            "template_id": request.template_id
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"템플릿 렌더링 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 렌더링 중 오류가 발생했습니다")


# 백업 및 복원 엔드포인트
@router.post("/export", response_model=Dict[str, Any])
async def export_templates():
    """템플릿 내보내기"""
    try:
        import tempfile
        import os
        
        # 임시 파일 생성
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name
        
        prompt_service.export_templates(temp_path)
        
        # 파일 내용 읽기
        with open(temp_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 임시 파일 삭제
        os.unlink(temp_path)
        
        return {
            "success": True,
            "data": json.loads(content),
            "message": "템플릿이 성공적으로 내보내기되었습니다"
        }
    
    except Exception as e:
        logger.error(f"템플릿 내보내기 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 내보내기 중 오류가 발생했습니다")


@router.post("/import", response_model=Dict[str, Any])
async def import_templates(
    file: UploadFile = File(...),
    overwrite: bool = Query(False, description="기존 템플릿 덮어쓰기")
):
    """템플릿 가져오기"""
    try:
        import tempfile
        import os
        
        # 업로드된 파일을 임시 파일로 저장
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.json', delete=False) as f:
            content = await file.read()
            f.write(content)
            temp_path = f.name
        
        # 템플릿 가져오기
        imported_count = prompt_service.import_templates(temp_path, overwrite)
        
        # 임시 파일 삭제
        os.unlink(temp_path)
        
        return {
            "success": True,
            "imported_count": imported_count,
            "message": f"{imported_count}개의 템플릿이 성공적으로 가져와졌습니다"
        }
    
    except Exception as e:
        logger.error(f"템플릿 가져오기 실패: {e}")
        raise HTTPException(status_code=500, detail="템플릿 가져오기 중 오류가 발생했습니다")


# 통계 정보 엔드포인트
@router.get("/statistics", response_model=Dict[str, Any])
async def get_statistics():
    """통계 정보 조회"""
    try:
        stats = prompt_service.get_statistics()
        
        return {
            "success": True,
            "statistics": stats
        }
    
    except Exception as e:
        logger.error(f"통계 정보 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="통계 정보 조회 중 오류가 발생했습니다")
