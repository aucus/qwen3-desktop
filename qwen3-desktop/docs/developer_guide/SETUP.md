# 개발 환경 설정 가이드

## 📋 요구사항

### 시스템 요구사항
- **OS**: macOS 10.15+, Windows 10+, Ubuntu 18.04+
- **RAM**: 최소 8GB (16GB 권장)
- **저장공간**: 최소 10GB 여유 공간
- **GPU**: CUDA 지원 GPU (선택사항, 가속화용)

### 소프트웨어 요구사항
- **Node.js**: 18.0.0 이상
- **Python**: 3.8.0 이상
- **Git**: 2.20.0 이상
- **npm**: 8.0.0 이상
- **pip**: 20.0.0 이상

## 🛠 설치 과정

### 1. Node.js 설치

#### macOS (Homebrew 사용)
```bash
brew install node
```

#### Windows
1. [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드
2. 설치 프로그램 실행

#### Ubuntu/Debian
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Python 설치

#### macOS (Homebrew 사용)
```bash
brew install python@3.11
```

#### Windows
1. [Python 공식 사이트](https://python.org/)에서 3.11 버전 다운로드
2. 설치 시 "Add Python to PATH" 옵션 체크

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install python3.11 python3.11-pip python3.11-venv
```

### 3. Git 설치

#### macOS
```bash
brew install git
```

#### Windows
1. [Git 공식 사이트](https://git-scm.com/)에서 다운로드
2. 설치 프로그램 실행

#### Ubuntu/Debian
```bash
sudo apt install git
```

## 🔧 개발 환경 설정

### 1. 프로젝트 클론
```bash
git clone [repository-url]
cd qwen3-desktop
```

### 2. Python 가상환경 설정
```bash
# 가상환경 생성
python3 -m venv venv

# 가상환경 활성화
# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. 백엔드 의존성 설치
```bash
cd backend
pip install -r requirements.txt
```

### 4. 프론트엔드 의존성 설치
```bash
cd ../frontend
npm install
```

## 🚀 개발 서버 실행

### 1. 백엔드 서버 실행
```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 프론트엔드 개발 서버 실행
```bash
cd frontend
npm run dev
```

### 3. Electron 앱 실행
```bash
cd frontend
npm run electron:dev
```

## 🔍 문제 해결

### 일반적인 문제들

#### Node.js 버전 문제
```bash
# Node.js 버전 확인
node --version

# nvm을 사용한 버전 관리
nvm install 18
nvm use 18
```

#### Python 가상환경 문제
```bash
# 가상환경 재생성
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### 권한 문제 (Linux/macOS)
```bash
# npm 글로벌 패키지 권한 설정
sudo chown -R $USER:$GROUP ~/.npm
sudo chown -R $USER:$GROUP ~/.config
```

#### 포트 충돌 문제
```bash
# 포트 사용 확인
lsof -i :8000
lsof -i :3000

# 프로세스 종료
kill -9 [PID]
```

## 📝 개발 도구 설정

### VS Code 확장 프로그램
- Python
- JavaScript and TypeScript Nightly
- ESLint
- Prettier
- GitLens
- Auto Rename Tag
- Bracket Pair Colorizer

### 브라우저 확장 프로그램
- React Developer Tools
- Vue.js devtools

## 🧪 테스트 환경

### 단위 테스트 실행
```bash
# 백엔드 테스트
cd backend
pytest

# 프론트엔드 테스트
cd frontend
npm test
```

### 통합 테스트 실행
```bash
npm run test:integration
```

## 📊 성능 모니터링

### 메모리 사용량 확인
```bash
# 프로세스별 메모리 사용량
ps aux | grep node
ps aux | grep python
```

### CPU 사용량 확인
```bash
# 실시간 CPU 사용량
top
htop
```

## 🔒 보안 설정

### API 키 관리
```bash
# 환경 변수 설정
cp .env.example .env
# .env 파일에 API 키 추가
```

### 개발용 SSL 인증서
```bash
# 자체 서명 인증서 생성
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

## 📚 추가 리소스

- [Electron 공식 문서](https://www.electronjs.org/docs)
- [React 공식 문서](https://reactjs.org/docs)
- [FastAPI 공식 문서](https://fastapi.tiangolo.com/)
- [MCP 공식 문서](https://modelcontextprotocol.io/)

---

**마지막 업데이트**: 2024년 1월
**문서 버전**: 1.0.0
