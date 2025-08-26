import React, { useState } from 'react';
import './FileExplorer.css';

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

interface FileExplorerProps {
  currentPath: string;
  files: FileInfo[];
  selectedFile: FileInfo | null;
  loading: boolean;
  onFileSelect: (file: FileInfo) => void;
  onPathChange: (path: string) => void;
  onLoadDirectory: (path: string) => void;
  onCreateFile: (fileName: string) => void;
  onCreateDirectory: (dirName: string) => void;
  onDeleteItem: (item: FileInfo) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  currentPath,
  files,
  selectedFile,
  loading,
  onFileSelect,
  onPathChange,
  onLoadDirectory,
  onCreateFile,
  onCreateDirectory,
  onDeleteItem
}) => {
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [createType, setCreateType] = useState<'file' | 'directory'>('file');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<FileInfo | null>(null);

  // 경로 이동
  const navigateToPath = (path: string) => {
    onPathChange(path);
    onLoadDirectory(path);
  };

  // 상위 디렉토리로 이동
  const goToParent = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '.';
    navigateToPath(parentPath);
  };

  // 홈 디렉토리로 이동
  const goToHome = () => {
    navigateToPath('.');
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined) return '-';
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 날짜 포맷팅
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return dateString;
    }
  };

  // 새 아이템 생성
  const handleCreateItem = () => {
    if (!newItemName.trim()) return;
    
    if (createType === 'file') {
      onCreateFile(newItemName);
    } else {
      onCreateDirectory(newItemName);
    }
    
    setNewItemName('');
    setShowCreateMenu(false);
  };

  // 삭제 확인
  const handleDeleteConfirm = () => {
    if (showDeleteConfirm) {
      onDeleteItem(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  // 파일 아이콘 가져오기
  const getFileIcon = (file: FileInfo): string => {
    if (file.type === 'directory') return '📁';
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    const iconMap: { [key: string]: string } = {
      'txt': '📄',
      'md': '📝',
      'json': '📋',
      'js': '📜',
      'ts': '📜',
      'jsx': '⚛️',
      'tsx': '⚛️',
      'py': '🐍',
      'java': '☕',
      'cpp': '⚙️',
      'c': '⚙️',
      'html': '🌐',
      'css': '🎨',
      'scss': '🎨',
      'sass': '🎨',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
      'pdf': '📕',
      'doc': '📘',
      'docx': '📘',
      'xls': '📊',
      'xlsx': '📊',
      'zip': '📦',
      'tar': '📦',
      'gz': '📦',
      'rar': '📦',
      'mp3': '🎵',
      'mp4': '🎬',
      'avi': '🎬',
      'mov': '🎬'
    };
    
    return iconMap[extension || ''] || '📄';
  };

  return (
    <div className="file-explorer">
      {/* 경로 네비게이션 */}
      <div className="path-navigation">
        <div className="path-breadcrumb">
          <button
            type="button"
            className="nav-btn home-btn"
            onClick={goToHome}
            title="홈"
          >
            🏠
          </button>
          <button
            type="button"
            className="nav-btn parent-btn"
            onClick={goToParent}
            disabled={currentPath === '.'}
            title="상위 디렉토리"
          >
            ⬆️
          </button>
          <div className="path-display">
            <span className="path-text">{currentPath}</span>
          </div>
        </div>
        <div className="path-actions">
          <button
            type="button"
            className="create-btn"
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            title="새로 만들기"
          >
            ➕
          </button>
        </div>
      </div>

      {/* 새 아이템 생성 메뉴 */}
      {showCreateMenu && (
        <div className="create-menu">
          <div className="create-menu-header">
            <h4>새로 만들기</h4>
            <button
              type="button"
              className="close-btn"
              onClick={() => setShowCreateMenu(false)}
            >
              ✕
            </button>
          </div>
          <div className="create-menu-content">
            <div className="create-type-selector">
              <label>
                <input
                  type="radio"
                  value="file"
                  checked={createType === 'file'}
                  onChange={(e) => setCreateType(e.target.value as 'file' | 'directory')}
                />
                📄 파일
              </label>
              <label>
                <input
                  type="radio"
                  value="directory"
                  checked={createType === 'directory'}
                  onChange={(e) => setCreateType(e.target.value as 'file' | 'directory')}
                />
                📁 디렉토리
              </label>
            </div>
            <input
              type="text"
              placeholder={`새 ${createType === 'file' ? '파일' : '디렉토리'} 이름`}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateItem()}
              autoFocus
            />
            <div className="create-menu-actions">
              <button
                type="button"
                className="create-confirm-btn"
                onClick={handleCreateItem}
                disabled={!newItemName.trim()}
              >
                만들기
              </button>
              <button
                type="button"
                className="create-cancel-btn"
                onClick={() => setShowCreateMenu(false)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 파일 목록 */}
      <div className="file-list">
        <div className="file-list-header">
          <div className="header-name">이름</div>
          <div className="header-size">크기</div>
          <div className="header-modified">수정일</div>
          <div className="header-actions">작업</div>
        </div>
        
        <div className="file-list-content">
          {loading ? (
            <div className="loading-placeholder">
              <div className="loading-spinner"></div>
              <p>파일 목록을 불러오는 중...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="empty-placeholder">
              <p>이 디렉토리는 비어있습니다.</p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.path}
                className={`file-item ${selectedFile?.path === file.path ? 'selected' : ''}`}
                onClick={() => onFileSelect(file)}
                onDoubleClick={() => onFileSelect(file)}
              >
                <div className="file-info">
                  <div className="file-icon">
                    {getFileIcon(file)}
                  </div>
                  <div className="file-name" title={file.name}>
                    {file.name}
                  </div>
                </div>
                <div className="file-size">
                  {file.type === 'directory' ? '-' : formatFileSize(file.size)}
                </div>
                <div className="file-modified">
                  {formatDate(file.modified)}
                </div>
                <div className="file-actions">
                  <button
                    type="button"
                    className="action-btn delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(file);
                    }}
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-dialog">
            <h4>삭제 확인</h4>
            <p>
              "{showDeleteConfirm.name}"을(를) 삭제하시겠습니까?
              {showDeleteConfirm.type === 'directory' && ' 이 디렉토리와 그 안의 모든 내용이 삭제됩니다.'}
            </p>
            <div className="delete-confirm-actions">
              <button
                type="button"
                className="delete-confirm-btn"
                onClick={handleDeleteConfirm}
              >
                삭제
              </button>
              <button
                type="button"
                className="delete-cancel-btn"
                onClick={() => setShowDeleteConfirm(null)}
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
