import React, { useState, useRef, useEffect } from 'react';
import './TerminalInterface.css';

interface CommandResult {
  id: string;
  command: string;
  output: string;
  error: string;
  exitCode: number;
  startTime: string;
  endTime: string;
  duration: number;
  workingDirectory: string;
}

interface TerminalSettings {
  fontSize: number;
  theme: string;
  showLineNumbers: boolean;
  autoScroll: boolean;
  commandTimeout: number;
}

interface TerminalInterfaceProps {
  currentDirectory: string;
  commandResults: CommandResult[];
  terminalSettings: TerminalSettings;
  loading: boolean;
  onExecuteCommand: (command: string) => void;
  onUpdateSettings: (settings: Partial<TerminalSettings>) => void;
}

export const TerminalInterface: React.FC<TerminalInterfaceProps> = ({
  currentDirectory,
  commandResults,
  terminalSettings,
  loading,
  onExecuteCommand,
  onUpdateSettings
}) => {
  const [currentCommand, setCurrentCommand] = useState<string>('');
  const [commandHistoryIndex, setCommandHistoryIndex] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const terminalOutputRef = useRef<HTMLDivElement>(null);

  // 명령어 히스토리 (최근 100개)
  const commandHistory = commandResults.map(result => result.command);

  // 명령어 실행
  const handleExecuteCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentCommand.trim()) {
      onExecuteCommand(currentCommand.trim());
      setCurrentCommand('');
      setCommandHistoryIndex(-1);
    }
  };

  // 키보드 단축키 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (commandHistoryIndex < commandHistory.length - 1) {
          const newIndex = commandHistoryIndex + 1;
          setCommandHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (commandHistoryIndex > 0) {
          const newIndex = commandHistoryIndex - 1;
          setCommandHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        } else if (commandHistoryIndex === 0) {
          setCommandHistoryIndex(-1);
          setCurrentCommand('');
        }
        break;
      case 'Tab':
        e.preventDefault();
        // 자동완성 기능 (추후 구현)
        break;
      case 'Escape':
        setCurrentCommand('');
        setCommandHistoryIndex(-1);
        break;
    }
  };

  // 명령어 자동완성 (간단한 구현)
  const getCommandSuggestions = (input: string): string[] => {
    if (!input.trim()) return [];

    const commonCommands = [
      'ls', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'find',
      'ps', 'top', 'kill', 'chmod', 'chown', 'tar', 'zip', 'unzip',
      'git', 'npm', 'python', 'node', 'docker', 'kubectl'
    ];

    return commonCommands.filter(cmd => 
      cmd.toLowerCase().startsWith(input.toLowerCase())
    );
  };

  // 결과 복사
  const copyResult = (result: CommandResult) => {
    const resultText = `$ ${result.command}\n${result.output}${result.error ? `\nError: ${result.error}` : ''}`;
    navigator.clipboard.writeText(resultText);
  };

  // 결과 재실행
  const repeatResult = (result: CommandResult) => {
    onExecuteCommand(result.command);
  };

  // 결과 삭제
  const deleteResult = (resultId: string) => {
    // 결과 삭제 로직 (부모 컴포넌트에서 처리)
    console.log('Delete result:', resultId);
  };

  // 실행 시간 포맷팅
  const formatDuration = (duration: number): string => {
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  // 상태 아이콘
  const getStatusIcon = (result: CommandResult): string => {
    if (result.exitCode === 0) return '✅';
    if (result.exitCode > 0) return '❌';
    if (result.error) return '⚠️';
    return '⏳';
  };

  // 출력 렌더링
  const renderOutput = (output: string, error: string) => {
    if (error) {
      return (
        <div className="output-error">
          <pre>{error}</pre>
        </div>
      );
    }
    
    if (output) {
      return (
        <div className="output-success">
          <pre>{output}</pre>
        </div>
      );
    }
    
    return null;
  };

  // 자동완성 제안
  const suggestions = getCommandSuggestions(currentCommand);

  return (
    <div className="terminal-interface">
      {/* 터미널 출력 영역 */}
      <div className="terminal-output" ref={terminalOutputRef}>
        <div className="output-header">
          <h4>터미널 출력</h4>
          <div className="output-controls">
            <button
              type="button"
              className="clear-btn"
              onClick={() => {
                // 출력 클리어 로직
                console.log('Clear output');
              }}
              title="출력 클리어"
            >
              🗑️
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={() => setShowSettings(!showSettings)}
              title="설정"
            >
              ⚙️
            </button>
          </div>
        </div>

        <div className="output-content">
          {commandResults.length === 0 ? (
            <div className="empty-output">
              <p>명령어를 실행하면 결과가 여기에 표시됩니다.</p>
              <p>사용 가능한 명령어: ls, cd, pwd, mkdir, rm, cp, mv, cat, grep, find 등</p>
            </div>
          ) : (
            commandResults.map((result) => (
              <div
                key={result.id}
                className={`command-result ${selectedResult === result.id ? 'selected' : ''}`}
                onClick={() => setSelectedResult(result.id)}
              >
                <div className="result-header">
                  <div className="result-info">
                    <span className="status-icon">{getStatusIcon(result)}</span>
                    <span className="command-text">$ {result.command}</span>
                    <span className="duration">({formatDuration(result.duration)})</span>
                  </div>
                  <div className="result-actions">
                    <button
                      type="button"
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyResult(result);
                      }}
                      title="복사"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        repeatResult(result);
                      }}
                      title="재실행"
                    >
                      🔄
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteResult(result.id);
                      }}
                      title="삭제"
                    >
                      ❌
                    </button>
                  </div>
                </div>

                <div className="result-content">
                  {renderOutput(result.output, result.error)}
                </div>

                <div className="result-meta">
                  <span className="working-dir">📁 {result.workingDirectory}</span>
                  <span className="timestamp">
                    {new Date(result.startTime).toLocaleTimeString()}
                  </span>
                  {result.exitCode !== -1 && (
                    <span className="exit-code">Exit: {result.exitCode}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 명령어 입력 영역 */}
      <div className="command-input-section">
        <form onSubmit={handleExecuteCommand} className="command-form">
          <div className="prompt">
            <span className="user">user</span>
            <span className="at">@</span>
            <span className="host">qwen3-desktop</span>
            <span className="colon">:</span>
            <span className="directory">{currentDirectory}</span>
            <span className="dollar">$</span>
          </div>
          
          <div className="input-container">
            <input
              ref={commandInputRef}
              type="text"
              value={currentCommand}
              onChange={(e) => setCurrentCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="명령어를 입력하세요..."
              className="command-input"
              disabled={loading}
              autoFocus
            />
            
            {suggestions.length > 0 && (
              <div className="command-suggestions">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="suggestion-item"
                    onClick={() => setCurrentCommand(suggestion)}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <button
            type="submit"
            className="execute-btn"
            disabled={loading || !currentCommand.trim()}
          >
            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              '실행'
            )}
          </button>
        </form>
      </div>

      {/* 터미널 설정 */}
      {showSettings && (
        <div className="terminal-settings">
          <h5>터미널 설정</h5>
          <div className="settings-grid">
            <div className="setting-item">
              <label>글꼴 크기:</label>
              <input
                type="range"
                min="10"
                max="24"
                value={terminalSettings.fontSize}
                onChange={(e) => onUpdateSettings({ fontSize: parseInt(e.target.value) })}
              />
              <span>{terminalSettings.fontSize}px</span>
            </div>
            
            <div className="setting-item">
              <label>테마:</label>
              <select
                value={terminalSettings.theme}
                onChange={(e) => onUpdateSettings({ theme: e.target.value })}
              >
                <option value="dark">다크</option>
                <option value="light">라이트</option>
                <option value="monokai">Monokai</option>
              </select>
            </div>
            
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={terminalSettings.showLineNumbers}
                  onChange={(e) => onUpdateSettings({ showLineNumbers: e.target.checked })}
                />
                라인 번호 표시
              </label>
            </div>
            
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={terminalSettings.autoScroll}
                  onChange={(e) => onUpdateSettings({ autoScroll: e.target.checked })}
                />
                자동 스크롤
              </label>
            </div>
            
            <div className="setting-item">
              <label>명령어 타임아웃:</label>
              <input
                type="number"
                min="5"
                max="300"
                value={terminalSettings.commandTimeout}
                onChange={(e) => onUpdateSettings({ commandTimeout: parseInt(e.target.value) })}
              />
              <span>초</span>
            </div>
          </div>
        </div>
      )}

      {/* 키보드 단축키 도움말 */}
      <div className="keyboard-shortcuts">
        <h6>단축키</h6>
        <div className="shortcuts-list">
          <span>↑↓: 히스토리 탐색</span>
          <span>Tab: 자동완성</span>
          <span>Esc: 입력 취소</span>
          <span>Ctrl+C: 명령어 중단</span>
        </div>
      </div>
    </div>
  );
};
