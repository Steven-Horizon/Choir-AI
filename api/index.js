// Vercel Serverless Function - ChoirAI Backend
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();

// DeepSeek API config
const DEEPSEEK_API_KEY = process.env.DEEPEEK_API_KEY || 'sk-7fa9ea181c2748d793f26f184fe756de';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory storage for Vercel (no SQLite in serverless)
const scores = [];
const sessions = [];
const messages = [];

// Upload setup (store in /tmp for serverless)
const uploadsDir = '/tmp/uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

function generateScoreParts(title) {
  return {
    soprano: { name: '女高音 (Soprano)', color: '#ef4444', notes: [{ note: 'C4', duration: '4n', time: '0:0:0' }, { note: 'E4', duration: '4n', time: '0:1:0' }, { note: 'G4', duration: '4n', time: '0:2:0' }, { note: 'A4', duration: '4n', time: '0:3:0' }, { note: 'G4', duration: '2n', time: '1:0:0' }, { note: 'E4', duration: '4n', time: '1:2:0' }, { note: 'C4', duration: '2n', time: '1:3:0' }] },
    alto: { name: '女低音 (Alto)', color: '#3b82f6', notes: [{ note: 'G3', duration: '4n', time: '0:0:0' }, { note: 'C4', duration: '4n', time: '0:1:0' }, { note: 'E4', duration: '4n', time: '0:2:0' }, { note: 'F4', duration: '4n', time: '0:3:0' }, { note: 'E4', duration: '2n', time: '1:0:0' }, { note: 'C4', duration: '4n', time: '1:2:0' }, { note: 'G3', duration: '2n', time: '1:3:0' }] },
    tenor: { name: '男高音 (Tenor)', color: '#22c55e', notes: [{ note: 'E3', duration: '4n', time: '0:0:0' }, { note: 'G3', duration: '4n', time: '0:1:0' }, { note: 'C4', duration: '4n', time: '0:2:0' }, { note: 'D4', duration: '4n', time: '0:3:0' }, { note: 'C4', duration: '2n', time: '1:0:0' }, { note: 'G3', duration: '4n', time: '1:2:0' }, { note: 'E3', duration: '2n', time: '1:3:0' }] },
    bass: { name: '男低音 (Bass)', color: '#d97706', notes: [{ note: 'C3', duration: '4n', time: '0:0:0' }, { note: 'E3', duration: '4n', time: '0:1:0' }, { note: 'G3', duration: '4n', time: '0:2:0' }, { note: 'F3', duration: '4n', time: '0:3:0' }, { note: 'E3', duration: '2n', time: '1:0:0' }, { note: 'G3', duration: '4n', time: '1:2:0' }, { note: 'C3', duration: '2n', time: '1:3:0' }] },
    tempo: 72, key: 'C大调', timeSignature: '4/4', totalMeasures: 2
  };
}

// ========== SCORES ==========
app.get('/api/scores', (req, res) => { res.json(scores); });

app.get('/api/scores/:id', (req, res) => {
  const s = scores.find(x => x.id === parseInt(req.params.id));
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

app.post('/api/scores', upload.single('file'), (req, res) => {
  const { title, composer } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const filePath = req.file ? `/uploads/${req.file.filename}` : null;
  const parts = generateScoreParts(title);
  const id = scores.length + 1;
  const result = { id, title, composer: composer || '', file_path: filePath, tempo: parts.tempo, key_sig: parts.key, time_signature: parts.timeSignature, total_measures: parts.totalMeasures, parts_data: parts, created_at: new Date().toISOString() };
  scores.push(result);
  res.json(result);
});

// ========== CHAT (DeepSeek) ==========
function callDeepSeek(msgs) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ model: 'deepseek-chat', messages: msgs, temperature: 0.7, max_tokens: 2048 });
    const req = https.request({ hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Length': Buffer.byteLength(postData) }, timeout: 30000 }, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { const p = JSON.parse(data); if (p.choices?.[0]) resolve(p.choices[0].message.content); else reject(new Error(p.error?.message || 'No response')); } catch(e) { reject(e); } }); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(postData); req.end();
  });
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  
  const sid = sessionId || Date.now();
  const history = messages.filter(m => m.session_id === sid);
  messages.push({ session_id: sid, role: 'user', content: message, created_at: new Date().toISOString() });

  const msgs = [{ role: 'system', content: '你是 ChoirAI 合唱智能训练助手，擅长合唱训练指导、乐理知识、谱面分析、声部协调。' }, ...history.map(h => ({ role: h.role, content: h.content })), { role: 'user', content: message }];

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

// ========== REHEARSAL ==========
app.post('/api/rehearsal/start', (req, res) => {
  res.json({ id: Date.now() });
});

app.get('/api/rehearsal/records', (req, res) => {
  res.json([]);
});

// ========== PLANS ==========
app.get('/api/plans', (req, res) => { res.json([]); });

// ========== UPLOADS (static) ==========
app.use('/uploads', express.static(uploadsDir));

// ========== SERVE FRONTEND ==========
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

module.exports = app;
