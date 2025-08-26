import pytest
import asyncio
import tempfile
import os
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 테스트 설정
pytest_plugins = [
    "pytest_asyncio",
]

# pytest-asyncio 설정
@pytest.fixture(scope="session")
def event_loop():
    """이벤트 루프 생성"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# 공통 테스트 설정
@pytest.fixture(scope="session")
def test_config():
    """테스트 설정"""
    return {
        "test_mode": True,
        "log_level": "DEBUG",
        "temp_dir": tempfile.mkdtemp(),
        "max_file_size": 1024 * 1024,  # 1MB
        "timeout": 30,
    }

@pytest.fixture
def temp_dir():
    """임시 디렉토리 생성"""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir

@pytest.fixture
def sample_files(temp_dir):
    """샘플 파일들 생성"""
    files = {
        "text.txt": "This is a sample text file.",
        "data.json": '{"name": "test", "value": 123}',
        "script.py": "print('Hello, World!')",
        "empty.txt": "",
    }
    
    created_files = {}
    for filename, content in files.items():
        file_path = os.path.join(temp_dir, filename)
        with open(file_path, "w") as f:
            f.write(content)
        created_files[filename] = file_path
    
    yield created_files

@pytest.fixture
def sample_database(temp_dir):
    """샘플 데이터베이스 생성"""
    import sqlite3
    
    db_path = os.path.join(temp_dir, "test.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 테스트 테이블 생성
    cursor.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            title TEXT NOT NULL,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    
    # 샘플 데이터 삽입
    cursor.execute("INSERT INTO users (name, email) VALUES (?, ?)", ("John Doe", "john@example.com"))
    cursor.execute("INSERT INTO users (name, email) VALUES (?, ?)", ("Jane Smith", "jane@example.com"))
    
    cursor.execute("INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)", 
                   (1, "First Post", "This is the first post content"))
    cursor.execute("INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)", 
                   (2, "Second Post", "This is the second post content"))
    
    conn.commit()
    conn.close()
    
    yield db_path

# Mock 설정
@pytest.fixture
def mock_requests():
    """requests 모듈 Mock"""
    import requests
    from unittest.mock import Mock, patch
    
    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {
                    "title": "Test Result",
                    "url": "https://example.com",
                    "snippet": "Test snippet"
                }
            ]
        }
        mock_get.return_value = mock_response
        yield mock_get

@pytest.fixture
def mock_subprocess():
    """subprocess 모듈 Mock"""
    from unittest.mock import Mock, patch
    
    with patch('subprocess.run') as mock_run:
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = b"Command output"
        mock_result.stderr = b""
        mock_run.return_value = mock_result
        yield mock_run

# 성능 테스트 설정
@pytest.fixture
def performance_thresholds():
    """성능 테스트 임계값"""
    return {
        "response_time": 3.0,  # 초
        "memory_usage": 100,   # MB
        "cpu_usage": 50,       # %
        "concurrent_requests": 10,
        "success_rate": 0.8,   # 80%
    }

# 로깅 설정
@pytest.fixture(autouse=True)
def setup_logging():
    """테스트 로깅 설정"""
    import logging
    
    # 테스트 로거 설정
    test_logger = logging.getLogger("test")
    test_logger.setLevel(logging.DEBUG)
    
    # 콘솔 핸들러 추가
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    
    # 포맷터 설정
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    
    test_logger.addHandler(console_handler)
    
    yield test_logger
    
    # 정리
    test_logger.removeHandler(console_handler)

# 테스트 데이터 생성기
@pytest.fixture
def test_data_generator():
    """테스트 데이터 생성기"""
    import random
    import string
    
    def generate_text(length=100):
        """랜덤 텍스트 생성"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))
    
    def generate_file_content(lines=100):
        """파일 내용 생성"""
        return '\n'.join([generate_text(50) for _ in range(lines)])
    
    def generate_json_data(records=10):
        """JSON 데이터 생성"""
        return [
            {
                "id": i,
                "name": f"Item {i}",
                "value": random.randint(1, 1000),
                "description": generate_text(100)
            }
            for i in range(records)
        ]
    
    return {
        "generate_text": generate_text,
        "generate_file_content": generate_file_content,
        "generate_json_data": generate_json_data,
    }

# 환경 변수 설정
@pytest.fixture(autouse=True)
def setup_test_env():
    """테스트 환경 변수 설정"""
    # 테스트 모드 설정
    os.environ["TEST_MODE"] = "true"
    os.environ["LOG_LEVEL"] = "DEBUG"
    
    # 임시 디렉토리 설정
    temp_dir = tempfile.mkdtemp()
    os.environ["TEMP_DIR"] = temp_dir
    
    yield
    
    # 정리
    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)
    os.environ.pop("TEST_MODE", None)
    os.environ.pop("LOG_LEVEL", None)
    os.environ.pop("TEMP_DIR", None)
