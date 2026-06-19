// ============================================================
// ChatPanel — In-Game Chat
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import { useAppSelector } from '../../store/hooks';
import type { ChatMessagePayload } from '@sky-kingdom/shared';

const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [input, setInput] = useState('');
  const [minimized, setMinimized] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket, sendChatMessage } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handler = (msg: ChatMessagePayload) => {
      setMessages((prev) => [...prev.slice(-49), msg]);
    };

    socket.on('CHAT_MESSAGE', handler);
    return () => {
      socket.off('CHAT_MESSAGE', handler);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendChatMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`glass rounded-2xl transition-all duration-300 ${
        minimized ? 'h-12 cursor-pointer' : 'h-80'
      }`}
      onClick={() => minimized && setMinimized(false)}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12"
        onClick={() => setMinimized(!minimized)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-skc-gold" />
          <span className="text-xs text-white/60 uppercase tracking-wider">Chat</span>
        </div>
        <span className="text-xs text-white/30">{messages.length}</span>
      </div>

      {/* Messages */}
      {!minimized && (
        <div className="flex flex-col h-[calc(100%-3rem)]">
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {messages.length === 0 && (
              <div className="text-center text-white/20 text-sm py-8">
                No messages yet. Be the first!
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="text-sm">
                <span className="text-skc-gold font-medium">{msg.username}</span>
                <span className="text-white/70 ml-1.5">{msg.message}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/5">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                maxLength={200}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-skc-gold/30 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 bg-skc-gold/20 rounded-xl text-skc-gold hover:bg-skc-gold/30 transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;