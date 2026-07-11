// Vercel Serverless Function - ChoirAI Backend
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();

// DeepSeek API config
const DEEPSEEK_API_KEY = process.env.DEEPEEK_API_KEY || 'sk-7fa9ea181c2748d793f26f184fe756de';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// =================== IN-MEMORY STORAGE ===================
const scores = [];
const sessions = [];
const messages = [];
const voiceParts = [];     // { id, name, code, password, creator, members:[], tasks:[], createdAt }
const trainingPlans = [];  // { id, title, scoreName, parts, startDate, endDate, phases, creator, shared, createdAt }
const planProgress = {};   // { planId: { userId: percentage } }
const fileStorage = {};    // { filename: { data, type, name } }

function generateScoreParts(title) {
  return {
    soprano: { name: '女高音 (Soprano)', color: '#ef4444', notes: [{ note: 'C4', duration: '4n', time: '0:0:0' }, { note: 'E4', duration: '4n', time: '0:1:0' }, { note: 'G4', duration: '4n', time: '0:2:0' }, { note: 'A4', duration: '4n', time: '0:3:0' }, { note: 'G4', duration: '2n', time: '1:0:0' }, { note: 'E4', duration: '4n', time: '1:2:0' }, { note: 'C4', duration: '2n', time: '1:3:0' }] },
    alto: { name: '女低音 (Alto)', color: '#3b82f6', notes: [{ note: 'G3', duration: '4n', time: '0:0:0' }, { note: 'C4', duration: '4n', time: '0:1:0' }, { note: 'E4', duration: '4n', time: '0:2:0' }, { note: 'F4', duration: '4n', time: '0:3:0' }, { note: 'E4', duration: '2n', time: '1:0:0' }, { note: 'C4', duration: '4n', time: '1:2:0' }, { note: 'G3', duration: '2n', time: '1:3:0' }] },
    tenor: { name: '男高音 (Tenor)', color: '#22c55e', notes: [{ note: 'E3', duration: '4n', time: '0:0:0' }, { note: 'G3', duration: '4n', time: '0:1:0' }, { note: 'C4', duration: '4n', time: '0:2:0' }, { note: 'D4', duration: '4n', time: '0:3:0' }, { note: 'C4', duration: '2n', time: '1:0:0' }, { note: 'G3', duration: '4n', time: '1:2:0' }, { note: 'E3', duration: '2n', time: '1:3:0' }] },
    bass: { name: '男低音 (Bass)', color: '#d97706', notes: [{ note: 'C3', duration: '4n', time: '0:0:0' }, { note: 'E3', duration: '4n', time: '0:1:0' }, { note: 'G3', duration: '4n', time: '0:2:0' }, { note: 'F3', duration: '4n', time: '0:3:0' }, { note: 'E3', duration: '2n', time: '1:0:0' }, { note: 'G3', duration: '4n', time: '1:2:0' }, { note: 'C3', duration: '2n', time: '1:3:0' }] },
    tempo: 72, key: 'C大调', timeSignature: '4/4', totalMeasures: 2
  };
}

// =================== SCORES ===================
app.get('/api/scores', (req, res) => { res.json(scores); });

