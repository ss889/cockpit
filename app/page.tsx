'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/types';

export default function CockpitChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [jd, setJd] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd: jd || input,
          history: messages,
          question: input,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to get response';
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch (e) {
          // ignore parse error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text || (typeof data.content === 'string' ? data.content : 'No response generated'),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Store job descriptions for analysis
      if (input.toLowerCase().includes('analyze') && input.length > 50) {
        setJd(input);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'An error occurred'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cockpit-chat">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-branding">
          <h1>Career Cockpit</h1>
          <p>AI operator for job search, analysis, and tracking</p>
        </div>
      </header>

      {/* Chat Container */}
      <div className="chat-container">
        {/* Welcome State */}
        {messages.length === 0 ? (
          <div className="welcome-state">
            <h2>What can I help you with?</h2>
            <p>Tell me about a job you want to analyze, search for roles, or track your applications.</p>
            <div className="example-prompts">
              <button
                onClick={() => setInput('Analyze this job description: [paste job description]')}
                className="example-prompt"
              >
                📋 Analyze a job description
              </button>
              <button
                onClick={() => setInput('Search for AI engineer roles in SF')}
                className="example-prompt"
              >
                🔍 Search for jobs
              </button>
              <button
                onClick={() => setInput('Show me my tracked jobs')}
                className="example-prompt"
              >
                💾 View saved jobs
              </button>
              <button
                onClick={() => setInput('What skills should I focus on for ML engineering?')}
                className="example-prompt"
              >
                🎯 Career advice
              </button>
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <span className="typing-indicator">
                    <span></span><span></span><span></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="input-wrapper">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Tell me what you want to analyze, search, or track..."
            className="chat-input"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="send-button"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
        <p className="input-hint">Paste job descriptions, ask about roles, or discuss your career path</p>
      </div>
    </div>
  );
}
