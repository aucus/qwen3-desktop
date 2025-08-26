import React from 'react';
import './TypingIndicator.css';

interface TypingIndicatorProps {
  isVisible: boolean;
  message?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  isVisible, 
  message = 'Qwen 3이 응답을 생성하고 있습니다...' 
}) => {
  if (!isVisible) return null;

  return (
    <div className="typing-indicator-container">
      <div className="typing-indicator">
        <div className="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="typing-message">
          {message}
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
