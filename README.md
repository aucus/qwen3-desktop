# Qwen 3 Desktop Assistant

Qwen 3 LLM을 로컬에서 실행하고 MCP(Model Context Protocol)를 통해 다양한 도구들과 연동하는 데스크톱 애플리케이션입니다.

## 🚀 주요 기능

### 💬 AI 채팅
- Qwen 3 LLM을 통한 자연어 대화
- 실시간 스트리밍 응답
- 대화 히스토리 관리
- 파일 업로드 및 분석

### 🛠️ MCP 도구 통합
- **파일시스템 도구**: 파일 탐색, 편집, 검색
- **웹 검색 도구**: 다중 검색 엔진, 결과 미리보기
- **터미널 도구**: 명령어 실행, 프로세스 관리
- **데이터베이스 도구**: SQL 쿼리 실행, 데이터 관리

### 🎨 사용자 인터페이스
- Electron 기반 데스크톱 앱
- React + TypeScript 프론트엔드
- 다크/라이트 테마 지원
- 반응형 디자인

## 📋 시스템 요구사항

### 필수 요구사항
- **OS**: macOS 10.15+, Windows 10+, Linux (Ubuntu 18.04+)
- **Python**: 3.8+
- **Node.js**: 18+
- **RAM**: 최소 8GB (Qwen 3 모델 로딩용)
- **저장공간**: 최소 10GB (모델 파일 포함)

### 권장 사항
- **RAM**: 16GB+
- **GPU**: NVIDIA GPU (CUDA 지원)
- **저장공간**: 20GB+

## 🛠️ 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/your-username/qwen3-desktop.git
cd qwen3-desktop
```

### 2. 백엔드 설정
```bash
cd backend

# Python 가상환경 생성
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 Qwen 3 모델 경로 설정
```

### 3. 프론트엔드 설정
```bash
cd frontend

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
```

### 4. 애플리케이션 실행
```bash
# 백엔드 실행 (backend 디렉토리에서)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드 실행 (frontend 디렉토리에서)
npm run dev

# Electron 앱 실행
npm run electron
```

## 📁 프로젝트 구조

```
qwen3-desktop/
├── backend/                 # Python FastAPI 백엔드
│   ├── app/
│   │   ├── api/            # API 엔드포인트
│   │   ├── services/       # 비즈니스 로직
│   │   ├── utils/          # 유틸리티 함수
│   │   └── main.py         # 애플리케이션 진입점
│   ├── requirements.txt    # Python 의존성
│   └── mcp_config.json    # MCP 서버 설정
├── frontend/               # React + Electron 프론트엔드
│   ├── src/
│   │   ├── components/     # React 컴포넌트
│   │   ├── services/       # API 서비스
│   │   ├── stores/         # 상태 관리
│   │   └── styles/         # CSS 스타일
│   ├── package.json        # Node.js 의존성
│   └── main.js            # Electron 메인 프로세스
├── PRD.md                 # 제품 요구사항 문서
├── Tasks.md               # 개발 작업 목록
└── README.md              # 프로젝트 문서
```

## 🔧 MCP 도구 설정

### 파일시스템 도구
- 로컬 파일 시스템 접근
- 파일 읽기/쓰기/삭제
- 디렉토리 탐색
- 파일 검색

### 웹 검색 도구
- Google, Bing, DuckDuckGo 검색
- YouTube, Wikipedia, GitHub 검색
- 검색 결과 미리보기
- 검색 히스토리 관리

### 터미널 도구
- 명령어 실행
- 프로세스 관리
- 명령어 히스토리
- 실시간 출력

### 데이터베이스 도구
- SQLite 데이터베이스 연결
- SQL 쿼리 실행
- 결과 테이블 표시
- 쿼리 히스토리

## 🎯 개발 로드맵

### Phase 1: 기본 시스템 ✅
- [x] Electron + React 프론트엔드
- [x] FastAPI 백엔드
- [x] Qwen 3 모델 연결
- [x] 기본 채팅 인터페이스
- [x] 파일 업로드 기능

### Phase 2: MCP 도구 통합 ✅
- [x] MCP 클라이언트 구현
- [x] 핵심 MCP 서버 연결
- [x] MCP 도구 패널 UI
- [x] 파일시스템 도구
- [x] 웹 검색 도구
- [x] 터미널 도구
- [ ] 데이터베이스 도구

### Phase 3: 고급 기능
- [ ] 플러그인 시스템
- [ ] 사용자 설정 관리
- [ ] 백업 및 복원
- [ ] 성능 최적화

### Phase 4: 배포 및 배포
- [ ] 자동 업데이트
- [ ] 인스톨러 패키징
- [ ] 문서화
- [ ] 테스트 자동화

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙏 감사의 말

- [Qwen Team](https://github.com/QwenLM) - Qwen 3 모델 제공
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP 표준
- [Electron](https://electronjs.org/) - 크로스 플랫폼 데스크톱 앱 프레임워크
- [React](https://reactjs.org/) - 사용자 인터페이스 라이브러리
- [FastAPI](https://fastapi.tiangolo.com/) - 고성능 웹 프레임워크

## 📞 지원

문제가 있거나 제안사항이 있으시면 [Issues](https://github.com/your-username/qwen3-desktop/issues)를 통해 알려주세요.

---

**Qwen 3 Desktop Assistant** - 로컬 AI 어시스턴트의 새로운 경험을 시작하세요! 🚀
