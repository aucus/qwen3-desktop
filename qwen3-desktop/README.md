# Qwen 3 Desktop Assistant

로컬 Qwen 3 LLM을 Claude Desktop App과 유사한 GUI 환경에서 활용하고, MCP(Model Context Protocol)를 통해 확장 기능을 제공하는 통합 시스템입니다.

## 🎯 주요 기능

- **로컬 LLM 지원**: Qwen 3 모델을 로컬에서 실행
- **Claude Desktop App 유사 인터페이스**: 직관적이고 깔끔한 채팅 인터페이스
- **MCP 통합**: 파일 시스템, 웹 검색, 터미널 등 다양한 도구 연결
- **시스템 프롬프트 관리**: 템플릿 시스템과 사용자 정의 프롬프트 지원
- **개인정보 보호**: 모든 데이터 로컬 저장

## 🏗 기술 스택

### 프론트엔드
- Electron
- React/Vue.js
- TypeScript
- CSS/SCSS

### 백엔드
- Python
- FastAPI/Flask
- Qwen 3 LLM

### MCP 서버
- Model Context Protocol
- JSON-RPC
- 다양한 도구 서버

## 📁 프로젝트 구조

```
qwen3-desktop/
├── frontend/                 # Electron 앱
├── backend/                  # Python 백엔드
├── mcp_servers/             # MCP 서버들
├── prompts/                 # 프롬프트 템플릿
├── data/                    # 사용자 데이터
└── docs/                    # 문서
```

## 🚀 설치 및 실행

### 요구사항
- Node.js 18+
- Python 3.8+
- Qwen 3 모델 (로컬 설치)

### 설치 방법
```bash
# 저장소 클론
git clone [repository-url]
cd qwen3-desktop

# 프론트엔드 의존성 설치
cd frontend
npm install

# 백엔드 의존성 설치
cd ../backend
pip install -r requirements.txt
```

### 실행 방법
```bash
# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build
```

## 📖 문서

- [사용자 가이드](docs/user_guide/)
- [API 문서](docs/api/)
- [개발자 가이드](docs/developer_guide/)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 연락처

프로젝트 링크: [https://github.com/username/qwen3-desktop](https://github.com/username/qwen3-desktop)

---

**개발 상태**: 개발 중
**버전**: 0.1.0
