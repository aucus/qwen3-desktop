import json
import os
import hashlib
import hmac
import base64
import secrets
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
import sqlite3
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from ..utils.logger import get_logger

logger = get_logger(__name__)


class KeyStatus(Enum):
    """API 키 상태"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    EXPIRED = "expired"
    REVOKED = "revoked"


class KeyPermission(Enum):
    """API 키 권한"""
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    PLUGIN = "plugin"
    FILE_ACCESS = "file_access"
    MCP_ACCESS = "mcp_access"


@dataclass
class APIKey:
    """API 키 정보"""
    id: str
    name: str
    key_hash: str
    permissions: List[KeyPermission]
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime]
    usage_count: int
    status: KeyStatus
    description: Optional[str] = None
    tags: List[str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "id": self.id,
            "name": self.name,
            "permissions": [perm.value for perm in self.permissions],
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_used": self.last_used.isoformat() if self.last_used else None,
            "usage_count": self.usage_count,
            "status": self.status.value,
            "description": self.description,
            "tags": self.tags
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'APIKey':
        """딕셔너리에서 생성"""
        data["permissions"] = [KeyPermission(perm) for perm in data["permissions"]]
        data["status"] = KeyStatus(data["status"])
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        if data["expires_at"]:
            data["expires_at"] = datetime.fromisoformat(data["expires_at"])
        if data["last_used"]:
            data["last_used"] = datetime.fromisoformat(data["last_used"])
        return cls(**data)


@dataclass
class KeyUsage:
    """API 키 사용 기록"""
    key_id: str
    timestamp: datetime
    endpoint: str
    method: str
    status_code: int
    response_time: float
    ip_address: str
    user_agent: str
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "key_id": self.key_id,
            "timestamp": self.timestamp.isoformat(),
            "endpoint": self.endpoint,
            "method": self.method,
            "status_code": self.status_code,
            "response_time": self.response_time,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent
        }


class APIKeyService:
    """API 키 관리 서비스"""
    
    def __init__(self, db_path: str = "data/api_keys.db", encryption_key: str = None):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 암호화 키 설정
        if encryption_key:
            self.encryption_key = self._derive_key(encryption_key)
        else:
            # 기본 암호화 키 생성
            self.encryption_key = Fernet.generate_key()
        
        self.cipher = Fernet(self.encryption_key)
        self._init_database()
        logger.info("API 키 서비스 초기화 완료")
    
    def _derive_key(self, password: str) -> bytes:
        """패스워드에서 암호화 키 생성"""
        salt = b'api_key_salt'  # 실제로는 랜덤 솔트 사용
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))
    
    def _init_database(self):
        """데이터베이스 초기화"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS api_keys (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    key_hash TEXT NOT NULL,
                    permissions TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT,
                    last_used TEXT,
                    usage_count INTEGER DEFAULT 0,
                    status TEXT NOT NULL,
                    description TEXT,
                    tags TEXT
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS key_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    endpoint TEXT NOT NULL,
                    method TEXT NOT NULL,
                    status_code INTEGER NOT NULL,
                    response_time REAL NOT NULL,
                    ip_address TEXT NOT NULL,
                    user_agent TEXT NOT NULL,
                    FOREIGN KEY (key_id) REFERENCES api_keys (id)
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_key_usage_key_id 
                ON key_usage (key_id)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_key_usage_timestamp 
                ON key_usage (timestamp)
            """)
    
    def _encrypt(self, data: str) -> str:
        """데이터 암호화"""
        return self.cipher.encrypt(data.encode()).decode()
    
    def _decrypt(self, encrypted_data: str) -> str:
        """데이터 복호화"""
        return self.cipher.decrypt(encrypted_data.encode()).decode()
    
    def _hash_key(self, key: str) -> str:
        """API 키 해시"""
        return hashlib.sha256(key.encode()).hexdigest()
    
    def _generate_key(self) -> str:
        """새 API 키 생성"""
        return f"qwen_{secrets.token_urlsafe(32)}"
    
    def create_api_key(self, name: str, permissions: List[KeyPermission], 
                      expires_at: Optional[datetime] = None, 
                      description: Optional[str] = None,
                      tags: List[str] = None) -> Dict[str, Any]:
        """API 키 생성"""
        try:
            key_id = secrets.token_urlsafe(16)
            api_key = self._generate_key()
            key_hash = self._hash_key(api_key)
            
            # 데이터베이스에 저장
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO api_keys 
                    (id, name, key_hash, permissions, created_at, expires_at, 
                     status, description, tags)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    key_id,
                    name,
                    key_hash,
                    json.dumps([perm.value for perm in permissions]),
                    datetime.now().isoformat(),
                    expires_at.isoformat() if expires_at else None,
                    KeyStatus.ACTIVE.value,
                    description,
                    json.dumps(tags or [])
                ))
            
            # API 키 객체 생성
            api_key_obj = APIKey(
                id=key_id,
                name=name,
                key_hash=key_hash,
                permissions=permissions,
                created_at=datetime.now(),
                expires_at=expires_at,
                last_used=None,
                usage_count=0,
                status=KeyStatus.ACTIVE,
                description=description,
                tags=tags or []
            )
            
            logger.info(f"API 키 생성 완료: {name} ({key_id})")
            
            return {
                "success": True,
                "api_key": api_key,
                "key_info": api_key_obj.to_dict(),
                "message": f"API 키 '{name}'이 성공적으로 생성되었습니다"
            }
            
        except Exception as e:
            logger.error(f"API 키 생성 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "API 키 생성 중 오류가 발생했습니다"
            }
    
    def validate_api_key(self, api_key: str) -> Optional[APIKey]:
        """API 키 검증"""
        try:
            key_hash = self._hash_key(api_key)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT id, name, key_hash, permissions, created_at, expires_at,
                           last_used, usage_count, status, description, tags
                    FROM api_keys 
                    WHERE key_hash = ?
                """, (key_hash,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                # API 키 객체 생성
                api_key_obj = APIKey(
                    id=row[0],
                    name=row[1],
                    key_hash=row[2],
                    permissions=[KeyPermission(perm) for perm in json.loads(row[3])],
                    created_at=datetime.fromisoformat(row[4]),
                    expires_at=datetime.fromisoformat(row[5]) if row[5] else None,
                    last_used=datetime.fromisoformat(row[6]) if row[6] else None,
                    usage_count=row[7],
                    status=KeyStatus(row[8]),
                    description=row[9],
                    tags=json.loads(row[10]) if row[10] else []
                )
                
                # 상태 확인
                if api_key_obj.status != KeyStatus.ACTIVE:
                    return None
                
                # 만료 확인
                if api_key_obj.expires_at and api_key_obj.expires_at < datetime.now():
                    # 만료 상태로 업데이트
                    self._update_key_status(api_key_obj.id, KeyStatus.EXPIRED)
                    return None
                
                return api_key_obj
                
        except Exception as e:
            logger.error(f"API 키 검증 실패: {e}")
            return None
    
    def update_key_usage(self, key_id: str, endpoint: str, method: str, 
                        status_code: int, response_time: float, 
                        ip_address: str, user_agent: str):
        """API 키 사용 기록 업데이트"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 사용 기록 저장
                conn.execute("""
                    INSERT INTO key_usage 
                    (key_id, timestamp, endpoint, method, status_code, 
                     response_time, ip_address, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    key_id,
                    datetime.now().isoformat(),
                    endpoint,
                    method,
                    status_code,
                    response_time,
                    ip_address,
                    user_agent
                ))
                
                # 마지막 사용 시간 및 사용 횟수 업데이트
                conn.execute("""
                    UPDATE api_keys 
                    SET last_used = ?, usage_count = usage_count + 1
                    WHERE id = ?
                """, (datetime.now().isoformat(), key_id))
                
        except Exception as e:
            logger.error(f"API 키 사용 기록 업데이트 실패: {e}")
    
    def get_api_key(self, key_id: str) -> Optional[APIKey]:
        """API 키 정보 조회"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT id, name, key_hash, permissions, created_at, expires_at,
                           last_used, usage_count, status, description, tags
                    FROM api_keys 
                    WHERE id = ?
                """, (key_id,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                return APIKey(
                    id=row[0],
                    name=row[1],
                    key_hash=row[2],
                    permissions=[KeyPermission(perm) for perm in json.loads(row[3])],
                    created_at=datetime.fromisoformat(row[4]),
                    expires_at=datetime.fromisoformat(row[5]) if row[5] else None,
                    last_used=datetime.fromisoformat(row[6]) if row[6] else None,
                    usage_count=row[7],
                    status=KeyStatus(row[8]),
                    description=row[9],
                    tags=json.loads(row[10]) if row[10] else []
                )
                
        except Exception as e:
            logger.error(f"API 키 조회 실패: {e}")
            return None
    
    def get_all_api_keys(self) -> List[APIKey]:
        """모든 API 키 목록 조회"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT id, name, key_hash, permissions, created_at, expires_at,
                           last_used, usage_count, status, description, tags
                    FROM api_keys 
                    ORDER BY created_at DESC
                """)
                
                api_keys = []
                for row in cursor.fetchall():
                    api_keys.append(APIKey(
                        id=row[0],
                        name=row[1],
                        key_hash=row[2],
                        permissions=[KeyPermission(perm) for perm in json.loads(row[3])],
                        created_at=datetime.fromisoformat(row[4]),
                        expires_at=datetime.fromisoformat(row[5]) if row[5] else None,
                        last_used=datetime.fromisoformat(row[6]) if row[6] else None,
                        usage_count=row[7],
                        status=KeyStatus(row[8]),
                        description=row[9],
                        tags=json.loads(row[10]) if row[10] else []
                    ))
                
                return api_keys
                
        except Exception as e:
            logger.error(f"API 키 목록 조회 실패: {e}")
            return []
    
    def update_api_key(self, key_id: str, name: Optional[str] = None,
                      permissions: Optional[List[KeyPermission]] = None,
                      expires_at: Optional[datetime] = None,
                      description: Optional[str] = None,
                      tags: Optional[List[str]] = None) -> Dict[str, Any]:
        """API 키 정보 업데이트"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 현재 키 정보 조회
                current_key = self.get_api_key(key_id)
                if not current_key:
                    return {
                        "success": False,
                        "error": "API 키를 찾을 수 없습니다",
                        "message": "존재하지 않는 API 키입니다"
                    }
                
                # 업데이트할 필드만 변경
                if name is not None:
                    current_key.name = name
                if permissions is not None:
                    current_key.permissions = permissions
                if expires_at is not None:
                    current_key.expires_at = expires_at
                if description is not None:
                    current_key.description = description
                if tags is not None:
                    current_key.tags = tags
                
                # 데이터베이스 업데이트
                conn.execute("""
                    UPDATE api_keys 
                    SET name = ?, permissions = ?, expires_at = ?, 
                        description = ?, tags = ?
                    WHERE id = ?
                """, (
                    current_key.name,
                    json.dumps([perm.value for perm in current_key.permissions]),
                    current_key.expires_at.isoformat() if current_key.expires_at else None,
                    current_key.description,
                    json.dumps(current_key.tags),
                    key_id
                ))
                
                logger.info(f"API 키 업데이트 완료: {key_id}")
                
                return {
                    "success": True,
                    "key_info": current_key.to_dict(),
                    "message": f"API 키 '{current_key.name}'이 업데이트되었습니다"
                }
                
        except Exception as e:
            logger.error(f"API 키 업데이트 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "API 키 업데이트 중 오류가 발생했습니다"
            }
    
    def revoke_api_key(self, key_id: str) -> Dict[str, Any]:
        """API 키 폐기"""
        try:
            result = self._update_key_status(key_id, KeyStatus.REVOKED)
            if result["success"]:
                logger.info(f"API 키 폐기 완료: {key_id}")
                return {
                    "success": True,
                    "message": "API 키가 성공적으로 폐기되었습니다"
                }
            return result
            
        except Exception as e:
            logger.error(f"API 키 폐기 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "API 키 폐기 중 오류가 발생했습니다"
            }
    
    def delete_api_key(self, key_id: str) -> Dict[str, Any]:
        """API 키 삭제"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 사용 기록 먼저 삭제
                conn.execute("DELETE FROM key_usage WHERE key_id = ?", (key_id,))
                
                # API 키 삭제
                cursor = conn.execute("DELETE FROM api_keys WHERE id = ?", (key_id,))
                
                if cursor.rowcount == 0:
                    return {
                        "success": False,
                        "error": "API 키를 찾을 수 없습니다",
                        "message": "존재하지 않는 API 키입니다"
                    }
                
                logger.info(f"API 키 삭제 완료: {key_id}")
                
                return {
                    "success": True,
                    "message": "API 키가 성공적으로 삭제되었습니다"
                }
                
        except Exception as e:
            logger.error(f"API 키 삭제 실패: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "API 키 삭제 중 오류가 발생했습니다"
            }
    
    def _update_key_status(self, key_id: str, status: KeyStatus) -> Dict[str, Any]:
        """API 키 상태 업데이트"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    UPDATE api_keys SET status = ? WHERE id = ?
                """, (status.value, key_id))
                
                if cursor.rowcount == 0:
                    return {
                        "success": False,
                        "error": "API 키를 찾을 수 없습니다"
                    }
                
                return {"success": True}
                
        except Exception as e:
            logger.error(f"API 키 상태 업데이트 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_key_usage(self, key_id: str, limit: int = 100) -> List[KeyUsage]:
        """API 키 사용 기록 조회"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT key_id, timestamp, endpoint, method, status_code,
                           response_time, ip_address, user_agent
                    FROM key_usage 
                    WHERE key_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (key_id, limit))
                
                usage_records = []
                for row in cursor.fetchall():
                    usage_records.append(KeyUsage(
                        key_id=row[0],
                        timestamp=datetime.fromisoformat(row[1]),
                        endpoint=row[2],
                        method=row[3],
                        status_code=row[4],
                        response_time=row[5],
                        ip_address=row[6],
                        user_agent=row[7]
                    ))
                
                return usage_records
                
        except Exception as e:
            logger.error(f"API 키 사용 기록 조회 실패: {e}")
            return []
    
    def get_key_statistics(self) -> Dict[str, Any]:
        """API 키 통계 정보"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 전체 키 수
                total_keys = conn.execute("SELECT COUNT(*) FROM api_keys").fetchone()[0]
                
                # 상태별 키 수
                status_counts = {}
                cursor = conn.execute("""
                    SELECT status, COUNT(*) FROM api_keys GROUP BY status
                """)
                for row in cursor.fetchall():
                    status_counts[row[0]] = row[1]
                
                # 최근 사용된 키 수 (7일)
                recent_usage = conn.execute("""
                    SELECT COUNT(DISTINCT key_id) FROM key_usage 
                    WHERE timestamp > ?
                """, ((datetime.now() - timedelta(days=7)).isoformat(),)).fetchone()[0]
                
                # 총 사용 횟수
                total_usage = conn.execute("SELECT COUNT(*) FROM key_usage").fetchone()[0]
                
                return {
                    "total_keys": total_keys,
                    "status_distribution": status_counts,
                    "recent_usage": recent_usage,
                    "total_usage": total_usage,
                    "last_updated": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"API 키 통계 조회 실패: {e}")
            return {}
    
    def cleanup_expired_keys(self) -> int:
        """만료된 API 키 정리"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # 만료된 키 찾기
                expired_keys = conn.execute("""
                    SELECT id FROM api_keys 
                    WHERE expires_at IS NOT NULL AND expires_at < ? AND status = 'active'
                """, (datetime.now().isoformat(),)).fetchall()
                
                # 상태를 만료로 업데이트
                count = 0
                for (key_id,) in expired_keys:
                    conn.execute("""
                        UPDATE api_keys SET status = ? WHERE id = ?
                    """, (KeyStatus.EXPIRED.value, key_id))
                    count += 1
                
                logger.info(f"만료된 API 키 {count}개 정리 완료")
                return count
                
        except Exception as e:
            logger.error(f"만료된 API 키 정리 실패: {e}")
            return 0
    
    def export_keys(self) -> Dict[str, Any]:
        """API 키 내보내기"""
        try:
            keys = self.get_all_api_keys()
            export_data = {
                "exported_at": datetime.now().isoformat(),
                "total_keys": len(keys),
                "keys": [key.to_dict() for key in keys]
            }
            
            return {
                "success": True,
                "data": export_data
            }
            
        except Exception as e:
            logger.error(f"API 키 내보내기 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def import_keys(self, import_data: Dict[str, Any]) -> Dict[str, Any]:
        """API 키 가져오기"""
        try:
            imported_count = 0
            skipped_count = 0
            
            for key_data in import_data.get("keys", []):
                try:
                    # 기존 키 확인
                    existing_key = self.get_api_key(key_data["id"])
                    if existing_key:
                        skipped_count += 1
                        continue
                    
                    # 새 키 생성
                    api_key_obj = APIKey.from_dict(key_data)
                    
                    with sqlite3.connect(self.db_path) as conn:
                        conn.execute("""
                            INSERT INTO api_keys 
                            (id, name, key_hash, permissions, created_at, expires_at,
                             last_used, usage_count, status, description, tags)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            api_key_obj.id,
                            api_key_obj.name,
                            api_key_obj.key_hash,
                            json.dumps([perm.value for perm in api_key_obj.permissions]),
                            api_key_obj.created_at.isoformat(),
                            api_key_obj.expires_at.isoformat() if api_key_obj.expires_at else None,
                            api_key_obj.last_used.isoformat() if api_key_obj.last_used else None,
                            api_key_obj.usage_count,
                            api_key_obj.status.value,
                            api_key_obj.description,
                            json.dumps(api_key_obj.tags)
                        ))
                    
                    imported_count += 1
                    
                except Exception as e:
                    logger.error(f"키 가져오기 실패: {key_data.get('id', 'unknown')} - {e}")
                    skipped_count += 1
            
            return {
                "success": True,
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "message": f"{imported_count}개 키 가져오기 완료, {skipped_count}개 건너뜀"
            }
            
        except Exception as e:
            logger.error(f"API 키 가져오기 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
