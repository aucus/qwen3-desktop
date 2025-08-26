import json
import os
import shutil
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import difflib
from pathlib import Path

from ..utils.logger import get_logger

logger = get_logger(__name__)


class VersionType(Enum):
    """버전 타입"""
    MAJOR = "major"
    MINOR = "minor"
    PATCH = "patch"
    CUSTOM = "custom"


class ChangeType(Enum):
    """변경 타입"""
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    RENAMED = "renamed"
    MERGED = "merged"


@dataclass
class VersionMetadata:
    """버전 메타데이터"""
    version: str
    version_type: VersionType
    description: str
    author: str
    created_at: datetime
    changes: List[Dict[str, Any]]
    tags: List[str]
    is_stable: bool = False
    parent_version: Optional[str] = None
    merge_source: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "version": self.version,
            "version_type": self.version_type.value,
            "description": self.description,
            "author": self.author,
            "created_at": self.created_at.isoformat(),
            "changes": self.changes,
            "tags": self.tags,
            "is_stable": self.is_stable,
            "parent_version": self.parent_version,
            "merge_source": self.merge_source
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'VersionMetadata':
        """딕셔너리에서 생성"""
        data["version_type"] = VersionType(data["version_type"])
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)


@dataclass
class VersionDiff:
    """버전 간 차이점"""
    version_from: str
    version_to: str
    changes: List[Dict[str, Any]]
    added_lines: int
    removed_lines: int
    modified_files: List[str]
    diff_summary: str
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "version_from": self.version_from,
            "version_to": self.version_to,
            "changes": self.changes,
            "added_lines": self.added_lines,
            "removed_lines": self.removed_lines,
            "modified_files": self.modified_files,
            "diff_summary": self.diff_summary
        }


