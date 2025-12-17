import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './ChatInterface.css';

function ChatInterface({ user, onLogout, apiBase }) {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef(null);
  const token = localStorage.getItem('newburry_token');

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessions = async () => {
    try {
      const response = await fetch(`${apiBase}/api/agent-chat/sessions?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSessions(data.sessions);
        if (data.sessions.length > 0 && !currentSessionId) {
          setCurrentSessionId(data.sessions[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadMessages = async (sessionId) => {
    try {
      const response = await fetch(`${apiBase}/api/agent-chat/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await fetch(`${apiBase}/api/agent-chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'New Chat' })
      });
      const data = await response.json();
      if (data.success) {
        setSessions([data.session, ...sessions]);
        setCurrentSessionId(data.session.id);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !currentSessionId || isLoading) return;

    const userMessage = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    // Add user message to UI immediately
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const response = await fetch(`${apiBase}/api/agent-chat/sessions/${currentSessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_history: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let assistantMessageObj = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'response_chunk') {
                assistantMessage += data.data.content;
                
                // Update or create assistant message in UI
                if (!assistantMessageObj) {
                  assistantMessageObj = {
                    role: 'assistant',
                    content: assistantMessage,
                    created_at: new Date().toISOString()
                  };
                  setMessages(prev => [...prev, assistantMessageObj]);
                } else {
                  setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      ...assistantMessageObj,
                      content: assistantMessage
                    };
                    return newMessages;
                  });
                }
              } else if (data.type === 'complete') {
                // Final message received
                await loadSessions(); // Refresh sessions (title might have been auto-generated)
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Could not connect to AI agent. Please try again.',
        created_at: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="chat-container">
      {/* Sidebar */}
      {showSidebar && (
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="logo-small">
              <span className="logo-icon-small">🧠</span>
              <span>Newburry</span>
            </div>
            <button onClick={createNewSession} className="new-chat-button">
              <span className="plus-icon">+</span>
              New Chat
            </button>
          </div>

          <div className="sessions-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                onClick={() => setCurrentSessionId(session.id)}
              >
                <span className="session-icon">💬</span>
                <span className="session-title">{session.title}</span>
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="user-details">
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role}</div>
              </div>
            </div>
            <button onClick={onLogout} className="logout-button">
              <span>🚪</span>
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="chat-main">
        {/* Header */}
        <div className="chat-header">
          <button onClick={() => setShowSidebar(!showSidebar)} className="toggle-sidebar">
            <span>{showSidebar ? '◀' : '▶'}</span>
          </button>
          <h2 className="chat-title">{currentSession?.title || 'Select a chat'}</h2>
          <div className="header-actions">
            <span className="ai-badge">🤖 AI Agent</span>
          </div>
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧠</div>
              <h3>Welcome to Newburry AI Agent</h3>
              <p>Ask me anything about Newbury Partners, search meeting transcripts, or analyze client engagements.</p>
              <div className="example-queries">
                <button onClick={() => setInputMessage("Tell me about Newbury Partners' Bullhorn services")} className="example-query">
                  Tell me about Bullhorn services
                </button>
                <button onClick={() => setInputMessage("Search for transcripts about Bullhorn")} className="example-query">
                  Search transcripts
                </button>
                <button onClick={() => setInputMessage("What are our AI enablement capabilities?")} className="example-query">
                  AI capabilities
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="message-avatar">
                    {message.role === 'user' ? (
                      <div className="user-avatar-small">{user.name.charAt(0).toUpperCase()}</div>
                    ) : (
                      <div className="ai-avatar">🤖</div>
                    )}
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-author">
                        {message.role === 'user' ? user.name : 'AI Agent'}
                      </span>
                      <span className="message-time">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-text">
                      {message.role === 'assistant' ? (
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about transcripts, Newbury Partners services, or anything else..."
              rows="1"
              disabled={isLoading || !currentSessionId}
              className="chat-input"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim() || !currentSessionId}
              className="send-button"
            >
              {isLoading ? (
                <span className="button-spinner-small"></span>
              ) : (
                <span className="send-icon">➤</span>
              )}
            </button>
          </div>
          <div className="input-hint">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;

