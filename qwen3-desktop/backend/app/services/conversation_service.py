import json
import os
import hashlib
import uuid
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
import sqlite3
import re
from difflib import unified_diff

from ..utils.logger import get_logger

logger = get_logger(__name__)


class ConversationStatus(Enum):
    """대화 상태"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class MessageRole(Enum):
    """메시지 역할"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


@dataclass
class Message:
    """메시지 정보"""
    id: str
    conversation_id: str
    role: MessageRole
    content: str
    timestamp: datetime
    metadata: Dict[str, Any] = None
    parent_id: Optional[str] = None
    branch_id: Optional[str] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role.value,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
            "parent_id": self.parent_id,
            "branch_id": self.branch_id
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Message':
        """딕셔너리에서 생성"""
        data["role"] = MessageRole(data["role"])
        data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return cls(**data)


@dataclass
class Conversation:
    """대화 정보"""
    id: str
    title: str
    status: ConversationStatus
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any] = None
    tags: List[str] = None
    parent_conversation_id: Optional[str] = None
    branch_id: Optional[str] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.tags is None:
            self.tags = []
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "id": self.id,
            "title": self.title,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "metadata": self.metadata,
            "tags": self.tags,
            "parent_conversation_id": self.parent_conversation_id,
            "branch_id": self.branch_id
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Conversation':
        """딕셔너리에서 생성"""
        data["status"] = ConversationStatus(data["status"])
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["updated_at"] = datetime.fromisoformat(data["updated_at"])
        return cls(**data)


