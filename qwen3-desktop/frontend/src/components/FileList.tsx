import React, { useState, useEffect } from 'react';
import { apiService, FileInfo } from '../services/apiService';
import { useAppStore } from '../stores/useAppStore';
import './FileList.css';

interface FileListProps {
  conversationId?: string;
  onFileSelect?: (file: FileInfo) => void;
  onFileDelete?: (filename: string) => void;
  className?: string;
}

export const FileList: React.FC<FileListProps> = ({
  conversationId,
  onFileSelect,
  onFileDelete,
  className = '',
}) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { currentConversationId } = useAppStore();

  // 파일 목록 로드
  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const fileList = await apiService.listFiles(conversationId || currentConversationId);
      setFiles(fileList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일 목록을 불러오는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 파일 삭제
  const handleFileDelete = async (filename: string) => {
    try {
      await apiService.deleteFile(filename, conversationId || currentConversationId);
      
      // 목록에서 제거
      setFiles(prev => prev.filter(file => file.filename !== filename));
      
      // 선택된 파일이 삭제된 경우 선택 해제
      if (selectedFile === filename) {
        setSelectedFile(null);
      }
      
      onFileDelete?.(filename);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일 삭제에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 파일 다운로드
  const handleFileDownload = async (file: FileInfo) => {
    try {
      const blob = await apiService.downloadFile(file.filename, conversationId || currentConversationId);
      
      // 다운로드 링크 생성
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일 다운로드에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 파일 선택
  const handleFileSelect = (file: FileInfo) => {
    setSelectedFile(file.filename);
    onFileSelect?.(file);
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 파일 타입별 아이콘
  const getFileIcon = (contentType: string): string => {
    if (contentType.startsWith('image/')) {
      return '🖼️';
    } else if (contentType.includes('pdf')) {
      return '📄';
    } else if (contentType.includes('text')) {
      return '📝';
    } else if (contentType.includes('json')) {
      return '⚙️';
    } else if (contentType.includes('csv')) {
      return '📊';
    } else {
      return '📁';
    }
  };

  // 날짜 포맷팅
  const formatDate = (timestamp: string): string => {
    const date = new Date(parseFloat(timestamp) * 1000);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 초기 로드
  useEffect(() => {
    loadFiles();
  }, [conversationId, currentConversationId]);

  // 새로고침 버튼
  const handleRefresh = () => {
    loadFiles();
  };

  if (loading && files.length === 0) {
    return (
      <div className={`file-list ${className}`}>
        <div className="file-list-header">
          <h3>파일 목록</h3>
          <button 
            type="button" 
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            🔄
          </button>
        </div>
        <div className="file-list-loading">
          <div className="loading-spinner"></div>
          <p>파일 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`file-list ${className}`}>
      <div className="file-list-header">
        <h3>파일 목록 ({files.length})</h3>
        <button 
          type="button" 
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={loading}
          title="새로고침"
        >
          🔄
        </button>
      </div>

      {error && (
        <div className="file-list-error">
          <p>{error}</p>
          <button 
            type="button" 
            className="retry-btn"
            onClick={handleRefresh}
          >
            다시 시도
          </button>
        </div>
      )}

      {files.length === 0 && !loading ? (
        <div className="file-list-empty">
          <p>업로드된 파일이 없습니다.</p>
        </div>
      ) : (
        <div className="file-list-content">
          {files.map((file) => (
            <div
              key={file.filename}
              className={`file-item ${selectedFile === file.filename ? 'selected' : ''}`}
              onClick={() => handleFileSelect(file)}
            >
              <div className="file-icon">
                {getFileIcon(file.content_type)}
              </div>
              
              <div className="file-info">
                <div className="file-name">{file.filename}</div>
                <div className="file-meta">
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  <span className="file-date">{formatDate(file.uploaded_at)}</span>
                </div>
              </div>
              
              <div className="file-actions">
                <button
                  type="button"
                  className="action-btn download-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileDownload(file);
                  }}
                  title="다운로드"
                >
                  ⬇️
                </button>
                <button
                  type="button"
                  className="action-btn delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`"${file.filename}" 파일을 삭제하시겠습니까?`)) {
                      handleFileDelete(file.filename);
                    }
                  }}
                  title="삭제"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && files.length > 0 && (
        <div className="file-list-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};
