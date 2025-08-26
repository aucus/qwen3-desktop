import React, { useState } from 'react';
import { apiService } from '../services/apiService';
import './McpMethodExecutor.css';

interface McpMethodExecutorProps {
  methodName: string;
  serverName: string;
  onClose: () => void;
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  value: string;
}

export const McpMethodExecutor: React.FC<McpMethodExecutorProps> = ({
  methodName,
  serverName,
  onClose
}) => {
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  // 메서드별 기본 매개변수 설정
  const getDefaultParameters = (method: string): Parameter[] => {
    const defaultParams: { [key: string]: Parameter[] } = {
      'filesystem/read': [
        { name: 'path', type: 'string', required: true, description: '파일 경로', value: '' }
      ],
      'filesystem/write': [
        { name: 'path', type: 'string', required: true, description: '파일 경로', value: '' },
        { name: 'content', type: 'string', required: true, description: '파일 내용', value: '' },
        { name: 'overwrite', type: 'boolean', required: false, description: '덮어쓰기 여부', value: 'false' }
      ],
      'filesystem/list': [
        { name: 'path', type: 'string', required: false, description: '디렉토리 경로', value: '.' },
        { name: 'include_hidden', type: 'boolean', required: false, description: '숨김 파일 포함', value: 'false' },
        { name: 'recursive', type: 'boolean', required: false, description: '재귀적 나열', value: 'false' }
      ],
      'web/search': [
        { name: 'query', type: 'string', required: true, description: '검색 쿼리', value: '' },
        { name: 'engine', type: 'string', required: false, description: '검색 엔진', value: 'google' },
        { name: 'max_results', type: 'number', required: false, description: '최대 결과 수', value: '10' }
      ],
      'web/browse': [
        { name: 'url', type: 'string', required: true, description: '탐색할 URL', value: '' }
      ],
      'terminal/execute': [
        { name: 'command', type: 'string', required: true, description: '실행할 명령어', value: '' },
        { name: 'timeout', type: 'number', required: false, description: '타임아웃 (초)', value: '30' },
        { name: 'working_directory', type: 'string', required: false, description: '작업 디렉토리', value: '' }
      ],
      'terminal/list': [
        { name: 'type', type: 'string', required: false, description: '명령어 타입', value: 'all' }
      ],
      'database/query': [
        { name: 'query', type: 'string', required: true, description: 'SQL 쿼리', value: '' },
        { name: 'database', type: 'string', required: false, description: '데이터베이스 이름', value: 'default' },
        { name: 'fetch_type', type: 'string', required: false, description: '결과 타입', value: 'all' }
      ],
      'database/list': [
        { name: 'database', type: 'string', required: false, description: '데이터베이스 이름', value: 'default' }
      ]
    };

    return defaultParams[method] || [];
  };

  // 초기 매개변수 설정
  React.useEffect(() => {
    setParameters(getDefaultParameters(methodName));
  }, [methodName]);

  // 매개변수 값 변경
  const handleParameterChange = (index: number, value: string) => {
    setParameters(prev => 
      prev.map((param, i) => 
        i === index ? { ...param, value } : param
      )
    );
  };

  // 매개변수 추가
  const addParameter = () => {
    setParameters(prev => [
      ...prev,
      { name: '', type: 'string', required: false, description: '', value: '' }
    ]);
  };

  // 매개변수 제거
  const removeParameter = (index: number) => {
    setParameters(prev => prev.filter((_, i) => i !== index));
  };

  // 메서드 실행
  const executeMethod = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setShowResult(false);

      // 매개변수 객체 생성
      const params: { [key: string]: any } = {};
      parameters.forEach(param => {
        if (param.name && param.value !== '') {
          // 타입에 따른 값 변환
          let convertedValue: any = param.value;
          if (param.type === 'number') {
            convertedValue = parseFloat(param.value);
          } else if (param.type === 'boolean') {
            convertedValue = param.value === 'true';
          }
          params[param.name] = convertedValue;
        }
      });

      // MCP 메서드 호출
      const response = await apiService.callMCPMethod(methodName, params);
      setResult(response);
      setShowResult(true);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '메서드 실행에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 결과 복사
  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    }
  };

  // 결과 다운로드
  const downloadResult = () => {
    if (result) {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${methodName.replace('/', '_')}_result.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="mcp-method-executor">
      <div className="executor-header">
        <h4>{methodName}</h4>
        <button type="button" className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="executor-content">
        <div className="parameters-section">
          <h5>매개변수</h5>
          {parameters.map((param, index) => (
            <div key={index} className="parameter-item">
              <div className="parameter-header">
                <input
                  type="text"
                  placeholder="매개변수 이름"
                  value={param.name}
                  onChange={(e) => handleParameterChange(index, e.target.value)}
                  className="param-name"
                />
                <select
                  value={param.type}
                  onChange={(e) => handleParameterChange(index, e.target.value)}
                  className="param-type"
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                </select>
                <label className="param-required">
                  <input
                    type="checkbox"
                    checked={param.required}
                    onChange={(e) => handleParameterChange(index, e.target.checked.toString())}
                  />
                  필수
                </label>
                <button
                  type="button"
                  className="remove-param-btn"
                  onClick={() => removeParameter(index)}
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                placeholder="매개변수 값"
                value={param.value}
                onChange={(e) => handleParameterChange(index, e.target.value)}
                className="param-value"
              />
              {param.description && (
                <p className="param-description">{param.description}</p>
              )}
            </div>
          ))}
          <button type="button" className="add-param-btn" onClick={addParameter}>
            + 매개변수 추가
          </button>
        </div>

        <div className="execution-section">
          <button
            type="button"
            className="execute-btn"
            onClick={executeMethod}
            disabled={loading}
          >
            {loading ? '실행 중...' : '실행'}
          </button>
        </div>

        {error && (
          <div className="execution-error">
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="result-section">
            <div className="result-header">
              <h5>결과</h5>
              <div className="result-actions">
                <button type="button" className="action-btn" onClick={copyResult}>
                  복사
                </button>
                <button type="button" className="action-btn" onClick={downloadResult}>
                  다운로드
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => setShowResult(!showResult)}
                >
                  {showResult ? '숨기기' : '보기'}
                </button>
              </div>
            </div>
            {showResult && (
              <div className="result-content">
                <pre className="result-json">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
