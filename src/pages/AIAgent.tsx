import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, Plus, Send, Bot, User, Trash2, X,
  MessageSquare, Sparkles, ChevronLeft, Loader2,
  Paperclip, FileText, ImageIcon, Target, UserPlus, CheckCircle
} from 'lucide-react';
import { API_BASE } from '@/config';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  attachments?: Attachment[];
}

interface Attachment {
  name: string;
  type: string;
  data: string;
  preview?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

interface PlanSuggestion {
  goals: { type: string; title: string; desc: string }[];
  suggestedDuration: number;
  message: string;
}

function getToken() { return localStorage.getItem('choirai_token') || ''; }

function loadLocalSessions(): ChatSession[] {
  try { return JSON.parse(localStorage.getItem('choirai_chat_sessions') || '[]'); } catch { return []; }
}
function saveLocalSessions(sessions: ChatSession[]) {
  localStorage.setItem('choirai_chat_sessions', JSON.stringify(sessions));
}

const WELCOME_MSG: ChatMessage = {
  id: 0, role: 'assistant',
  content: `你好！我是你的合唱训练AI助手。

**当前模型：DeepSeek V3**（文字对话）/ **Kimi**（图片分析）

我可以帮你：
- **制定训练计划** — 告诉我你的目标（如"增强听力""改善音准"），我会自动为你制定练习计划
- **分析谱面** — 调性、难点段落、和声走向
- **音准/节奏指导** — 针对性的练习建议
- **合唱知识问答** — 乐理、发声技巧、声部协调
- **分析五线谱图片** — 上传乐谱照片，自动切换到 Kimi 模型分析

💡 试试说"我想增强听力能力"，我会为你制定专门的练习计划！`,
};

type AIModel = 'auto' | 'deepseek' | 'kimi';

export default function AIAgent() {
  const navigate = useNavigate();
  const { user, isLoggedIn, isAdmin, isCaptain } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>(loadLocalSessions);
  const [currentId, setCurrentId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [model, setModel] = useState<AIModel>('auto');
  const [planSuggestion, setPlanSuggestion] = useState<PlanSuggestion | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSession = sessions.find(s => s.id === currentId);
  const hasImageAttachments = attachments.some(a => a.type.startsWith('image/'));

  const effectiveModel: AIModel = model === 'auto'
    ? (hasImageAttachments ? 'kimi' : 'deepseek')
    : model;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { saveLocalSessions(sessions); }, [sessions]);

  // Load sessions from backend
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch(`${API_BASE}/api/chat/sessions`, { headers: { 'x-auth-token': getToken() } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (data && data.length > 0) {
          const backendSessions = data.map((s: any) => ({
            id: s.id,
            title: s.title,
            messages: [WELCOME_MSG],
            createdAt: s.created_at || new Date().toLocaleString(),
          }));
          setSessions(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newSessions = backendSessions.filter((s: ChatSession) => !existingIds.has(s.id));
            return [...newSessions, ...prev];
          });
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const createNewSession = () => {
    const newId = 'chat_' + Date.now();
    const newSession: ChatSession = { id: newId, title: '新会话', messages: [WELCOME_MSG], createdAt: new Date().toLocaleString() };
    setSessions([newSession, ...sessions]);
    setCurrentId(newId);
    setMessages([WELCOME_MSG]);
    setInput(''); setAttachments([]); setPlanSuggestion(null);
    setSidebarOpen(false);
  };

  const switchSession = (id: string) => {
    setCurrentId(id);
    const s = sessions.find(x => x.id === id);
    if (s) setMessages(s.messages);
    setSidebarOpen(false); setAttachments([]); setPlanSuggestion(null);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = sessions.filter(s => s.id !== id);
    setSessions(next);
    if (currentId === id) {
      if (next.length > 0) { setCurrentId(next[0].id); setMessages(next[0].messages); }
      else { setCurrentId(''); setMessages([WELCOME_MSG]); }
    }
  };

  const fileToBase64 = (file: File): Promise<Attachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve({ name: file.name, type: file.type, data: base64, preview: result });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 35 * 1024 * 1024) { alert(`文件 ${file.name} 超过 35MB 限制，已跳过`); continue; }
      try { newAttachments.push(await fileToBase64(file)); } catch { alert(`文件 ${file.name} 读取失败`); }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Add plan to user's practice
  const addToPlan = async (type: 'personal' | 'voicePart') => {
    if (!planSuggestion) return;
    const token = getToken();
    const exercises = planSuggestion.goals.map(g => ({
      name: g.title,
      type: g.type,
      description: g.desc,
      duration: Math.ceil(planSuggestion.suggestedDuration / planSuggestion.goals.length),
    }));

    try {
      const res = await fetch(`${API_BASE}/api/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({
          title: planSuggestion.goals.map(g => g.title).join(' + '),
          type,
          exercises,
          targetPart: user?.part,
        }),
      });
      if (res.ok) {
        alert(type === 'personal' ? '已添加到个人计划！' : '已添加到声部计划！');
        setPlanSuggestion(null);
      }
    } catch {}
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;
    if (!isLoggedIn) { alert('请先登录'); return; }
    const content = input.trim();
    setInput('');

    let sid = currentId;
    let currentSessions = sessions;
    if (!sid) {
      sid = 'chat_' + Date.now();
      const newSession: ChatSession = { id: sid, title: content.slice(0, 20) || attachments[0]?.name || '新会话', messages: [WELCOME_MSG], createdAt: new Date().toLocaleString() };
      currentSessions = [newSession, ...sessions];
      setSessions(currentSessions); setCurrentId(sid);
    }

    const userMsg: ChatMessage = {
      id: Date.now(), role: 'user', content,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };
    const updatedMessages = [...messages.filter(m => m.id !== 0 || messages.length === 1), userMsg];
    setMessages(updatedMessages);

    const sentAttachments = [...attachments];
    setAttachments([]);

    let forceModel: string | undefined;
    if (model === 'deepseek') forceModel = 'deepseek';
    else if (model === 'kimi') forceModel = 'kimi';

    setLoading(true);
    setPlanSuggestion(null);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': getToken() },
        body: JSON.stringify({
          message: content || '请帮我分析这张图片',
          sessionId: sid,
          forceModel,
          attachments: sentAttachments.map(a => ({ name: a.name, type: a.type, data: a.data })),
        }),
      });
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();

      // Show plan suggestion if AI detected training needs
      if (data.planSuggestion) {
        setPlanSuggestion(data.planSuggestion);
      }

      const aiMsg: ChatMessage = {
        id: Date.now() + 1, role: 'assistant',
        content: data.content, model: data.model,
      };
      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      setSessions(prev => prev.map(s => s.id === sid ? { ...s, messages: finalMessages } : s));
    } catch {
      const fallback: ChatMessage = {
        id: Date.now() + 1, role: 'assistant',
        content: '抱歉，AI服务暂时不可用。请稍后重试。',
      };
      setMessages([...updatedMessages, fallback]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  useEffect(() => {
    if (inputRef.current) { inputRef.current.style.height = 'auto'; inputRef.current.style.height = Math.min(120, inputRef.current.scrollHeight) + 'px'; }
  }, [input]);

  const modelIndicator = () => {
    if (effectiveModel === 'kimi') return { text: 'Kimi', color: 'bg-purple-500/20 text-purple-400', desc: '图片分析' };
    return { text: 'DeepSeek', color: 'bg-blue-500/20 text-blue-400', desc: '文字对话' };
  };
  const mi = modelIndicator();

  return (
    <div className="h-full flex w-full overflow-hidden">
      {sidebarOpen && isMobile && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />}
      <aside className={`bg-neutral-900 border-r border-neutral-800 flex flex-col flex-shrink-0 ${isMobile ? sidebarOpen ? 'fixed top-0 left-0 bottom-0 w-64 z-50' : 'hidden' : 'w-64'}`}>
        <div className="p-3 border-b border-neutral-800 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400"><ChevronLeft className="w-4 h-4" /></button>
          <div className="flex-1 min-w-0"><h3 className="text-sm font-medium truncate">会话历史</h3></div>
          <button onClick={createNewSession} className="p-1.5 rounded-lg hover:bg-neutral-800 text-amber-400"><Plus className="w-4 h-4" /></button>
          {isMobile && <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          {!isLoggedIn && <p className="text-xs text-neutral-600 text-center py-4">登录后查看历史会话</p>}
          {sessions.length === 0 ? <p className="text-xs text-neutral-600 text-center py-8">还没有会话</p> :
            sessions.map(s => (
              <button key={s.id} onClick={() => switchSession(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors group ${currentId === s.id ? 'bg-amber-500/10 text-amber-400' : 'text-neutral-400 hover:bg-neutral-800'}`}>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate flex-1">{s.title}</span>
                  <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
                </div>
                <p className="text-[10px] text-neutral-600 mt-0.5 pl-5">{s.createdAt}</p>
              </button>
            ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400"><Menu className="w-4 h-4" /></button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
              <div className="min-w-0">
                <h2 className="text-sm font-medium truncate">{currentSession ? currentSession.title : 'AI助手'}</h2>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${mi.color}`}>{mi.text}</span>
                  <span className="text-[10px] text-neutral-600">{mi.desc}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={model} onChange={e => setModel(e.target.value as AIModel)}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none focus:border-amber-500">
              <option value="auto">自动</option>
              <option value="deepseek">DeepSeek</option>
              <option value="kimi">Kimi</option>
            </select>
            <button onClick={createNewSession} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700"><Plus className="w-3.5 h-3.5" /><span>新会话</span></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot className="w-4 h-4 text-white" /></div>
              )}
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${msg.role === 'user' ? 'bg-amber-500 text-black' : 'bg-neutral-800/80 border border-neutral-700/50 text-neutral-200'}`}>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.attachments.map((att, i) => (
                      <div key={i}>
                        {att.type?.startsWith('image/') && att.preview ? (
                          <img src={att.preview} alt={att.name}
                            className="max-w-[180px] max-h-[120px] rounded-lg object-cover border border-black/10"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="flex items-center gap-1.5 bg-black/20 rounded-lg px-3 py-2 text-xs">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[120px]">{att.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.role === 'assistant' ? (
                  <div>
                    {msg.model && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded mb-1 inline-block ${msg.model === 'kimi' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {msg.model === 'kimi' ? 'Kimi' : 'DeepSeek'}
                      </span>
                    )}
                    <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
              {msg.role === 'user' && <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5"><User className="w-4 h-4 text-amber-400" /></div>}
            </div>
          ))}

          {/* AI Agent Plan Suggestion */}
          {planSuggestion && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-400">AI为你制定了训练计划</h3>
              </div>
              <div className="space-y-2 mb-3">
                {planSuggestion.goals.map((goal, i) => (
                  <div key={i} className="flex items-start gap-2 bg-neutral-900 rounded-lg p-2.5">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">{goal.title}</div>
                      <div className="text-xs text-neutral-500">{goal.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => addToPlan('personal')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-black rounded-lg text-xs font-medium hover:bg-amber-400">
                  <Target className="w-3.5 h-3.5" />加入个人计划
                </button>
                {(isAdmin || isCaptain) && (
                  <button onClick={() => addToPlan('voicePart')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30">
                    <UserPlus className="w-3.5 h-3.5" />加入声部计划
                  </button>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0"><Loader2 className="w-4 h-4 text-white animate-spin" /></div>
              <div className="bg-neutral-800/80 border border-neutral-700/50 rounded-xl px-4 py-3">
                <p className="text-sm text-neutral-400">助手思考中...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900/80 backdrop-blur-sm">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 max-w-3xl mx-auto">
              {attachments.map((att, i) => (
                <div key={i} className="relative group">
                  {att.type?.startsWith('image/') && att.preview ? (
                    <div className="relative">
                      <img src={att.preview} alt={att.name} className="w-16 h-16 rounded-lg object-cover border border-neutral-700"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <button onClick={() => removeAttachment(i)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-3 h-3 text-white" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-neutral-800 rounded-lg px-3 py-1.5 text-xs border border-neutral-700">
                      <FileText className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="truncate max-w-[100px] text-neutral-300">{att.name}</span>
                      <button onClick={() => removeAttachment(i)} className="ml-1 text-neutral-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              ))}
              {hasImageAttachments && model === 'auto' && (
                <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded self-center">检测到图片 → Kimi</span>
              )}
            </div>
          )}
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <button onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center hover:bg-neutral-700 transition-colors flex-shrink-0 text-neutral-400"
              title="上传图片">
              {hasImageAttachments ? <ImageIcon className="w-4 h-4 text-purple-400" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx" onChange={handleFileSelect} className="hidden" />
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={effectiveModel === 'kimi' ? "Kimi 模式：发送图片让我分析五线谱..." : "试试说'我想增强听力能力'..."}
              rows={1} className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 resize-none min-h-[40px] max-h-[120px]" />
            <button onClick={handleSend} disabled={loading || (!input.trim() && attachments.length === 0)}
              className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0">
              <Send className="w-4 h-4 text-black" />
            </button>
          </div>
          <p className="text-[10px] text-neutral-600 text-center mt-2">
            {effectiveModel === 'kimi' ? 'Kimi 模式：支持图片分析' : 'DeepSeek 模式：文字对话 · 试试说"我想增强听力"'}
          </p>
        </div>
      </div>
    </div>
  );
}
