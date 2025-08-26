import React, { useState } from 'react';
import './ProcessManager.css';

interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  cpu: number;
  memory: number;
  status: string;
  startTime: string;
}

interface ProcessManagerProps {
  processes: ProcessInfo[];
  loading: boolean;
  onKillProcess: (pid: number) => void;
  onRefresh: () => void;
}

export const ProcessManager: React.FC<ProcessManagerProps> = ({
  processes,
  loading,
  onKillProcess,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'pid' | 'name' | 'cpu' | 'memory' | 'status'>('cpu');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showKillConfirm, setShowKillConfirm] = useState<number | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<ProcessInfo | null>(null);

  // 검색 및 필터링
  const filteredProcesses = processes.filter(process => {
    const matchesSearch = process.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         process.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         process.pid.toString().includes(searchQuery);
    
    const matchesStatus = filterStatus === 'all' || process.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // 정렬된 프로세스 목록
  const sortedProcesses = [...filteredProcesses].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'pid':
        comparison = a.pid - b.pid;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'cpu':
        comparison = a.cpu - b.cpu;
        break;
      case 'memory':
        comparison = a.memory - b.memory;
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // 메모리 사용량 포맷팅
  const formatMemory = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // CPU 사용량 포맷팅
  const formatCPU = (cpu: number): string => {
    return `${cpu.toFixed(1)}%`;
  };

  // 프로세스 상태 아이콘
  const getStatusIcon = (status: string): string => {
    const statusIcons: { [key: string]: string } = {
      'running': '🟢',
      'sleeping': '🟡',
      'stopped': '🔴',
      'zombie': '💀',
      'unknown': '❓'
    };
    return statusIcons[status.toLowerCase()] || '❓';
  };

  // 프로세스 우선순위 색상
  const getProcessPriority = (cpu: number, memory: number): 'low' | 'medium' | 'high' => {
    if (cpu > 50 || memory > 1024 * 1024 * 1024) return 'high';
    if (cpu > 20 || memory > 100 * 1024 * 1024) return 'medium';
    return 'low';
  };

  // 프로세스 종료 확인
  const handleKillConfirm = (pid: number) => {
    if (showKillConfirm === pid) {
      onKillProcess(pid);
      setShowKillConfirm(null);
    } else {
      setShowKillConfirm(pid);
    }
  };

  // 시스템 통계 계산
  const getSystemStats = () => {
    const totalProcesses = processes.length;
    const runningProcesses = processes.filter(p => p.status === 'running').length;
    const totalCPU = processes.reduce((sum, p) => sum + p.cpu, 0);
    const totalMemory = processes.reduce((sum, p) => sum + p.memory, 0);
    
    return {
      total: totalProcesses,
      running: runningProcesses,
      totalCPU: totalCPU.toFixed(1),
      totalMemory: formatMemory(totalMemory)
    };
  };

  const systemStats = getSystemStats();

  return (
    <div className="process-manager">
      {/* 프로세스 관리자 헤더 */}
      <div className="manager-header">
        <h4>프로세스 관리자</h4>
        <div className="header-actions">
          <button
            type="button"
            className="refresh-btn"
            onClick={onRefresh}
            disabled={loading}
            title="새로고침"
          >
            🔄
          </button>
        </div>
      </div>

      {/* 시스템 통계 */}
      <div className="system-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{systemStats.total}</div>
            <div className="stat-label">총 프로세스</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <div className="stat-value">{systemStats.running}</div>
            <div className="stat-label">실행 중</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-value">{systemStats.totalCPU}%</div>
            <div className="stat-label">총 CPU</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💾</div>
          <div className="stat-content">
            <div className="stat-value">{systemStats.totalMemory}</div>
            <div className="stat-label">총 메모리</div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="process-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="프로세스 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <div className="status-filter">
            <label>상태:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">모든 상태</option>
              <option value="running">실행 중</option>
              <option value="sleeping">대기 중</option>
              <option value="stopped">중지됨</option>
              <option value="zombie">좀비</option>
            </select>
          </div>
          
          <div className="sort-controls">
            <label>정렬:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="cpu">CPU 사용률</option>
              <option value="memory">메모리 사용량</option>
              <option value="pid">PID</option>
              <option value="name">이름</option>
              <option value="status">상태</option>
            </select>
            <button
              type="button"
              className="sort-order-btn"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              title={`${sortOrder === 'asc' ? '내림차순' : '오름차순'} 정렬`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* 프로세스 목록 */}
      <div className="process-list">
        <div className="list-header">
          <div className="header-pid">PID</div>
          <div className="header-name">이름</div>
          <div className="header-cpu">CPU</div>
          <div className="header-memory">메모리</div>
          <div className="header-status">상태</div>
          <div className="header-actions">작업</div>
        </div>
        
        <div className="list-content">
          {loading ? (
            <div className="loading-placeholder">
              <div className="loading-spinner"></div>
              <p>프로세스 목록을 불러오는 중...</p>
            </div>
          ) : sortedProcesses.length === 0 ? (
            <div className="empty-placeholder">
              <p>표시할 프로세스가 없습니다.</p>
            </div>
          ) : (
            sortedProcesses.map((process) => {
              const priority = getProcessPriority(process.cpu, process.memory);
              
              return (
                <div
                  key={process.pid}
                  className={`process-item ${priority} ${selectedProcess?.pid === process.pid ? 'selected' : ''}`}
                  onClick={() => setSelectedProcess(process)}
                >
                  <div className="process-pid">{process.pid}</div>
                  <div className="process-name" title={process.command}>
                    <span className="name-text">{process.name}</span>
                    {process.command !== process.name && (
                      <span className="command-preview">{process.command}</span>
                    )}
                  </div>
                  <div className="process-cpu">
                    <div className="cpu-bar">
                      <div 
                        className="cpu-fill" 
                        style={{ width: `${Math.min(process.cpu, 100)}%` }}
                      ></div>
                    </div>
                    <span className="cpu-value">{formatCPU(process.cpu)}</span>
                  </div>
                  <div className="process-memory">
                    <div className="memory-bar">
                      <div 
                        className="memory-fill" 
                        style={{ width: `${Math.min((process.memory / (1024 * 1024 * 1024)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="memory-value">{formatMemory(process.memory)}</span>
                  </div>
                  <div className="process-status">
                    <span className="status-icon">{getStatusIcon(process.status)}</span>
                    <span className="status-text">{process.status}</span>
                  </div>
                  <div className="process-actions">
                    <button
                      type="button"
                      className="kill-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleKillConfirm(process.pid);
                      }}
                      title="프로세스 종료"
                    >
                      {showKillConfirm === process.pid ? '✓' : '💀'}
                    </button>
                  </div>
                  
                  {/* 종료 확인 */}
                  {showKillConfirm === process.pid && (
                    <div className="kill-confirmation">
                      <p>프로세스 "{process.name}" (PID: {process.pid})를 종료하시겠습니까?</p>
                      <div className="confirmation-actions">
                        <button
                          type="button"
                          className="confirm-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKillConfirm(process.pid);
                          }}
                        >
                          종료
                        </button>
                        <button
                          type="button"
                          className="cancel-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowKillConfirm(null);
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 선택된 프로세스 상세 정보 */}
      {selectedProcess && (
        <div className="process-details">
          <h5>프로세스 상세 정보</h5>
          <div className="details-grid">
            <div className="detail-item">
              <label>PID:</label>
              <span>{selectedProcess.pid}</span>
            </div>
            <div className="detail-item">
              <label>이름:</label>
              <span>{selectedProcess.name}</span>
            </div>
            <div className="detail-item">
              <label>명령어:</label>
              <span className="command-full">{selectedProcess.command}</span>
            </div>
            <div className="detail-item">
              <label>CPU 사용률:</label>
              <span>{formatCPU(selectedProcess.cpu)}</span>
            </div>
            <div className="detail-item">
              <label>메모리 사용량:</label>
              <span>{formatMemory(selectedProcess.memory)}</span>
            </div>
            <div className="detail-item">
              <label>상태:</label>
              <span>{selectedProcess.status}</span>
            </div>
            <div className="detail-item">
              <label>시작 시간:</label>
              <span>{new Date(selectedProcess.startTime).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* 프로세스 내보내기 */}
      <div className="process-export">
        <button
          type="button"
          className="export-btn"
          onClick={() => {
            const exportData = {
              processes: processes,
              exportTime: new Date().toISOString(),
              systemStats: systemStats
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'process_list.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          disabled={processes.length === 0}
        >
          📥 프로세스 목록 내보내기
        </button>
      </div>
    </div>
  );
};
