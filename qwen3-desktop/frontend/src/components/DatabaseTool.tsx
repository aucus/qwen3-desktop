import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/apiService';
import { DatabaseConnection } from './DatabaseConnection';
import { QueryExecutor } from './QueryExecutor';
import { TableViewer } from './TableViewer';
import { QueryHistory } from './QueryHistory';
import './DatabaseTool.css';

interface DatabaseToolProps {
  className?: string;
}

interface DatabaseConnection {
  id: string;
  name: string;
  type: 'sqlite' | 'mysql' | 'postgresql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filePath?: string;
  isConnected: boolean;
  lastConnected?: string;
}

interface QueryResult {
  id: string;
  query: string;
  result: any;
  error?: string;
  executionTime: number;
  timestamp: string;
  rowCount?: number;
  columns?: string[];
}

interface TableInfo {
  name: string;
  type: 'table' | 'view';
  rowCount?: number;
  columns?: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
}

export const DatabaseTool: React.FC<DatabaseToolProps> = ({ className = '' }) => {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [activeConnection, setActiveConnection] = useState<DatabaseConnection | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [queryHistory, setQueryHistory] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'connections' | 'query' | 'tables' | 'history'>('connections');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<string[]>([]);

  const databaseRef = useRef<HTMLDivElement>(null);

  // 데이터베이스 연결 목록 로드
  const loadConnections = async () => {
    try {
      const response = await apiService.callMCPMethod('database/list_connections', {});
      
      if (response.connections) {
        const dbConnections: DatabaseConnection[] = response.connections.map((conn: any) => ({
          id: conn.id,
          name: conn.name,
          type: conn.type,
          host: conn.host,
          port: conn.port,
          database: conn.database,
          username: conn.username,
          filePath: conn.file_path,
          isConnected: conn.is_connected,
          lastConnected: conn.last_connected
        }));
        
        setConnections(dbConnections);
        
        // 활성 연결이 있다면 설정
        const activeConn = dbConnections.find(conn => conn.isConnected);
        if (activeConn) {
          setActiveConnection(activeConn);
          await loadTables(activeConn.id);
        }
      }
    } catch (err) {
      console.warn('Failed to load database connections:', err);
    }
  };

  // 데이터베이스 연결
  const connectDatabase = async (connection: Omit<DatabaseConnection, 'id' | 'isConnected' | 'lastConnected'>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.callMCPMethod('database/connect', {
        type: connection.type,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password: connection.password,
        file_path: connection.filePath
      });

      if (response.success) {
        const newConnection: DatabaseConnection = {
          ...connection,
          id: response.connection_id,
          isConnected: true,
          lastConnected: new Date().toISOString()
        };

        setConnections(prev => [...prev, newConnection]);
        setActiveConnection(newConnection);
        await loadTables(newConnection.id);
        setActiveTab('query');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '데이터베이스 연결에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 데이터베이스 연결 해제
  const disconnectDatabase = async (connectionId: string) => {
    try {
      await apiService.callMCPMethod('database/disconnect', { connection_id: connectionId });
      
      setConnections(prev => 
        prev.map(conn => 
          conn.id === connectionId 
            ? { ...conn, isConnected: false }
            : conn
        )
      );

      if (activeConnection?.id === connectionId) {
        setActiveConnection(null);
        setTables([]);
        setTableData([]);
        setTableColumns([]);
        setSelectedTable(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '데이터베이스 연결 해제에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 테이블 목록 로드
  const loadTables = async (connectionId: string) => {
    try {
      const response = await apiService.callMCPMethod('database/list_tables', { 
        connection_id: connectionId 
      });
      
      if (response.tables) {
        const tableList: TableInfo[] = response.tables.map((table: any) => ({
          name: table.name,
          type: table.type,
          rowCount: table.row_count,
          columns: table.columns?.map((col: any) => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            primaryKey: col.primary_key,
            defaultValue: col.default_value
          }))
        }));
        
        setTables(tableList);
      }
    } catch (err) {
      console.warn('Failed to load tables:', err);
    }
  };

  // SQL 쿼리 실행
  const executeQuery = async (query: string) => {
    if (!activeConnection || !query.trim()) return;

    const queryId = Date.now().toString();
    const startTime = Date.now();

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.callMCPMethod('database/execute_query', {
        connection_id: activeConnection.id,
        query: query
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      const queryResult: QueryResult = {
        id: queryId,
        query: query,
        result: response.result,
        executionTime: executionTime,
        timestamp: new Date().toISOString(),
        rowCount: response.row_count,
        columns: response.columns
      };

      setQueryHistory(prev => [queryResult, ...prev.slice(0, 49)]); // 최대 50개 유지

      // SELECT 쿼리인 경우 테이블 데이터 업데이트
      if (query.trim().toLowerCase().startsWith('select')) {
        setTableData(response.result || []);
        setTableColumns(response.columns || []);
      }

    } catch (err) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      const errorResult: QueryResult = {
        id: queryId,
        query: query,
        result: null,
        error: err instanceof Error ? err.message : '쿼리 실행에 실패했습니다.',
        executionTime: executionTime,
        timestamp: new Date().toISOString()
      };

      setQueryHistory(prev => [errorResult, ...prev.slice(0, 49)]);

      const errorMessage = err instanceof Error ? err.message : '쿼리 실행에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 테이블 데이터 로드
  const loadTableData = async (tableName: string) => {
    if (!activeConnection) return;

    setSelectedTable(tableName);
    setLoading(true);

    try {
      const response = await apiService.callMCPMethod('database/execute_query', {
        connection_id: activeConnection.id,
        query: `SELECT * FROM ${tableName} LIMIT 1000`
      });

      setTableData(response.result || []);
      setTableColumns(response.columns || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '테이블 데이터 로드에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 쿼리 히스토리에서 재실행
  const repeatQuery = (query: string) => {
    executeQuery(query);
  };

  // 쿼리 히스토리 삭제
  const deleteQueryHistory = (queryId: string) => {
    setQueryHistory(prev => prev.filter(result => result.id !== queryId));
  };

  // 쿼리 히스토리 전체 삭제
  const clearQueryHistory = () => {
    setQueryHistory([]);
  };

  // 데이터베이스 백업
  const backupDatabase = async () => {
    if (!activeConnection) return;

    try {
      const response = await apiService.callMCPMethod('database/backup', {
        connection_id: activeConnection.id
      });

      if (response.backup_path) {
        // 백업 파일 다운로드
        const link = document.createElement('a');
        link.href = response.backup_path;
        link.download = `${activeConnection.database}_backup_${new Date().toISOString().split('T')[0]}.sql`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '데이터베이스 백업에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadConnections();
  }, []);

  return (
    <div className={`database-tool ${className}`}>
      <div className="tool-header">
        <h3>데이터베이스 도구</h3>
        <div className="header-actions">
          {activeConnection && (
            <div className="connection-status">
              <span className="status-indicator connected"></span>
              <span className="connection-name">{activeConnection.name}</span>
              <button
                type="button"
                className="backup-btn"
                onClick={backupDatabase}
                title="데이터베이스 백업"
              >
                💾
              </button>
            </div>
          )}
          <button
            type="button"
            className="refresh-btn"
            onClick={loadConnections}
            title="새로고침"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="tool-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
          onClick={() => setActiveTab('connections')}
        >
          🔌 연결 ({connections.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
          disabled={!activeConnection}
        >
          🔍 쿼리
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
          onClick={() => setActiveTab('tables')}
          disabled={!activeConnection}
        >
          📊 테이블 ({tables.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📚 히스토리 ({queryHistory.length})
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

      <div className="tool-content" ref={databaseRef}>
        {activeTab === 'connections' && (
          <DatabaseConnection
            connections={connections}
            activeConnection={activeConnection}
            onConnect={connectDatabase}
            onDisconnect={disconnectDatabase}
            onSelectConnection={(conn) => {
              setActiveConnection(conn);
              loadTables(conn.id);
              setActiveTab('query');
            }}
          />
        )}

        {activeTab === 'query' && activeConnection && (
          <QueryExecutor
            connection={activeConnection}
            onExecuteQuery={executeQuery}
            loading={loading}
          />
        )}

        {activeTab === 'tables' && activeConnection && (
          <TableViewer
            tables={tables}
            selectedTable={selectedTable}
            tableData={tableData}
            tableColumns={tableColumns}
            onSelectTable={loadTableData}
            loading={loading}
          />
        )}

        {activeTab === 'history' && (
          <QueryHistory
            history={queryHistory}
            onRepeatQuery={repeatQuery}
            onDeleteHistory={deleteQueryHistory}
            onClearHistory={clearQueryHistory}
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
