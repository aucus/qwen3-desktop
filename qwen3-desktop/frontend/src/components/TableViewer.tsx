import React, { useState } from 'react';
import './TableViewer.css';

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

interface TableViewerProps {
  tables: TableInfo[];
  selectedTable: string | null;
  tableData: any[];
  tableColumns: string[];
  onSelectTable: (tableName: string) => void;
  loading: boolean;
}

export const TableViewer: React.FC<TableViewerProps> = ({
  tables,
  selectedTable,
  tableData,
  tableColumns,
  onSelectTable,
  loading
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [showTableSchema, setShowTableSchema] = useState<boolean>(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // 테이블 검색 필터링
  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 테이블 데이터 정렬
  const getSortedData = () => {
    if (!sortColumn || tableData.length === 0) return tableData;

    return [...tableData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // 페이지네이션
  const sortedData = getSortedData();
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // 컬럼 정렬 처리
  const handleColumnSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // 행 선택 처리
  const handleRowSelect = (index: number) => {
    const actualIndex = startIndex + index;
    const newSelectedRows = new Set(selectedRows);
    
    if (newSelectedRows.has(actualIndex)) {
      newSelectedRows.delete(actualIndex);
    } else {
      newSelectedRows.add(actualIndex);
    }
    
    setSelectedRows(newSelectedRows);
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      const newSelectedRows = new Set<number>();
      for (let i = 0; i < paginatedData.length; i++) {
        newSelectedRows.add(startIndex + i);
      }
      setSelectedRows(newSelectedRows);
    }
  };

  // 선택된 데이터 내보내기
  const exportSelectedData = () => {
    if (selectedRows.size === 0) return;

    const selectedData = Array.from(selectedRows).map(index => sortedData[index]);
    const csvContent = generateCSV(selectedData, tableColumns);
    downloadCSV(csvContent, `${selectedTable}_selected_data.csv`);
  };

  // 전체 데이터 내보내기
  const exportAllData = () => {
    const csvContent = generateCSV(sortedData, tableColumns);
    downloadCSV(csvContent, `${selectedTable}_all_data.csv`);
  };

  // CSV 생성
  const generateCSV = (data: any[], columns: string[]): string => {
    const header = columns.join(',');
    const rows = data.map(row => 
      columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return '';
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',')
    );
    return [header, ...rows].join('\n');
  };

  // CSV 다운로드
  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 선택된 행 복사
  const copySelectedRows = () => {
    if (selectedRows.size === 0) return;

    const selectedData = Array.from(selectedRows).map(index => sortedData[index]);
    const jsonData = JSON.stringify(selectedData, null, 2);
    navigator.clipboard.writeText(jsonData);
  };

  // 테이블 타입 아이콘
  const getTableTypeIcon = (type: string): string => {
    return type === 'table' ? '📋' : '👁️';
  };

  // 데이터 타입 색상
  const getDataTypeColor = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) return 'date';
      if (value.match(/^\d{2}:\d{2}:\d{2}/)) return 'time';
    }
    return 'string';
  };

  return (
    <div className="table-viewer">
      {/* 테이블 목록 */}
      <div className="table-list-section">
        <div className="list-header">
          <h4>테이블 목록</h4>
          <div className="list-controls">
            <input
              type="text"
              placeholder="테이블 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="table-search"
            />
          </div>
        </div>

        <div className="table-list">
          {filteredTables.length === 0 ? (
            <div className="empty-tables">
              <p>표시할 테이블이 없습니다.</p>
            </div>
          ) : (
            filteredTables.map((table) => (
              <div
                key={table.name}
                className={`table-item ${selectedTable === table.name ? 'selected' : ''}`}
                onClick={() => onSelectTable(table.name)}
              >
                <div className="table-info">
                  <span className="table-icon">{getTableTypeIcon(table.type)}</span>
                  <span className="table-name">{table.name}</span>
                  <span className="table-type">({table.type})</span>
                </div>
                {table.rowCount !== undefined && (
                  <div className="table-stats">
                    <span className="row-count">{table.rowCount.toLocaleString()} 행</span>
                    {table.columns && (
                      <span className="column-count">{table.columns.length} 컬럼</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 테이블 데이터 */}
      {selectedTable && (
        <div className="table-data-section">
          <div className="data-header">
            <h4>테이블: {selectedTable}</h4>
            <div className="data-controls">
              <button
                type="button"
                className="schema-btn"
                onClick={() => setShowTableSchema(!showTableSchema)}
                title="테이블 스키마"
              >
                📋
              </button>
              <button
                type="button"
                className="export-btn"
                onClick={exportAllData}
                disabled={tableData.length === 0}
                title="전체 데이터 내보내기"
              >
                📥
              </button>
              <button
                type="button"
                className="export-selected-btn"
                onClick={exportSelectedData}
                disabled={selectedRows.size === 0}
                title="선택된 데이터 내보내기"
              >
                📤
              </button>
              <button
                type="button"
                className="copy-btn"
                onClick={copySelectedRows}
                disabled={selectedRows.size === 0}
                title="선택된 데이터 복사"
              >
                📋
              </button>
            </div>
          </div>

          {/* 테이블 스키마 */}
          {showTableSchema && (
            <div className="table-schema">
              <h5>테이블 스키마</h5>
              <div className="schema-table">
                <table>
                  <thead>
                    <tr>
                      <th>컬럼명</th>
                      <th>데이터 타입</th>
                      <th>NULL 허용</th>
                      <th>기본값</th>
                      <th>기본키</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.find(t => t.name === selectedTable)?.columns?.map((column, index) => (
                      <tr key={index}>
                        <td>{column.name}</td>
                        <td>{column.type}</td>
                        <td>{column.nullable ? 'YES' : 'NO'}</td>
                        <td>{column.defaultValue || '-'}</td>
                        <td>{column.primaryKey ? '🔑' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 데이터 테이블 */}
          <div className="data-table-container">
            {loading ? (
              <div className="loading-placeholder">
                <div className="loading-spinner"></div>
                <p>테이블 데이터를 불러오는 중...</p>
              </div>
            ) : tableData.length === 0 ? (
              <div className="empty-data">
                <p>테이블에 데이터가 없습니다.</p>
              </div>
            ) : (
              <>
                <div className="table-controls">
                  <div className="pagination-info">
                    <span>
                      {startIndex + 1}-{Math.min(endIndex, sortedData.length)} / {sortedData.length} 행
                    </span>
                  </div>
                  <div className="page-size-control">
                    <label>페이지 크기:</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(parseInt(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="select-column">
                          <input
                            type="checkbox"
                            checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                            onChange={handleSelectAll}
                          />
                        </th>
                        {tableColumns.map((column) => (
                          <th
                            key={column}
                            onClick={() => handleColumnSort(column)}
                            className={`sortable ${sortColumn === column ? `sorted-${sortDirection}` : ''}`}
                          >
                            {column}
                            {sortColumn === column && (
                              <span className="sort-indicator">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={selectedRows.has(startIndex + rowIndex) ? 'selected' : ''}
                        >
                          <td className="select-column">
                            <input
                              type="checkbox"
                              checked={selectedRows.has(startIndex + rowIndex)}
                              onChange={() => handleRowSelect(rowIndex)}
                            />
                          </td>
                          {tableColumns.map((column) => (
                            <td
                              key={column}
                              className={`data-cell ${getDataTypeColor(row[column])}`}
                              title={String(row[column] || '')}
                            >
                              {row[column] === null || row[column] === undefined ? (
                                <span className="null-value">NULL</span>
                              ) : (
                                String(row[column])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      처음
                    </button>
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      이전
                    </button>
                    
                    <span className="page-info">
                      {currentPage} / {totalPages}
                    </span>
                    
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      다음
                    </button>
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      마지막
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
