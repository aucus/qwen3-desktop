import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { FileExplorer } from './FileExplorer';
import { FileViewer } from './FileViewer';
import { FileEditor } from './FileEditor';
import { FileSearch } from './FileSearch';
import './FileSystemTool.css';

interface FileSystemToolProps {
  className?: string;
}

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

export const FileSystemTool: React.FC<FileSystemToolProps> = ({ className = '' }) => {
  const [currentPath, setCurrentPath] = useState<string>('.');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'explorer' | 'viewer' | 'editor' | 'search'>('explorer');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FileInfo[]>([]);

  // 현재 디렉토리 로드
  const loadDirectory = async (path: string = currentPath) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.callMCPMethod('filesystem/list', {
        path: path,
        include_hidden: false,
        recursive: false
      });
      
      if (response.files) {
        const fileList: FileInfo[] = response.files.map((file: any) => ({
          name: file.name,
          path: file.path,
          type: file.type === 'directory' ? 'directory' : 'file',
          size: file.size,
          modified: file.modified,
          permissions: file.permissions
        }));
        
        // 디렉토리를 먼저, 파일을 나중에 정렬
        const sortedFiles = fileList.sort((a, b) => {
          if (a.type === 'directory' && b.type === 'file') return -1;
          if (a.type === 'file' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        });
        
        setFiles(sortedFiles);
        setCurrentPath(path);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '디렉토리를 불러오는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 파일 읽기
  const readFile = async (filePath: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.callMCPMethod('filesystem/read', {
        path: filePath
      });
      
      if (response.content !== undefined) {
        setFileContent(response.content);
        setActiveTab('viewer');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일을 읽는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 파일 쓰기
  const writeFile = async (filePath: string, content: string) => {
    try {
      setLoading(true);
      setError(null);
      
      await apiService.callMCPMethod('filesystem/write', {
        path: filePath,
        content: content,
        overwrite: true
      });
      
      // 파일 목록 새로고침
      await loadDirectory();
      setActiveTab('viewer');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일을 저장하는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 파일 검색
  const searchFiles = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.callMCPMethod('filesystem/search', {
        query: query,
        path: currentPath,
        recursive: true,
        include_hidden: false
      });
      
      if (response.files) {
        const searchFileList: FileInfo[] = response.files.map((file: any) => ({
          name: file.name,
          path: file.path,
          type: file.type === 'directory' ? 'directory' : 'file',
          size: file.size,
          modified: file.modified,
          permissions: file.permissions
        }));
        
        setSearchResults(searchFileList);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '파일 검색에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 파일 선택
  const handleFileSelect = (file: FileInfo) => {
    setSelectedFile(file);
    if (file.type === 'file') {
      readFile(file.path);
    } else {
      loadDirectory(file.path);
    }
  };

  // 새 파일 생성
  const createNewFile = async (fileName: string) => {
    const newFilePath = `${currentPath}/${fileName}`;
    try {
      await writeFile(newFilePath, '');
      setSelectedFile({
        name: fileName,
        path: newFilePath,
        type: 'file'
      });
      setActiveTab('editor');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '새 파일 생성에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 새 디렉토리 생성
  const createNewDirectory = async (dirName: string) => {
    const newDirPath = `${currentPath}/${dirName}`;
    try {
      await apiService.callMCPMethod('filesystem/create_directory', {
        path: newDirPath
      });
      await loadDirectory();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '새 디렉토리 생성에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 파일/디렉토리 삭제
  const deleteItem = async (item: FileInfo) => {
    try {
      if (item.type === 'directory') {
        await apiService.callMCPMethod('filesystem/delete_directory', {
          path: item.path
        });
      } else {
        await apiService.callMCPMethod('filesystem/delete_file', {
          path: item.path
        });
      }
      
      if (selectedFile?.path === item.path) {
        setSelectedFile(null);
        setFileContent('');
      }
      
      await loadDirectory();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '삭제에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadDirectory();
  }, []);

  // 검색 쿼리 변경 시 검색 실행
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchFiles(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  return (
    <div className={`file-system-tool ${className}`}>
      <div className="tool-header">
        <h3>파일시스템 도구</h3>
        <div className="header-actions">
          <button
            type="button"
            className="refresh-btn"
            onClick={() => loadDirectory()}
            disabled={loading}
            title="새로고침"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="tool-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveTab('explorer')}
        >
          📁 탐색기
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'viewer' ? 'active' : ''}`}
          onClick={() => setActiveTab('viewer')}
          disabled={!selectedFile || selectedFile.type !== 'file'}
        >
          👁️ 뷰어
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
          disabled={!selectedFile || selectedFile.type !== 'file'}
        >
          ✏️ 편집기
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          🔍 검색
        </button>
      </div>

      {error && (
        <div className="tool-error">
          <p>{error}</p>
          <button type="button" className="clear-btn" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <div className="tool-content">
        {activeTab === 'explorer' && (
          <FileExplorer
            currentPath={currentPath}
            files={files}
            selectedFile={selectedFile}
            loading={loading}
            onFileSelect={handleFileSelect}
            onPathChange={setCurrentPath}
            onLoadDirectory={loadDirectory}
            onCreateFile={createNewFile}
            onCreateDirectory={createNewDirectory}
            onDeleteItem={deleteItem}
          />
        )}

        {activeTab === 'viewer' && selectedFile && (
          <FileViewer
            file={selectedFile}
            content={fileContent}
            loading={loading}
            onEdit={() => setActiveTab('editor')}
          />
        )}

        {activeTab === 'editor' && selectedFile && (
          <FileEditor
            file={selectedFile}
            content={fileContent}
            loading={loading}
            onSave={writeFile}
            onCancel={() => setActiveTab('viewer')}
          />
        )}

        {activeTab === 'search' && (
          <FileSearch
            searchQuery={searchQuery}
            searchResults={searchResults}
            loading={loading}
            onSearchQueryChange={setSearchQuery}
            onFileSelect={handleFileSelect}
          />
        )}
      </div>

      {loading && (
        <div className="tool-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};
