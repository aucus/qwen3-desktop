import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useStreaming } from '../services/streamingService';
import { FileUpload } from './FileUpload';
import './InputArea.css';

interface InputAreaProps {
  conversationId: string;
}

const InputArea: React.FC<InputAreaProps> = ({ conversationId }) => {
  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addMessage, setLoading } = useAppStore();
  const { sendMessage, isStreaming } = useStreaming();

  // 자동 높이 조정
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isComposing || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    
    // 자동 높이 조정
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // 스트리밍 서비스 사용
    await sendMessage(conversationId, userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  // 파일 업로드 토글
  const toggleFileUpload = () => {
    setShowFileUpload(!showFileUpload);
  };

  // 파일 업로드 완료 처리
  const handleFileUploadComplete = (fileInfo: any) => {
    console.log('File uploaded:', fileInfo);
    setShowFileUpload(false);
  };

  // 파일 업로드 에러 처리
  const handleFileUploadError = (error: string) => {
    console.error('File upload error:', error);
    // TODO: 에러 메시지 표시
  };

  return (
    <div className="input-area">
      {/* 파일 업로드 영역 */}
      {showFileUpload && (
        <div className="file-upload-container">
          <FileUpload
            conversationId={conversationId}
            onUploadComplete={handleFileUploadComplete}
            onUploadError={handleFileUploadError}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="input-form">
        <div className="input-container">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="메시지를 입력하세요... (Shift + Enter로 줄바꿈)"
            className="message-input"
            rows={1}
            maxLength={4000}
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={!input.trim() || isComposing || isStreaming}
            className="send-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        
        <div className="input-actions">
          <button 
            type="button" 
            className={`action-button ${showFileUpload ? 'active' : ''}`}
            onClick={toggleFileUpload}
            title="파일 첨부"
          >
            📎
          </button>
          <button type="button" className="action-button" title="이미지 첨부">
            🖼️
          </button>
          <button type="button" className="action-button" title="음성 입력">
            🎤
          </button>
        </div>
      </form>
    </div>
  );
};

export default InputArea;
