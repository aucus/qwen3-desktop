import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import './ConversationList.css';

const ConversationList: React.FC = () => {
  const { conversations, currentConversationId, setCurrentConversation, deleteConversation } = useAppStore();

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return '오늘';
    } else if (diffDays === 2) {
      return '어제';
    } else if (diffDays <= 7) {
      return `${diffDays - 1}일 전`;
    } else {
      return new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
      }).format(date);
    }
  };

  const getPreviewText = (messages: any[]) => {
    if (messages.length === 0) return '새로운 대화';
    
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content;
    
    if (content.length <= 50) {
      return content;
    }
    
    return content.substring(0, 50) + '...';
  };

  const handleConversationClick = (id: string) => {
    setCurrentConversation(id);
  };

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('이 대화를 삭제하시겠습니까?')) {
      deleteConversation(id);
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="conversation-list empty">
        <div className="empty-state">
          <p>대화가 없습니다</p>
          <p>새로운 대화를 시작해보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className={`conversation-item ${conversation.id === currentConversationId ? 'active' : ''}`}
          onClick={() => handleConversationClick(conversation.id)}
        >
          <div className="conversation-content">
            <div className="conversation-header">
              <h4 className="conversation-title">{conversation.title}</h4>
              <button
                className="delete-btn"
                onClick={(e) => handleDeleteConversation(e, conversation.id)}
                title="대화 삭제"
              >
                🗑️
              </button>
            </div>
            
            <p className="conversation-preview">
              {getPreviewText(conversation.messages)}
            </p>
            
            <div className="conversation-meta">
              <span className="message-count">
                {conversation.messages.length}개 메시지
              </span>
              <span className="conversation-date">
                {formatDate(conversation.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversationList;