app.get('/api/scores/:id', (req, res) => {
  const s = scores.find(x => x.id === parseInt(req.params.id));
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

app.post('/api/scores', (req, res) => {
  const { title, composer, fileData, fileName, fileType, externalUrl } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  let file_path = null;
  if (fileData && fileName) {
    const ext = path.extname(fileName) || '';
    const safeName = Date.now() + '-' + Math.random().toString(36).slice(2) + ext;
    file_path = `/uploads/${safeName}`;
    fileStorage[safeName] = { data: fileData, type: fileType || 'application/octet-stream', name: fileName };
  }

  const parts = generateScoreParts(title);
  const id = scores.length + 1;
  const result = { id, title, composer: composer || '', file_path, external_url: externalUrl || null, tempo: parts.tempo, key_sig: parts.key, time_signature: parts.timeSignature, total_measures: parts.totalMeasures, parts_data: parts, created_at: new Date().toISOString() };
  scores.push(result);
  res.json(result);
});

app.get('/uploads/:filename', (req, res) => {
  const file = fileStorage[req.params.filename];
  if (!file) return res.status(404).json({ error: 'File not found' });
  const buffer = Buffer.from(file.data, 'base64');
  res.setHeader('Content-Type', file.type);
  res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
  res.send(buffer);
});

// =================== VOICE PARTS ===================
// Create a voice part with password
app.post('/api/voice-parts', (req, res) => {
  const { name, password, creator } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Name and password required' });

  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const part = {
    id: 'vp_' + Date.now(),
    name,
    code,
    password, // plain text for simplicity (in production use bcrypt)
    creator: creator || 'unknown',
    members: [creator || 'unknown'],
    tasks: [],
    createdAt: new Date().toISOString(),
  };
  voiceParts.push(part);
  res.json({ id: part.id, name: part.name, code: part.code, members: part.members, tasks: part.tasks, createdAt: part.createdAt });
});

// Get all voice parts (without password)
app.get('/api/voice-parts', (req, res) => {
  res.json(voiceParts.map(p => ({ id: p.id, name: p.name, code: p.code, creator: p.creator, members: p.members, tasks: p.tasks, createdAt: p.createdAt })));
});

// Join a voice part (need code + password)
app.post('/api/voice-parts/:code/join', (req, res) => {
  const { password, memberName } = req.body;
  const part = voiceParts.find(p => p.code === req.params.code.toUpperCase());
  if (!part) return res.status(404).json({ error: '邀请码不存在' });
  if (part.password !== password) return res.status(403).json({ error: '密码错误' });
  if (!memberName) return res.status(400).json({ error: 'Member name required' });
  if (!part.members.includes(memberName)) {
    part.members.push(memberName);
  }
  res.json({ id: part.id, name: part.name, code: part.code, members: part.members, tasks: part.tasks });
});

// Get single voice part
app.get('/api/voice-parts/:id', (req, res) => {
  const part = voiceParts.find(p => p.id === req.params.id);
  if (!part) return res.status(404).json({ error: 'Not found' });
  res.json({ id: part.id, name: part.name, code: part.code, creator: part.creator, members: part.members, tasks: part.tasks, createdAt: part.createdAt });
});

// Delete voice part
app.delete('/api/voice-parts/:id', (req, res) => {
  const idx = voiceParts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  voiceParts.splice(idx, 1);
  res.json({ success: true });
});

// Add task to voice part
app.post('/api/voice-parts/:id/tasks', (req, res) => {
  const part = voiceParts.find(p => p.id === req.params.id);
  if (!part) return res.status(404).json({ error: 'Not found' });
  const { title, type, assignee } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const task = {
    id: 'task_' + Date.now(),
    title,
    type: type || 'practice',
    assignee: assignee || '全体成员',
    completed: false,
    createdAt: new Date().toLocaleDateString(),
  };
  part.tasks.push(task);
  res.json(task);
});

// Toggle task completion
app.patch('/api/voice-parts/:partId/tasks/:taskId', (req, res) => {
  const part = voiceParts.find(p => p.id === req.params.partId);
  if (!part) return res.status(404).json({ error: 'Not found' });
  const task = part.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  task.completed = !task.completed;
  res.json(task);
});

// Delete task
app.delete('/api/voice-parts/:partId/tasks/:taskId', (req, res) => {
  const part = voiceParts.find(p => p.id === req.params.partId);
  if (!part) return res.status(404).json({ error: 'Not found' });
  part.tasks = part.tasks.filter(t => t.id !== req.params.taskId);
  res.json({ success: true });
});

// =================== TRAINING PLANS ===================
// Create training plan
app.post('/api/plans', (req, res) => {
  const { title, scoreName, parts, startDate, endDate, phases, creator } = req.body;
  if (!title || !scoreName || !parts || parts.length === 0) {
    return res.status(400).json({ error: 'Title, scoreName and parts required' });
  }

  const plan = {
    id: 'plan_' + Date.now(),
    title,
    scoreName,
    parts,
    startDate: startDate || new Date().toLocaleDateString(),
    endDate: endDate || new Date(Date.now() + 14 * 86400000).toLocaleDateString(),
    phases: phases || [],
    creator: creator || 'unknown',
    shared: true,
    createdAt: new Date().toISOString(),
  };
  trainingPlans.push(plan);
  res.json(plan);
});

// Get all shared plans
app.get('/api/plans', (req, res) => {
  res.json(trainingPlans.filter(p => p.shared).map(p => ({
    id: p.id,
    title: p.title,
    scoreName: p.scoreName,
    parts: p.parts,
    startDate: p.startDate,
    endDate: p.endDate,
    phases: p.phases,
    creator: p.creator,
    createdAt: p.createdAt,
  })));
});

// Get single plan
app.get('/api/plans/:id', (req, res) => {
  const plan = trainingPlans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: 'Not found' });
  res.json(plan);
});

