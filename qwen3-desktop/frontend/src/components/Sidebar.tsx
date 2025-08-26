import React, { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import ConversationList from './ConversationList';
import McpToolsPanel from './McpToolsPanel';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'conversations' | 'tools'>('conversations');
  const { createConversation } = useAppStore();

  const handleNewConversation = () => {
    createConversation();
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-tabs">
          <button
            className={`tab-button ${activeTab === 'conversations' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversations')}
          >
            💬 대화
          </button>
          <button
            className={`tab-button ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            🛠️ 도구
          </button>
        </div>
        {activeTab === 'conversations' && (
          <button className="new-conversation-btn" onClick={handleNewConversation}>
            +
          </button>
        )}
      </div>
      
      <div className="sidebar-content">
        {activeTab === 'conversations' ? (
          <ConversationList />
        ) : (
          <McpToolsPanel />
        )}
      </div>
    </div>
  );
};

export default Sidebar;
