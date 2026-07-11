import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, Plus, Send, Bot, User, Trash2, X,
  MessageSquare, Sparkles, ChevronLeft, Loader2
} from 'lucide-react';
import { API_BASE } from '@/config';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

function getUserKey(): string {
  try { const u = JSON.parse(localStorage.getItem('choir_user') || '{}'); return u.id || 'guest'; } catch { return 'guest'; }
}

function loadSessions(): ChatSession[] {
  try { return JSON.parse(localStorage.getItem(`choir_chat_${getUserKey()}`) || '[]'); } catch { return []; }
}
function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(`choir_chat_${getUserKey()}`, JSON.stringify(sessions));
}

// Default welcome message
const WELCOME_MSG: ChatMessage = {
  id: 0,
  role: 'assistant',
  content: `你好！我是你的合唱训练AI助手。

我可以帮你：
- **制定训练计划** — 根据曲目和声部安排个性化方案
- **分析谱面** — 调性、难点段落、和声走向
- **音准/节奏指导** — 针对性的练习建议
- **合唱知识问答** — 乐理、发声技巧、声部配合

试试问我：「如何制定14天训练计划？」`,
};

export default function AIAgent() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [currentId, setCurrentId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = sessions.find(s => s.id === currentId);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const createNewSession = () => {
    const newId = 'chat_' + Date.now();
    const newSession: ChatSession = {
      id: newId,
      title: '新会话',
      messages: [WELCOME_MSG],
      createdAt: new Date().toLocaleString(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentId(newId);
    setMessages([WELCOME_MSG]);
    setInput('');
    setSidebarOpen(false);
  };

  const switchSession = (id: string) => {
    setCurrentId(id);
    const s = sessions.find(x => x.id === id);
    if (s) setMessages(s.messages);
    setSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = sessions.filter(s => s.id !== id);
    setSessions(next);
    if (currentId === id) {
      if (next.length > 0) {
        setCurrentId(next[0].id);
        setMessages(next[0].messages);
      } else {
        setCurrentId('');
        setMessages([WELCOME_MSG]);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput('');

    // Determine session
    let sid = currentId;
    let currentSessions = sessions;
    if (!sid) {
      sid = 'chat_' + Date.now();
      const newSession: ChatSession = {
        id: sid, title: content.slice(0, 20),
        messages: [WELCOME_MSG], createdAt: new Date().toLocaleString(),
      };
      currentSessions = [newSession, ...sessions];
      setSessions(currentSessions);
      setCurrentId(sid);
    }

    // Add user message
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', content };
    const updatedMessages = [...messages.filter(m => m.id !== 0 || messages.length === 1), userMsg];
    setMessages(updatedMessages);

    // Update session title if first real message
    setSessions(currentSessions.map(s => {
      if (s.id === sid && s.title === '新会话') return { ...s, title: content.slice(0, 20), messages: updatedMessages };
      if (s.id === sid) return { ...s, messages: updatedMessages };
      return s;
    }));

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, sessionId: sid }),
      });
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();

      const aiMsg: ChatMessage = { id: Date.now() + 1, role: 'assistant', content: data.content };
      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      setSessions(prev => prev.map(s => s.id === sid ? { ...s, messages: finalMessages } : s));
    } catch {
      const fallback: ChatMessage = {
        id: Date.now() + 1, role: 'assistant',
        content: '抱歉，AI服务暂时不可用。请确保后端已启动（`cd backend && node server.js`），或稍后重试。',
      };
      setMessages([...updatedMessages, fallback]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(120, inputRef.current.scrollHeight) + 'px';
    }
  }, [input]);

  return (
    <div className="h-full flex w-full overflow-hidden">
      {/* Sidebar - History Sessions */}
      {sidebarOpen && isMobile && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`bg-neutral-900 border-r border-neutral-800 flex flex-col flex-shrink-0 ${
        isMobile
          ? sidebarOpen ? 'fixed top-0 left-0 bottom-0 w-64 z-50' : 'hidden'
          : 'w-64'
      }`}>
        {/* Sidebar Header */}
        <div className="p-3 border-b border-neutral-800 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate">会话历史</h3>
          </div>
          <button onClick={createNewSession} className="p-1.5 rounded-lg hover:bg-neutral-800 text-amber-400">
            <Plus className="w-4 h-4" />
          </button>
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          {sessions.length === 0 ? (
            <p className="text-xs text-neutral-600 text-center py-8">还没有会话</p>
          ) : sessions.map(s => (
            <button
              key={s.id}
              onClick={() => switchSession(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors group ${
                currentId === s.id ? 'bg-amber-500/10 text-amber-400' : 'text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1">{s.title}</span>
                <button
                  onClick={(e) => deleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 p-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[10px] text-neutral-600 mt-0.5 pl-5">{s.createdAt}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Menu button to toggle sidebar */}
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 transition-colors">
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-medium truncate">
                  {currentSession ? currentSession.title : 'AI助手'}
                </h2>
                <p className="text-[10px] text-neutral-500">DeepSeek V3</p>
              </div>
            </div>
          </div>
          <button onClick={createNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            <span>新会话</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-amber-500 text-black'
                  : 'bg-neutral-800/80 border border-neutral-700/50 text-neutral-200'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-amber-400" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-neutral-800/80 border border-neutral-700/50 rounded-xl px-4 py-3">
                <p className="text-sm text-neutral-400">思考中...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur-sm">
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="问我关于合唱训练的问题..."
              rows={1}
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 resize-none min-h-[40px] max-h-[120px]"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4 text-black" />
            </button>
          </div>
          <p className="text-[10px] text-neutral-600 text-center mt-2">AI生成内容仅供参考</p>
        </div>
      </div>
    </div>
  );
}
