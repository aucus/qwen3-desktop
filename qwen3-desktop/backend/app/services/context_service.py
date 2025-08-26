import json
import time
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from collections import deque
import hashlib
import zlib
from dataclasses import dataclass, asdict
from enum import Enum

from ..utils.logger import get_logger

logger = get_logger(__name__)


class ContextType(Enum):
    """컨텍스트 타입"""
    CHAT = "chat"
    SYSTEM = "system"
    USER_PROFILE = "user_profile"
    SESSION = "session"
    TEMPORARY = "temporary"


@dataclass
class ContextItem:
    """컨텍스트 아이템"""
    id: str
    type: ContextType
    content: str
    metadata: Dict[str, Any]
    created_at: datetime
    accessed_at: datetime
    priority: int = 0
    size: int = 0
    compressed: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "id": self.id,
            "type": self.type.value,
            "content": self.content,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "accessed_at": self.accessed_at.isoformat(),
            "priority": self.priority,
            "size": self.size,
            "compressed": self.compressed
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ContextItem':
        """딕셔너리에서 생성"""
        data["type"] = ContextType(data["type"])
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["accessed_at"] = datetime.fromisoformat(data["accessed_at"])
        return cls(**data)


@dataclass
class ContextSession:
    """컨텍스트 세션"""
    session_id: str
    user_id: str
    items: List[ContextItem]
    max_size: int = 10000  # 최대 토큰 수
    max_items: int = 100   # 최대 아이템 수
    created_at: datetime = None
    updated_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "items": [item.to_dict() for item in self.items],
            "max_size": self.max_size,
            "max_items": self.max_items,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ContextSession':
        """딕셔너리에서 생성"""
        data["items"] = [ContextItem.from_dict(item) for item in data["items"]]
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["updated_at"] = datetime.fromisoformat(data["updated_at"])
        return cls(**data)


