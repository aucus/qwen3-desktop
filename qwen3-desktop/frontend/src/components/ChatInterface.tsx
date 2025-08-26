import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import MessageBubble from './MessageBubble';
import InputArea from './InputArea';
import './ChatInterface.css';

const ChatInterface: React.FC = () => {
  const { conversations, currentConversationId, isLoading } = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const currentConversation = conversations.find(
    (conv) => conv.id === currentConversationId
  );

  // 메시지가 추가될 때 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  if (!currentConversation) {
    return (
      <div className="chat-interface empty">
        <div className="empty-state">
          <h2>대화를 시작해보세요</h2>
          <p>새로운 대화를 생성하거나 기존 대화를 선택하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2>{currentConversation.title}</h2>
        <div className="chat-meta">
          <span>{currentConversation.messages.length}개의 메시지</span>
          <span>
            {new Date(currentConversation.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      
      <div className="messages-container">
        {currentConversation.messages.length === 0 ? (
          <div className="welcome-message">
            <h3>안녕하세요! 👋</h3>
            <p>Qwen 3 Desktop Assistant와 대화를 시작해보세요.</p>
            <p>무엇이든 물어보실 수 있습니다.</p>
          </div>
        ) : (
          currentConversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        
        {isLoading && (
          <div className="loading-indicator">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <InputArea conversationId={currentConversation.id} />
    </div>
  );
};

export default ChatInterface;
