import React, { useState } from 'react';
import './CommandHistory.css';

interface CommandHistoryProps {
  history: string[];
  onRepeatCommand: (command: string) => void;
  onDeleteHistory: (index: number) => void;
  onClearHistory: () => void;
}

export const CommandHistory: React.FC<CommandHistoryProps> = ({
  history,
  onRepeatCommand,
  onDeleteHistory,
  onClearHistory
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'time' | 'frequency'>('time');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  // 검색 필터링
  const filteredHistory = history.filter(command =>
    command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 명령어 빈도 계산
  const getCommandFrequency = (command: string): number => {
    return history.filter(cmd => cmd === command).length;
  };

  // 정렬된 히스토리
  const getSortedHistory = () => {
    if (sortBy === 'frequency') {
      const uniqueCommands = [...new Set(filteredHistory)];
      return uniqueCommands.sort((a, b) => {
        const freqA = getCommandFrequency(a);
        const freqB = getCommandFrequency(b);
        return freqB - freqA;
      });
    }
    return filteredHistory;
  };

  // 명령어 카테고리 분류
  const getCommandCategory = (command: string): string => {
    const cmd = command.split(' ')[0].toLowerCase();
    
    const categories: { [key: string]: string } = {
      // 파일 시스템
      'ls': '파일시스템',
      'cd': '파일시스템',
      'pwd': '파일시스템',
      'mkdir': '파일시스템',
      'rm': '파일시스템',
      'cp': '파일시스템',
      'mv': '파일시스템',
      'cat': '파일시스템',
      'touch': '파일시스템',
      'chmod': '파일시스템',
      'chown': '파일시스템',
      
      // 검색 및 필터링
      'grep': '검색',
      'find': '검색',
      'locate': '검색',
      'which': '검색',
      'whereis': '검색',
      
      // 프로세스 관리
      'ps': '프로세스',
      'top': '프로세스',
      'htop': '프로세스',
      'kill': '프로세스',
      'pkill': '프로세스',
      'killall': '프로세스',
      
      // 네트워크
      'ping': '네트워크',
      'curl': '네트워크',
      'wget': '네트워크',
      'ssh': '네트워크',
      'scp': '네트워크',
      'netstat': '네트워크',
      
      // 개발 도구
      'git': '개발',
      'npm': '개발',
      'yarn': '개발',
      'python': '개발',
      'node': '개발',
      'docker': '개발',
      'kubectl': '개발',
      
      // 시스템 정보
      'uname': '시스템',
      'df': '시스템',
      'du': '시스템',
      'free': '시스템',
      'uptime': '시스템',
      'who': '시스템',
      'w': '시스템',
      
      // 압축 및 아카이브
      'tar': '압축',
      'zip': '압축',
      'unzip': '압축',
      'gzip': '압축',
      'gunzip': '압축'
    };
    
    return categories[cmd] || '기타';
  };

  // 카테고리별 아이콘
  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      '파일시스템': '📁',
      '검색': '🔍',
      '프로세스': '⚙️',
      '네트워크': '🌐',
      '개발': '💻',
      '시스템': '🖥️',
      '압축': '📦',
      '기타': '🔧'
    };
    return icons[category] || '🔧';
  };

  // 명령어 설명
  const getCommandDescription = (command: string): string => {
    const cmd = command.split(' ')[0].toLowerCase();
    
    const descriptions: { [key: string]: string } = {
      'ls': '디렉토리 내용 나열',
      'cd': '디렉토리 변경',
      'pwd': '현재 작업 디렉토리 출력',
      'mkdir': '디렉토리 생성',
      'rm': '파일/디렉토리 삭제',
      'cp': '파일 복사',
      'mv': '파일 이동/이름변경',
      'cat': '파일 내용 출력',
      'grep': '텍스트 검색',
      'find': '파일 검색',
      'ps': '프로세스 목록',
      'top': '시스템 모니터링',
      'kill': '프로세스 종료',
      'git': 'Git 버전 관리',
      'npm': 'Node.js 패키지 관리',
      'python': 'Python 실행',
      'docker': 'Docker 컨테이너 관리',
      'tar': '아카이브 생성/추출',
      'zip': '압축 파일 생성',
      'unzip': '압축 파일 해제'
    };
    
    return descriptions[cmd] || '명령어 실행';
  };

  // 삭제 확인
  const handleDeleteConfirm = (index: number) => {
    if (showDeleteConfirm === index) {
      onDeleteHistory(index);
      setShowDeleteConfirm(null);
    } else {
      setShowDeleteConfirm(index);
    }
  };

  const sortedHistory = getSortedHistory();

  return (
    <div className="command-history">
      {/* 히스토리 헤더 */}
      <div className="history-header">
        <h4>명령어 히스토리 ({history.length}개)</h4>
        <div className="header-actions">
          <button
            type="button"
            className="clear-all-btn"
            onClick={onClearHistory}
            disabled={history.length === 0}
          >
            전체 삭제
          </button>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="history-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="명령어 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="sort-options">
          <label>정렬 기준:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'time' | 'frequency')}
          >
            <option value="time">시간순</option>
            <option value="frequency">사용 빈도순</option>
          </select>
        </div>
      </div>

      {/* 히스토리 목록 */}
      <div className="history-list">
        {sortedHistory.length === 0 ? (
          <div className="empty-history">
            {searchQuery ? (
              <p>검색 결과가 없습니다.</p>
            ) : (
              <p>명령어 히스토리가 없습니다.</p>
            )}
          </div>
        ) : (
          sortedHistory.map((command, index) => {
            const category = getCommandCategory(command);
            const frequency = getCommandFrequency(command);
            const description = getCommandDescription(command);
            
            return (
              <div key={`${command}-${index}`} className="history-item">
                <div className="item-header">
                  <div className="item-info">
                    <span className="category-icon">{getCategoryIcon(category)}</span>
                    <span className="category-name">{category}</span>
                    {frequency > 1 && (
                      <span className="frequency-badge">{frequency}회</span>
                    )}
                  </div>
                  
                  <div className="item-actions">
                    <button
                      type="button"
                      className="repeat-btn"
                      onClick={() => onRepeatCommand(command)}
                      title="재실행"
                    >
                      🔄
                    </button>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDeleteConfirm(index)}
                      title="삭제"
                    >
                      {showDeleteConfirm === index ? '✓' : '❌'}
                    </button>
                  </div>
                </div>

                <div className="command-display">
                  <code className="command-text">$ {command}</code>
                </div>

                <div className="command-description">
                  {description}
                </div>

                {/* 삭제 확인 메시지 */}
                {showDeleteConfirm === index && (
                  <div className="delete-confirmation">
                    <p>이 명령어를 히스토리에서 삭제하시겠습니까?</p>
                    <div className="confirmation-actions">
                      <button
                        type="button"
                        className="confirm-btn"
                        onClick={() => handleDeleteConfirm(index)}
                      >
                        삭제
                      </button>
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => setShowDeleteConfirm(null)}
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

      {/* 히스토리 통계 */}
      {history.length > 0 && (
        <div className="history-stats">
          <h5>히스토리 통계</h5>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">총 명령어 수:</span>
              <span className="stat-value">{history.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">고유 명령어:</span>
              <span className="stat-value">{new Set(history).size}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">가장 많이 사용:</span>
              <span className="stat-value">
                {(() => {
                  const freqMap = new Map<string, number>();
                  history.forEach(cmd => {
                    freqMap.set(cmd, (freqMap.get(cmd) || 0) + 1);
                  });
                  const mostUsed = Array.from(freqMap.entries())
                    .sort((a, b) => b[1] - a[1])[0];
                  return mostUsed ? `${mostUsed[0]} (${mostUsed[1]}회)` : '-';
                })()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 히스토리 내보내기 */}
      <div className="history-export">
        <button
          type="button"
          className="export-btn"
          onClick={() => {
            const exportData = {
              history: history,
              exportTime: new Date().toISOString(),
              totalCommands: history.length,
              uniqueCommands: new Set(history).size
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'command_history.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          disabled={history.length === 0}
        >
          📥 히스토리 내보내기
        </button>
      </div>
    </div>
  );
};
