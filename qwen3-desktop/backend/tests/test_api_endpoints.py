import pytest
import json
import tempfile
import os
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock

from app.main import app
from app.services.mcp_server_manager import MCPServerManager


class TestChatAPI:
    """채팅 API 엔드포인트 테스트"""
    
    @pytest.fixture
    def client(self):
        """FastAPI 테스트 클라이언트"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_qwen_service(self):
        """Qwen 서비스 Mock"""
        with patch('app.api.chat.QwenService') as mock:
            mock_instance = Mock()
            mock_instance.generate_response.return_value = {
                "success": True,
                "response": "Test response",
                "tokens_used": 100
            }
            mock.return_value = mock_instance
            yield mock_instance
    
    def test_chat_endpoint(self, client, mock_qwen_service):
        """채팅 엔드포인트 테스트"""
        response = client.post("/api/chat", json={
            "message": "Hello, World!",
            "conversation_id": "test-conv-123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "response" in data
    
    def test_chat_streaming_endpoint(self, client, mock_qwen_service):
        """스트리밍 채팅 엔드포인트 테스트"""
        response = client.post("/api/chat/stream", json={
            "message": "Hello, World!",
            "conversation_id": "test-conv-123"
        })
        
        assert response.status_code == 200
        # 스트리밍 응답 확인
        content = response.content.decode()
        assert "data:" in content
    
    def test_chat_with_invalid_input(self, client):
        """잘못된 입력으로 채팅 테스트"""
        response = client.post("/api/chat", json={
            "message": "",  # 빈 메시지
            "conversation_id": "test-conv-123"
        })
        
        assert response.status_code == 400
    
    def test_chat_without_conversation_id(self, client, mock_qwen_service):
        """대화 ID 없이 채팅 테스트"""
        response = client.post("/api/chat", json={
            "message": "Hello, World!"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestFilesAPI:
    """파일 API 엔드포인트 테스트"""
    
    @pytest.fixture
    def client(self):
        """FastAPI 테스트 클라이언트"""
        return TestClient(app)
    
    @pytest.fixture
    def temp_file(self):
        """임시 파일 생성"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write("Test file content")
            temp_path = f.name
        
        yield temp_path
        
        # 정리
        os.unlink(temp_path)
    
    def test_upload_file(self, client, temp_file):
        """파일 업로드 테스트"""
        with open(temp_file, 'rb') as f:
            response = client.post(
                "/api/files/upload",
                files={"file": ("test.txt", f, "text/plain")}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "file_id" in data
    
    def test_list_files(self, client):
        """파일 목록 조회 테스트"""
        response = client.get("/api/files/list")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "files" in data
    
    def test_read_file(self, client, temp_file):
        """파일 읽기 테스트"""
        # 먼저 파일 업로드
        with open(temp_file, 'rb') as f:
            upload_response = client.post(
                "/api/files/upload",
                files={"file": ("test.txt", f, "text/plain")}
            )
        
        file_id = upload_response.json()["file_id"]
        
        # 파일 읽기
        response = client.get(f"/api/files/{file_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "content" in data
    
    def test_delete_file(self, client, temp_file):
        """파일 삭제 테스트"""
        # 먼저 파일 업로드
        with open(temp_file, 'rb') as f:
            upload_response = client.post(
                "/api/files/upload",
                files={"file": ("test.txt", f, "text/plain")}
            )
        
        file_id = upload_response.json()["file_id"]
        
        # 파일 삭제
        response = client.delete(f"/api/files/{file_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestMCPAPI:
    """MCP API 엔드포인트 테스트"""
    
    @pytest.fixture
    def client(self):
        """FastAPI 테스트 클라이언트"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_mcp_manager(self):
        """MCP 매니저 Mock"""
        with patch('app.api.mcp.MCPServerManager') as mock:
            mock_instance = Mock()
            mock_instance.get_servers.return_value = {
                "filesystem": {"status": "active"},
                "web_search": {"status": "active"},
                "terminal": {"status": "active"},
                "database": {"status": "active"}
            }
            mock_instance.execute_method.return_value = {
                "success": True,
                "result": "test result"
            }
            mock.return_value = mock_instance
            yield mock_instance
    
    def test_get_mcp_servers(self, client, mock_mcp_manager):
        """MCP 서버 목록 조회 테스트"""
        response = client.get("/api/mcp/servers")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "servers" in data
        assert len(data["servers"]) == 4
    
    def test_execute_mcp_method(self, client, mock_mcp_manager):
        """MCP 메서드 실행 테스트"""
        response = client.post("/api/mcp/execute", json={
            "server": "filesystem",
            "method": "list_files",
            "params": {"path": "/tmp"}
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "result" in data
    
    def test_execute_mcp_method_invalid_server(self, client, mock_mcp_manager):
        """잘못된 서버로 MCP 메서드 실행 테스트"""
        response = client.post("/api/mcp/execute", json={
            "server": "invalid_server",
            "method": "list_files",
            "params": {"path": "/tmp"}
        })
        
        assert response.status_code == 400
    
    def test_execute_mcp_method_invalid_method(self, client, mock_mcp_manager):
        """잘못된 메서드로 MCP 메서드 실행 테스트"""
        mock_mcp_manager.execute_method.side_effect = Exception("Method not found")
        
        response = client.post("/api/mcp/execute", json={
            "server": "filesystem",
            "method": "invalid_method",
            "params": {}
        })
        
        assert response.status_code == 500


class TestHealthAPI:
    """헬스 체크 API 엔드포인트 테스트"""
    
    @pytest.fixture
    def client(self):
        """FastAPI 테스트 클라이언트"""
        return TestClient(app)
    
    def test_health_check(self, client):
        """헬스 체크 테스트"""
        response = client.get("/api/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_health_check_detailed(self, client):
        """상세 헬스 체크 테스트"""
        response = client.get("/api/health/detailed")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "services" in data
        assert "system" in data


class TestErrorHandling:
    """에러 처리 테스트"""
    
    @pytest.fixture
    def client(self):
        """FastAPI 테스트 클라이언트"""
        return TestClient(app)
    
    def test_404_error(self, client):
        """404 에러 테스트"""
        response = client.get("/api/non-existent-endpoint")
        
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
    
    def test_500_error(self, client):
        """500 에러 테스트"""
        with patch('app.api.chat.QwenService') as mock:
            mock_instance = Mock()
            mock_instance.generate_response.side_effect = Exception("Internal error")
            mock.return_value = mock_instance
            
            response = client.post("/api/chat", json={
                "message": "Hello, World!",
                "conversation_id": "test-conv-123"
            })
            
            assert response.status_code == 500
            data = response.json()
            assert "error" in data
    
    def test_validation_error(self, client):
        """입력 검증 에러 테스트"""
        response = client.post("/api/chat", json={
            "invalid_field": "invalid_value"
        })
        
        assert response.status_code == 422


class TestPerformance:
    """성능 테스트"""
    
    @pytest.fixture
    def client(self):
        """FastAPI 테스트 클라이언트"""
        return TestClient(app)
    
    def test_chat_response_time(self, client):
        """채팅 응답 시간 테스트"""
        import time
        
        start_time = time.time()
        response = client.post("/api/chat", json={
            "message": "Hello, World!",
            "conversation_id": "test-conv-123"
        })
        end_time = time.time()
        
        response_time = end_time - start_time
        
        assert response.status_code == 200
        assert response_time < 5.0  # 5초 이내 응답
    
    def test_concurrent_requests(self, client):
        """동시 요청 테스트"""
        import threading
        import time
        
        results = []
        errors = []
        
        def make_request():
            try:
                response = client.post("/api/chat", json={
                    "message": "Hello, World!",
                    "conversation_id": f"test-conv-{threading.get_ident()}"
                })
                results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))
        
        # 5개의 동시 요청
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        # 모든 스레드 완료 대기
        for thread in threads:
            thread.join()
        
        # 결과 확인
        assert len(errors) == 0
        assert len(results) == 5
        assert all(status == 200 for status in results)


if __name__ == "__main__":
    pytest.main([__file__])
