import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { apiService } from '../services/apiService';
import { useAppStore } from '../stores/useAppStore';
import './FileUpload.css';

interface FileUploadProps {
  conversationId?: string;
  onUploadComplete?: (fileInfo: any) => void;
  onUploadError?: (error: string) => void;
  className?: string;
}

interface UploadProgress {
  filename: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  conversationId,
  onUploadComplete,
  onUploadError,
  className = '',
}) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addMessage } = useAppStore();

  // 파일 업로드 처리
  const handleFileUpload = useCallback(async (files: File[]) => {
    const newProgress: UploadProgress[] = files.map(file => ({
      filename: file.name,
      progress: 0,
      status: 'uploading',
    }));

    setUploadProgress(prev => [...prev, ...newProgress]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progressIndex = uploadProgress.length + i;

      try {
        // 파일 크기 검증
        if (file.size > 50 * 1024 * 1024) { // 50MB 제한
          throw new Error('파일 크기가 50MB를 초과합니다.');
        }

        // 파일 타입 검증
        const allowedTypes = [
          'text/plain',
          'text/markdown',
          'text/csv',
          'application/json',
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ];

        if (!allowedTypes.includes(file.type)) {
          throw new Error('지원하지 않는 파일 타입입니다.');
        }

        // 업로드 진행률 시뮬레이션
        const updateProgress = (progress: number) => {
          setUploadProgress(prev => 
            prev.map((item, index) => 
              index === progressIndex 
                ? { ...item, progress }
                : item
            )
          );
        };

        // 실제 파일 업로드
        const fileInfo = await apiService.uploadFile(file, conversationId);
        
        // 진행률 100%로 업데이트
        updateProgress(100);
        
        // 성공 상태로 업데이트
        setUploadProgress(prev => 
          prev.map((item, index) => 
            index === progressIndex 
              ? { ...item, status: 'completed' }
              : item
          )
        );

        // 채팅에 파일 업로드 메시지 추가
        if (conversationId) {
          addMessage(conversationId, {
            role: 'user',
            content: `파일을 업로드했습니다: ${file.name}`,
            timestamp: new Date(),
            attachments: [fileInfo],
          });
        }

        // 콜백 호출
        onUploadComplete?.(fileInfo);

        // 파일 분석 시도
        try {
          const analysis = await apiService.analyzeFile(fileInfo.filename, conversationId);
          console.log('File analysis:', analysis);
        } catch (analysisError) {
          console.warn('File analysis failed:', analysisError);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '업로드 실패';
        
        // 에러 상태로 업데이트
        setUploadProgress(prev => 
          prev.map((item, index) => 
            index === progressIndex 
              ? { ...item, status: 'error', error: errorMessage }
              : item
          )
        );

        onUploadError?.(errorMessage);
      }
    }
  }, [conversationId, onUploadComplete, onUploadError, addMessage, uploadProgress.length]);

  // 드래그 앤 드롭 설정
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsDragging(false);
    handleFileUpload(acceptedFiles);
  }, [handleFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    multiple: true,
    accept: {
      'text/*': ['.txt', '.md', '.csv', '.json'],
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    },
  });

  // 파일 선택 버튼 클릭
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 파일 입력 변경
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      handleFileUpload(Array.from(files));
    }
    // 입력 초기화
    event.target.value = '';
  };

  // 업로드 진행률 제거
  const removeProgress = (index: number) => {
    setUploadProgress(prev => prev.filter((_, i) => i !== index));
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`file-upload ${className}`}>
      {/* 드래그 앤 드롭 영역 */}
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive || isDragging ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="dropzone-content">
          <div className="upload-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <p className="upload-text">
            {isDragActive || isDragging 
              ? '파일을 여기에 놓으세요' 
              : '파일을 드래그하거나 클릭하여 업로드하세요'
            }
          </p>
          <p className="upload-hint">
            지원 형식: TXT, MD, CSV, JSON, PDF, JPG, PNG, GIF, WEBP (최대 50MB)
          </p>
          <button 
            type="button" 
            className="select-files-btn"
            onClick={handleFileSelect}
          >
            파일 선택
          </button>
        </div>
      </div>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,.pdf,.jpg,.jpeg,.png,.gif,.webp"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {/* 업로드 진행률 */}
      {uploadProgress.length > 0 && (
        <div className="upload-progress">
          <h4>업로드 진행률</h4>
          {uploadProgress.map((item, index) => (
            <div key={index} className={`progress-item ${item.status}`}>
              <div className="progress-info">
                <span className="filename">{item.filename}</span>
                <span className="status">
                  {item.status === 'uploading' && '업로드 중...'}
                  {item.status === 'completed' && '완료'}
                  {item.status === 'error' && '오류'}
                </span>
              </div>
              
              {item.status === 'uploading' && (
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              
              {item.status === 'completed' && (
                <div className="progress-complete">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                </div>
              )}
              
              {item.status === 'error' && (
                <div className="progress-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span className="error-message">{item.error}</span>
                </div>
              )}
              
              <button
                type="button"
                className="remove-progress"
                onClick={() => removeProgress(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