class ContextService:
    """컨텍스트 관리 서비스"""
    
    def __init__(self, max_total_size: int = 100000, compression_threshold: int = 1000):
        self.max_total_size = max_total_size
        self.compression_threshold = compression_threshold
        self.sessions: Dict[str, ContextSession] = {}
        self.context_cache: Dict[str, ContextItem] = {}
        self.access_history: deque = deque(maxlen=1000)
        
        logger.info("컨텍스트 서비스 초기화 완료")
    
    def create_session(self, session_id: str, user_id: str, max_size: int = 10000, max_items: int = 100) -> ContextSession:
        """새 세션 생성"""
        session = ContextSession(
            session_id=session_id,
            user_id=user_id,
            items=[],
            max_size=max_size,
            max_items=max_items
        )
        self.sessions[session_id] = session
        logger.info(f"새 세션 생성: {session_id} (사용자: {user_id})")
        return session
    
    def get_session(self, session_id: str) -> Optional[ContextSession]:
        """세션 조회"""
        return self.sessions.get(session_id)
    
    def add_context_item(self, session_id: str, context_type: ContextType, content: str, 
                        metadata: Dict[str, Any] = None, priority: int = 0) -> ContextItem:
        """컨텍스트 아이템 추가"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"세션을 찾을 수 없습니다: {session_id}")
        
        # 아이템 생성
        item_id = self._generate_item_id(session_id, context_type, content)
        item = ContextItem(
            id=item_id,
            type=context_type,
            content=content,
            metadata=metadata or {},
            created_at=datetime.now(),
            accessed_at=datetime.now(),
            priority=priority,
            size=len(content)
        )
        
        # 압축 필요 여부 확인
        if item.size > self.compression_threshold:
            item.content = self._compress_content(content)
            item.compressed = True
            item.size = len(item.content)
        
        # 세션에 추가
        session.items.append(item)
        session.updated_at = datetime.now()
        
        # 캐시에 저장
        self.context_cache[item_id] = item
        
        # 크기 제한 확인 및 정리
        self._manage_session_size(session)
        
        logger.info(f"컨텍스트 아이템 추가: {item_id} (타입: {context_type.value})")
        return item
    
    def get_context_items(self, session_id: str, context_type: Optional[ContextType] = None, 
                         limit: Optional[int] = None, include_compressed: bool = True) -> List[ContextItem]:
        """컨텍스트 아이템 조회"""
        session = self.get_session(session_id)
        if not session:
            return []
        
        items = session.items
        
        # 타입 필터링
        if context_type:
            items = [item for item in items if item.type == context_type]
        
        # 압축된 아이템 필터링
        if not include_compressed:
            items = [item for item in items if not item.compressed]
        
        # 액세스 시간 업데이트
        for item in items:
            item.accessed_at = datetime.now()
        
        # 우선순위 및 액세스 시간으로 정렬
        items.sort(key=lambda x: (x.priority, x.accessed_at), reverse=True)
        
        # 제한 적용
        if limit:
            items = items[:limit]
        
        return items
    
    def update_context_item(self, session_id: str, item_id: str, 
                          content: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None,
                          priority: Optional[int] = None) -> Optional[ContextItem]:
        """컨텍스트 아이템 업데이트"""
        session = self.get_session(session_id)
        if not session:
            return None
        
        # 아이템 찾기
        item = next((item for item in session.items if item.id == item_id), None)
        if not item:
            return None
        
        # 업데이트
        if content is not None:
            item.content = content
            item.size = len(content)
            if item.size > self.compression_threshold:
                item.content = self._compress_content(content)
                item.compressed = True
                item.size = len(item.content)
            else:
                item.compressed = False
        
        if metadata is not None:
            item.metadata.update(metadata)
        
        if priority is not None:
            item.priority = priority
        
        item.accessed_at = datetime.now()
        session.updated_at = datetime.now()
        
        # 캐시 업데이트
        self.context_cache[item_id] = item
        
        logger.info(f"컨텍스트 아이템 업데이트: {item_id}")
        return item
    
    def remove_context_item(self, session_id: str, item_id: str) -> bool:
        """컨텍스트 아이템 삭제"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        # 아이템 찾기 및 삭제
        original_count = len(session.items)
        session.items = [item for item in session.items if item.id != item_id]
        
        if len(session.items) < original_count:
            session.updated_at = datetime.now()
            
            # 캐시에서도 삭제
            self.context_cache.pop(item_id, None)
            
            logger.info(f"컨텍스트 아이템 삭제: {item_id}")
            return True
        
        return False
    
    def clear_session(self, session_id: str) -> bool:
        """세션 전체 삭제"""
        if session_id in self.sessions:
            session = self.sessions[session_id]
            
            # 캐시에서 아이템들 삭제
            for item in session.items:
                self.context_cache.pop(item.id, None)
            
            # 세션 삭제
            del self.sessions[session_id]
            
            logger.info(f"세션 삭제: {session_id}")
            return True
        
        return False
    
    def get_context_summary(self, session_id: str) -> Dict[str, Any]:
        """컨텍스트 요약 정보"""
        session = self.get_session(session_id)
        if not session:
            return {}
        
        total_size = sum(item.size for item in session.items)
        type_counts = {}
        for item in session.items:
            type_counts[item.type.value] = type_counts.get(item.type.value, 0) + 1
        
        return {
            "session_id": session_id,
            "user_id": session.user_id,
            "total_items": len(session.items),
            "total_size": total_size,
            "max_size": session.max_size,
            "max_items": session.max_items,
            "type_distribution": type_counts,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
            "compressed_items": len([item for item in session.items if item.compressed])
        }
    
    def optimize_context(self, session_id: str, target_size: Optional[int] = None) -> Dict[str, Any]:
        """컨텍스트 최적화"""
        session = self.get_session(session_id)
        if not session:
            return {"success": False, "error": "세션을 찾을 수 없습니다"}
        
        if target_size is None:
            target_size = session.max_size
        
        current_size = sum(item.size for item in session.items)
        removed_items = []
        compressed_items = []
        
        # 우선순위가 낮고 오래된 아이템부터 제거
        session.items.sort(key=lambda x: (x.priority, x.accessed_at))
        
        while current_size > target_size and session.items:
            item = session.items.pop(0)
            current_size -= item.size
            removed_items.append(item.id)
            
            # 캐시에서도 제거
            self.context_cache.pop(item.id, None)
        
        # 압축 가능한 아이템 압축
        for item in session.items:
            if not item.compressed and item.size > self.compression_threshold:
                original_size = item.size
                item.content = self._compress_content(item.content)
                item.compressed = True
                item.size = len(item.content)
                current_size -= (original_size - item.size)
                compressed_items.append(item.id)
        
        session.updated_at = datetime.now()
        
        logger.info(f"컨텍스트 최적화 완료: {session_id} (제거: {len(removed_items)}, 압축: {len(compressed_items)})")
        
        return {
            "success": True,
            "removed_items": removed_items,
            "compressed_items": compressed_items,
            "final_size": current_size,
            "target_size": target_size
        }
    
    def merge_contexts(self, source_session_id: str, target_session_id: str, 
                      conflict_strategy: str = "keep_newer") -> Dict[str, Any]:
        """컨텍스트 병합"""
        source_session = self.get_session(source_session_id)
        target_session = self.get_session(target_session_id)
        
        if not source_session or not target_session:
            return {"success": False, "error": "세션을 찾을 수 없습니다"}
        
        merged_items = []
        conflicts = []
        
        # 타겟 세션의 아이템들을 딕셔너리로 변환
        target_items_dict = {item.id: item for item in target_session.items}
        
        for source_item in source_session.items:
            if source_item.id in target_items_dict:
                # 충돌 처리
                target_item = target_items_dict[source_item.id]
                if conflict_strategy == "keep_newer":
                    if source_item.updated_at > target_item.accessed_at:
                        merged_items.append(source_item)
                        conflicts.append({"id": source_item.id, "strategy": "source_kept"})
                    else:
                        merged_items.append(target_item)
                        conflicts.append({"id": source_item.id, "strategy": "target_kept"})
                elif conflict_strategy == "keep_source":
                    merged_items.append(source_item)
                    conflicts.append({"id": source_item.id, "strategy": "source_kept"})
                elif conflict_strategy == "keep_target":
                    merged_items.append(target_item)
                    conflicts.append({"id": source_item.id, "strategy": "target_kept"})
            else:
                # 충돌 없음, 소스 아이템 추가
                merged_items.append(source_item)
        
        # 타겟 세션에 없는 아이템들 추가
        for target_item in target_session.items:
            if target_item.id not in [item.id for item in merged_items]:
                merged_items.append(target_item)
        
        # 타겟 세션 업데이트
        target_session.items = merged_items
        target_session.updated_at = datetime.now()
        
        # 캐시 업데이트
        for item in merged_items:
            self.context_cache[item.id] = item
        
        logger.info(f"컨텍스트 병합 완료: {source_session_id} -> {target_session_id}")
        
        return {
            "success": True,
            "merged_items": len(merged_items),
            "conflicts": conflicts,
            "conflict_strategy": conflict_strategy
        }
    
    def export_context(self, session_id: str, format: str = "json") -> str:
        """컨텍스트 내보내기"""
        session = self.get_session(session_id)
        if not session:
            return ""
        
        if format == "json":
            return json.dumps(session.to_dict(), ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"지원하지 않는 형식: {format}")
    
    def import_context(self, session_id: str, data: str, format: str = "json", 
                      merge_strategy: str = "replace") -> Dict[str, Any]:
        """컨텍스트 가져오기"""
        if format == "json":
            imported_data = json.loads(data)
        else:
            raise ValueError(f"지원하지 않는 형식: {format}")
        
        imported_session = ContextSession.from_dict(imported_data)
        
        if merge_strategy == "replace":
            # 기존 세션 교체
            self.sessions[session_id] = imported_session
            imported_session.session_id = session_id
            
            # 캐시 업데이트
            for item in imported_session.items:
                self.context_cache[item.id] = item
            
        elif merge_strategy == "merge":
            # 기존 세션과 병합
            existing_session = self.get_session(session_id)
            if existing_session:
                self.merge_contexts(imported_session.session_id, session_id)
            else:
                self.sessions[session_id] = imported_session
                imported_session.session_id = session_id
        
        logger.info(f"컨텍스트 가져오기 완료: {session_id}")
        
        return {
            "success": True,
            "imported_items": len(imported_session.items),
            "merge_strategy": merge_strategy
        }
    
    def _generate_item_id(self, session_id: str, context_type: ContextType, content: str) -> str:
        """아이템 ID 생성"""
        content_hash = hashlib.md5(content.encode()).hexdigest()[:8]
        timestamp = int(time.time())
        return f"{session_id}_{context_type.value}_{content_hash}_{timestamp}"
    
    def _compress_content(self, content: str) -> str:
        """내용 압축"""
        try:
            compressed = zlib.compress(content.encode('utf-8'))
            return compressed.hex()
        except Exception as e:
            logger.error(f"내용 압축 실패: {e}")
            return content
    
    def _decompress_content(self, compressed_content: str) -> str:
        """내용 압축 해제"""
        try:
            compressed_bytes = bytes.fromhex(compressed_content)
            return zlib.decompress(compressed_bytes).decode('utf-8')
        except Exception as e:
            logger.error(f"내용 압축 해제 실패: {e}")
            return compressed_content
    
    def _manage_session_size(self, session: ContextSession):
        """세션 크기 관리"""
        current_size = sum(item.size for item in session.items)
        
        # 크기 제한 초과 시 오래된 아이템 제거
        while (current_size > session.max_size or len(session.items) > session.max_items) and session.items:
            # 우선순위가 낮고 오래된 아이템 제거
            session.items.sort(key=lambda x: (x.priority, x.accessed_at))
            removed_item = session.items.pop(0)
            current_size -= removed_item.size
            
            # 캐시에서도 제거
            self.context_cache.pop(removed_item.id, None)
            
            logger.debug(f"컨텍스트 아이템 자동 제거: {removed_item.id}")
    
    def get_statistics(self) -> Dict[str, Any]:
        """서비스 통계 정보"""
        total_sessions = len(self.sessions)
        total_items = sum(len(session.items) for session in self.sessions.values())
        total_size = sum(sum(item.size for item in session.items) for session in self.sessions.values())
        
        type_distribution = {}
        for session in self.sessions.values():
            for item in session.items:
                type_distribution[item.type.value] = type_distribution.get(item.type.value, 0) + 1
        
        return {
            "total_sessions": total_sessions,
            "total_items": total_items,
            "total_size": total_size,
            "cache_size": len(self.context_cache),
            "type_distribution": type_distribution,
            "compressed_items": sum(
                sum(1 for item in session.items if item.compressed)
                for session in self.sessions.values()
            )
        }
