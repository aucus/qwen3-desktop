import React, { useState } from 'react';
import './FileViewer.css';

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

interface FileViewerProps {
  file: FileInfo;
  content: string;
  loading: boolean;
  onEdit: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  file,
  content,
  loading,
  onEdit
}) => {
  const [viewMode, setViewMode] = useState<'text' | 'hex' | 'binary'>('text');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [fontSize, setFontSize] = useState(14);

  // 파일 확장자에 따른 뷰 모드 결정
  const getDefaultViewMode = (): 'text' | 'hex' | 'binary' => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const textExtensions = ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'scss', 'sass', 'xml', 'yaml', 'yml', 'ini', 'conf', 'log'];
    const binaryExtensions = ['exe', 'dll', 'so', 'dylib', 'bin'];
    
    if (binaryExtensions.includes(extension || '')) {
      return 'hex';
    } else if (textExtensions.includes(extension || '')) {
      return 'text';
    } else {
      // 파일 크기로 판단
      return (file.size || 0) > 1024 * 1024 ? 'hex' : 'text';
    }
  };

  // 초기 뷰 모드 설정
  React.useEffect(() => {
    setViewMode(getDefaultViewMode());
  }, [file.name]);

  // 텍스트를 16진수로 변환
  const toHex = (str: string): string => {
    return Array.from(str)
      .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');
  };

  // 텍스트를 바이너리로 변환
  const toBinary = (str: string): string => {
    return Array.from(str)
      .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
      .join(' ');
  };

  // 라인 번호가 있는 텍스트 렌더링
  const renderTextWithLineNumbers = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="text-content">
        {lines.map((line, index) => (
          <div key={index} className="text-line">
            {showLineNumbers && (
              <span className="line-number">{index + 1}</span>
            )}
            <span className="line-content">{line || ' '}</span>
          </div>
        ))}
      </div>
    );
  };

  // 16진수 뷰 렌더링
  const renderHexView = (text: string) => {
    const hex = toHex(text);
    const bytes = hex.split(' ');
    const rows = [];
    
    for (let i = 0; i < bytes.length; i += 16) {
      const rowBytes = bytes.slice(i, i + 16);
      const rowHex = rowBytes.join(' ');
      const rowAscii = rowBytes.map(byte => {
        const charCode = parseInt(byte, 16);
        return charCode >= 32 && charCode <= 126 ? String.fromCharCode(charCode) : '.';
      }).join('');
      
      rows.push(
        <div key={i} className="hex-row">
          <span className="hex-offset">{i.toString(16).padStart(8, '0')}</span>
          <span className="hex-bytes">{rowHex.padEnd(47, ' ')}</span>
          <span className="hex-ascii">{rowAscii}</span>
        </div>
      );
    }
    
    return <div className="hex-content">{rows}</div>;
  };

  // 바이너리 뷰 렌더링
  const renderBinaryView = (text: string) => {
    const binary = toBinary(text);
    const bits = binary.split(' ');
    const rows = [];
    
    for (let i = 0; i < bits.length; i += 8) {
      const rowBits = bits.slice(i, i + 8);
      const rowBinary = rowBits.join(' ');
      const rowAscii = rowBits.map(bit => {
        const charCode = parseInt(bit, 2);
        return charCode >= 32 && charCode <= 126 ? String.fromCharCode(charCode) : '.';
      }).join('');
      
      rows.push(
        <div key={i} className="binary-row">
          <span className="binary-offset">{i.toString(16).padStart(8, '0')}</span>
          <span className="binary-bits">{rowBinary.padEnd(95, ' ')}</span>
          <span className="binary-ascii">{rowAscii}</span>
        </div>
      );
    }
    
    return <div className="binary-content">{rows}</div>;
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
      <div className="info-item">
        <label>수정일:</label>
        <span>{formatDate(file.modified)}</span>
      </div>
      {file.permissions && (
        <div className="info-item">
          <label>권한:</label>
          <span>{file.permissions}</span>
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

  // 내용 렌더링
  const renderContent = () => {
    if (loading) {
      return (
        <div className="content-loading">
          <div className="loading-spinner"></div>
          <p>파일을 불러오는 중...</p>
        </div>
      );
    }

    switch (viewMode) {
      case 'text':
        return renderTextWithLineNumbers(content);
      case 'hex':
        return renderHexView(content);
      case 'binary':
        return renderBinaryView(content);
      default:
        return renderTextWithLineNumbers(content);
    }
  };

  return (
    <div className="file-viewer">
      {/* 파일 정보 */}
      {renderFileInfo()}

      {/* 뷰어 컨트롤 */}
      <div className="viewer-controls">
        <div className="view-mode-selector">
          <label>뷰 모드:</label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'text' | 'hex' | 'binary')}
          >
            <option value="text">텍스트</option>
            <option value="hex">16진수</option>
            <option value="binary">바이너리</option>
          </select>
        </div>

        {viewMode === 'text' && (
          <div className="text-options">
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
        )}

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

        <button
          type="button"
          className="edit-btn"
          onClick={onEdit}
          title="편집"
        >
          ✏️ 편집
        </button>
      </div>

      {/* 파일 내용 */}
      <div 
        className={`file-content ${viewMode} ${wordWrap ? 'word-wrap' : ''}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {renderContent()}
      </div>
    </div>
  );
};
