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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Eye, 
  Copy,
  Variable,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import './PromptVariableEditor.css';

interface ValidationRule {
  type: string;
  value: any;
  message?: string;
}

interface PromptVariable {
  name: string;
  type: string;
  description: string;
  default_value?: any;
  required: boolean;
  validation_rules?: ValidationRule[];
}

interface PromptVariableEditorProps {
  variables: PromptVariable[];
  onVariablesChange: (variables: PromptVariable[]) => void;
  onPreviewChange?: (previewData: { [key: string]: any }) => void;
}

export const PromptVariableEditor: React.FC<PromptVariableEditorProps> = ({
  variables,
  onVariablesChange,
  onPreviewChange
}) => {
  const [newVariable, setNewVariable] = useState<Partial<PromptVariable>>({
    name: '',
    type: 'string',
    description: '',
    required: false
  });
  const [previewData, setPreviewData] = useState<{ [key: string]: any }>({});
  const [showValidationEditor, setShowValidationEditor] = useState<string | null>(null);
  const [validationRules, setValidationRules] = useState<{ [key: string]: ValidationRule[] }>({});
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    // 기본값으로 미리보기 데이터 초기화
    const initialPreview: { [key: string]: any } = {};
    variables.forEach(variable => {
      if (variable.default_value !== undefined) {
        initialPreview[variable.name] = variable.default_value;
      }
    });
    setPreviewData(initialPreview);
    onPreviewChange?.(initialPreview);
  }, [variables, onPreviewChange]);

  const validateVariableName = (name: string): string[] => {
    const errors: string[] = [];
    
    if (!name.trim()) {
      errors.push('변수 이름은 비어있을 수 없습니다.');
    }
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      errors.push('변수 이름은 알파벳, 숫자, 언더스코어만 사용 가능하며, 숫자로 시작할 수 없습니다.');
    }
    
    if (variables.some(v => v.name === name)) {
      errors.push('이미 존재하는 변수 이름입니다.');
    }
    
    return errors;
  };

  const addVariable = () => {
    const nameErrors = validateVariableName(newVariable.name || '');
    if (nameErrors.length > 0) {
      setErrors(prev => ({ ...prev, newVariable: nameErrors }));
      return;
    }

    const variable: PromptVariable = {
      name: newVariable.name!,
      type: newVariable.type || 'string',
      description: newVariable.description || '',
      default_value: newVariable.default_value,
      required: newVariable.required || false,
      validation_rules: validationRules[newVariable.name!] || []
    };

    onVariablesChange([...variables, variable]);
    
    // 폼 초기화
    setNewVariable({
      name: '',
      type: 'string',
      description: '',
      required: false
    });
    setValidationRules(prev => {
      const newRules = { ...prev };
      delete newRules[newVariable.name!];
      return newRules;
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.newVariable;
      return newErrors;
    });
  };

  const updateVariable = (index: number, updates: Partial<PromptVariable>) => {
    const updatedVariables = [...variables];
    updatedVariables[index] = { ...updatedVariables[index], ...updates };
    onVariablesChange(updatedVariables);
  };

  const removeVariable = (index: number) => {
    const variableToRemove = variables[index];
    const updatedVariables = variables.filter((_, i) => i !== index);
    onVariablesChange(updatedVariables);
    
    // 미리보기 데이터에서도 제거
    const newPreviewData = { ...previewData };
    delete newPreviewData[variableToRemove.name];
    setPreviewData(newPreviewData);
    onPreviewChange?.(newPreviewData);
  };

  const handlePreviewChange = (variableName: string, value: any) => {
    const newPreviewData = { ...previewData, [variableName]: value };
    setPreviewData(newPreviewData);
    onPreviewChange?.(newPreviewData);
  };

  const addValidationRule = (variableName: string, rule: ValidationRule) => {
    const currentRules = validationRules[variableName] || [];
    const updatedRules = [...currentRules, rule];
    setValidationRules(prev => ({ ...prev, [variableName]: updatedRules }));
  };

  const removeValidationRule = (variableName: string, ruleIndex: number) => {
    const currentRules = validationRules[variableName] || [];
    const updatedRules = currentRules.filter((_, i) => i !== ruleIndex);
    setValidationRules(prev => ({ ...prev, [variableName]: updatedRules }));
  };

  const validateVariableValue = (variable: PromptVariable, value: any): string[] => {
    const errors: string[] = [];
    
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
    const rules = validationRules[variable.name] || [];
    rules.forEach(rule => {
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
    
    return errors;
  };

  const renderValidationEditor = (variable: PromptVariable) => {
    if (showValidationEditor !== variable.name) return null;

    const [newRule, setNewRule] = useState<Partial<ValidationRule>>({
      type: 'min_length',
      value: '',
      message: ''
    });

    const addRule = () => {
      if (!newRule.type || newRule.value === '') return;
      
      addValidationRule(variable.name, {
        type: newRule.type,
        value: newRule.type === 'pattern' ? newRule.value : Number(newRule.value),
        message: newRule.message
      });
      
      setNewRule({ type: 'min_length', value: '', message: '' });
    };

    return (
      <div className="validation-editor">
        <div className="validation-header">
          <h4>검증 규칙 추가</h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowValidationEditor(null)}
          >
            닫기
          </Button>
        </div>
        
        <div className="validation-form">
          <div className="grid grid-cols-3 gap-2">
            <Select value={newRule.type} onValueChange={(value) => setNewRule(prev => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="min_length">최소 길이</SelectItem>
                <SelectItem value="max_length">최대 길이</SelectItem>
                <SelectItem value="min">최소값</SelectItem>
                <SelectItem value="max">최대값</SelectItem>
                <SelectItem value="pattern">정규식</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="값"
              value={newRule.value}
              onChange={(e) => setNewRule(prev => ({ ...prev, value: e.target.value }))}
            />
            <Button size="sm" onClick={addRule}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Input
            placeholder="오류 메시지 (선택사항)"
            value={newRule.message}
            onChange={(e) => setNewRule(prev => ({ ...prev, message: e.target.value }))}
            className="mt-2"
          />
        </div>
        
        <div className="validation-rules">
          {(validationRules[variable.name] || []).map((rule, index) => (
            <div key={index} className="validation-rule">
              <Badge variant="outline">
                {rule.type}: {rule.value}
              </Badge>
              {rule.message && <span className="rule-message">{rule.message}</span>}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeValidationRule(variable.name, index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderVariableInput = (variable: PromptVariable) => {
    const value = previewData[variable.name];
    const validationErrors = validateVariableValue(variable, value);

    switch (variable.type) {
      case 'string':
        return (
          <div>
            <Input
              value={value || ''}
              onChange={(e) => handlePreviewChange(variable.name, e.target.value)}
              placeholder={variable.description || variable.name}
            />
            {validationErrors.length > 0 && (
              <div className="validation-errors">
                {validationErrors.map((error, index) => (
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
              onChange={(e) => handlePreviewChange(variable.name, Number(e.target.value))}
              placeholder={variable.description || variable.name}
            />
            {validationErrors.length > 0 && (
              <div className="validation-errors">
                {validationErrors.map((error, index) => (
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
              onCheckedChange={(checked) => handlePreviewChange(variable.name, checked)}
            />
            <Label>{variable.description || variable.name}</Label>
          </div>
        );
      
      case 'list':
        return (
          <div>
            <Textarea
              value={Array.isArray(value) ? value.join('\n') : ''}
              onChange={(e) => handlePreviewChange(variable.name, e.target.value.split('\n').filter(item => item.trim()))}
              placeholder="한 줄에 하나씩 입력하세요"
              rows={3}
            />
            {validationErrors.length > 0 && (
              <div className="validation-errors">
                {validationErrors.map((error, index) => (
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
        return <Input value={value || ''} onChange={(e) => handlePreviewChange(variable.name, e.target.value)} />;
    }
  };

  return (
    <div className="prompt-variable-editor">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Variable className="w-5 h-5" />
            변수 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 새 변수 추가 */}
          <div className="new-variable-form">
            <h3 className="text-lg font-medium mb-4">새 변수 추가</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <Label htmlFor="var-name">변수 이름 *</Label>
                <Input
                  id="var-name"
                  value={newVariable.name}
                  onChange={(e) => {
                    setNewVariable(prev => ({ ...prev, name: e.target.value }));
                    const errors = validateVariableName(e.target.value);
                    setErrors(prev => ({ ...prev, newVariable: errors }));
                  }}
                  placeholder="변수명"
                  className={errors.newVariable?.length ? 'border-red-500' : ''}
                />
                {errors.newVariable?.map((error, index) => (
                  <div key={index} className="text-red-500 text-sm mt-1">
                    {error}
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor="var-type">타입</Label>
                <Select
                  value={newVariable.type}
                  onValueChange={(value) => setNewVariable(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">문자열</SelectItem>
                    <SelectItem value="number">숫자</SelectItem>
                    <SelectItem value="boolean">불린</SelectItem>
                    <SelectItem value="list">리스트</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="var-description">설명</Label>
                <Input
                  id="var-description"
                  value={newVariable.description}
                  onChange={(e) => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="변수 설명"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newVariable.required}
                  onCheckedChange={(checked) => setNewVariable(prev => ({ ...prev, required: checked }))}
                />
                <Label>필수</Label>
                <Button onClick={addVariable} disabled={!newVariable.name}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* 변수 목록 */}
          {variables.length > 0 && (
            <div className="variables-list">
              <h3 className="text-lg font-medium mb-4">변수 목록</h3>
              <div className="space-y-4">
                {variables.map((variable, index) => (
                  <div key={variable.name} className="variable-item">
                    <div className="variable-header">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{variable.name}</h4>
                        <Badge variant="outline">{variable.type}</Badge>
                        {variable.required && <Badge variant="secondary">필수</Badge>}
                        {validationRules[variable.name]?.length > 0 && (
                          <Badge variant="default">
                            검증 규칙 {validationRules[variable.name].length}개
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowValidationEditor(
                            showValidationEditor === variable.name ? null : variable.name
                          )}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeVariable(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {variable.description && (
                      <p className="text-sm text-gray-600 mb-2">{variable.description}</p>
                    )}
                    
                    {renderValidationEditor(variable)}
                    
                    <div className="variable-preview">
                      <Label>미리보기</Label>
                      {renderVariableInput(variable)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 미리보기 요약 */}
          {Object.keys(previewData).length > 0 && (
            <div className="preview-summary">
              <h3 className="text-lg font-medium mb-4">변수 값 요약</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {variables.map(variable => (
                  <div key={variable.name} className="preview-item">
                    <div className="preview-label">{variable.name}</div>
                    <div className="preview-value">
                      {previewData[variable.name] !== undefined 
                        ? String(previewData[variable.name])
                        : '값 없음'
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
