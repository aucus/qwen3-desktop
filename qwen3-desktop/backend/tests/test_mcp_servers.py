import pytest
import asyncio
import tempfile
import os
import sqlite3
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, Any

# MCP 서버들 import
from app.services.mcp_servers.filesystem_server import FilesystemMCPServer
from app.services.mcp_servers.web_search_server import WebSearchMCPServer
from app.services.mcp_servers.terminal_server import TerminalMCPServer
from app.services.mcp_servers.database_server import DatabaseMCPServer


class TestFilesystemMCPServer:
    """파일시스템 MCP 서버 테스트"""
    
    @pytest.fixture
    async def filesystem_server(self):
        """파일시스템 서버 인스턴스 생성"""
        server = FilesystemMCPServer()
        await server.initialize()
        yield server
        await server.cleanup()
    
    @pytest.fixture
    def temp_dir(self):
        """임시 디렉토리 생성"""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield temp_dir
    
    async def test_list_files(self, filesystem_server, temp_dir):
        """파일 목록 조회 테스트"""
        # 테스트 파일 생성
        test_file = os.path.join(temp_dir, "test.txt")
        with open(test_file, "w") as f:
            f.write("test content")
        
        # 파일 목록 조회
        result = await filesystem_server.list_files(temp_dir)
        
        assert result["success"] is True
        assert "test.txt" in [file["name"] for file in result["files"]]
    
    async def test_read_file(self, filesystem_server, temp_dir):
        """파일 읽기 테스트"""
        # 테스트 파일 생성
        test_content = "Hello, World!"
        test_file = os.path.join(temp_dir, "test.txt")
        with open(test_file, "w") as f:
            f.write(test_content)
        
        # 파일 읽기
        result = await filesystem_server.read_file(test_file)
        
        assert result["success"] is True
        assert result["content"] == test_content
    
    async def test_write_file(self, filesystem_server, temp_dir):
        """파일 쓰기 테스트"""
        test_content = "New content"
        test_file = os.path.join(temp_dir, "new_file.txt")
        
        # 파일 쓰기
        result = await filesystem_server.write_file(test_file, test_content)
        
        assert result["success"] is True
        
        # 파일이 실제로 생성되었는지 확인
        with open(test_file, "r") as f:
            content = f.read()
        assert content == test_content
    
    async def test_search_files(self, filesystem_server, temp_dir):
        """파일 검색 테스트"""
        # 테스트 파일들 생성
        files = ["test1.txt", "test2.py", "other.txt"]
        for file_name in files:
            with open(os.path.join(temp_dir, file_name), "w") as f:
                f.write("content")
        
        # 파일 검색
        result = await filesystem_server.search_files(temp_dir, "test")
        
        assert result["success"] is True
        assert len(result["files"]) == 2
        assert "test1.txt" in [f["name"] for f in result["files"]]
        assert "test2.py" in [f["name"] for f in result["files"]]


class TestWebSearchMCPServer:
    """웹 검색 MCP 서버 테스트"""
    
    @pytest.fixture
    async def web_search_server(self):
        """웹 검색 서버 인스턴스 생성"""
        server = WebSearchMCPServer()
        await server.initialize()
        yield server
        await server.cleanup()
    
    @patch('app.services.mcp_servers.web_search_server.requests.get')
    async def test_search_web(self, mock_get, web_search_server):
        """웹 검색 테스트"""
        # Mock 응답 설정
        mock_response = Mock()
        mock_response.json.return_value = {
            "results": [
                {"title": "Test Result", "url": "https://example.com", "snippet": "Test snippet"}
            ]
        }
        mock_response.status_code = 200
        mock_get.return_value = mock_response
        
        # 검색 실행
        result = await web_search_server.search_web("test query")
        
        assert result["success"] is True
        assert len(result["results"]) == 1
        assert result["results"][0]["title"] == "Test Result"
    
    async def test_search_with_invalid_query(self, web_search_server):
        """빈 쿼리 검색 테스트"""
        result = await web_search_server.search_web("")
        
        assert result["success"] is False
        assert "error" in result


class TestTerminalMCPServer:
    """터미널 MCP 서버 테스트"""
    
    @pytest.fixture
    async def terminal_server(self):
        """터미널 서버 인스턴스 생성"""
        server = TerminalMCPServer()
        await server.initialize()
        yield server
        await server.cleanup()
    
    async def test_execute_command(self, terminal_server):
        """명령어 실행 테스트"""
        # 안전한 명령어 실행
        result = await terminal_server.execute_command("echo 'Hello, World!'")
        
        assert result["success"] is True
        assert "Hello, World!" in result["output"]
    
    async def test_execute_forbidden_command(self, terminal_server):
        """금지된 명령어 실행 테스트"""
        # 위험한 명령어 실행 시도
        result = await terminal_server.execute_command("rm -rf /")
        
        assert result["success"] is False
        assert "forbidden" in result["error"].lower()
    
    async def test_command_history(self, terminal_server):
        """명령어 히스토리 테스트"""
        # 여러 명령어 실행
        await terminal_server.execute_command("echo 'first'")
        await terminal_server.execute_command("echo 'second'")
        
        # 히스토리 조회
        history = await terminal_server.get_command_history()
        
        assert len(history) >= 2
        assert any("first" in cmd["command"] for cmd in history)
        assert any("second" in cmd["command"] for cmd in history)


