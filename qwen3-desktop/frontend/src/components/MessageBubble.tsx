import React from 'react';
import { Message } from '../stores/useAppStore';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatContent = (content: string) => {
    // 마크다운 스타일의 간단한 포맷팅
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      
      <div className="message-content">
        <div className="message-header">
          <span className="message-author">
            {isUser ? '사용자' : 'Qwen 3 Assistant'}
          </span>
          <span className="message-time">
            {formatTime(message.timestamp)}
          </span>
        </div>
        
        <div 
          className={`message-text ${isStreaming ? 'streaming' : ''}`}
          dangerouslySetInnerHTML={{ 
            __html: formatContent(message.content) 
          }}
        />
        
        {isStreaming && (
          <div className="streaming-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>
      
      <div className="message-actions">
        <button className="action-btn" title="복사">
          📋
        </button>
        {!isUser && (
          <>
            <button className="action-btn" title="다시 생성">
              🔄
            </button>
            <button className="action-btn" title="좋아요">
              👍
            </button>
            <button className="action-btn" title="싫어요">
              👎
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
