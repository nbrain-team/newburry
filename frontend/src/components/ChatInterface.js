import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import FeedbackModal from './FeedbackModal';
import './ChatInterface.css';

function ChatInterface({ user, onLogout, apiBase }) {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState({ isOpen: false, messageId: null });
  const messagesEndRef = useRef(null);
  const currentSessionIdRef = useRef(null);
  const token = localStorage.getItem('newburry_token');
  
  // Keep ref in sync with state for use in closures
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

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
        currentSessionIdRef.current = data.session.id; // Update ref immediately
        setMessages([]);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation(); // Prevent triggering session selection
    
    if (!window.confirm('Are you sure you want to delete this chat?')) {
      return;
    }
    
    try {
      const response = await fetch(`${apiBase}/api/agent-chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        // Remove from sessions list
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        
        // If we deleted the current session, switch to another or clear
        if (currentSessionId === sessionId) {
          const remainingSessions = sessions.filter(s => s.id !== sessionId);
          if (remainingSessions.length > 0) {
            setCurrentSessionId(remainingSessions[0].id);
            currentSessionIdRef.current = remainingSessions[0].id;
          } else {
            setCurrentSessionId(null);
            currentSessionIdRef.current = null;
            setMessages([]);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
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
              
              if (data.type === 'plan') {
                // Show that AI is starting to work
                setMessages(prev => [...prev, {
                  role: 'system',
                  content: `🔍 Planning your request...`,
                  created_at: new Date().toISOString(),
                  isProgress: true
                }]);
              } else if (data.type === 'tool_start') {
                // Show tool starting
                const { step, tool, total_steps } = data.data;
                const toolName = tool.replace(/_/g, ' ');
                
                setMessages(prev => {
                  const filtered = prev.filter(m => !m.isProgress);
                  return [...filtered, {
                    role: 'system',
                    content: `⚙️ Step ${step}/${total_steps}: ${toolName}...`,
                    created_at: new Date().toISOString(),
                    isProgress: true
                  }];
                });
              } else if (data.type === 'tool_result') {
                // Show tool completed
                const { step, tool, success, total_steps } = data.data;
                const toolName = tool.replace(/_/g, ' ');
                
                setMessages(prev => {
                  const filtered = prev.filter(m => !m.isProgress);
                  return [...filtered, {
                    role: 'system',
                    content: `✓ Completed: ${toolName}`,
                    created_at: new Date().toISOString(),
                    isProgress: true
                  }];
                });
              } else if (data.type === 'progress') {
                // Show custom progress message
                const { message } = data.data;
                
                setMessages(prev => {
                  const filtered = prev.filter(m => !m.isProgress);
                  return [...filtered, {
                    role: 'system',
                    content: `💭 ${message}`,
                    created_at: new Date().toISOString(),
                    isProgress: true
                  }];
                });
              } else if (data.type === 'response_chunk') {
                // Remove all progress messages when actual response starts
                setMessages(prev => prev.filter(m => !m.isProgress));
                
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
                // Remove any remaining progress messages
                setMessages(prev => prev.filter(m => !m.isProgress));
                
                // Reload messages to get IDs for feedback buttons (use ref for current value)
                setTimeout(async () => {
                  const sessionIdToReload = currentSessionIdRef.current;
                  console.log('[Chat] Reloading messages for session:', sessionIdToReload);
                  if (sessionIdToReload) {
                    await loadMessages(sessionIdToReload);
                  }
                }, 1000); // Wait for DB save to complete
                
                // Reload sessions with longer delay to get auto-generated title
                setTimeout(async () => {
                  console.log('[Chat] Reloading sessions for title update');
                  await loadSessions();
                }, 3000); // 3 seconds for title generation
              } else if (data.type === 'error') {
                // Remove progress messages and show error
                setMessages(prev => prev.filter(m => !m.isProgress));
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Error: ${data.error}`,
                  created_at: new Date().toISOString()
                }]);
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

  const handleFeedbackSubmit = async (feedbackText) => {
    try {
      const response = await fetch(`${apiBase}/api/feedback/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message_id: feedbackModal.messageId,
          session_id: currentSessionId,
          text_feedback: feedbackText,
          full_conversation: messages
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Feedback submitted successfully');
        // Could show a success toast here
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
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
              <img src="/newbury-logo.png" alt="Newbury Partners" className="sidebar-logo-img" />
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
                <span className="session-title">{session.title}</span>
                <button 
                  className="delete-session-button"
                  onClick={(e) => deleteSession(e, session.id)}
                  title="Delete chat"
                >
                  ×
                </button>
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
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h3>Welcome to Newbury AI Agent</h3>
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
                <div key={index} className={`message ${message.role} ${message.isProgress ? 'system-message' : ''}`}>
                  {message.role !== 'system' && (
                    <div className="message-avatar">
                      {message.role === 'user' ? (
                        <div className="user-avatar-small">{user.name.charAt(0).toUpperCase()}</div>
                      ) : (
                        <div className="ai-avatar">AI</div>
                      )}
                    </div>
                  )}
                  <div className="message-content">
                    {message.role !== 'system' && (
                      <div className="message-header">
                        <span className="message-author">
                          {message.role === 'user' ? user.name : 'AI Agent'}
                        </span>
                        <span className="message-time">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    <div className="message-text">
                      {message.role === 'assistant' ? (
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      ) : (
                        message.content
                      )}
                    </div>
                    {message.role === 'assistant' && message.id && (
                      <button 
                        className="feedback-button"
                        onClick={() => setFeedbackModal({ isOpen: true, messageId: message.id })}
                        title="Provide feedback"
                      >
                        +
                      </button>
                    )}
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

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={feedbackModal.isOpen}
        onClose={() => setFeedbackModal({ isOpen: false, messageId: null })}
        onSubmit={handleFeedbackSubmit}
        messageId={feedbackModal.messageId}
        sessionId={currentSessionId}
      />
    </div>
  );
}

export default ChatInterface;