class TestDatabaseMCPServer:
    """데이터베이스 MCP 서버 테스트"""
    
    @pytest.fixture
    async def database_server(self):
        """데이터베이스 서버 인스턴스 생성"""
        server = DatabaseMCPServer()
        await server.initialize()
        yield server
        await server.cleanup()
    
    @pytest.fixture
    def temp_db(self):
        """임시 데이터베이스 생성"""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        
        # 테스트 테이블 생성
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                value INTEGER
            )
        """)
        cursor.execute("INSERT INTO test_table (name, value) VALUES (?, ?)", ("test1", 100))
        cursor.execute("INSERT INTO test_table (name, value) VALUES (?, ?)", ("test2", 200))
        conn.commit()
        conn.close()
        
        yield db_path
        
        # 정리
        os.unlink(db_path)
    
    async def test_connect_database(self, database_server, temp_db):
        """데이터베이스 연결 테스트"""
        result = await database_server.connect_database(temp_db)
        
        assert result["success"] is True
        assert "connected" in result["message"].lower()
    
    async def test_execute_query(self, database_server, temp_db):
        """SQL 쿼리 실행 테스트"""
        # 데이터베이스 연결
        await database_server.connect_database(temp_db)
        
        # SELECT 쿼리 실행
        result = await database_server.execute_query("SELECT * FROM test_table")
        
        assert result["success"] is True
        assert len(result["results"]) == 2
        assert result["results"][0]["name"] == "test1"
        assert result["results"][1]["name"] == "test2"
    
    async def test_execute_insert_query(self, database_server, temp_db):
        """INSERT 쿼리 실행 테스트"""
        # 데이터베이스 연결
        await database_server.connect_database(temp_db)
        
        # INSERT 쿼리 실행
        result = await database_server.execute_query(
            "INSERT INTO test_table (name, value) VALUES (?, ?)",
            ["test3", 300]
        )
        
        assert result["success"] is True
        
        # 데이터가 실제로 삽입되었는지 확인
        select_result = await database_server.execute_query("SELECT * FROM test_table WHERE name = ?", ["test3"])
        assert len(select_result["results"]) == 1
        assert select_result["results"][0]["value"] == 300
    
    async def test_invalid_query(self, database_server, temp_db):
        """잘못된 쿼리 실행 테스트"""
        # 데이터베이스 연결
        await database_server.connect_database(temp_db)
        
        # 잘못된 쿼리 실행
        result = await database_server.execute_query("SELECT * FROM non_existent_table")
        
        assert result["success"] is False
        assert "error" in result


class TestMCPServerIntegration:
    """MCP 서버 통합 테스트"""
    
    @pytest.fixture
    async def all_servers(self):
        """모든 MCP 서버 인스턴스 생성"""
        servers = {
            "filesystem": FilesystemMCPServer(),
            "web_search": WebSearchMCPServer(),
            "terminal": TerminalMCPServer(),
            "database": DatabaseMCPServer()
        }
        
        for server in servers.values():
            await server.initialize()
        
        yield servers
        
        for server in servers.values():
            await server.cleanup()
    
    async def test_server_initialization(self, all_servers):
        """서버 초기화 통합 테스트"""
        for name, server in all_servers.items():
            assert server.is_initialized is True
            assert hasattr(server, 'config')
    
    async def test_server_health_check(self, all_servers):
        """서버 상태 확인 통합 테스트"""
        for name, server in all_servers.items():
            health = await server.health_check()
            assert health["status"] == "healthy"
    
    async def test_error_handling(self, all_servers):
        """에러 처리 통합 테스트"""
        # 파일시스템 서버 - 존재하지 않는 파일 읽기
        fs_result = await all_servers["filesystem"].read_file("/non/existent/file")
        assert fs_result["success"] is False
        
        # 터미널 서버 - 금지된 명령어
        term_result = await all_servers["terminal"].execute_command("rm -rf /")
        assert term_result["success"] is False
        
        # 데이터베이스 서버 - 잘못된 쿼리
        db_result = await all_servers["database"].execute_query("INVALID SQL")
        assert db_result["success"] is False


if __name__ == "__main__":
    pytest.main([__file__])