class ConversationService:
    """고급 대화 관리 서비스"""
    
    def __init__(self, db_path: str = "data/conversations.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_database()
        logger.info("대화 관리 서비스 초기화 완료")
    
    def _init_database(self):
        """데이터베이스 초기화"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata TEXT,
                    tags TEXT,
                    parent_conversation_id TEXT,
                    branch_id TEXT
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    metadata TEXT,
                    parent_id TEXT,
                    branch_id TEXT,
                    FOREIGN KEY (conversation_id) REFERENCES conversations (id)
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_branches (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    branch_name TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    description TEXT,
                    FOREIGN KEY (conversation_id) REFERENCES conversations (id)
                )
            """)
            
            # 인덱스 생성
            conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations (status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations (updated_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_conversations_tags ON conversations (tags)")
    
    def create_conversation(self, title: str, initial_message: Optional[str] = None, 
                          tags: List[str] = None, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """새 대화 생성"""
        try:
            conversation_id = str(uuid.uuid4())
            now = datetime.now()
            
            conversation = Conversation(
                id=conversation_id,
                title=title,
                status=ConversationStatus.ACTIVE,
                created_at=now,
                updated_at=now,
                metadata=metadata or {},
                tags=tags or []
            )
            
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO conversations 
                    (id, title, status, created_at, updated_at, metadata, tags)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    conversation.id,
                    conversation.title,
                    conversation.status.value,
                    conversation.created_at.isoformat(),
                    conversation.updated_at.isoformat(),
                    json.dumps(conversation.metadata),
                    json.dumps(conversation.tags)
                ))
                
                # 초기 메시지가 있으면 추가
                if initial_message:
                    message_id = str(uuid.uuid4())
                    message = Message(
                        id=message_id,
                        conversation_id=conversation_id,
                        role=MessageRole.USER,
                        content=initial_message,
                        timestamp=now
                    )
                    
                    conn.execute("""
                        INSERT INTO messages 
                        (id, conversation_id, role, content, timestamp, metadata)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        message.id,
                        message.conversation_id,
                        message.role.value,
                        message.content,
                        message.timestamp.isoformat(),
                        json.dumps(message.metadata)
                    ))
            
            logger.info(f"대화 생성 완료: {title} ({conversation_id})")
            
            return {
                "success": True,
                "conversation": conversation.to_dict(),
                "message": f"대화 '{title}'이 생성되었습니다"
            }
            
        except Exception as e:
            logger.error(f"대화 생성 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "대화 생성 중 오류가 발생했습니다"
            }
    
    def add_message(self, conversation_id: str, role: MessageRole, content: str,
                   metadata: Dict[str, Any] = None, parent_id: Optional[str] = None) -> Dict[str, Any]:
        """메시지 추가"""
        try:
            message_id = str(uuid.uuid4())
            now = datetime.now()
            
            message = Message(
                id=message_id,
                conversation_id=conversation_id,
                role=role,
                content=content,
                timestamp=now,
                metadata=metadata or {},
                parent_id=parent_id
            )
            
            with sqlite3.connect(self.db_path) as conn:
                # 메시지 추가
                conn.execute("""
                    INSERT INTO messages 
                    (id, conversation_id, role, content, timestamp, metadata, parent_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    message.id,
                    message.conversation_id,
                    message.role.value,
                    message.content,
                    message.timestamp.isoformat(),
                    json.dumps(message.metadata),
                    message.parent_id
                ))
                
                # 대화 업데이트 시간 갱신
                conn.execute("""
                    UPDATE conversations 
                    SET updated_at = ? 
                    WHERE id = ?
                """, (now.isoformat(), conversation_id))
            
            logger.info(f"메시지 추가 완료: {conversation_id} -> {role.value}")
            
            return {
                "success": True,
                "message": message.to_dict(),
                "message_text": "메시지가 추가되었습니다"
            }
            
        except Exception as e:
            logger.error(f"메시지 추가 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "메시지 추가 중 오류가 발생했습니다"
            }
    
    def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """대화 조회"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT id, title, status, created_at, updated_at, metadata, tags,
                           parent_conversation_id, branch_id
                    FROM conversations 
                    WHERE id = ?
                """, (conversation_id,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                return Conversation(
                    id=row[0],
                    title=row[1],
                    status=ConversationStatus(row[2]),
                    created_at=datetime.fromisoformat(row[3]),
                    updated_at=datetime.fromisoformat(row[4]),
                    metadata=json.loads(row[5]) if row[5] else {},
                    tags=json.loads(row[6]) if row[6] else [],
                    parent_conversation_id=row[7],
                    branch_id=row[8]
                )
                
        except Exception as e:
            logger.error(f"대화 조회 실패: {e}")
            return None
    
    def get_messages(self, conversation_id: str, limit: int = 100, offset: int = 0) -> List[Message]:
        """메시지 목록 조회"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT id, conversation_id, role, content, timestamp, metadata, parent_id, branch_id
                    FROM messages 
                    WHERE conversation_id = ?
                    ORDER BY timestamp ASC
                    LIMIT ? OFFSET ?
                """, (conversation_id, limit, offset))
                
                messages = []
                for row in cursor.fetchall():
                    messages.append(Message(
                        id=row[0],
                        conversation_id=row[1],
                        role=MessageRole(row[2]),
                        content=row[3],
                        timestamp=datetime.fromisoformat(row[4]),
                        metadata=json.loads(row[5]) if row[5] else {},
                        parent_id=row[6],
                        branch_id=row[7]
                    ))
                
                return messages
                
        except Exception as e:
            logger.error(f"메시지 조회 실패: {e}")
            return []
    
    def get_all_conversations(self, status: Optional[ConversationStatus] = None,
                            limit: int = 100, offset: int = 0) -> List[Conversation]:
        """모든 대화 목록 조회"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                query = """
                    SELECT id, title, status, created_at, updated_at, metadata, tags,
                           parent_conversation_id, branch_id
                    FROM conversations
                """
                params = []
                
                if status:
                    query += " WHERE status = ?"
                    params.append(status.value)
                
                query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
                params.extend([limit, offset])
                
                cursor = conn.execute(query, params)
                
                conversations = []
                for row in cursor.fetchall():
                    conversations.append(Conversation(
                        id=row[0],
                        title=row[1],
                        status=ConversationStatus(row[2]),
                        created_at=datetime.fromisoformat(row[3]),
                        updated_at=datetime.fromisoformat(row[4]),
                        metadata=json.loads(row[5]) if row[5] else {},
                        tags=json.loads(row[6]) if row[6] else [],
                        parent_conversation_id=row[7],
                        branch_id=row[8]
                    ))
                
                return conversations
                
        except Exception as e:
            logger.error(f"대화 목록 조회 실패: {e}")
            return []
    
    def update_conversation(self, conversation_id: str, title: Optional[str] = None,
                          status: Optional[ConversationStatus] = None,
                          tags: Optional[List[str]] = None,
                          metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """대화 정보 업데이트"""
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                return {
                    "success": False,
                    "error": "대화를 찾을 수 없습니다",
                    "message": "존재하지 않는 대화입니다"
                }
            
            # 업데이트할 필드만 변경
            if title is not None:
                conversation.title = title
            if status is not None:
                conversation.status = status
            if tags is not None:
                conversation.tags = tags
            if metadata is not None:
                conversation.metadata = metadata
            
            conversation.updated_at = datetime.now()
            
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE conversations 
                    SET title = ?, status = ?, updated_at = ?, metadata = ?, tags = ?
                    WHERE id = ?
                """, (
                    conversation.title,
                    conversation.status.value,
                    conversation.updated_at.isoformat(),
                    json.dumps(conversation.metadata),
                    json.dumps(conversation.tags),
                    conversation_id
                ))
            
            logger.info(f"대화 업데이트 완료: {conversation_id}")
            
            return {
                "success": True,
                "conversation": conversation.to_dict(),
                "message": f"대화 '{conversation.title}'이 업데이트되었습니다"
            }
            
        except Exception as e:
            logger.error(f"대화 업데이트 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "대화 업데이트 중 오류가 발생했습니다"
            }
    
    def delete_conversation(self, conversation_id: str, permanent: bool = False) -> Dict[str, Any]:
        """대화 삭제"""
        try:
            if permanent:
                # 영구 삭제
                with sqlite3.connect(self.db_path) as conn:
                    # 메시지 먼저 삭제
                    conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
                    # 대화 삭제
                    conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
                
                logger.info(f"대화 영구 삭제 완료: {conversation_id}")
                return {
                    "success": True,
                    "message": "대화가 영구적으로 삭제되었습니다"
                }
            else:
                # 소프트 삭제 (상태 변경)
                result = self.update_conversation(conversation_id, status=ConversationStatus.DELETED)
                if result["success"]:
                    logger.info(f"대화 삭제 완료: {conversation_id}")
                    return {
                        "success": True,
                        "message": "대화가 삭제되었습니다"
                    }
                return result
            
        except Exception as e:
            logger.error(f"대화 삭제 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "대화 삭제 중 오류가 발생했습니다"
            }
    
    def create_branch(self, conversation_id: str, branch_name: str, 
                     description: Optional[str] = None, created_by: str = "user") -> Dict[str, Any]:
        """대화 분기 생성"""
        try:
            branch_id = str(uuid.uuid4())
            now = datetime.now()
            
            # 원본 대화 조회
            original_conversation = self.get_conversation(conversation_id)
            if not original_conversation:
                return {
                    "success": False,
                    "error": "원본 대화를 찾을 수 없습니다",
                    "message": "존재하지 않는 대화입니다"
                }
            
            # 분기 대화 생성
            branch_conversation = Conversation(
                id=str(uuid.uuid4()),
                title=f"{original_conversation.title} - {branch_name}",
                status=ConversationStatus.ACTIVE,
                created_at=now,
                updated_at=now,
                metadata={
                    **original_conversation.metadata,
                    "branch_name": branch_name,
                    "original_conversation_id": conversation_id
                },
                tags=original_conversation.tags + [f"branch:{branch_name}"],
                parent_conversation_id=conversation_id,
                branch_id=branch_id
            )
            
            with sqlite3.connect(self.db_path) as conn:
                # 분기 대화 저장
                conn.execute("""
                    INSERT INTO conversations 
                    (id, title, status, created_at, updated_at, metadata, tags, 
                     parent_conversation_id, branch_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    branch_conversation.id,
                    branch_conversation.title,
                    branch_conversation.status.value,
                    branch_conversation.created_at.isoformat(),
                    branch_conversation.updated_at.isoformat(),
                    json.dumps(branch_conversation.metadata),
                    json.dumps(branch_conversation.tags),
                    branch_conversation.parent_conversation_id,
                    branch_conversation.branch_id
                ))
                
                # 분기 정보 저장
                conn.execute("""
                    INSERT INTO conversation_branches 
                    (id, conversation_id, branch_name, created_at, created_by, description)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    branch_id,
                    conversation_id,
                    branch_name,
                    now.isoformat(),
                    created_by,
                    description
                ))
                
                # 원본 메시지들을 분기에 복사
                original_messages = self.get_messages(conversation_id)
                for message in original_messages:
                    new_message_id = str(uuid.uuid4())
                    new_message = Message(
                        id=new_message_id,
                        conversation_id=branch_conversation.id,
                        role=message.role,
                        content=message.content,
                        timestamp=message.timestamp,
                        metadata={
                            **message.metadata,
                            "original_message_id": message.id,
                            "branch_id": branch_id
                        },
                        parent_id=message.parent_id,
                        branch_id=branch_id
                    )
                    
                    conn.execute("""
                        INSERT INTO messages 
                        (id, conversation_id, role, content, timestamp, metadata, parent_id, branch_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        new_message.id,
                        new_message.conversation_id,
                        new_message.role.value,
                        new_message.content,
                        new_message.timestamp.isoformat(),
                        json.dumps(new_message.metadata),
                        new_message.parent_id,
                        new_message.branch_id
                    ))
            
            logger.info(f"대화 분기 생성 완료: {conversation_id} -> {branch_name}")
            
            return {
                "success": True,
                "branch_conversation": branch_conversation.to_dict(),
                "branch_id": branch_id,
                "message": f"대화 분기 '{branch_name}'이 생성되었습니다"
            }
            
        except Exception as e:
            logger.error(f"대화 분기 생성 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "대화 분기 생성 중 오류가 발생했습니다"
            }
    
    def merge_conversations(self, source_conversation_id: str, target_conversation_id: str,
                          merge_strategy: str = "append") -> Dict[str, Any]:
        """대화 병합"""
        try:
            source_conversation = self.get_conversation(source_conversation_id)
            target_conversation = self.get_conversation(target_conversation_id)
            
            if not source_conversation or not target_conversation:
                return {
                    "success": False,
                    "error": "대화를 찾을 수 없습니다",
                    "message": "존재하지 않는 대화입니다"
                }
            
            source_messages = self.get_messages(source_conversation_id)
            target_messages = self.get_messages(target_conversation_id)
            
            if merge_strategy == "append":
                # 메시지를 끝에 추가
                for message in source_messages:
                    self.add_message(
                        target_conversation_id,
                        message.role,
                        message.content,
                        {
                            **message.metadata,
                            "merged_from": source_conversation_id,
                            "merge_timestamp": datetime.now().isoformat()
                        }
                    )
                
                # 소스 대화를 아카이브
                self.update_conversation(source_conversation_id, status=ConversationStatus.ARCHIVED)
                
            elif merge_strategy == "interleave":
                # 메시지를 시간순으로 교차 배치
                all_messages = []
                for msg in source_messages:
                    all_messages.append((msg.timestamp, msg, "source"))
                for msg in target_messages:
                    all_messages.append((msg.timestamp, msg, "target"))
                
                all_messages.sort(key=lambda x: x[0])
                
                # 새로운 대화 생성
                merged_conversation = self.create_conversation(
                    f"{target_conversation.title} (병합)",
                    tags=target_conversation.tags + source_conversation.tags + ["merged"],
                    metadata={
                        "merged_from": [source_conversation_id, target_conversation_id],
                        "merge_strategy": merge_strategy,
                        "merge_timestamp": datetime.now().isoformat()
                    }
                )
                
                if merged_conversation["success"]:
                    merged_id = merged_conversation["conversation"]["id"]
                    for _, message, source in all_messages:
                        self.add_message(
                            merged_id,
                            message.role,
                            message.content,
                            {
                                **message.metadata,
                                "original_conversation": source,
                                "merge_timestamp": datetime.now().isoformat()
                            }
                        )
                    
                    # 원본 대화들을 아카이브
                    self.update_conversation(source_conversation_id, status=ConversationStatus.ARCHIVED)
                    self.update_conversation(target_conversation_id, status=ConversationStatus.ARCHIVED)
            
            logger.info(f"대화 병합 완료: {source_conversation_id} + {target_conversation_id}")
            
            return {
                "success": True,
                "message": f"대화가 성공적으로 병합되었습니다 (전략: {merge_strategy})"
            }
            
        except Exception as e:
            logger.error(f"대화 병합 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "대화 병합 중 오류가 발생했습니다"
            }
    
    def export_conversation(self, conversation_id: str, format: str = "json") -> Dict[str, Any]:
        """대화 내보내기"""
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                return {
                    "success": False,
                    "error": "대화를 찾을 수 없습니다",
                    "message": "존재하지 않는 대화입니다"
                }
            
            messages = self.get_messages(conversation_id)
            
            if format == "json":
                export_data = {
                    "conversation": conversation.to_dict(),
                    "messages": [msg.to_dict() for msg in messages],
                    "exported_at": datetime.now().isoformat(),
                    "format": "json"
                }
                
                return {
                    "success": True,
                    "data": export_data,
                    "format": "json"
                }
            
            elif format == "markdown":
                markdown_content = f"# {conversation.title}\n\n"
                markdown_content += f"**생성일**: {conversation.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
                markdown_content += f"**태그**: {', '.join(conversation.tags)}\n\n"
                markdown_content += "---\n\n"
                
                for message in messages:
                    role_emoji = "👤" if message.role == MessageRole.USER else "🤖"
                    markdown_content += f"## {role_emoji} {message.role.value.title()}\n\n"
                    markdown_content += f"{message.content}\n\n"
                    markdown_content += f"*{message.timestamp.strftime('%Y-%m-%d %H:%M:%S')}*\n\n"
                    markdown_content += "---\n\n"
                
                return {
                    "success": True,
                    "data": markdown_content,
                    "format": "markdown"
                }
            
            else:
                return {
                    "success": False,
                    "error": "지원하지 않는 형식입니다",
                    "message": "지원되는 형식: json, markdown"
                }
            
        except Exception as e:
            logger.error(f"대화 내보내기 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "대화 내보내기 중 오류가 발생했습니다"
            }
    
    def import_conversation(self, import_data: Dict[str, Any], format: str = "json") -> Dict[str, Any]:
        """대화 가져오기"""
        try:
            if format == "json":
                conversation_data = import_data.get("conversation", {})
                messages_data = import_data.get("messages", [])
                
                # 대화 생성
                conversation = self.create_conversation(
                    conversation_data.get("title", "가져온 대화"),
                    tags=conversation_data.get("tags", []),
                    metadata={
                        **conversation_data.get("metadata", {}),
                        "imported_at": datetime.now().isoformat(),
                        "original_id": conversation_data.get("id")
                    }
                )
                
                if not conversation["success"]:
                    return conversation
                
                conversation_id = conversation["conversation"]["id"]
                
                # 메시지 추가
                for message_data in messages_data:
                    self.add_message(
                        conversation_id,
                        MessageRole(message_data["role"]),
                        message_data["content"],
                        {
                            **message_data.get("metadata", {}),
                            "imported_at": datetime.now().isoformat(),
                            "original_message_id": message_data.get("id")
                        }
                    )
                
                return {
                    "success": True,
                    "conversation_id": conversation_id,
                    "message": "대화가 성공적으로 가져와졌습니다"
                }
            
            elif format == "markdown":
                # 마크다운 파싱 (간단한 구현)
                content = import_data.get("content", "")
                lines = content.split('\n')
                
                title = "가져온 대화"
                messages = []
                current_role = None
                current_content = []
                
                for line in lines:
                    if line.startswith('# '):
                        title = line[2:].strip()
                    elif line.startswith('## 👤 User'):
                        if current_role and current_content:
                            messages.append((current_role, '\n'.join(current_content)))
                        current_role = MessageRole.USER
                        current_content = []
                    elif line.startswith('## 🤖 Assistant'):
                        if current_role and current_content:
                            messages.append((current_role, '\n'.join(current_content)))
                        current_role = MessageRole.ASSISTANT
                        current_content = []
                    elif line.startswith('---') or line.startswith('*'):
                        continue
                    elif line.strip() and current_role:
                        current_content.append(line)
                
                if current_role and current_content:
                    messages.append((current_role, '\n'.join(current_content)))
                
                # 대화 생성
                conversation = self.create_conversation(
                    title,
                    metadata={"imported_from": "markdown", "imported_at": datetime.now().isoformat()}
                )
                
                if not conversation["success"]:
                    return conversation
                
                conversation_id = conversation["conversation"]["id"]
                
                # 메시지 추가
                for role, content in messages:
                    self.add_message(conversation_id, role, content.strip())
                
                return {
                    "success": True,
                    "conversation_id": conversation_id,
                    "message": "마크다운 대화가 성공적으로 가져와졌습니다"
                }
            
            else:
                return {
                    "success": False,
                    "error": "지원하지 않는 형식입니다",
                    "message": "지원되는 형식: json, markdown"
                }
            
        except Exception as e:
            logger.error(f"대화 가져오기 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "대화 가져오기 중 오류가 발생했습니다"
            }
    
    def search_conversations(self, query: str, search_type: str = "content") -> List[Dict[str, Any]]:
        """대화 검색"""
        try:
            results = []
            
            if search_type == "content":
                # 메시지 내용 검색
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute("""
                        SELECT DISTINCT c.id, c.title, c.status, c.created_at, c.updated_at,
                               c.metadata, c.tags, c.parent_conversation_id, c.branch_id
                        FROM conversations c
                        JOIN messages m ON c.id = m.conversation_id
                        WHERE m.content LIKE ? AND c.status != 'deleted'
                        ORDER BY c.updated_at DESC
                    """, (f"%{query}%",))
                    
                    for row in cursor.fetchall():
                        conversation = Conversation(
                            id=row[0],
                            title=row[1],
                            status=ConversationStatus(row[2]),
                            created_at=datetime.fromisoformat(row[3]),
                            updated_at=datetime.fromisoformat(row[4]),
                            metadata=json.loads(row[5]) if row[5] else {},
                            tags=json.loads(row[6]) if row[6] else [],
                            parent_conversation_id=row[7],
                            branch_id=row[8]
                        )
                        results.append({
                            "conversation": conversation.to_dict(),
                            "match_type": "content",
                            "query": query
                        })
            
            elif search_type == "title":
                # 제목 검색
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute("""
                        SELECT id, title, status, created_at, updated_at,
                               metadata, tags, parent_conversation_id, branch_id
                        FROM conversations
                        WHERE title LIKE ? AND status != 'deleted'
                        ORDER BY updated_at DESC
                    """, (f"%{query}%",))
                    
                    for row in cursor.fetchall():
                        conversation = Conversation(
                            id=row[0],
                            title=row[1],
                            status=ConversationStatus(row[2]),
                            created_at=datetime.fromisoformat(row[3]),
                            updated_at=datetime.fromisoformat(row[4]),
                            metadata=json.loads(row[5]) if row[5] else {},
                            tags=json.loads(row[6]) if row[6] else [],
                            parent_conversation_id=row[7],
                            branch_id=row[8]
                        )
                        results.append({
                            "conversation": conversation.to_dict(),
                            "match_type": "title",
                            "query": query
                        })
            
            elif search_type == "tags":
                # 태그 검색
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute("""
                        SELECT id, title, status, created_at, updated_at,
                               metadata, tags, parent_conversation_id, branch_id
                        FROM conversations
                        WHERE tags LIKE ? AND status != 'deleted'
                        ORDER BY updated_at DESC
                    """, (f"%{query}%",))
                    
                    for row in cursor.fetchall():
                        conversation = Conversation(
                            id=row[0],
                            title=row[1],
                            status=ConversationStatus(row[2]),
                            created_at=datetime.fromisoformat(row[3]),
                            updated_at=datetime.fromisoformat(row[4]),
                            metadata=json.loads(row[5]) if row[5] else {},
                            tags=json.loads(row[6]) if row[6] else [],
                            parent_conversation_id=row[7],
                            branch_id=row[8]
                        )
                        results.append({
                            "conversation": conversation.to_dict(),
                            "match_type": "tags",
                            "query": query
                        })
            
            return results
            
        except Exception as e:
            logger.error(f"대화 검색 실패: {e}")
            return []
    
    def get_conversation_statistics(self) -> Dict[str, Any]:
        """대화 통계 정보"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 전체 대화 수
                total_conversations = conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]
                
                # 상태별 대화 수
                status_counts = {}
                cursor = conn.execute("""
                    SELECT status, COUNT(*) FROM conversations GROUP BY status
                """)
                for row in cursor.fetchall():
                    status_counts[row[0]] = row[1]
                
                # 전체 메시지 수
                total_messages = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
                
                # 역할별 메시지 수
                role_counts = {}
                cursor = conn.execute("""
                    SELECT role, COUNT(*) FROM messages GROUP BY role
                """)
                for row in cursor.fetchall():
                    role_counts[row[0]] = row[1]
                
                # 분기 수
                total_branches = conn.execute("SELECT COUNT(*) FROM conversation_branches").fetchone()[0]
                
                return {
                    "total_conversations": total_conversations,
                    "status_distribution": status_counts,
                    "total_messages": total_messages,
                    "role_distribution": role_counts,
                    "total_branches": total_branches,
                    "last_updated": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"대화 통계 조회 실패: {e}")
            return {}
