import React, { useState } from 'react';
import './FileSearch.css';

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

interface FileSearchProps {
  searchQuery: string;
  searchResults: FileInfo[];
  loading: boolean;
  onSearchQueryChange: (query: string) => void;
  onFileSelect: (file: FileInfo) => void;
}

export const FileSearch: React.FC<FileSearchProps> = ({
  searchQuery,
  searchResults,
  loading,
  onSearchQueryChange,
  onFileSelect
}) => {
  const [searchType, setSearchType] = useState<'name' | 'content' | 'both'>('name');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<'all' | 'files' | 'directories'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // 검색 옵션 변경 핸들러
  const handleSearchTypeChange = (type: 'name' | 'content' | 'both') => {
    setSearchType(type);
    // 검색 타입이 변경되면 검색을 다시 실행
    if (searchQuery) {
      onSearchQueryChange(searchQuery);
    }
  };

  // 정렬된 결과 가져오기
  const getSortedResults = () => {
    return [...searchResults].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'modified':
          comparison = new Date(a.modified || '').getTime() - new Date(b.modified || '').getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  // 필터된 결과 가져오기
  const getFilteredResults = () => {
    let filtered = getSortedResults();
    
    if (fileTypeFilter !== 'all') {
      filtered = filtered.filter(file => 
        fileTypeFilter === 'files' ? file.type === 'file' : file.type === 'directory'
      );
    }
    
    return filtered;
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

  // 검색 결과 하이라이트
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm || !caseSensitive) return text;
    
    const regex = new RegExp(`(${searchTerm})`, caseSensitive ? 'g' : 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? <mark key={index}>{part}</mark> : part
    );
  };

  const filteredResults = getFilteredResults();

  return (
    <div className="file-search">
      {/* 검색 입력 */}
      <div className="search-input-section">
        <div className="search-input-container">
          <input
            type="text"
            placeholder="파일명 또는 내용으로 검색..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="search-input"
            autoFocus
          />
          {loading && (
            <div className="search-loading">
              <div className="loading-spinner"></div>
            </div>
          )}
        </div>
      </div>

      {/* 검색 옵션 */}
      <div className="search-options">
        <div className="search-type-selector">
          <label>검색 타입:</label>
          <select
            value={searchType}
            onChange={(e) => handleSearchTypeChange(e.target.value as 'name' | 'content' | 'both')}
          >
            <option value="name">파일명만</option>
            <option value="content">내용만</option>
            <option value="both">파일명 + 내용</option>
          </select>
        </div>

        <div className="search-filters">
          <label>
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            대소문자 구분
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(e) => setIncludeHidden(e.target.checked)}
            />
            숨김 파일 포함
          </label>
        </div>

        <div className="file-type-filter">
          <label>파일 타입:</label>
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value as 'all' | 'files' | 'directories')}
          >
            <option value="all">모든 파일</option>
            <option value="files">파일만</option>
            <option value="directories">디렉토리만</option>
          </select>
        </div>
      </div>

      {/* 정렬 옵션 */}
      <div className="sort-options">
        <div className="sort-by">
          <label>정렬 기준:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'size' | 'modified')}
          >
            <option value="name">이름</option>
            <option value="size">크기</option>
            <option value="modified">수정일</option>
          </select>
        </div>
        <div className="sort-order">
          <label>정렬 순서:</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="asc">오름차순</option>
            <option value="desc">내림차순</option>
          </select>
        </div>
      </div>

      {/* 검색 결과 */}
      <div className="search-results">
        <div className="results-header">
          <h4>검색 결과 ({filteredResults.length}개)</h4>
          {searchQuery && (
            <span className="search-query">
              "{searchQuery}" 검색 결과
            </span>
          )}
        </div>

        {loading ? (
          <div className="results-loading">
            <div className="loading-spinner"></div>
            <p>검색 중...</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="results-empty">
            {searchQuery ? (
              <p>검색 결과가 없습니다.</p>
            ) : (
              <p>검색어를 입력하세요.</p>
            )}
          </div>
        ) : (
          <div className="results-list">
            <div className="results-list-header">
              <div className="header-name">이름</div>
              <div className="header-path">경로</div>
              <div className="header-size">크기</div>
              <div className="header-modified">수정일</div>
            </div>
            
            <div className="results-list-content">
              {filteredResults.map((file) => (
                <div
                  key={file.path}
                  className="result-item"
                  onClick={() => onFileSelect(file)}
                  onDoubleClick={() => onFileSelect(file)}
                >
                  <div className="result-info">
                    <div className="result-icon">
                      {getFileIcon(file)}
                    </div>
                    <div className="result-name" title={file.name}>
                      {highlightSearchTerm(file.name, searchQuery)}
                    </div>
                  </div>
                  <div className="result-path" title={file.path}>
                    {file.path}
                  </div>
                  <div className="result-size">
                    {file.type === 'directory' ? '-' : formatFileSize(file.size)}
                  </div>
                  <div className="result-modified">
                    {formatDate(file.modified)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 검색 히스토리 (추후 구현) */}
      <div className="search-history">
        <h5>최근 검색</h5>
        <div className="history-list">
          <p>검색 히스토리 기능은 추후 구현 예정입니다.</p>
        </div>
      </div>
    </div>
  );
};