class VersionService:
    """프롬프트 버전 관리 서비스"""
    
    def __init__(self, base_path: str = "data/versions"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.version_history: Dict[str, List[VersionMetadata]] = {}
        self.current_versions: Dict[str, str] = {}
        
        logger.info("버전 관리 서비스 초기화 완료")
    
    def create_version(self, template_id: str, version_type: VersionType, description: str, 
                      author: str, content: Dict[str, Any], tags: List[str] = None,
                      parent_version: Optional[str] = None) -> VersionMetadata:
        """새 버전 생성"""
        # 버전 번호 생성
        version_number = self._generate_version_number(template_id, version_type, parent_version)
        
        # 메타데이터 생성
        metadata = VersionMetadata(
            version=version_number,
            version_type=version_type,
            description=description,
            author=author,
            created_at=datetime.now(),
            changes=self._detect_changes(template_id, content, parent_version),
            tags=tags or [],
            parent_version=parent_version
        )
        
        # 버전 저장
        self._save_version(template_id, version_number, content, metadata)
        
        # 히스토리 업데이트
        if template_id not in self.version_history:
            self.version_history[template_id] = []
        self.version_history[template_id].append(metadata)
        
        # 현재 버전 업데이트
        self.current_versions[template_id] = version_number
        
        logger.info(f"새 버전 생성: {template_id} v{version_number}")
        return metadata
    
    def get_version(self, template_id: str, version: str) -> Optional[Dict[str, Any]]:
        """특정 버전 조회"""
        version_path = self.base_path / template_id / f"{version}.json"
        if not version_path.exists():
            return None
        
        try:
            with open(version_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data
        except Exception as e:
            logger.error(f"버전 조회 실패: {e}")
            return None
    
    def get_version_metadata(self, template_id: str, version: str) -> Optional[VersionMetadata]:
        """버전 메타데이터 조회"""
        version_data = self.get_version(template_id, version)
        if not version_data:
            return None
        
        return VersionMetadata.from_dict(version_data.get("metadata", {}))
    
    def get_version_history(self, template_id: str, limit: Optional[int] = None) -> List[VersionMetadata]:
        """버전 히스토리 조회"""
        history = self.version_history.get(template_id, [])
        if limit:
            history = history[-limit:]
        return history
    
    def get_latest_version(self, template_id: str) -> Optional[str]:
        """최신 버전 조회"""
        return self.current_versions.get(template_id)
    
    def get_stable_versions(self, template_id: str) -> List[VersionMetadata]:
        """안정 버전 목록 조회"""
        history = self.version_history.get(template_id, [])
        return [v for v in history if v.is_stable]
    
    def compare_versions(self, template_id: str, version_from: str, version_to: str) -> Optional[VersionDiff]:
        """버전 비교"""
        content_from = self.get_version(template_id, version_from)
        content_to = self.get_version(template_id, version_to)
        
        if not content_from or not content_to:
            return None
        
        # 차이점 분석
        changes = self._analyze_changes(content_from, content_to)
        diff_summary = self._generate_diff_summary(changes)
        
        return VersionDiff(
            version_from=version_from,
            version_to=version_to,
            changes=changes,
            added_lines=sum(c.get("added_lines", 0) for c in changes),
            removed_lines=sum(c.get("removed_lines", 0) for c in changes),
            modified_files=list(set(c.get("field", "") for c in changes)),
            diff_summary=diff_summary
        )
    
    def rollback_to_version(self, template_id: str, target_version: str) -> bool:
        """특정 버전으로 롤백"""
        target_content = self.get_version(template_id, target_version)
        if not target_content:
            return False
        
        try:
            # 현재 버전을 롤백 버전으로 업데이트
            current_version = self.current_versions.get(template_id)
            if current_version:
                # 롤백 메타데이터 생성
                rollback_metadata = VersionMetadata(
                    version=self._generate_version_number(template_id, VersionType.PATCH),
                    version_type=VersionType.PATCH,
                    description=f"롤백: {target_version}로 복원",
                    author="system",
                    created_at=datetime.now(),
                    changes=[{
                        "type": "rollback",
                        "from_version": current_version,
                        "to_version": target_version,
                        "description": f"버전 {current_version}에서 {target_version}로 롤백"
                    }],
                    tags=["rollback"],
                    parent_version=current_version
                )
                
                # 롤백 버전 저장
                self._save_version(template_id, rollback_metadata.version, target_content, rollback_metadata)
                
                # 히스토리 업데이트
                self.version_history[template_id].append(rollback_metadata)
                self.current_versions[template_id] = rollback_metadata.version
            
            logger.info(f"롤백 완료: {template_id} -> v{target_version}")
            return True
            
        except Exception as e:
            logger.error(f"롤백 실패: {e}")
            return False
    
    def merge_versions(self, template_id: str, source_version: str, target_version: str, 
                      author: str, description: str, conflict_strategy: str = "manual") -> Optional[VersionMetadata]:
        """버전 병합"""
        source_content = self.get_version(template_id, source_version)
        target_content = self.get_version(template_id, target_version)
        
        if not source_content or not target_content:
            return None
        
        try:
            # 병합 수행
            merged_content = self._merge_content(source_content, target_content, conflict_strategy)
            
            # 병합 버전 생성
            merge_metadata = VersionMetadata(
                version=self._generate_version_number(template_id, VersionType.MINOR),
                version_type=VersionType.MINOR,
                description=description,
                author=author,
                created_at=datetime.now(),
                changes=[{
                    "type": "merge",
                    "source_version": source_version,
                    "target_version": target_version,
                    "strategy": conflict_strategy,
                    "description": f"버전 {source_version}와 {target_version} 병합"
                }],
                tags=["merge"],
                parent_version=target_version,
                merge_source=source_version
            )
            
            # 병합 버전 저장
            self._save_version(template_id, merge_metadata.version, merged_content, merge_metadata)
            
            # 히스토리 업데이트
            self.version_history[template_id].append(merge_metadata)
            self.current_versions[template_id] = merge_metadata.version
            
            logger.info(f"버전 병합 완료: {template_id} v{merge_metadata.version}")
            return merge_metadata
            
        except Exception as e:
            logger.error(f"버전 병합 실패: {e}")
            return None
    
    def tag_version(self, template_id: str, version: str, tags: List[str], is_stable: bool = False) -> bool:
        """버전 태그 설정"""
        metadata = self.get_version_metadata(template_id, version)
        if not metadata:
            return False
        
        # 태그 업데이트
        metadata.tags.extend(tags)
        metadata.is_stable = is_stable
        
        # 버전 파일 업데이트
        version_data = self.get_version(template_id, version)
        if version_data:
            version_data["metadata"] = metadata.to_dict()
            self._save_version_file(template_id, version, version_data)
            
            # 히스토리 업데이트
            for v in self.version_history.get(template_id, []):
                if v.version == version:
                    v.tags = metadata.tags
                    v.is_stable = metadata.is_stable
                    break
        
        logger.info(f"버전 태그 설정: {template_id} v{version}")
        return True
    
    def delete_version(self, template_id: str, version: str) -> bool:
        """버전 삭제"""
        try:
            # 파일 삭제
            version_path = self.base_path / template_id / f"{version}.json"
            if version_path.exists():
                version_path.unlink()
            
            # 히스토리에서 제거
            if template_id in self.version_history:
                self.version_history[template_id] = [
                    v for v in self.version_history[template_id] if v.version != version
                ]
            
            # 현재 버전이 삭제된 경우 최신 버전으로 설정
            if self.current_versions.get(template_id) == version:
                history = self.version_history.get(template_id, [])
                if history:
                    self.current_versions[template_id] = history[-1].version
                else:
                    self.current_versions.pop(template_id, None)
            
            logger.info(f"버전 삭제: {template_id} v{version}")
            return True
            
        except Exception as e:
            logger.error(f"버전 삭제 실패: {e}")
            return False
    
    def export_version(self, template_id: str, version: str, format: str = "json") -> Optional[str]:
        """버전 내보내기"""
        version_data = self.get_version(template_id, version)
        if not version_data:
            return None
        
        if format == "json":
            return json.dumps(version_data, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"지원하지 않는 형식: {format}")
    
    def import_version(self, template_id: str, version_data: str, format: str = "json") -> bool:
        """버전 가져오기"""
        try:
            if format == "json":
                data = json.loads(version_data)
            else:
                raise ValueError(f"지원하지 않는 형식: {format}")
            
            version = data.get("metadata", {}).get("version")
            if not version:
                return False
            
            # 버전 저장
            self._save_version_file(template_id, version, data)
            
            # 메타데이터 파싱 및 히스토리 업데이트
            metadata = VersionMetadata.from_dict(data.get("metadata", {}))
            if template_id not in self.version_history:
                self.version_history[template_id] = []
            
            # 기존 버전이 있으면 업데이트, 없으면 추가
            existing_index = next((i for i, v in enumerate(self.version_history[template_id]) 
                                 if v.version == version), None)
            if existing_index is not None:
                self.version_history[template_id][existing_index] = metadata
            else:
                self.version_history[template_id].append(metadata)
            
            # 현재 버전 업데이트
            self.current_versions[template_id] = version
            
            logger.info(f"버전 가져오기 완료: {template_id} v{version}")
            return True
            
        except Exception as e:
            logger.error(f"버전 가져오기 실패: {e}")
            return False
    
    def get_version_statistics(self, template_id: str) -> Dict[str, Any]:
        """버전 통계 정보"""
        history = self.version_history.get(template_id, [])
        
        if not history:
            return {
                "total_versions": 0,
                "latest_version": None,
                "stable_versions": 0,
                "version_types": {},
                "authors": {},
                "creation_timeline": []
            }
        
        version_types = {}
        authors = {}
        creation_timeline = []
        
        for version in history:
            # 버전 타입 통계
            vtype = version.version_type.value
            version_types[vtype] = version_types.get(vtype, 0) + 1
            
            # 작성자 통계
            author = version.author
            authors[author] = authors.get(author, 0) + 1
            
            # 생성 타임라인
            creation_timeline.append({
                "version": version.version,
                "created_at": version.created_at.isoformat(),
                "description": version.description
            })
        
        return {
            "total_versions": len(history),
            "latest_version": history[-1].version if history else None,
            "stable_versions": len([v for v in history if v.is_stable]),
            "version_types": version_types,
            "authors": authors,
            "creation_timeline": creation_timeline
        }
    
    def _generate_version_number(self, template_id: str, version_type: VersionType, 
                               parent_version: Optional[str] = None) -> str:
        """버전 번호 생성"""
        if parent_version:
            # 부모 버전 기반으로 증가
            parts = parent_version.split('.')
            if len(parts) >= 3:
                major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
                
                if version_type == VersionType.MAJOR:
                    major += 1
                    minor = 0
                    patch = 0
                elif version_type == VersionType.MINOR:
                    minor += 1
                    patch = 0
                elif version_type == VersionType.PATCH:
                    patch += 1
                
                return f"{major}.{minor}.{patch}"
        
        # 새 템플릿이거나 부모 버전이 없는 경우
        if template_id not in self.version_history:
            return "1.0.0"
        
        # 기존 히스토리에서 최신 버전 찾기
        latest = self.current_versions.get(template_id, "0.0.0")
        parts = latest.split('.')
        if len(parts) >= 3:
            major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
            
            if version_type == VersionType.MAJOR:
                major += 1
                minor = 0
                patch = 0
            elif version_type == VersionType.MINOR:
                minor += 1
                patch = 0
            elif version_type == VersionType.PATCH:
                patch += 1
            
            return f"{major}.{minor}.{patch}"
        
        return "1.0.0"
    
    def _detect_changes(self, template_id: str, content: Dict[str, Any], 
                       parent_version: Optional[str] = None) -> List[Dict[str, Any]]:
        """변경사항 감지"""
        changes = []
        
        if parent_version:
            parent_content = self.get_version(template_id, parent_version)
            if parent_content:
                # 필드별 변경사항 분석
                for field in ["name", "description", "content", "variables", "tags"]:
                    old_value = parent_content.get("content", {}).get(field)
                    new_value = content.get(field)
                    
                    if old_value != new_value:
                        changes.append({
                            "type": "updated",
                            "field": field,
                            "old_value": old_value,
                            "new_value": new_value,
                            "description": f"{field} 필드 업데이트"
                        })
        else:
            # 새 템플릿 생성
            changes.append({
                "type": "created",
                "description": "새 프롬프트 템플릿 생성"
            })
        
        return changes
    
    def _analyze_changes(self, content_from: Dict[str, Any], content_to: Dict[str, Any]) -> List[Dict[str, Any]]:
        """변경사항 상세 분석"""
        changes = []
        
        # 텍스트 필드 비교
        text_fields = ["name", "description", "content"]
        for field in text_fields:
            old_text = str(content_from.get("content", {}).get(field, ""))
            new_text = str(content_to.get("content", {}).get(field, ""))
            
            if old_text != new_text:
                # 라인별 차이점 분석
                old_lines = old_text.splitlines()
                new_lines = new_text.splitlines()
                
                diff = list(difflib.unified_diff(old_lines, new_lines, lineterm=''))
                added_lines = len([line for line in diff if line.startswith('+') and not line.startswith('+++')])
                removed_lines = len([line for line in diff if line.startswith('-') and not line.startswith('---')])
                
                changes.append({
                    "type": "updated",
                    "field": field,
                    "added_lines": added_lines,
                    "removed_lines": removed_lines,
                    "diff": diff,
                    "description": f"{field} 필드 변경 ({added_lines} 추가, {removed_lines} 삭제)"
                })
        
        return changes
    
    def _generate_diff_summary(self, changes: List[Dict[str, Any]]) -> str:
        """차이점 요약 생성"""
        total_added = sum(c.get("added_lines", 0) for c in changes)
        total_removed = sum(c.get("removed_lines", 0) for c in changes)
        modified_fields = list(set(c.get("field", "") for c in changes))
        
        summary = f"총 {len(changes)}개 필드 변경"
        if total_added > 0 or total_removed > 0:
            summary += f", {total_added}줄 추가, {total_removed}줄 삭제"
        if modified_fields:
            summary += f" (변경된 필드: {', '.join(modified_fields)})"
        
        return summary
    
    def _merge_content(self, source_content: Dict[str, Any], target_content: Dict[str, Any], 
                      conflict_strategy: str) -> Dict[str, Any]:
        """컨텐츠 병합"""
        merged = target_content.copy()
        
        # 간단한 병합 전략 (실제로는 더 복잡한 로직 필요)
        if conflict_strategy == "source_wins":
            merged["content"] = source_content.get("content", {})
        elif conflict_strategy == "target_wins":
            merged["content"] = target_content.get("content", {})
        elif conflict_strategy == "manual":
            # 수동 병합을 위한 충돌 정보 추가
            merged["conflicts"] = self._detect_conflicts(source_content, target_content)
        
        return merged
    
    def _detect_conflicts(self, source_content: Dict[str, Any], target_content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """충돌 감지"""
        conflicts = []
        
        # 텍스트 필드 충돌 확인
        text_fields = ["name", "description", "content"]
        for field in text_fields:
            source_value = source_content.get("content", {}).get(field)
            target_value = target_content.get("content", {}).get(field)
            
            if source_value != target_value and source_value is not None and target_value is not None:
                conflicts.append({
                    "field": field,
                    "source_value": source_value,
                    "target_value": target_value,
                    "description": f"{field} 필드에서 충돌 발생"
                })
        
        return conflicts
    
    def _save_version(self, template_id: str, version: str, content: Dict[str, Any], metadata: VersionMetadata):
        """버전 저장"""
        version_data = {
            "content": content,
            "metadata": metadata.to_dict()
        }
        self._save_version_file(template_id, version, version_data)
    
    def _save_version_file(self, template_id: str, version: str, data: Dict[str, Any]):
        """버전 파일 저장"""
        template_path = self.base_path / template_id
        template_path.mkdir(parents=True, exist_ok=True)
        
        version_file = template_path / f"{version}.json"
        with open(version_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
