import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/apiService';
import { TerminalInterface } from './TerminalInterface';
import { CommandHistory } from './CommandHistory';
import { ProcessManager } from './ProcessManager';
import './TerminalTool.css';

interface TerminalToolProps {
  className?: string;
}

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

interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  cpu: number;
  memory: number;
  status: string;
  startTime: string;
}

export const TerminalTool: React.FC<TerminalToolProps> = ({ className = '' }) => {
  const [currentDirectory, setCurrentDirectory] = useState<string>('.');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [commandResults, setCommandResults] = useState<CommandResult[]>([]);
  const [runningProcesses, setRunningProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'terminal' | 'history' | 'processes'>('terminal');
  const [terminalSettings, setTerminalSettings] = useState({
    fontSize: 14,
    theme: 'dark',
    showLineNumbers: false,
    autoScroll: true,
    commandTimeout: 30
  });

  const terminalRef = useRef<HTMLDivElement>(null);

  // 현재 디렉토리 로드
  const loadCurrentDirectory = async () => {
    try {
      const response = await apiService.callMCPMethod('terminal/execute', {
        command: 'pwd',
        timeout: 5,
        working_directory: currentDirectory
      });
      
      if (response.output) {
        const newDir = response.output.trim();
        setCurrentDirectory(newDir);
      }
    } catch (err) {
      console.warn('Failed to get current directory:', err);
    }
  };

  // 명령어 실행
  const executeCommand = async (command: string) => {
    if (!command.trim()) return;

    const commandId = Date.now().toString();
    const startTime = new Date().toISOString();
    
    // 명령어 히스토리에 추가
    setCommandHistory(prev => {
      const newHistory = [command, ...prev.filter(cmd => cmd !== command)];
      return newHistory.slice(0, 100); // 최대 100개 유지
    });

    // 실행 중인 결과 추가
    const pendingResult: CommandResult = {
      id: commandId,
      command: command,
      output: '',
      error: '',
      exitCode: -1,
      startTime: startTime,
      endTime: '',
      duration: 0,
      workingDirectory: currentDirectory
    };

    setCommandResults(prev => [pendingResult, ...prev.slice(0, 49)]); // 최대 50개 유지
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.callMCPMethod('terminal/execute', {
        command: command,
        timeout: terminalSettings.commandTimeout,
        working_directory: currentDirectory
      });

      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();

      // 결과 업데이트
      const completedResult: CommandResult = {
        ...pendingResult,
        output: response.output || '',
        error: response.error || '',
        exitCode: response.exit_code || 0,
        endTime: endTime,
        duration: duration
      };

      setCommandResults(prev => 
        prev.map(result => 
          result.id === commandId ? completedResult : result
        )
      );

      // 디렉토리 변경 감지
      if (command.startsWith('cd ')) {
        const newDir = command.substring(3).trim();
        if (newDir) {
          setCurrentDirectory(newDir);
        }
      }

    } catch (err) {
      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
      
      const errorResult: CommandResult = {
        ...pendingResult,
        error: err instanceof Error ? err.message : '명령어 실행에 실패했습니다.',
        exitCode: -1,
        endTime: endTime,
        duration: duration
      };

      setCommandResults(prev => 
        prev.map(result => 
          result.id === commandId ? errorResult : result
        )
      );

      const errorMessage = err instanceof Error ? err.message : '명령어 실행에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 프로세스 목록 로드
  const loadProcesses = async () => {
    try {
      const response = await apiService.callMCPMethod('terminal/get_status', {});
      
      if (response.processes) {
        const processes: ProcessInfo[] = response.processes.map((proc: any) => ({
          pid: proc.pid,
          name: proc.name,
          command: proc.command,
          cpu: proc.cpu || 0,
          memory: proc.memory || 0,
          status: proc.status,
          startTime: proc.start_time
        }));
        
        setRunningProcesses(processes);
      }
    } catch (err) {
      console.warn('Failed to load processes:', err);
    }
  };

  // 프로세스 종료
  const killProcess = async (pid: number) => {
    try {
      await apiService.callMCPMethod('terminal/kill_process', { pid: pid });
      await loadProcesses(); // 프로세스 목록 새로고침
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '프로세스 종료에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 명령어 히스토리에서 재실행
  const repeatCommand = (command: string) => {
    executeCommand(command);
  };

  // 명령어 히스토리 삭제
  const deleteCommandHistory = (index: number) => {
    setCommandHistory(prev => prev.filter((_, i) => i !== index));
  };

  // 명령어 히스토리 전체 삭제
  const clearCommandHistory = () => {
    setCommandHistory([]);
  };

  // 터미널 설정 변경
  const updateTerminalSettings = (settings: Partial<typeof terminalSettings>) => {
    setTerminalSettings(prev => ({ ...prev, ...settings }));
  };

  // 초기 로드
  useEffect(() => {
    loadCurrentDirectory();
    loadProcesses();
  }, []);

  // 주기적 프로세스 목록 업데이트 (10초마다)
  useEffect(() => {
    const interval = setInterval(loadProcesses, 10000);
    return () => clearInterval(interval);
  }, []);

  // 자동 스크롤
  useEffect(() => {
    if (terminalSettings.autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commandResults, terminalSettings.autoScroll]);

  return (
    <div className={`terminal-tool ${className}`}>
      <div className="tool-header">
        <h3>터미널 도구</h3>
        <div className="header-actions">
          <div className="current-directory">
            📁 {currentDirectory}
          </div>
          <button
            type="button"
            className="refresh-btn"
            onClick={() => {
              loadCurrentDirectory();
              loadProcesses();
            }}
            title="새로고침"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="tool-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          💻 터미널
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📚 히스토리 ({commandHistory.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'processes' ? 'active' : ''}`}
          onClick={() => setActiveTab('processes')}
        >
          ⚙️ 프로세스 ({runningProcesses.length})
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

      <div className="tool-content" ref={terminalRef}>
        {activeTab === 'terminal' && (
          <TerminalInterface
            currentDirectory={currentDirectory}
            commandResults={commandResults}
            terminalSettings={terminalSettings}
            loading={loading}
            onExecuteCommand={executeCommand}
            onUpdateSettings={updateTerminalSettings}
          />
        )}

        {activeTab === 'history' && (
          <CommandHistory
            history={commandHistory}
            onRepeatCommand={repeatCommand}
            onDeleteHistory={deleteCommandHistory}
            onClearHistory={clearCommandHistory}
          />
        )}

        {activeTab === 'processes' && (
          <ProcessManager
            processes={runningProcesses}
            loading={loading}
            onKillProcess={killProcess}
            onRefresh={loadProcesses}
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
