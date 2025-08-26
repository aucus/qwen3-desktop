import React, { useState, useEffect, useRef } from 'react';
import './FileEditor.css';

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

interface FileEditorProps {
  file: FileInfo;
  content: string;
  loading: boolean;
  onSave: (filePath: string, content: string) => void;
  onCancel: () => void;
}

export const FileEditor: React.FC<FileEditorProps> = ({
  file,
  content,
  loading,
  onSave,
  onCancel
}) => {
  const [editedContent, setEditedContent] = useState(content);
  const [hasChanges, setHasChanges] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 내용이 변경되었는지 확인
  useEffect(() => {
    setHasChanges(editedContent !== content);
  }, [editedContent, content]);

  // 초기 내용 설정
  useEffect(() => {
    setEditedContent(content);
    setHasChanges(false);
  }, [content]);

  // 자동 저장 (5초마다)
  useEffect(() => {
    if (!hasChanges) return;

    const autoSaveTimer = setTimeout(() => {
      if (hasChanges) {
        onSave(file.path, editedContent);
        setHasChanges(false);
      }
    }, 5000);

    return () => clearTimeout(autoSaveTimer);
  }, [editedContent, hasChanges, file.path, onSave]);

  // 텍스트 영역 자동 크기 조정
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editedContent]);

  // 저장 핸들러
  const handleSave = () => {
    onSave(file.path, editedContent);
    setHasChanges(false);
  };

  // 취소 핸들러
  const handleCancel = () => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      onCancel();
    }
  };

  // 변경사항 버리기 확인
  const handleDiscardConfirm = () => {
    setShowDiscardConfirm(false);
    setEditedContent(content);
    setHasChanges(false);
    onCancel();
  };

  // 키보드 단축키 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+S: 저장
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Ctrl+Z: 실행 취소 (브라우저 기본 동작 사용)
    // Ctrl+Y: 다시 실행 (브라우저 기본 동작 사용)
    // Ctrl+F: 찾기 (추후 구현)
    // Ctrl+H: 바꾸기 (추후 구현)
  };

  // 탭 키 처리
  const handleKeyDownInTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      // 탭 문자 삽입
      const newContent = editedContent.substring(0, start) + '\t' + editedContent.substring(end);
      setEditedContent(newContent);
      
      // 커서 위치 조정
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);
    }
  };

  // 파일 정보 표시
  const renderFileInfo = () => (
    <div className="file-info-panel">
      <div className="info-item">
        <label>파일명:</label>
        <span>{file.name}</span>
      </div>
      <div className="info-item">
        <label>경로:</label>
        <span>{file.path}</span>
      </div>
      <div className="info-item">
        <label>크기:</label>
        <span>{formatFileSize(file.size)}</span>
      </div>
      {hasChanges && (
        <div className="info-item">
          <label>상태:</label>
          <span className="status-modified">수정됨</span>
        </div>
      )}
    </div>
  );

  // 파일 크기 포맷팅
  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined) return '-';
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 라인 번호 렌더링
  const renderLineNumbers = () => {
    const lines = editedContent.split('\n');
    return (
      <div className="line-numbers">
        {lines.map((_, index) => (
          <div key={index} className="line-number">
            {index + 1}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="file-editor">
      {/* 파일 정보 */}
      {renderFileInfo()}

      {/* 편집기 컨트롤 */}
      <div className="editor-controls">
        <div className="editor-options">
          <label>
            <input
              type="checkbox"
              checked={showLineNumbers}
              onChange={(e) => setShowLineNumbers(e.target.checked)}
            />
            라인 번호
          </label>
          <label>
            <input
              type="checkbox"
              checked={wordWrap}
              onChange={(e) => setWordWrap(e.target.checked)}
            />
            자동 줄바꿈
          </label>
        </div>

        <div className="font-size-control">
          <label>글꼴 크기:</label>
          <input
            type="range"
            min="10"
            max="24"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
          />
          <span>{fontSize}px</span>
        </div>

        <div className="editor-actions">
          <button
            type="button"
            className="save-btn"
            onClick={handleSave}
            disabled={!hasChanges || loading}
            title="저장 (Ctrl+S)"
          >
            💾 저장
          </button>
          <button
            type="button"
            className="cancel-btn"
            onClick={handleCancel}
            disabled={loading}
            title="취소"
          >
            ❌ 취소
          </button>
        </div>
      </div>

      {/* 편집기 내용 */}
      <div className="editor-content">
        {showLineNumbers && (
          <div className="line-numbers-panel">
            {renderLineNumbers()}
          </div>
        )}
        <div className="text-editor-container">
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onKeyDown={handleKeyDownInTextarea}
            className={`text-editor ${wordWrap ? 'word-wrap' : ''}`}
            style={{ fontSize: `${fontSize}px` }}
            placeholder="파일 내용을 편집하세요..."
            spellCheck={false}
            autoFocus
          />
        </div>
      </div>

      {/* 상태 표시줄 */}
      <div className="editor-statusbar">
        <div className="status-left">
          <span>라인: {editedContent.split('\n').length}</span>
          <span>문자: {editedContent.length}</span>
          <span>단어: {editedContent.trim().split(/\s+/).filter(word => word.length > 0).length}</span>
        </div>
        <div className="status-right">
          {hasChanges && <span className="status-indicator">수정됨</span>}
          {loading && <span className="status-indicator">저장 중...</span>}
        </div>
      </div>

      {/* 저장 확인 다이얼로그 */}
      {showSaveConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h4>저장 확인</h4>
            <p>변경사항을 저장하시겠습니까?</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn"
                onClick={() => {
                  setShowSaveConfirm(false);
                  handleSave();
                }}
              >
                저장
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowSaveConfirm(false)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 변경사항 버리기 확인 다이얼로그 */}
      {showDiscardConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h4>변경사항 버리기</h4>
            <p>저장하지 않은 변경사항이 있습니다. 정말로 버리시겠습니까?</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="discard-btn"
                onClick={handleDiscardConfirm}
              >
                버리기
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowDiscardConfirm(false)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