// Delete plan
app.delete('/api/plans/:id', (req, res) => {
  const idx = trainingPlans.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  trainingPlans.splice(idx, 1);
  res.json({ success: true });
});

// Get plan progress for a user
app.get('/api/plans/:id/progress/:userId', (req, res) => {
  const progress = planProgress[req.params.id]?.[req.params.userId] || 0;
  res.json({ progress });
});

// Update plan progress
app.post('/api/plans/:id/progress', (req, res) => {
  const { userId, progress } = req.body;
  if (!planProgress[req.params.id]) planProgress[req.params.id] = {};
  planProgress[req.params.id][userId] = progress;
  res.json({ success: true, progress });
});

// =================== CHAT (DeepSeek) ===================
function callDeepSeek(msgs) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ model: 'deepseek-chat', messages: msgs, temperature: 0.7, max_tokens: 2048 });
    const req = https.request({ hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Length': Buffer.byteLength(postData) }, timeout: 30000 }, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { const p = JSON.parse(data); if (p.choices?.[0]) resolve(p.choices[0].message.content); else reject(new Error(p.error?.message || 'No response')); } catch(e) { reject(e); } }); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(postData); req.end();
  });
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId, attachments } = req.body;
  if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Message or attachments required' });

  const sid = sessionId || Date.now();
  const history = messages.filter(m => m.session_id === sid);
  let userContent = message || '';
  const msgs = [{ role: 'system', content: '你是 ChoirAI 合唱智能训练助手，擅长合唱训练指导、乐理知识、谱面分析、声部协调。' }];
  history.forEach(h => msgs.push({ role: h.role, content: h.content }));

  if (attachments && attachments.length > 0) {
    const contentParts = [];
    if (userContent) contentParts.push({ type: 'text', text: userContent });
    attachments.forEach(att => {
      if (att.type && att.type.startsWith('image/')) {
        contentParts.push({ type: 'image_url', image_url: { url: `data:${att.type};base64,${att.data}` } });
      } else {
        contentParts.push({ type: 'text', text: `[附件: ${att.name || '文件'}]` });
      }
    });
    msgs.push({ role: 'user', content: contentParts });
  } else {
    msgs.push({ role: 'user', content: userContent });
  }

  messages.push({ session_id: sid, role: 'user', content: userContent, created_at: new Date().toISOString() });

  try {
    const aiContent = await callDeepSeek(msgs);
    messages.push({ session_id: sid, role: 'assistant', content: aiContent, created_at: new Date().toISOString() });
    res.json({ sessionId: sid, content: aiContent });
  } catch {
    const fallback = '抱歉，AI服务暂时不可用。请稍后重试。';
    messages.push({ session_id: sid, role: 'assistant', content: fallback, created_at: new Date().toISOString() });
    res.json({ sessionId: sid, content: fallback, _fallback: true });
  }
});

app.get('/api/chat/sessions', (req, res) => {
  const unique = [...new Set(messages.map(m => m.session_id))];
  res.json(unique.map(id => ({ id, title: messages.find(m => m.session_id === id && m.role === 'user')?.content?.slice(0, 30) || '新会话', created_at: messages.find(m => m.session_id === id)?.created_at })));
});

app.get('/api/chat/sessions/:id/messages', (req, res) => {
  res.json(messages.filter(m => m.session_id === parseInt(req.params.id)));
});

// =================== REHEARSAL ===================
app.post('/api/rehearsal/start', (req, res) => {
  res.json({ id: Date.now() });
});

app.get('/api/rehearsal/records', (req, res) => {
  res.json([]);
});

// =================== SERVE FRONTEND ===================
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

module.exports = app;
