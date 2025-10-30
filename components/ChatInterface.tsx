import React, { useState, useRef, useEffect } from 'react';
import { getAvailableAgents, getAgentConfig, streamTextResponse } from '../services/geminiService';
import type { Message } from '../types';
import { SendIcon, LinkIcon } from './icons';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aadya.com:8080';

interface Agent {
  name: string;
  displayName: string;
}

interface AgentConfig {
  name: string;
  chatPrompt?: string;
  model: string;
  [key: string]: any;
}

const ChatInterface: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load available agents on mount
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const agents = await getAvailableAgents();
        setAvailableAgents(agents);
        
        if (agents.length > 0) {
          await selectAgent(agents[0]);
        }
      } catch (err) {
        setError(`Error loading agents: ${err instanceof Error ? err.message : 'Unknown error'}`);
        console.error('Error fetching agents:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Select agent and fetch its config
  const selectAgent = async (agent: Agent) => {
    try {
      setLoading(true);
      setSelectedAgent(agent);
      
      const config = await getAgentConfig(agent.name);
      setAgentConfig(config);
      setMessages([]);
      setError(null);
    } catch (err) {
      setError(`Error loading agent: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error selecting agent:', err);
    } finally {
      setLoading(false);
    }
  };

 const handleSendMessage = async (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key !== 'Enter' || !agentConfig || !selectedAgent) return;
  
  const userMessage = inputRef.current?.value.trim();
  if (!userMessage) return;

  setMessages(prev => [...prev, { text: userMessage, role: 'user', sources: [] }]);
  if (inputRef.current) inputRef.current.value = '';
  setMessages(prev => [...prev, { text: '', role: 'model', sources: [] }]);
  setIsTyping(true);

  try {
    const stream = await streamTextResponse(selectedAgent.name, userMessage, messages);
    
    if (!stream) throw new Error('No stream received');
    
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      fullResponse += decoder.decode(value, { stream: true });
      setMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex].role === 'model') {
          updated[lastIndex] = { ...updated[lastIndex], text: fullResponse };
        }
        return updated;
      });
    }
  } catch (err) {
    setError(`Chat error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    setMessages(prev => prev.slice(0, -1));
  } finally {
    setIsTyping(false);
  }
};


  const handleStartLive = async () => {
    if (!selectedAgent) return;

    try {
      setLoading(true);
      setError(null);

      const { startLiveConversation } = await import('../services/geminiService');
      
      const session = await startLiveConversation(selectedAgent.name, {
        onopen: () => {
          setIsLiveActive(true);
          console.log('Live session started');
        },
        onmessage: (message: any) => {
          console.log('Live message received:', message);
        },
        onerror: (e: Error) => {
          setError(`Live session error: ${e.message}`);
          setIsLiveActive(false);
          console.error('Live session error:', e);
        },
        onclose: () => {
          setIsLiveActive(false);
          console.log('Live session closed');
        }
      });

      liveSessionRef.current = session;
    } catch (err) {
      setError(`Failed to start live: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Failed to start live:', err);
      setIsLiveActive(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEndLive = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.close?.();
      liveSessionRef.current = null;
      setIsLiveActive(false);
    }
  };

  // Agent selection screen
  if (!selectedAgent || !agentConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-purple-900 to-black">
        {loading ? (
          <div className="text-white text-xl">Loading agents...</div>
        ) : error ? (
          <div className="text-red-500 text-center max-w-md">
            <p className="mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-4xl font-bold text-white mb-8">Select an Agent</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableAgents.map(agent => (
                <button
                  key={agent.name}
                  onClick={() => selectAgent(agent)}
                  disabled={loading}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {agent.displayName}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Chat screen
  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-black p-4 border-b border-purple-800">
        <div className="flex justify-between items-center">
          <h1 className="text-white text-2xl font-bold">{agentConfig.name}</h1>
          <div className="flex gap-2">
            {isLiveActive ? (
              <button
                onClick={handleEndLive}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
              >
                End Call
              </button>
            ) : (
              <button
                onClick={handleStartLive}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50"
              >
                Voice Call
              </button>
            )}
            <button
              onClick={() => {
                setSelectedAgent(null);
                setAgentConfig(null);
                setMessages([]);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              Change Agent
            </button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 p-3 m-2 rounded-lg flex justify-between items-center">
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-lg font-bold hover:text-red-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isTyping && (
          <div className="text-center text-gray-500 mt-10">
            <p>Start a conversation with {agentConfig.name}</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              msg.role === 'user'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-100'
            }`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 text-sm text-gray-300 border-t border-gray-600 pt-2">
                  {msg.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-blue-400 hover:underline truncate"
                    >
                      {source.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-2 rounded-lg text-gray-500">typing...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!isLiveActive && (
        <div className="p-4 border-t border-purple-800">
          <input
            ref={inputRef}
            type="text"
            placeholder={`Message ${agentConfig.name}...`}
            onKeyPress={handleSendMessage}
            disabled={loading || isTyping}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg outline-none focus:ring-2 focus:ring-purple-600 disabled:opacity-50 transition"
          />
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
