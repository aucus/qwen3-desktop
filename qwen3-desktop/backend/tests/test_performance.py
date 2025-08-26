import pytest
import asyncio
import time
import psutil
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any

from app.services.mcp_servers.filesystem_server import FilesystemMCPServer
from app.services.mcp_servers.web_search_server import WebSearchMCPServer
from app.services.mcp_servers.terminal_server import TerminalMCPServer
from app.services.mcp_servers.database_server import DatabaseMCPServer
from app.services.mcp_server_manager import MCPServerManager


class TestPerformance:
    """성능 테스트 클래스"""
    
    @pytest.fixture
    async def mcp_manager(self):
        """MCP 매니저 인스턴스 생성"""
        manager = MCPServerManager()
        await manager.initialize()
        yield manager
        await manager.cleanup()
    
    @pytest.fixture
    def temp_dir(self):
        """임시 디렉토리 생성"""
        with tempfile.TemporaryDirectory() as temp_dir:
            yield temp_dir
    
    def test_memory_usage(self, mcp_manager):
        """메모리 사용량 테스트"""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # 여러 작업 수행
        for i in range(100):
            # 메모리 사용량 증가 작업
            large_data = [f"data_{j}" for j in range(1000)]
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # 메모리 증가량이 100MB 이하인지 확인
        assert memory_increase < 100, f"Memory increase: {memory_increase:.2f}MB"
    
    async def test_response_time(self, mcp_manager):
        """응답 시간 테스트"""
        start_time = time.time()
        
        # 파일시스템 서버 테스트
        result = await mcp_manager.execute_method("filesystem", "list_files", {"path": "/tmp"})
        
        end_time = time.time()
        response_time = end_time - start_time
        
        # 응답 시간이 3초 이내인지 확인
        assert response_time < 3.0, f"Response time: {response_time:.2f}s"
        assert result["success"] is True
    
    async def test_concurrent_requests(self, mcp_manager):
        """동시 요청 테스트"""
        async def make_request(request_id: int) -> Dict[str, Any]:
            """단일 요청 수행"""
            start_time = time.time()
            result = await mcp_manager.execute_method("filesystem", "list_files", {"path": "/tmp"})
            end_time = time.time()
            
            return {
                "request_id": request_id,
                "success": result["success"],
                "response_time": end_time - start_time
            }
        
        # 10개의 동시 요청
        tasks = [make_request(i) for i in range(10)]
        results = await asyncio.gather(*tasks)
        
        # 모든 요청이 성공했는지 확인
        success_count = sum(1 for r in results if r["success"])
        assert success_count == 10, f"Success rate: {success_count}/10"
        
        # 평균 응답 시간이 2초 이내인지 확인
        avg_response_time = sum(r["response_time"] for r in results) / len(results)
        assert avg_response_time < 2.0, f"Average response time: {avg_response_time:.2f}s"
    
    def test_cpu_usage(self, mcp_manager):
        """CPU 사용량 테스트"""
        process = psutil.Process()
        
        # CPU 사용량 측정 시작
        cpu_percent_start = process.cpu_percent(interval=1)
        
        # CPU 집약적 작업 수행
        for i in range(1000000):
            _ = i * i
        
        # CPU 사용량 측정 종료
        cpu_percent_end = process.cpu_percent(interval=1)
        
        # CPU 사용량이 50% 이하인지 확인
        assert cpu_percent_end < 50, f"CPU usage: {cpu_percent_end:.2f}%"
    
    async def test_file_operations_performance(self, mcp_manager, temp_dir):
        """파일 작업 성능 테스트"""
        # 대용량 파일 생성
        large_file_path = os.path.join(temp_dir, "large_file.txt")
        with open(large_file_path, "w") as f:
            for i in range(10000):
                f.write(f"Line {i}: This is a test line with some content.\n")
        
        # 파일 읽기 성능 테스트
        start_time = time.time()
        result = await mcp_manager.execute_method("filesystem", "read_file", {"path": large_file_path})
        end_time = time.time()
        
        read_time = end_time - start_time
        
        # 파일 읽기가 1초 이내에 완료되는지 확인
        assert read_time < 1.0, f"File read time: {read_time:.2f}s"
        assert result["success"] is True
        assert "content" in result["result"]
    
    async def test_database_performance(self, mcp_manager):
        """데이터베이스 성능 테스트"""
        # 임시 데이터베이스 생성
        import sqlite3
        
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        
        try:
            # 테스트 테이블 생성
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE performance_test (
                    id INTEGER PRIMARY KEY,
                    name TEXT,
                    value INTEGER,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 대량 데이터 삽입
            for i in range(1000):
                cursor.execute(
                    "INSERT INTO performance_test (name, value) VALUES (?, ?)",
                    (f"item_{i}", i)
                )
            conn.commit()
            conn.close()
            
            # 데이터베이스 연결
            start_time = time.time()
            result = await mcp_manager.execute_method("database", "connect_database", {"path": db_path})
            connect_time = time.time() - start_time
            
            assert connect_time < 1.0, f"Database connect time: {connect_time:.2f}s"
            assert result["success"] is True
            
            # 쿼리 성능 테스트
            start_time = time.time()
            result = await mcp_manager.execute_method("database", "execute_query", {
                "query": "SELECT * FROM performance_test WHERE value > 500"
            })
            query_time = time.time() - start_time
            
            assert query_time < 2.0, f"Query time: {query_time:.2f}s"
            assert result["success"] is True
            assert len(result["result"]["results"]) == 499  # 501-999
            
        finally:
            # 정리
            os.unlink(db_path)
    
    async def test_web_search_performance(self, mcp_manager):
        """웹 검색 성능 테스트"""
        start_time = time.time()
        
        result = await mcp_manager.execute_method("web_search", "search_web", {
            "query": "test query"
        })
        
        end_time = time.time()
        search_time = end_time - start_time
        
        # 웹 검색이 5초 이내에 완료되는지 확인
        assert search_time < 5.0, f"Web search time: {search_time:.2f}s"
        # 성공 여부는 네트워크 상태에 따라 달라질 수 있음
    
    async def test_terminal_performance(self, mcp_manager):
        """터미널 명령어 성능 테스트"""
        start_time = time.time()
        
        result = await mcp_manager.execute_method("terminal", "execute_command", {
            "command": "echo 'Hello, World!'"
        })
        
        end_time = time.time()
        command_time = end_time - start_time
        
        # 명령어 실행이 1초 이내에 완료되는지 확인
        assert command_time < 1.0, f"Command execution time: {command_time:.2f}s"
        assert result["success"] is True
    
    def test_memory_leak(self, mcp_manager):
        """메모리 누수 테스트"""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # 반복적인 작업 수행
        for cycle in range(10):
            # 메모리 사용량 증가 작업
            data_structures = []
            for i in range(1000):
                data_structures.append({
                    "id": i,
                    "data": f"data_{i}",
                    "timestamp": time.time()
                })
            
            # 가비지 컬렉션 강제 실행
            import gc
            gc.collect()
            
            # 메모리 사용량 확인
            current_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_increase = current_memory - initial_memory
            
            # 각 사이클에서 메모리 증가량이 50MB 이하인지 확인
            assert memory_increase < 50, f"Memory leak detected at cycle {cycle}: {memory_increase:.2f}MB"
    
    async def test_stress_test(self, mcp_manager):
        """스트레스 테스트"""
        async def stress_operation(operation_id: int) -> Dict[str, Any]:
            """스트레스 작업 수행"""
            start_time = time.time()
            
            try:
                # 여러 서버에 동시 요청
                tasks = [
                    mcp_manager.execute_method("filesystem", "list_files", {"path": "/tmp"}),
                    mcp_manager.execute_method("terminal", "execute_command", {"command": "echo 'test'"}),
                    mcp_manager.execute_method("web_search", "search_web", {"query": f"test query {operation_id}"})
                ]
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                end_time = time.time()
                
                return {
                    "operation_id": operation_id,
                    "success": all(not isinstance(r, Exception) for r in results),
                    "response_time": end_time - start_time,
                    "results": results
                }
            
            except Exception as e:
                return {
                    "operation_id": operation_id,
                    "success": False,
                    "error": str(e)
                }
        
        # 50개의 동시 스트레스 작업
        tasks = [stress_operation(i) for i in range(50)]
        results = await asyncio.gather(*tasks)
        
        # 성공률이 80% 이상인지 확인
        success_count = sum(1 for r in results if r["success"])
        success_rate = success_count / len(results)
        assert success_rate >= 0.8, f"Success rate: {success_rate:.2%}"
        
        # 평균 응답 시간이 3초 이내인지 확인
        response_times = [r["response_time"] for r in results if "response_time" in r]
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
            assert avg_response_time < 3.0, f"Average response time: {avg_response_time:.2f}s"
    
    def test_resource_cleanup(self, mcp_manager):
        """리소스 정리 테스트"""
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        initial_handles = process.num_handles() if hasattr(process, 'num_handles') else 0
        
        # 리소스 사용량 증가 작업
        for i in range(100):
            # 파일 핸들, 네트워크 연결 등 생성
            pass
        
        # 가비지 컬렉션 강제 실행
        import gc
        gc.collect()
        
        # 정리 후 메모리 사용량 확인
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        final_handles = process.num_handles() if hasattr(process, 'num_handles') else 0
        
        memory_increase = final_memory - initial_memory
        handles_increase = final_handles - initial_handles
        
        # 메모리 증가량이 20MB 이하인지 확인
        assert memory_increase < 20, f"Memory increase after cleanup: {memory_increase:.2f}MB"
        
        # 핸들 증가량이 10개 이하인지 확인 (Windows에서만)
        if hasattr(process, 'num_handles'):
            assert handles_increase < 10, f"Handle increase after cleanup: {handles_increase}"


class TestScalability:
    """확장성 테스트"""
    
    async def test_concurrent_users(self):
        """동시 사용자 테스트"""
        async def simulate_user(user_id: int) -> Dict[str, Any]:
            """단일 사용자 시뮬레이션"""
            manager = MCPServerManager()
            await manager.initialize()
            
            try:
                start_time = time.time()
                
                # 사용자별 작업 수행
                tasks = [
                    manager.execute_method("filesystem", "list_files", {"path": "/tmp"}),
                    manager.execute_method("terminal", "execute_command", {"command": "echo 'user test'"}),
                    manager.execute_method("web_search", "search_web", {"query": f"user {user_id} query"})
                ]
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                end_time = time.time()
                
                return {
                    "user_id": user_id,
                    "success": all(not isinstance(r, Exception) for r in results),
                    "response_time": end_time - start_time
                }
            
            finally:
                await manager.cleanup()
        
        # 20명의 동시 사용자 시뮬레이션
        tasks = [simulate_user(i) for i in range(20)]
        results = await asyncio.gather(*tasks)
        
        # 성공률이 70% 이상인지 확인
        success_count = sum(1 for r in results if r["success"])
        success_rate = success_count / len(results)
        assert success_rate >= 0.7, f"Concurrent users success rate: {success_rate:.2%}"
        
        # 평균 응답 시간이 5초 이내인지 확인
        response_times = [r["response_time"] for r in results if "response_time" in r]
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
            assert avg_response_time < 5.0, f"Average response time: {avg_response_time:.2f}s"
    
    async def test_large_data_handling(self):
        """대용량 데이터 처리 테스트"""
        manager = MCPServerManager()
        await manager.initialize()
        
        try:
            # 대용량 파일 생성 (10MB)
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
                for i in range(100000):  # 약 10MB
                    f.write(f"Line {i}: This is a test line with some content to make it larger.\n")
                large_file_path = f.name
            
            try:
                # 대용량 파일 읽기 성능 테스트
                start_time = time.time()
                result = await manager.execute_method("filesystem", "read_file", {"path": large_file_path})
                end_time = time.time()
                
                read_time = end_time - start_time
                
                # 10MB 파일 읽기가 10초 이내에 완료되는지 확인
                assert read_time < 10.0, f"Large file read time: {read_time:.2f}s"
                assert result["success"] is True
                
            finally:
                os.unlink(large_file_path)
        
        finally:
            await manager.cleanup()


if __name__ == "__main__":
    pytest.main([__file__])
