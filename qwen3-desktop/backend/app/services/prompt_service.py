import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path
import shutil

from ..models.prompt import (
    PromptTemplate, PromptVariable, PromptCategory, 
    PromptVersion, PromptSearchResult
)
from ..utils.logger import get_logger

logger = get_logger(__name__)


class PromptService:
    """프롬프트 템플릿 관리 서비스"""
    
    def __init__(self, data_dir: str = "data/prompts"):
        self.data_dir = Path(data_dir)
        self.templates_file = self.data_dir / "templates.json"
        self.categories_file = self.data_dir / "categories.json"
        self.versions_file = self.data_dir / "versions.json"
        
        # 데이터 디렉토리 생성
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 메모리 캐시
        self._templates: Dict[str, PromptTemplate] = {}
        self._categories: Dict[str, PromptCategory] = {}
        self._versions: Dict[str, List[PromptVersion]] = {}
        
        # 초기화
        self._load_data()
        self._load_default_templates()
    
    def _load_data(self):
        """데이터 로드"""
        try:
            # 템플릿 로드
            if self.templates_file.exists():
                with open(self.templates_file, 'r', encoding='utf-8') as f:
                    templates_data = json.load(f)
                    for template_data in templates_data:
                        template = PromptTemplate.from_dict(template_data)
                        self._templates[template.id] = template
            
            # 카테고리 로드
            if self.categories_file.exists():
                with open(self.categories_file, 'r', encoding='utf-8') as f:
                    categories_data = json.load(f)
                    for category_data in categories_data:
                        category = PromptCategory(**category_data)
                        self._categories[category.name] = category
            
            # 버전 로드
            if self.versions_file.exists():
                with open(self.versions_file, 'r', encoding='utf-8') as f:
                    versions_data = json.load(f)
                    for template_id, versions_list in versions_data.items():
                        self._versions[template_id] = [
                            PromptVersion(**version_data) for version_data in versions_list
                        ]
            
            logger.info(f"프롬프트 데이터 로드 완료: {len(self._templates)} 템플릿, {len(self._categories)} 카테고리")
        
        except Exception as e:
            logger.error(f"프롬프트 데이터 로드 실패: {e}")
    
    def _save_data(self):
        """데이터 저장"""
        try:
            # 템플릿 저장
            templates_data = [template.to_dict() for template in self._templates.values()]
            with open(self.templates_file, 'w', encoding='utf-8') as f:
                json.dump(templates_data, f, ensure_ascii=False, indent=2)
            
            # 카테고리 저장
            categories_data = [category.dict() for category in self._categories.values()]
            with open(self.categories_file, 'w', encoding='utf-8') as f:
                json.dump(categories_data, f, ensure_ascii=False, indent=2)
            
            # 버전 저장
            versions_data = {}
            for template_id, versions in self._versions.items():
                versions_data[template_id] = [version.to_dict() for version in versions]
            with open(self.versions_file, 'w', encoding='utf-8') as f:
                json.dump(versions_data, f, ensure_ascii=False, indent=2)
            
            logger.info("프롬프트 데이터 저장 완료")
        
        except Exception as e:
            logger.error(f"프롬프트 데이터 저장 실패: {e}")
    
    def _load_default_templates(self):
        """기본 템플릿 로드"""
        if not self._templates:  # 템플릿이 없을 때만 기본 템플릿 로드
            self._create_default_categories()
            self._create_default_templates()
            self._save_data()
    
    def _create_default_categories(self):
        """기본 카테고리 생성"""
        default_categories = [
            PromptCategory(
                name="general",
                description="일반적인 프롬프트",
                icon="📝",
                color="#3B82F6"
            ),
            PromptCategory(
                name="coding",
                description="코딩 관련 프롬프트",
                icon="💻",
                color="#10B981"
            ),
            PromptCategory(
                name="writing",
                description="글쓰기 관련 프롬프트",
                icon="✍️",
                color="#F59E0B"
            ),
            PromptCategory(
                name="analysis",
                description="분석 관련 프롬프트",
                icon="📊",
                color="#8B5CF6"
            ),
            PromptCategory(
                name="creative",
                description="창작 관련 프롬프트",
                icon="🎨",
                color="#EC4899"
            ),
            PromptCategory(
                name="system",
                description="시스템 프롬프트",
                icon="⚙️",
                color="#6B7280"
            )
        ]
        
        for category in default_categories:
            self._categories[category.name] = category
    
    def _create_default_templates(self):
        """기본 템플릿 생성"""
        default_templates = [
            PromptTemplate(
                name="일반 대화",
                description="일반적인 대화를 위한 기본 프롬프트",
                category="general",
                content="안녕하세요! 저는 도움이 되는 AI 어시스턴트입니다. 무엇을 도와드릴까요?",
                tags=["기본", "대화"],
                is_system_prompt=True
            ),
            PromptTemplate(
                name="코드 리뷰",
                description="코드 리뷰를 위한 프롬프트",
                category="coding",
                content="다음 코드를 리뷰해주세요:\n\n{code}\n\n다음 관점에서 분석해주세요:\n1. 코드 품질\n2. 성능\n3. 보안\n4. 가독성\n5. 개선 제안",
                variables=[
                    PromptVariable(
                        name="code",
                        type="string",
                        description="리뷰할 코드",
                        required=True,
                        validation_rules={"min_length": 10}
                    )
                ],
                tags=["코드", "리뷰", "개발"]
            ),
            PromptTemplate(
                name="문서 요약",
                description="문서를 요약하는 프롬프트",
                category="writing",
                content="다음 문서를 {summary_length}자 이내로 요약해주세요:\n\n{document}\n\n요약 시 다음 사항을 포함해주세요:\n- 주요 내용\n- 핵심 포인트\n- 결론",
                variables=[
                    PromptVariable(
                        name="document",
                        type="string",
                        description="요약할 문서",
                        required=True,
                        validation_rules={"min_length": 50}
                    ),
                    PromptVariable(
                        name="summary_length",
                        type="number",
                        description="요약 길이 (자)",
                        default_value=200,
                        validation_rules={"min": 50, "max": 1000}
                    )
                ],
                tags=["문서", "요약", "글쓰기"]
            ),
            PromptTemplate(
                name="데이터 분석",
                description="데이터 분석을 위한 프롬프트",
                category="analysis",
                content="다음 데이터를 분석해주세요:\n\n{data}\n\n분석 요청: {analysis_request}\n\n다음 형식으로 답변해주세요:\n1. 데이터 개요\n2. 주요 패턴\n3. 인사이트\n4. 권장사항",
                variables=[
                    PromptVariable(
                        name="data",
                        type="string",
                        description="분석할 데이터",
                        required=True
                    ),
                    PromptVariable(
                        name="analysis_request",
                        type="string",
                        description="분석 요청사항",
                        default_value="전체적인 데이터 분석"
                    )
                ],
                tags=["데이터", "분석", "인사이트"]
            ),
            PromptTemplate(
                name="창작 도우미",
                description="창작 활동을 돕는 프롬프트",
                category="creative",
                content="창작 주제: {topic}\n창작 유형: {type}\n요구사항: {requirements}\n\n다음에 대해 도움을 주세요:\n1. 아이디어 제안\n2. 구조 설계\n3. 창작 팁\n4. 참고 자료",
                variables=[
                    PromptVariable(
                        name="topic",
                        type="string",
                        description="창작 주제",
                        required=True
                    ),
                    PromptVariable(
                        name="type",
                        type="string",
                        description="창작 유형 (소설, 시, 그림, 음악 등)",
                        default_value="일반"
                    ),
                    PromptVariable(
                        name="requirements",
                        type="string",
                        description="특별한 요구사항",
                        default_value="없음"
                    )
                ],
                tags=["창작", "아이디어", "예술"]
            )
        ]
        
        for template in default_templates:
            self._templates[template.id] = template
    
    # 템플릿 CRUD 작업
    def create_template(self, template: PromptTemplate) -> PromptTemplate:
        """템플릿 생성"""
        if template.id in self._templates:
            raise ValueError(f"템플릿 ID '{template.id}'가 이미 존재합니다")
        
        self._templates[template.id] = template
        self._save_data()
        
        logger.info(f"템플릿 생성: {template.name}")
        return template
    
    def get_template(self, template_id: str) -> Optional[PromptTemplate]:
        """템플릿 조회"""
        return self._templates.get(template_id)
    
    def get_all_templates(self) -> List[PromptTemplate]:
        """모든 템플릿 조회"""
        return list(self._templates.values())
    
    def get_templates_by_category(self, category: str) -> List[PromptTemplate]:
        """카테고리별 템플릿 조회"""
        return [template for template in self._templates.values() if template.category == category]
    
    def get_favorite_templates(self) -> List[PromptTemplate]:
        """즐겨찾기 템플릿 조회"""
        return [template for template in self._templates.values() if template.is_favorite]
    
    def get_system_templates(self) -> List[PromptTemplate]:
        """시스템 프롬프트 조회"""
        return [template for template in self._templates.values() if template.is_system_prompt]
    
    def update_template(self, template_id: str, updates: Dict[str, Any]) -> PromptTemplate:
        """템플릿 업데이트"""
        if template_id not in self._templates:
            raise ValueError(f"템플릿 ID '{template_id}'를 찾을 수 없습니다")
        
        template = self._templates[template_id]
        
        # 버전 관리
        self._create_version(template, "업데이트")
        
        # 업데이트 적용
        for key, value in updates.items():
            if hasattr(template, key):
                setattr(template, key, value)
        
        template.updated_at = datetime.now()
        self._save_data()
        
        logger.info(f"템플릿 업데이트: {template.name}")
        return template
    
    def delete_template(self, template_id: str) -> bool:
        """템플릿 삭제"""
        if template_id not in self._templates:
            return False
        
        template = self._templates[template_id]
        del self._templates[template_id]
        
        # 관련 버전도 삭제
        if template_id in self._versions:
            del self._versions[template_id]
        
        self._save_data()
        
        logger.info(f"템플릿 삭제: {template.name}")
        return True
    
    def duplicate_template(self, template_id: str, new_name: str = None) -> PromptTemplate:
        """템플릿 복제"""
        if template_id not in self._templates:
            raise ValueError(f"템플릿 ID '{template_id}'를 찾을 수 없습니다")
        
        original = self._templates[template_id]
        
        # 새 템플릿 생성
        new_template = PromptTemplate(
            name=new_name or f"{original.name} (복사본)",
            description=original.description,
            category=original.category,
            content=original.content,
            variables=original.variables.copy(),
            tags=original.tags.copy(),
            is_favorite=False,
            is_system_prompt=original.is_system_prompt
        )
        
        self._templates[new_template.id] = new_template
        self._save_data()
        
        logger.info(f"템플릿 복제: {original.name} -> {new_template.name}")
        return new_template
    
    # 카테고리 관리
    def create_category(self, category: PromptCategory) -> PromptCategory:
        """카테고리 생성"""
        if category.name in self._categories:
            raise ValueError(f"카테고리 '{category.name}'가 이미 존재합니다")
        
        self._categories[category.name] = category
        self._save_data()
        
        logger.info(f"카테고리 생성: {category.name}")
        return category
    
    def get_all_categories(self) -> List[PromptCategory]:
        """모든 카테고리 조회"""
        return list(self._categories.values())
    
    def get_category(self, category_name: str) -> Optional[PromptCategory]:
        """카테고리 조회"""
        return self._categories.get(category_name)
    
    def update_category(self, category_name: str, updates: Dict[str, Any]) -> PromptCategory:
        """카테고리 업데이트"""
        if category_name not in self._categories:
            raise ValueError(f"카테고리 '{category_name}'를 찾을 수 없습니다")
        
        category = self._categories[category_name]
        
        for key, value in updates.items():
            if hasattr(category, key):
                setattr(category, key, value)
        
        self._save_data()
        
        logger.info(f"카테고리 업데이트: {category.name}")
        return category
    
    def delete_category(self, category_name: str) -> bool:
        """카테고리 삭제"""
        if category_name not in self._categories:
            return False
        
        # 해당 카테고리의 템플릿들을 general로 이동
        for template in self._templates.values():
            if template.category == category_name:
                template.category = "general"
        
        del self._categories[category_name]
        self._save_data()
        
        logger.info(f"카테고리 삭제: {category_name}")
        return True
    
    # 버전 관리
    def _create_version(self, template: PromptTemplate, message: str = ""):
        """버전 생성"""
        version = PromptVersion(
            version=template.version,
            template=template,
            message=message
        )
        
        if template.id not in self._versions:
            self._versions[template.id] = []
        
        self._versions[template.id].append(version)
    
    def get_template_versions(self, template_id: str) -> List[PromptVersion]:
        """템플릿 버전 조회"""
        return self._versions.get(template_id, [])
    
    def rollback_template(self, template_id: str, version: str) -> PromptTemplate:
        """템플릿 롤백"""
        if template_id not in self._versions:
            raise ValueError(f"템플릿 ID '{template_id}'의 버전을 찾을 수 없습니다")
        
        versions = self._versions[template_id]
        target_version = None
        
        for v in versions:
            if v.version == version:
                target_version = v
                break
        
        if not target_version:
            raise ValueError(f"버전 '{version}'을 찾을 수 없습니다")
        
        # 롤백
        self._templates[template_id] = target_version.template
        self._save_data()
        
        logger.info(f"템플릿 롤백: {template_id} -> {version}")
        return target_version.template
    
    # 검색 기능
    def search_templates(self, query: str, limit: int = 10) -> List[PromptSearchResult]:
        """템플릿 검색"""
        if not query.strip():
            return []
        
        query_lower = query.lower()
        results = []
        
        for template in self._templates.values():
            score = 0
            matched_fields = []
            
            # 이름 검색
            if query_lower in template.name.lower():
                score += 10
                matched_fields.append("name")
            
            # 설명 검색
            if query_lower in template.description.lower():
                score += 5
                matched_fields.append("description")
            
            # 내용 검색
            if query_lower in template.content.lower():
                score += 3
                matched_fields.append("content")
            
            # 태그 검색
            for tag in template.tags:
                if query_lower in tag.lower():
                    score += 2
                    matched_fields.append("tags")
            
            # 카테고리 검색
            if query_lower in template.category.lower():
                score += 1
                matched_fields.append("category")
            
            if score > 0:
                results.append(PromptSearchResult(
                    template=template,
                    relevance_score=score,
                    matched_fields=list(set(matched_fields))
                ))
        
        # 점수순 정렬
        results.sort(key=lambda x: x.relevance_score, reverse=True)
        
        return results[:limit]
    
    # 템플릿 렌더링
    def render_template(self, template_id: str, values: Dict[str, Any] = None) -> str:
        """템플릿 렌더링"""
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"템플릿 ID '{template_id}'를 찾을 수 없습니다")
        
        return template.render(values)
    
    # 백업 및 복원
    def export_templates(self, file_path: str):
        """템플릿 내보내기"""
        data = {
            "templates": [template.to_dict() for template in self._templates.values()],
            "categories": [category.dict() for category in self._categories.values()],
            "exported_at": datetime.now().isoformat()
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"템플릿 내보내기: {file_path}")
    
    def import_templates(self, file_path: str, overwrite: bool = False):
        """템플릿 가져오기"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        imported_count = 0
        
        # 카테고리 가져오기
        for category_data in data.get("categories", []):
            category = PromptCategory(**category_data)
            if category.name not in self._categories or overwrite:
                self._categories[category.name] = category
        
        # 템플릿 가져오기
        for template_data in data.get("templates", []):
            template = PromptTemplate.from_dict(template_data)
            if template.id not in self._templates or overwrite:
                self._templates[template.id] = template
                imported_count += 1
        
        self._save_data()
        
        logger.info(f"템플릿 가져오기 완료: {imported_count}개 템플릿")
        return imported_count
    
    # 통계 정보
    def get_statistics(self) -> Dict[str, Any]:
        """통계 정보 조회"""
        total_templates = len(self._templates)
        total_categories = len(self._categories)
        favorite_count = len(self.get_favorite_templates())
        system_count = len(self.get_system_templates())
        
        # 카테고리별 템플릿 수
        category_counts = {}
        for template in self._templates.values():
            category_counts[template.category] = category_counts.get(template.category, 0) + 1
        
        # 변수가 있는 템플릿 수
        templates_with_variables = len([t for t in self._templates.values() if t.has_variables()])
        
        return {
            "total_templates": total_templates,
            "total_categories": total_categories,
            "favorite_templates": favorite_count,
            "system_templates": system_count,
            "templates_with_variables": templates_with_variables,
            "category_distribution": category_counts
        }
