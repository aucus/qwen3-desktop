import asyncio
import json
import sqlite3
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import os
from pathlib import Path

from ...utils.logger import mcp_logger

class DatabaseMCPServer:
    """데이터베이스 MCP 서버"""
    
    def __init__(self, database_path: str = None, allowed_operations: List[str] = None):
        self.database_path = database_path or "qwen_desktop.db"
        self.allowed_operations = allowed_operations or ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
        self.connections: Dict[str, sqlite3.Connection] = {}
        self.query_history: List[Dict[str, Any]] = []
        self.max_history = 100
        
    async def initialize(self):
        """서버를 초기화합니다."""
        try:
            mcp_logger.info(f"Initializing database MCP server with database: {self.database_path}")
            
            # 데이터베이스 디렉토리 생성
            db_dir = Path(self.database_path).parent
            db_dir.mkdir(parents=True, exist_ok=True)
            
            # 기본 메서드 등록
            self.methods = {
                'database/query': self.execute_query,
                'database/execute': self.execute_statement,
                'database/list': self.list_tables,
                'database/schema': self.get_schema,
                'database/connect': self.connect_database,
                'database/disconnect': self.disconnect_database,
                'database/backup': self.backup_database,
                'database/restore': self.restore_database,
                'database/history': self.get_query_history,
            }
            
            # 기본 데이터베이스 연결
            await self.connect_database({'name': 'default', 'path': self.database_path})
            
            # 기본 테이블 생성
            await self._create_default_tables()
            
            mcp_logger.info("Database MCP server initialized successfully")
            
        except Exception as e:
            mcp_logger.error(f"Failed to initialize database MCP server: {e}")
            raise
    
    async def cleanup(self):
        """서버 리소스를 정리합니다."""
        try:
            # 모든 연결 종료
            for name, connection in self.connections.items():
                try:
                    connection.close()
                    mcp_logger.info(f"Closed database connection: {name}")
                except Exception as e:
                    mcp_logger.warning(f"Error closing database connection {name}: {e}")
            
            self.connections.clear()
            mcp_logger.info("Database MCP server cleaned up")
            
        except Exception as e:
            mcp_logger.error(f"Error during database cleanup: {e}")
    
    async def handle_request(self, method: str, params: Dict[str, Any]) -> Any:
        """요청을 처리합니다."""
        try:
            if method not in self.methods:
                raise ValueError(f"Unknown method: {method}")
            
            handler = self.methods[method]
            return await handler(params)
            
        except Exception as e:
            mcp_logger.error(f"Error handling database request {method}: {e}")
            raise
    
    async def execute_query(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """SQL 쿼리를 실행합니다."""
        try:
            query = params.get('query')
            database = params.get('database', 'default')
            fetch_type = params.get('fetch_type', 'all')  # 'all', 'one', 'many'
            limit = params.get('limit', 1000)
            
            if not query:
                raise ValueError("Query parameter is required")
            
            # 쿼리 보안 검증
            self._validate_query(query)
            
            if database not in self.connections:
                raise ValueError(f"Database not connected: {database}")
            
            connection = self.connections[database]
            
            mcp_logger.info(f"Executing query on {database}: {query}")
            
            # 쿼리 실행
            cursor = connection.cursor()
            
            if fetch_type == 'one':
                cursor.execute(query)
                result = cursor.fetchone()
                if result:
                    columns = [description[0] for description in cursor.description]
                    row_data = dict(zip(columns, result))
                else:
                    row_data = None
            elif fetch_type == 'many':
                cursor.execute(query)
                results = cursor.fetchmany(limit)
                columns = [description[0] for description in cursor.description]
                rows_data = [dict(zip(columns, row)) for row in results]
                row_data = rows_data
            else:  # 'all'
                cursor.execute(query)
                results = cursor.fetchall()
                columns = [description[0] for description in cursor.description]
                rows_data = [dict(zip(columns, row)) for row in results]
                row_data = rows_data
            
            # 결과 처리
            result_data = {
                'query': query,
                'database': database,
                'fetch_type': fetch_type,
                'result': row_data,
                'row_count': len(row_data) if isinstance(row_data, list) else (1 if row_data else 0),
                'columns': columns if 'columns' in locals() else [],
                'executed_at': datetime.now().isoformat()
            }
            
            # 히스토리에 추가
            self._add_to_history(result_data)
            
            return result_data
            
        except Exception as e:
            mcp_logger.error(f"Error executing query {params.get('query')}: {e}")
            raise
    
    async def execute_statement(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """SQL 문을 실행합니다."""
        try:
            statement = params.get('statement')
            database = params.get('database', 'default')
            
            if not statement:
                raise ValueError("Statement parameter is required")
            
            # 문 보안 검증
            self._validate_statement(statement)
            
            if database not in self.connections:
                raise ValueError(f"Database not connected: {database}")
            
            connection = self.connections[database]
            
            mcp_logger.info(f"Executing statement on {database}: {statement}")
            
            # 문 실행
            cursor = connection.cursor()
            cursor.execute(statement)
            connection.commit()
            
            result_data = {
                'statement': statement,
                'database': database,
                'affected_rows': cursor.rowcount,
                'last_row_id': cursor.lastrowid,
                'executed_at': datetime.now().isoformat()
            }
            
            # 히스토리에 추가
            self._add_to_history(result_data)
            
            return result_data
            
        except Exception as e:
            mcp_logger.error(f"Error executing statement {params.get('statement')}: {e}")
            raise
    
    async def list_tables(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """테이블 목록을 반환합니다."""
        try:
            database = params.get('database', 'default')
            
            if database not in self.connections:
                raise ValueError(f"Database not connected: {database}")
            
            connection = self.connections[database]
            
            # SQLite 시스템 테이블에서 테이블 목록 조회
            cursor = connection.cursor()
            cursor.execute("""
                SELECT name, type, sql 
                FROM sqlite_master 
                WHERE type IN ('table', 'view')
                ORDER BY name
            """)
            
            tables = []
            for row in cursor.fetchall():
                tables.append({
                    'name': row[0],
                    'type': row[1],
                    'sql': row[2]
                })
            
            return {
                'database': database,
                'tables': tables,
                'total': len(tables),
                'queried_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error listing tables for database {params.get('database')}: {e}")
            raise
    
    async def get_schema(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """테이블 스키마를 반환합니다."""
        try:
            table_name = params.get('table')
            database = params.get('database', 'default')
            
            if not table_name:
                raise ValueError("Table parameter is required")
            
            if database not in self.connections:
                raise ValueError(f"Database not connected: {database}")
            
            connection = self.connections[database]
            
            # 테이블 스키마 조회
            cursor = connection.cursor()
            cursor.execute(f"PRAGMA table_info({table_name})")
            
            columns = []
            for row in cursor.fetchall():
                columns.append({
                    'cid': row[0],
                    'name': row[1],
                    'type': row[2],
                    'not_null': bool(row[3]),
                    'default_value': row[4],
                    'primary_key': bool(row[5])
                })
            
            return {
                'database': database,
                'table': table_name,
                'columns': columns,
                'total_columns': len(columns),
                'queried_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error getting schema for table {params.get('table')}: {e}")
            raise
    
    async def connect_database(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """데이터베이스에 연결합니다."""
        try:
            name = params.get('name', 'default')
            path = params.get('path', self.database_path)
            
            if name in self.connections:
                mcp_logger.info(f"Database already connected: {name}")
                return {
                    'name': name,
                    'path': path,
                    'connected': True,
                    'already_connected': True
                }
            
            # 데이터베이스 연결
            connection = sqlite3.connect(path)
            connection.row_factory = sqlite3.Row  # 딕셔너리 형태로 결과 반환
            
            self.connections[name] = connection
            
            return {
                'name': name,
                'path': path,
                'connected': True,
                'connected_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error connecting to database {params.get('name')}: {e}")
            raise
    
    async def disconnect_database(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """데이터베이스 연결을 해제합니다."""
        try:
            name = params.get('name', 'default')
            
            if name not in self.connections:
                return {
                    'name': name,
                    'disconnected': True,
                    'already_disconnected': True
                }
            
            connection = self.connections[name]
            connection.close()
            del self.connections[name]
            
            return {
                'name': name,
                'disconnected': True,
                'disconnected_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error disconnecting database {params.get('name')}: {e}")
            raise
    
    async def backup_database(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """데이터베이스를 백업합니다."""
        try:
            source_db = params.get('source', 'default')
            backup_path = params.get('backup_path')
            
            if not backup_path:
                backup_path = f"{source_db}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            
            if source_db not in self.connections:
                raise ValueError(f"Database not connected: {source_db}")
            
            source_connection = self.connections[source_db]
            
            # 백업 연결 생성
            backup_connection = sqlite3.connect(backup_path)
            
            # 데이터베이스 백업
            source_connection.backup(backup_connection)
            backup_connection.close()
            
            return {
                'source': source_db,
                'backup_path': backup_path,
                'backed_up': True,
                'backup_size': os.path.getsize(backup_path),
                'backed_up_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error backing up database {params.get('source')}: {e}")
            raise
    
    async def restore_database(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """데이터베이스를 복원합니다."""
        try:
            target_db = params.get('target', 'default')
            backup_path = params.get('backup_path')
            
            if not backup_path:
                raise ValueError("Backup path parameter is required")
            
            if not os.path.exists(backup_path):
                raise FileNotFoundError(f"Backup file not found: {backup_path}")
            
            # 기존 연결 종료
            if target_db in self.connections:
                self.connections[target_db].close()
                del self.connections[target_db]
            
            # 백업에서 복원
            target_path = self.database_path if target_db == 'default' else f"{target_db}.db"
            
            import shutil
            shutil.copy2(backup_path, target_path)
            
            # 새 연결 생성
            await self.connect_database({'name': target_db, 'path': target_path})
            
            return {
                'target': target_db,
                'backup_path': backup_path,
                'restored': True,
                'restored_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error restoring database {params.get('target')}: {e}")
            raise
    
    async def get_query_history(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """쿼리 히스토리를 반환합니다."""
        try:
            limit = params.get('limit', 50)
            database = params.get('database')
            
            # 히스토리 필터링
            history = self.query_history[-limit:] if limit > 0 else self.query_history.copy()
            
            if database:
                history = [item for item in history if item.get('database') == database]
            
            return {
                'history': history,
                'total': len(history),
                'limit': limit,
                'database': database
            }
            
        except Exception as e:
            mcp_logger.error(f"Error getting query history: {e}")
            raise
    
    # 내부 메서드들
    def _validate_query(self, query: str):
        """쿼리 보안을 검증합니다."""
        query_upper = query.upper().strip()
        
        # 허용된 작업인지 확인
        operation = None
        for op in self.allowed_operations:
            if query_upper.startswith(op):
                operation = op
                break
        
        if not operation:
            raise ValueError(f"Operation not allowed. Allowed operations: {self.allowed_operations}")
        
        # 위험한 패턴 확인
        dangerous_patterns = [
            'DROP TABLE', 'DROP DATABASE', 'DELETE FROM', 'TRUNCATE',
            'ALTER TABLE', 'CREATE INDEX', 'DROP INDEX'
        ]
        
        for pattern in dangerous_patterns:
            if pattern in query_upper:
                raise ValueError(f"Dangerous SQL pattern detected: {pattern}")
    
    def _validate_statement(self, statement: str):
        """SQL 문 보안을 검증합니다."""
        statement_upper = statement.upper().strip()
        
        # 허용된 작업인지 확인
        operation = None
        for op in self.allowed_operations:
            if statement_upper.startswith(op):
                operation = op
                break
        
        if not operation:
            raise ValueError(f"Operation not allowed. Allowed operations: {self.allowed_operations}")
        
        # 위험한 패턴 확인
        dangerous_patterns = [
            'DROP TABLE', 'DROP DATABASE', 'TRUNCATE',
            'ALTER TABLE', 'CREATE INDEX', 'DROP INDEX'
        ]
        
        for pattern in dangerous_patterns:
            if pattern in statement_upper:
                raise ValueError(f"Dangerous SQL pattern detected: {pattern}")
    
    def _add_to_history(self, result: Dict[str, Any]):
        """결과를 히스토리에 추가합니다."""
        history_item = {
            'query': result.get('query') or result.get('statement'),
            'database': result.get('database'),
            'executed_at': result.get('executed_at'),
            'type': 'query' if 'query' in result else 'statement'
        }
        
        self.query_history.append(history_item)
        
        # 히스토리 크기 제한
        if len(self.query_history) > self.max_history:
            self.query_history = self.query_history[-self.max_history:]
    
    async def _create_default_tables(self):
        """기본 테이블을 생성합니다."""
        try:
            default_connection = self.connections.get('default')
            if not default_connection:
                return
            
            cursor = default_connection.cursor()
            
            # 대화 히스토리 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT UNIQUE NOT NULL,
                    title TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 메시지 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (conversation_id) REFERENCES conversations (conversation_id)
                )
            """)
            
            # 파일 메타데이터 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filename TEXT NOT NULL,
                    conversation_id TEXT,
                    file_path TEXT NOT NULL,
                    file_size INTEGER,
                    content_type TEXT,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (conversation_id) REFERENCES conversations (conversation_id)
                )
            """)
            
            # 설정 테이블
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            default_connection.commit()
            mcp_logger.info("Default tables created successfully")
            
        except Exception as e:
            mcp_logger.error(f"Error creating default tables: {e}")
            raise
