import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { 
  Eye, 
  EyeOff, 
  Copy, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Variable,
  Play
} from 'lucide-react';
import './PromptVariablePreview.css';

interface PromptVariable {
  name: string;
  type: string;
  description: string;
  default_value?: any;
  required: boolean;
  validation_rules?: any[];
}

interface PromptVariablePreviewProps {
  template: {
    content: string;
    variables: PromptVariable[];
  };
  onPreviewChange?: (previewData: { [key: string]: any }) => void;
  onRender?: (renderedContent: string) => void;
}

export const PromptVariablePreview: React.FC<PromptVariablePreviewProps> = ({
  template,
  onPreviewChange,
  onRender
}) => {
  const [previewData, setPreviewData] = useState<{ [key: string]: any }>({});
  const [renderedContent, setRenderedContent] = useState<string>('');
  const [showPreview, setShowPreview] = useState(true);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string[] }>({});
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    // 기본값으로 미리보기 데이터 초기화
    const initialPreview: { [key: string]: any } = {};
    template.variables.forEach(variable => {
      if (variable.default_value !== undefined) {
        initialPreview[variable.name] = variable.default_value;
      }
    });
    setPreviewData(initialPreview);
    onPreviewChange?.(initialPreview);
  }, [template.variables, onPreviewChange]);

  useEffect(() => {
    renderContent();
    validateAllVariables();
  }, [previewData, template.content]);

  const handleVariableChange = (variableName: string, value: any) => {
    const newPreviewData = { ...previewData, [variableName]: value };
    setPreviewData(newPreviewData);
    onPreviewChange?.(newPreviewData);
  };

  const renderContent = () => {
    let content = template.content;
    
    template.variables.forEach(variable => {
      const value = previewData[variable.name];
      const placeholder = `{${variable.name}}`;
      
      if (value !== undefined && value !== null && value !== '') {
        content = content.replace(new RegExp(placeholder, 'g'), String(value));
      }
    });
    
    setRenderedContent(content);
    onRender?.(content);
  };

  const validateVariable = (variable: PromptVariable, value: any): string[] => {
    const errors: string[] = [];
    
    // 필수 검증
    if (variable.required && (value === undefined || value === null || value === '')) {
      errors.push('이 변수는 필수입니다.');
      return errors;
    }
    
    if (value === undefined || value === null || value === '') {
      return errors; // 빈 값은 필수가 아닌 경우 허용
    }
    
    // 타입 검증
    switch (variable.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push('문자열 타입이어야 합니다.');
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push('숫자 타입이어야 합니다.');
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push('불린 타입이어야 합니다.');
        }
        break;
      case 'list':
        if (!Array.isArray(value)) {
          errors.push('리스트 타입이어야 합니다.');
        }
        break;
    }
    
    // 사용자 정의 검증 규칙 적용
    if (variable.validation_rules) {
      variable.validation_rules.forEach(rule => {
        switch (rule.type) {
          case 'min_length':
            if (typeof value === 'string' && value.length < rule.value) {
              errors.push(rule.message || `최소 ${rule.value}자 이상이어야 합니다.`);
            }
            break;
          case 'max_length':
            if (typeof value === 'string' && value.length > rule.value) {
              errors.push(rule.message || `최대 ${rule.value}자 이하여야 합니다.`);
            }
            break;
          case 'min':
            if (typeof value === 'number' && value < rule.value) {
              errors.push(rule.message || `최소값은 ${rule.value}입니다.`);
            }
            break;
          case 'max':
            if (typeof value === 'number' && value > rule.value) {
              errors.push(rule.message || `최대값은 ${rule.value}입니다.`);
            }
            break;
          case 'pattern':
            if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
              errors.push(rule.message || '패턴과 일치하지 않습니다.');
            }
            break;
        }
      });
    }
    
    return errors;
  };

  const validateAllVariables = () => {
    const errors: { [key: string]: string[] } = {};
    let hasErrors = false;
    
    template.variables.forEach(variable => {
      const variableErrors = validateVariable(variable, previewData[variable.name]);
      if (variableErrors.length > 0) {
        errors[variable.name] = variableErrors;
        hasErrors = true;
      }
    });
    
    setValidationErrors(errors);
    setIsValid(!hasErrors);
  };

  const resetToDefaults = () => {
    const defaultPreview: { [key: string]: any } = {};
    template.variables.forEach(variable => {
      if (variable.default_value !== undefined) {
        defaultPreview[variable.name] = variable.default_value;
      }
    });
    setPreviewData(defaultPreview);
    onPreviewChange?.(defaultPreview);
  };

  const copyRenderedContent = () => {
    navigator.clipboard.writeText(renderedContent);
  };

  const renderVariableInput = (variable: PromptVariable) => {
    const value = previewData[variable.name];
    const errors = validationErrors[variable.name] || [];

    switch (variable.type) {
      case 'string':
        return (
          <div>
            <Input
              value={value || ''}
              onChange={(e) => handleVariableChange(variable.name, e.target.value)}
              placeholder={variable.description || variable.name}
              className={errors.length > 0 ? 'border-red-500' : ''}
            />
            {errors.length > 0 && (
              <div className="validation-errors">
                {errors.map((error, index) => (
                  <div key={index} className="error-message">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      
      case 'number':
        return (
          <div>
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => handleVariableChange(variable.name, Number(e.target.value))}
              placeholder={variable.description || variable.name}
              className={errors.length > 0 ? 'border-red-500' : ''}
            />
            {errors.length > 0 && (
              <div className="validation-errors">
                {errors.map((error, index) => (
                  <div key={index} className="error-message">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      
      case 'boolean':
        return (
          <div className="boolean-input">
            <Switch
              checked={value || false}
              onCheckedChange={(checked) => handleVariableChange(variable.name, checked)}
            />
            <Label className={errors.length > 0 ? 'text-red-500' : ''}>
              {variable.description || variable.name}
            </Label>
            {errors.length > 0 && (
              <div className="validation-errors">
                {errors.map((error, index) => (
                  <div key={index} className="error-message">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      
      case 'list':
        return (
          <div>
            <Textarea
              value={Array.isArray(value) ? value.join('\n') : ''}
              onChange={(e) => handleVariableChange(variable.name, e.target.value.split('\n').filter(item => item.trim()))}
              placeholder="한 줄에 하나씩 입력하세요"
              rows={3}
              className={errors.length > 0 ? 'border-red-500' : ''}
            />
            {errors.length > 0 && (
              <div className="validation-errors">
                {errors.map((error, index) => (
                  <div key={index} className="error-message">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            className={errors.length > 0 ? 'border-red-500' : ''}
          />
        );
    }
  };

  const getValidationStatus = () => {
    const totalVariables = template.variables.length;
    const validVariables = template.variables.filter(variable => 
      !validationErrors[variable.name] || validationErrors[variable.name].length === 0
    ).length;
    
    return {
      total: totalVariables,
      valid: validVariables,
      invalid: totalVariables - validVariables
    };
  };

  const status = getValidationStatus();

  return (
    <div className="prompt-variable-preview">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Variable className="w-5 h-5" />
              변수 미리보기
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm">
                <CheckCircle className={`w-4 h-4 ${isValid ? 'text-green-500' : 'text-gray-400'}`} />
                <span className={isValid ? 'text-green-600' : 'text-gray-500'}>
                  {status.valid}/{status.total} 유효
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 변수 입력 섹션 */}
          {template.variables.length > 0 && (
            <div className="variables-input-section">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">변수 값 입력</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDefaults}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  기본값으로 초기화
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {template.variables.map(variable => (
                  <div key={variable.name} className="variable-input-item">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="font-medium">{variable.name}</Label>
                      <Badge variant="outline">{variable.type}</Badge>
                      {variable.required && <Badge variant="secondary">필수</Badge>}
                    </div>
                    {variable.description && (
                      <p className="text-sm text-gray-600 mb-2">{variable.description}</p>
                    )}
                    {renderVariableInput(variable)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 렌더링된 내용 미리보기 */}
          {showPreview && (
            <div className="rendered-content-section">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">렌더링된 내용</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyRenderedContent}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  복사
                </Button>
              </div>
              
              <div className="rendered-content">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {renderedContent || template.content}
                </pre>
              </div>
              
              {template.variables.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <strong>사용된 변수:</strong> {template.variables.length}개
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>채워진 변수:</strong> {Object.keys(previewData).filter(key => 
                      previewData[key] !== undefined && previewData[key] !== null && previewData[key] !== ''
                    ).length}개
                  </div>
                  <div className="text-sm text-gray-600">
                    <strong>빈 변수:</strong> {template.variables.filter(variable => 
                      previewData[variable.name] === undefined || 
                      previewData[variable.name] === null || 
                      previewData[variable.name] === ''
                    ).length}개
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 검증 상태 요약 */}
          {template.variables.length > 0 && (
            <div className="validation-summary">
              <h3 className="text-lg font-medium mb-4">검증 상태</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="validation-stat">
                  <div className="stat-number">{status.total}</div>
                  <div className="stat-label">전체 변수</div>
                </div>
                <div className="validation-stat valid">
                  <div className="stat-number">{status.valid}</div>
                  <div className="stat-label">유효한 변수</div>
                </div>
                <div className="validation-stat invalid">
                  <div className="stat-number">{status.invalid}</div>
                  <div className="stat-label">오류가 있는 변수</div>
                </div>
              </div>
              
              {status.invalid > 0 && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm text-red-700">
                    <strong>주의:</strong> {status.invalid}개의 변수에 오류가 있습니다. 
                    모든 필수 변수를 올바르게 입력해주세요.
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
