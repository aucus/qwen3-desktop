import json
import os
import shutil
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
import sqlite3
import zipfile
import hashlib
from cryptography.fernet import Fernet

from ..utils.logger import get_logger

logger = get_logger(__name__)


class SettingCategory(Enum):
    """설정 카테고리"""
    GENERAL = "general"
    MODEL = "model"
    PERFORMANCE = "performance"
    SECURITY = "security"
    UI = "ui"
    PLUGINS = "plugins"
    BACKUP = "backup"


class SettingType(Enum):
    """설정 타입"""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    ARRAY = "array"
    OBJECT = "object"
    ENUM = "enum"


@dataclass
class SettingDefinition:
    """설정 정의"""
    key: str
    name: str
    description: str
    category: SettingCategory
    type: SettingType
    default_value: Any
    validation_rules: Dict[str, Any] = None
    options: List[Any] = None
    required: bool = True
    sensitive: bool = False
    
    def __post_init__(self):
        if self.validation_rules is None:
            self.validation_rules = {}
        if self.options is None:
            self.options = []
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "type": self.type.value,
            "default_value": self.default_value,
            "validation_rules": self.validation_rules,
            "options": self.options,
            "required": self.required,
            "sensitive": self.sensitive
        }


@dataclass
class SettingValue:
    """설정 값"""
    key: str
    value: Any
    updated_at: datetime
    updated_by: str = "system"
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환"""
        return {
            "key": self.key,
            "value": self.value,
            "updated_at": self.updated_at.isoformat(),
            "updated_by": self.updated_by
        }


class SettingsService:
    """고급 설정 관리 서비스"""
    
    def __init__(self, settings_dir: str = "data/settings", encryption_key: str = None):
        self.settings_dir = Path(settings_dir)
        self.settings_dir.mkdir(parents=True, exist_ok=True)
        
        # 암호화 키 설정
        if encryption_key:
            self.encryption_key = self._derive_key(encryption_key)
        else:
            self.encryption_key = Fernet.generate_key()
        
        self.cipher = Fernet(self.encryption_key)
        self.settings_db = self.settings_dir / "settings.db"
        self.backup_dir = self.settings_dir / "backups"
        self.backup_dir.mkdir(exist_ok=True)
        
        self._init_database()
        self._init_default_settings()
        logger.info("설정 서비스 초기화 완료")
    
    def _derive_key(self, password: str) -> bytes:
        """패스워드에서 암호화 키 생성"""
        salt = b'settings_salt'
        import hashlib
        return hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000, 32)
    
    def _init_database(self):
        """데이터베이스 초기화"""
        with sqlite3.connect(self.settings_db) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    updated_by TEXT NOT NULL
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS setting_definitions (
                    key TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    category TEXT NOT NULL,
                    type TEXT NOT NULL,
                    default_value TEXT NOT NULL,
                    validation_rules TEXT,
                    options TEXT,
                    required INTEGER DEFAULT 1,
                    sensitive INTEGER DEFAULT 0
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS setting_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT NOT NULL,
                    changed_at TEXT NOT NULL,
                    changed_by TEXT NOT NULL
                )
            """)
    
    def _init_default_settings(self):
        """기본 설정 초기화"""
        default_settings = [
            # 일반 설정
            SettingDefinition(
                key="app_name",
                name="애플리케이션 이름",
                description="애플리케이션의 표시 이름",
                category=SettingCategory.GENERAL,
                type=SettingType.STRING,
                default_value="Qwen 3 Desktop Assistant",
                validation_rules={"min_length": 1, "max_length": 100}
            ),
            SettingDefinition(
                key="language",
                name="언어",
                description="애플리케이션 언어 설정",
                category=SettingCategory.GENERAL,
                type=SettingType.ENUM,
                default_value="ko",
                options=["ko", "en", "ja", "zh"]
            ),
            SettingDefinition(
                key="timezone",
                name="시간대",
                description="애플리케이션 시간대 설정",
                category=SettingCategory.GENERAL,
                type=SettingType.STRING,
                default_value="Asia/Seoul"
            ),
            
            # 모델 설정
            SettingDefinition(
                key="default_model",
                name="기본 모델",
                description="기본적으로 사용할 AI 모델",
                category=SettingCategory.MODEL,
                type=SettingType.STRING,
                default_value="qwen2.5-7b-instruct",
                options=["qwen2.5-7b-instruct", "qwen2.5-14b-instruct", "qwen2.5-32b-instruct"]
            ),
            SettingDefinition(
                key="max_tokens",
                name="최대 토큰 수",
                description="응답 생성 시 최대 토큰 수",
                category=SettingCategory.MODEL,
                type=SettingType.INTEGER,
                default_value=2048,
                validation_rules={"min": 1, "max": 8192}
            ),
            SettingDefinition(
                key="temperature",
                name="온도",
                description="응답 생성의 창의성 조절 (0.0-2.0)",
                category=SettingCategory.MODEL,
                type=SettingType.FLOAT,
                default_value=0.7,
                validation_rules={"min": 0.0, "max": 2.0}
            ),
            SettingDefinition(
                key="top_p",
                name="Top P",
                description="응답 생성의 다양성 조절 (0.0-1.0)",
                category=SettingCategory.MODEL,
                type=SettingType.FLOAT,
                default_value=0.9,
                validation_rules={"min": 0.0, "max": 1.0}
            ),
            
            # 성능 설정
            SettingDefinition(
                key="max_concurrent_requests",
                name="최대 동시 요청 수",
                description="동시에 처리할 수 있는 최대 요청 수",
                category=SettingCategory.PERFORMANCE,
                type=SettingType.INTEGER,
                default_value=5,
                validation_rules={"min": 1, "max": 20}
            ),
            SettingDefinition(
                key="request_timeout",
                name="요청 타임아웃",
                description="API 요청 타임아웃 (초)",
                category=SettingCategory.PERFORMANCE,
                type=SettingType.INTEGER,
                default_value=30,
                validation_rules={"min": 5, "max": 300}
            ),
            SettingDefinition(
                key="cache_enabled",
                name="캐시 활성화",
                description="응답 캐싱 기능 활성화",
                category=SettingCategory.PERFORMANCE,
                type=SettingType.BOOLEAN,
                default_value=True
            ),
            SettingDefinition(
                key="cache_ttl",
                name="캐시 TTL",
                description="캐시 유효 시간 (초)",
                category=SettingCategory.PERFORMANCE,
                type=SettingType.INTEGER,
                default_value=3600,
                validation_rules={"min": 60, "max": 86400}
            ),
            
            # 보안 설정
            SettingDefinition(
                key="api_key_required",
                name="API 키 필수",
                description="API 사용 시 API 키 필수 여부",
                category=SettingCategory.SECURITY,
                type=SettingType.BOOLEAN,
                default_value=True
            ),
            SettingDefinition(
                key="rate_limit_enabled",
                name="속도 제한 활성화",
                description="API 요청 속도 제한 활성화",
                category=SettingCategory.SECURITY,
                type=SettingType.BOOLEAN,
                default_value=True
            ),
            SettingDefinition(
                key="rate_limit_requests",
                name="속도 제한 요청 수",
                description="분당 허용되는 최대 요청 수",
                category=SettingCategory.SECURITY,
                type=SettingType.INTEGER,
                default_value=100,
                validation_rules={"min": 1, "max": 1000}
            ),
            SettingDefinition(
                key="session_timeout",
                name="세션 타임아웃",
                description="사용자 세션 타임아웃 (분)",
                category=SettingCategory.SECURITY,
                type=SettingType.INTEGER,
                default_value=60,
                validation_rules={"min": 5, "max": 1440}
            ),
            
            # UI 설정
            SettingDefinition(
                key="theme",
                name="테마",
                description="애플리케이션 테마",
                category=SettingCategory.UI,
                type=SettingType.ENUM,
                default_value="system",
                options=["light", "dark", "system"]
            ),
            SettingDefinition(
                key="font_size",
                name="글꼴 크기",
                description="기본 글꼴 크기",
                category=SettingCategory.UI,
                type=SettingType.INTEGER,
                default_value=14,
                validation_rules={"min": 10, "max": 24}
            ),
            SettingDefinition(
                key="auto_save",
                name="자동 저장",
                description="작업 자동 저장 활성화",
                category=SettingCategory.UI,
                type=SettingType.BOOLEAN,
                default_value=True
            ),
            SettingDefinition(
                key="auto_save_interval",
                name="자동 저장 간격",
                description="자동 저장 간격 (초)",
                category=SettingCategory.UI,
                type=SettingType.INTEGER,
                default_value=30,
                validation_rules={"min": 5, "max": 300}
            ),
            
            # 플러그인 설정
            SettingDefinition(
                key="plugin_auto_update",
                name="플러그인 자동 업데이트",
                description="플러그인 자동 업데이트 활성화",
                category=SettingCategory.PLUGINS,
                type=SettingType.BOOLEAN,
                default_value=False
            ),
            SettingDefinition(
                key="plugin_verification",
                name="플러그인 검증",
                description="플러그인 설치 시 검증 활성화",
                category=SettingCategory.PLUGINS,
                type=SettingType.BOOLEAN,
                default_value=True
            ),
            
            # 백업 설정
            SettingDefinition(
                key="auto_backup",
                name="자동 백업",
                description="자동 백업 활성화",
                category=SettingCategory.BACKUP,
                type=SettingType.BOOLEAN,
                default_value=True
            ),
            SettingDefinition(
                key="backup_interval",
                name="백업 간격",
                description="자동 백업 간격 (시간)",
                category=SettingCategory.BACKUP,
                type=SettingType.INTEGER,
                default_value=24,
                validation_rules={"min": 1, "max": 168}
            ),
            SettingDefinition(
                key="backup_retention",
                name="백업 보관 기간",
                description="백업 파일 보관 기간 (일)",
                category=SettingCategory.BACKUP,
                type=SettingType.INTEGER,
                default_value=30,
                validation_rules={"min": 1, "max": 365}
            )
        ]
        
        # 설정 정의 저장
        for setting_def in default_settings:
            self._save_setting_definition(setting_def)
            
            # 기본값으로 설정 저장
            if not self.get_setting(setting_def.key):
                self.set_setting(setting_def.key, setting_def.default_value, "system")
    
    def _save_setting_definition(self, setting_def: SettingDefinition):
        """설정 정의 저장"""
        with sqlite3.connect(self.settings_db) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO setting_definitions 
                (key, name, description, category, type, default_value, 
                 validation_rules, options, required, sensitive)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                setting_def.key,
                setting_def.name,
                setting_def.description,
                setting_def.category.value,
                setting_def.type.value,
                json.dumps(setting_def.default_value),
                json.dumps(setting_def.validation_rules),
                json.dumps(setting_def.options),
                setting_def.required,
                setting_def.sensitive
            ))
    
    def get_setting_definition(self, key: str) -> Optional[SettingDefinition]:
        """설정 정의 조회"""
        with sqlite3.connect(self.settings_db) as conn:
            cursor = conn.execute("""
                SELECT key, name, description, category, type, default_value,
                       validation_rules, options, required, sensitive
                FROM setting_definitions WHERE key = ?
            """, (key,))
            
            row = cursor.fetchone()
            if not row:
                return None
            
            return SettingDefinition(
                key=row[0],
                name=row[1],
                description=row[2],
                category=SettingCategory(row[3]),
                type=SettingType(row[4]),
                default_value=json.loads(row[5]),
                validation_rules=json.loads(row[6]) if row[6] else {},
                options=json.loads(row[7]) if row[7] else [],
                required=bool(row[8]),
                sensitive=bool(row[9])
            )
    
    def get_all_setting_definitions(self) -> List[SettingDefinition]:
        """모든 설정 정의 조회"""
        with sqlite3.connect(self.settings_db) as conn:
            cursor = conn.execute("""
                SELECT key, name, description, category, type, default_value,
                       validation_rules, options, required, sensitive
                FROM setting_definitions ORDER BY category, key
            """)
            
            definitions = []
            for row in cursor.fetchall():
                definitions.append(SettingDefinition(
                    key=row[0],
                    name=row[1],
                    description=row[2],
                    category=SettingCategory(row[3]),
                    type=SettingType(row[4]),
                    default_value=json.loads(row[5]),
                    validation_rules=json.loads(row[6]) if row[6] else {},
                    options=json.loads(row[7]) if row[7] else [],
                    required=bool(row[8]),
                    sensitive=bool(row[9])
                ))
            
            return definitions
    
    def get_setting(self, key: str) -> Any:
        """설정 값 조회"""
        with sqlite3.connect(self.settings_db) as conn:
            cursor = conn.execute("""
                SELECT value FROM settings WHERE key = ?
            """, (key,))
            
            row = cursor.fetchone()
            if not row:
                # 기본값 반환
                setting_def = self.get_setting_definition(key)
                if setting_def:
                    return setting_def.default_value
                return None
            
            value = json.loads(row[0])
            
            # 민감한 설정의 경우 마스킹
            setting_def = self.get_setting_definition(key)
            if setting_def and setting_def.sensitive:
                if isinstance(value, str) and len(value) > 8:
                    return value[:4] + "*" * (len(value) - 8) + value[-4:]
                return "***"
            
            return value
    
    def set_setting(self, key: str, value: Any, updated_by: str = "system") -> Dict[str, Any]:
        """설정 값 설정"""
        try:
            # 설정 정의 확인
            setting_def = self.get_setting_definition(key)
            if not setting_def:
                return {
                    "success": False,
                    "error": f"알 수 없는 설정: {key}"
                }
            
            # 값 검증
            validation_result = self._validate_setting_value(setting_def, value)
            if not validation_result["valid"]:
                return {
                    "success": False,
                    "error": validation_result["error"]
                }
            
            # 이전 값 조회
            old_value = self.get_setting(key)
            
            # 새 값 저장
            with sqlite3.connect(self.settings_db) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO settings (key, value, updated_at, updated_by)
                    VALUES (?, ?, ?, ?)
                """, (
                    key,
                    json.dumps(value),
                    datetime.now().isoformat(),
                    updated_by
                ))
                
                # 변경 이력 저장
                conn.execute("""
                    INSERT INTO setting_history (key, old_value, new_value, changed_at, changed_by)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    key,
                    json.dumps(old_value) if old_value is not None else None,
                    json.dumps(value),
                    datetime.now().isoformat(),
                    updated_by
                ))
            
            logger.info(f"설정 업데이트: {key} = {value} (by {updated_by})")
            
            return {
                "success": True,
                "message": f"설정 '{setting_def.name}'이 업데이트되었습니다"
            }
            
        except Exception as e:
            logger.error(f"설정 업데이트 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _validate_setting_value(self, setting_def: SettingDefinition, value: Any) -> Dict[str, Any]:
        """설정 값 검증"""
        try:
            # 타입 검증
            if setting_def.type == SettingType.STRING:
                if not isinstance(value, str):
                    return {"valid": False, "error": "문자열 값이 필요합니다"}
                
                # 길이 검증
                if "min_length" in setting_def.validation_rules:
                    if len(value) < setting_def.validation_rules["min_length"]:
                        return {"valid": False, "error": f"최소 길이는 {setting_def.validation_rules['min_length']}자입니다"}
                
                if "max_length" in setting_def.validation_rules:
                    if len(value) > setting_def.validation_rules["max_length"]:
                        return {"valid": False, "error": f"최대 길이는 {setting_def.validation_rules['max_length']}자입니다"}
            
            elif setting_def.type == SettingType.INTEGER:
                if not isinstance(value, int):
                    return {"valid": False, "error": "정수 값이 필요합니다"}
                
                # 범위 검증
                if "min" in setting_def.validation_rules:
                    if value < setting_def.validation_rules["min"]:
                        return {"valid": False, "error": f"최소값은 {setting_def.validation_rules['min']}입니다"}
                
                if "max" in setting_def.validation_rules:
                    if value > setting_def.validation_rules["max"]:
                        return {"valid": False, "error": f"최대값은 {setting_def.validation_rules['max']}입니다"}
            
            elif setting_def.type == SettingType.FLOAT:
                if not isinstance(value, (int, float)):
                    return {"valid": False, "error": "숫자 값이 필요합니다"}
                
                # 범위 검증
                if "min" in setting_def.validation_rules:
                    if value < setting_def.validation_rules["min"]:
                        return {"valid": False, "error": f"최소값은 {setting_def.validation_rules['min']}입니다"}
                
                if "max" in setting_def.validation_rules:
                    if value > setting_def.validation_rules["max"]:
                        return {"valid": False, "error": f"최대값은 {setting_def.validation_rules['max']}입니다"}
            
            elif setting_def.type == SettingType.BOOLEAN:
                if not isinstance(value, bool):
                    return {"valid": False, "error": "불린 값이 필요합니다"}
            
            elif setting_def.type == SettingType.ENUM:
                if value not in setting_def.options:
                    return {"valid": False, "error": f"유효한 옵션: {', '.join(str(opt) for opt in setting_def.options)}"}
            
            return {"valid": True}
            
        except Exception as e:
            return {"valid": False, "error": f"검증 중 오류: {str(e)}"}
    
    def get_settings_by_category(self, category: SettingCategory) -> Dict[str, Any]:
        """카테고리별 설정 조회"""
        settings = {}
        definitions = self.get_all_setting_definitions()
        
        for definition in definitions:
            if definition.category == category:
                settings[definition.key] = {
                    "definition": definition.to_dict(),
                    "value": self.get_setting(definition.key)
                }
        
        return settings
    
    def get_all_settings(self) -> Dict[str, Any]:
        """모든 설정 조회"""
        settings = {}
        definitions = self.get_all_setting_definitions()
        
        for definition in definitions:
            settings[definition.key] = {
                "definition": definition.to_dict(),
                "value": self.get_setting(definition.key)
            }
        
        return settings
    
    def reset_setting(self, key: str) -> Dict[str, Any]:
        """설정을 기본값으로 초기화"""
        setting_def = self.get_setting_definition(key)
        if not setting_def:
            return {
                "success": False,
                "error": f"알 수 없는 설정: {key}"
            }
        
        return self.set_setting(key, setting_def.default_value, "system")
    
    def reset_category(self, category: SettingCategory) -> Dict[str, Any]:
        """카테고리별 설정 초기화"""
        try:
            definitions = self.get_all_setting_definitions()
            reset_count = 0
            
            for definition in definitions:
                if definition.category == category:
                    self.set_setting(definition.key, definition.default_value, "system")
                    reset_count += 1
            
            return {
                "success": True,
                "message": f"{category.value} 카테고리의 {reset_count}개 설정이 초기화되었습니다"
            }
            
        except Exception as e:
            logger.error(f"카테고리 초기화 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_setting_history(self, key: str, limit: int = 50) -> List[Dict[str, Any]]:
        """설정 변경 이력 조회"""
        with sqlite3.connect(self.settings_db) as conn:
            cursor = conn.execute("""
                SELECT old_value, new_value, changed_at, changed_by
                FROM setting_history 
                WHERE key = ?
                ORDER BY changed_at DESC
                LIMIT ?
            """, (key, limit))
            
            history = []
            for row in cursor.fetchall():
                history.append({
                    "old_value": json.loads(row[0]) if row[0] else None,
                    "new_value": json.loads(row[1]),
                    "changed_at": row[2],
                    "changed_by": row[3]
                })
            
            return history
    
    def create_backup(self) -> Dict[str, Any]:
        """설정 백업 생성"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = self.backup_dir / f"settings_backup_{timestamp}.zip"
            
            with zipfile.ZipFile(backup_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # 설정 데이터베이스 백업
                zipf.write(self.settings_db, "settings.db")
                
                # 설정 메타데이터 추가
                settings_data = {
                    "backup_created_at": datetime.now().isoformat(),
                    "settings": self.get_all_settings(),
                    "definitions": [def.to_dict() for def in self.get_all_setting_definitions()]
                }
                
                zipf.writestr("settings_metadata.json", json.dumps(settings_data, indent=2, ensure_ascii=False))
            
            # 백업 파일 해시 생성
            with open(backup_file, 'rb') as f:
                file_hash = hashlib.sha256(f.read()).hexdigest()
            
            logger.info(f"설정 백업 생성 완료: {backup_file}")
            
            return {
                "success": True,
                "backup_file": str(backup_file),
                "file_hash": file_hash,
                "message": "설정 백업이 생성되었습니다"
            }
            
        except Exception as e:
            logger.error(f"설정 백업 생성 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def restore_backup(self, backup_file: str) -> Dict[str, Any]:
        """설정 백업 복원"""
        try:
            backup_path = Path(backup_file)
            if not backup_path.exists():
                return {
                    "success": False,
                    "error": "백업 파일을 찾을 수 없습니다"
                }
            
            # 임시 디렉토리에 백업 해제
            temp_dir = self.settings_dir / "temp_restore"
            temp_dir.mkdir(exist_ok=True)
            
            with zipfile.ZipFile(backup_path, 'r') as zipf:
                zipf.extractall(temp_dir)
            
            # 백업 데이터베이스 복원
            backup_db = temp_dir / "settings.db"
            if backup_db.exists():
                shutil.copy2(backup_db, self.settings_db)
            
            # 임시 디렉토리 정리
            shutil.rmtree(temp_dir)
            
            logger.info(f"설정 백업 복원 완료: {backup_file}")
            
            return {
                "success": True,
                "message": "설정 백업이 복원되었습니다"
            }
            
        except Exception as e:
            logger.error(f"설정 백업 복원 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_backup_list(self) -> List[Dict[str, Any]]:
        """백업 파일 목록 조회"""
        backups = []
        
        for backup_file in self.backup_dir.glob("settings_backup_*.zip"):
            try:
                stat = backup_file.stat()
                backups.append({
                    "filename": backup_file.name,
                    "path": str(backup_file),
                    "size": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
            except Exception as e:
                logger.error(f"백업 파일 정보 조회 실패: {backup_file} - {e}")
        
        # 생성일 기준 내림차순 정렬
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        
        return backups
    
    def cleanup_old_backups(self, keep_count: int = 10) -> Dict[str, Any]:
        """오래된 백업 파일 정리"""
        try:
            backups = self.get_backup_list()
            
            if len(backups) <= keep_count:
                return {
                    "success": True,
                    "message": "정리할 백업 파일이 없습니다"
                }
            
            # 오래된 백업 파일 삭제
            deleted_count = 0
            for backup in backups[keep_count:]:
                try:
                    Path(backup["path"]).unlink()
                    deleted_count += 1
                except Exception as e:
                    logger.error(f"백업 파일 삭제 실패: {backup['path']} - {e}")
            
            return {
                "success": True,
                "deleted_count": deleted_count,
                "message": f"{deleted_count}개의 오래된 백업 파일이 정리되었습니다"
            }
            
        except Exception as e:
            logger.error(f"백업 정리 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def export_settings(self) -> Dict[str, Any]:
        """설정 내보내기"""
        try:
            export_data = {
                "exported_at": datetime.now().isoformat(),
                "settings": self.get_all_settings(),
                "definitions": [def.to_dict() for def in self.get_all_setting_definitions()]
            }
            
            return {
                "success": True,
                "data": export_data
            }
            
        except Exception as e:
            logger.error(f"설정 내보내기 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def import_settings(self, import_data: Dict[str, Any]) -> Dict[str, Any]:
        """설정 가져오기"""
        try:
            imported_count = 0
            
            # 설정 값 가져오기
            for key, setting_data in import_data.get("settings", {}).items():
                if "value" in setting_data:
                    result = self.set_setting(key, setting_data["value"], "import")
                    if result["success"]:
                        imported_count += 1
            
            return {
                "success": True,
                "imported_count": imported_count,
                "message": f"{imported_count}개의 설정이 가져와졌습니다"
            }
            
        except Exception as e:
            logger.error(f"설정 가져오기 실패: {e}")
            return {
                "success": False,
                "error": str(e)
            }
