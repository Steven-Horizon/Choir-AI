// Vercel Serverless Function - ChoirAI Backend
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const { parseMidi } = require('midi-file');

const app = express();

// API config
const DEEPSEEK_API_KEY = process.env.DEEPEEK_API_KEY || 'sk-7fa9ea181c2748d793f26f184fe756de';
const KIMI_API_KEY = process.env.KIMI_API_KEY || 'sk-mB6NN8flAt7hsVbxfMhzOjMP15qCS87kZnYeS3yXTo1miPqg';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// =================== IN-MEMORY STORAGE ===================
const scores = [];
const sessions = [];
const messages = [];
const voiceParts = [];
const trainingPlans = [];
const planProgress = {};
const fileStorage = {};

// =================== MIDI PARSER ===================
function parseMidiFile(base64Data) {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const midi = parseMidi(buffer);

    // Extract tempo
    let tempo = 120;
    let ticksPerBeat = midi.header.ticksPerBeat || 480;

    // Parse tracks into note events
    const tracks = [];
    midi.tracks.forEach((track, trackIdx) => {
      const notes = [];
      let currentTime = 0;
      const noteOnMap = {}; // track pending noteOn events

      track.forEach(event => {
        currentTime += event.deltaTime;

        // Extract tempo
        if (event.type === 'setTempo' && event.microsecondsPerBeat) {
          tempo = Math.round(60000000 / event.microsecondsPerBeat);
        }

        // Note on
        if (event.type === 'noteOn' || (event.type === 'noteOff') ||
            (event.subtype === 'noteOn') || (event.subtype === 'noteOff')) {
          const noteNumber = event.noteNumber;
          const velocity = event.velocity || 0;

          if ((event.type === 'noteOn' || event.subtype === 'noteOn') && velocity > 0) {
            noteOnMap[noteNumber] = { time: currentTime, velocity };
          } else {
            // Note off
            const onEvent = noteOnMap[noteNumber];
            if (onEvent) {
              const duration = currentTime - onEvent.time;
              const noteName = midiNoteToName(noteNumber);
              notes.push({
                note: noteName,
                midi: noteNumber,
                time: onEvent.time,
                duration: duration,
                velocity: onEvent.velocity,
              });
              delete noteOnMap[noteNumber];
            }
          }
        }
      });

      if (notes.length > 0) {
        tracks.push({ idx: trackIdx, notes });
      }
    });

    // Convert to Tone.js format
    const bpm = tempo;
    const secondsPerTick = 60 / (bpm * ticksPerBeat);

    // Group notes by track, convert time to Tone.js transport time
    const toneTracks = tracks.map(t => {
      const toneNotes = t.notes.map(n => {
        const startSec = n.time * secondsPerTick;
        const durSec = n.duration * secondsPerTick;
        // Format time as bars:quarters:sixteenths for Tone.js
        const beats = startSec * (bpm / 60);
        const bars = Math.floor(beats / 4);
        const quarters = Math.floor(beats % 4);
        const sixteenths = Math.floor((beats % 1) * 4);

        return {
          note: n.note,
          duration: secToToneDuration(durSec),
          time: `${bars}:${quarters}:${sixteenths}`,
          velocity: n.velocity / 127,
        };
      });

      // Detect track name / instrument from program change events
      return {
        name: `声部 ${t.idx + 1}`,
        notes: toneNotes,
      };
    });

    return { bpm, ticksPerBeat, tracks: toneTracks };
  } catch (e) {
    console.error('MIDI parse error:', e);
    return null;
  }
}

function midiNoteToName(midiNum) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const name = names[midiNum % 12];
  const octave = Math.floor(midiNum / 12) - 1;
  return name + octave;
}

function secToToneDuration(sec) {
  if (sec >= 1.5) return '2n';
  if (sec >= 0.75) return '1n';
  if (sec >= 0.375) return '2n';
  if (sec >= 0.1875) return '4n';
  if (sec >= 0.09375) return '8n';
  return '16n';
}

// =================== SCORES ===================
app.get('/api/scores', (req, res) => { res.json(scores); });

app.get('/api/scores/:id', (req, res) => {
  const s = scores.find(x => x.id === parseInt(req.params.id));
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

app.post('/api/scores', (req, res) => {
  const { title, composer, fileData, fileName, fileType, externalUrl, midiData } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  let file_path = null;
  let external_url = externalUrl || null;
  let midiParsed = null;

  if (fileData && fileName) {
    const ext = path.extname(fileName) || '';
    const safeName = Date.now() + '-' + Math.random().toString(36).slice(2) + ext;
    file_path = `/uploads/${safeName}`;
    fileStorage[safeName] = { data: fileData, type: fileType || 'application/octet-stream', name: fileName };

    // Parse MIDI if it's a MIDI file
    if (ext.toLowerCase() === '.mid' || ext.toLowerCase() === '.midi' || fileType === 'audio/midi') {
      midiParsed = parseMidiFile(fileData);
    }
  }

  // Also parse MIDI if midiData is provided directly
  if (midiData && !midiParsed) {
    midiParsed = parseMidiFile(midiData);
  }

  const parts = generateScoreParts(title);
  const id = scores.length + 1;

  // If MIDI was parsed, use its data
  if (midiParsed && midiParsed.tracks.length > 0) {
    // Map MIDI tracks to voice parts (up to 4)
    const voiceNames = ['soprano', 'alto', 'tenor', 'bass'];
    const voiceLabels = ['女高音 (Soprano)', '女低音 (Alto)', '男高音 (Tenor)', '男低音 (Bass)'];
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#d97706'];

    midiParsed.tracks.slice(0, 4).forEach((track, i) => {
      parts[voiceNames[i]] = {
        name: voiceLabels[i],
        color: colors[i],
        notes: track.notes.slice(0, 100), // Limit notes
      };
    });
    parts.tempo = midiParsed.bpm;
  }

  const result = {
    id, title, composer: composer || '', file_path, external_url,
    tempo: parts.tempo, key_sig: parts.key, time_signature: parts.timeSignature,
    total_measures: parts.totalMeasures, parts_data: parts,
    midi_parsed: !!midiParsed,
    created_at: new Date().toISOString(),
  };
  scores.push(result);
  res.json(result);
});

function generateScoreParts(title) {
  return {
    soprano: { name: '女高音 (Soprano)', color: '#ef4444', notes: [{ note: 'C4', duration: '4n', time: '0:0:0' }, { note: 'E4', duration: '4n', time: '0:1:0' }, { note: 'G4', duration: '4n', time: '0:2:0' }, { note: 'A4', duration: '4n', time: '0:3:0' }, { note: 'G4', duration: '2n', time: '1:0:0' }, { note: 'E4', duration: '4n', time: '1:2:0' }, { note: 'C4', duration: '2n', time: '1:3:0' }] },
    alto: { name: '女低音 (Alto)', color: '#3b82f6', notes: [{ note: 'G3', duration: '4n', time: '0:0:0' }, { note: 'C4', duration: '4n', time: '0:1:0' }, { note: 'E4', duration: '4n', time: '0:2:0' }, { note: 'F4', duration: '4n', time: '0:3:0' }, { note: 'E4', duration: '2n', time: '1:0:0' }, { note: 'C4', duration: '4n', time: '1:2:0' }, { note: 'G3', duration: '2n', time: '1:3:0' }] },
    tenor: { name: '男高音 (Tenor)', color: '#22c55e', notes: [{ note: 'E3', duration: '4n', time: '0:0:0' }, { note: 'G3', duration: '4n', time: '0:1:0' }, { note: 'C4', duration: '4n', time: '0:2:0' }, { note: 'D4', duration: '4n', time: '0:3:0' }, { note: 'C4', duration: '2n', time: '1:0:0' }, { note: 'G3', duration: '4n', time: '1:2:0' }, { note: 'E3', duration: '2n', time: '1:3:0' }] },
    bass: { name: '男低音 (Bass)', color: '#d97706', notes: [{ note: 'C3', duration: '4n', time: '0:0:0' }, { note: 'E3', duration: '4n', time: '0:1:0' }, { note: 'G3', duration: '4n', time: '0:2:0' }, { note: 'F3', duration: '4n', time: '0:3:0' }, { note: 'E3', duration: '2n', time: '1:0:0' }, { note: 'G3', duration: '4n', time: '1:2:0' }, { note: 'C3', duration: '2n', time: '1:3:0' }] },
    tempo: 72, key: 'C大调', timeSignature: '4/4', totalMeasures: 2
  };
}

app.get('/uploads/:filename', (req, res) => {
  const file = fileStorage[req.params.filename];
  if (!file) return res.status(404).json({ error: 'File not found' });
  const buffer = Buffer.from(file.data, 'base64');
  res.setHeader('Content-Type', file.type);
  res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
  res.send(buffer);
});

// =================== VOICE PARTS (same as before) ===================
app.post('/api/voice-parts', (req, res) => {
  const { name, password, creator } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Name and password required' });
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const part = { id: 'vp_' + Date.now(), name, code, password, creator: creator || 'unknown', members: [creator || 'unknown'], tasks: [], createdAt: new Date().toISOString() };
  voiceParts.push(part);
  res.json({ id: part.id, name: part.name, code: part.code, creator: part.creator, members: part.members, tasks: part.tasks, createdAt: part.createdAt });
});

app.get('/api/voice-parts', (req, res) => {
  res.json(voiceParts.map(p => ({ id: p.id, name: p.name, code: p.code, creator: p.creator, members: p.members, tasks: p.tasks, createdAt: p.createdAt })));
});

app.post('/api/voice-parts/:code/join', (req, res) => {
  const { password, memberName } = req.body;
  const part = voiceParts.find(p => p.code === req.params.code.toUpperCase());
  if (!part) return res.status(404).json({ error: '邀请码不存在' });
  if (part.password !== password) return res.status(403).json({ error: '密码错误' });
  if (!memberName) return res.status(400).json({ error: 'Member name required' });
  if (!part.members.includes(memberName)) part.members.push(memberName);
  res.json({ id: part.id, name: part.name, code: part.code, members: part.members, tasks: part.tasks });
});

app.get('/api/voice-parts/:id', (req, res) => {
  const part = voiceParts.find(p => p.id === req.params.id);
  if (!part) return res.status(404).json({ error: 'Not found' });
  res.json({ id: part.id, name: part.name, code: part.code, creator: part.creator, members: part.members, tasks: part.tasks, createdAt: part.createdAt });
});

app.delete('/api/voice-parts/:id', (req, res) => {
  const idx = voiceParts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  voiceParts.splice(idx, 1);
  res.json({ success: true });
});

app.post('/api/voice-parts/:id/tasks', (req, res) => {
  const part = voiceParts.find(p => p.id === req.params.id);
  if (!part) return res.status(404).json({ error: 'Not found' });
  const { title, type, assignee } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const task = { id: 'task_' + Date.now(), title, type: type || 'practice', assignee: assignee || '全体成员', completed: false, createdAt: new Date().toLocaleDateString() };
  part.tasks.push(task);
  res.json(task);
});

app.patch('/api/voice-parts/:partId/tasks/:taskId', (req, res) => {
  const part = voiceParts.find(p => p.id === req.params.partId);
  if (!part) return res.status(404).json({ error: 'Not found' });
  const task = part.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  task.completed = !task.completed;
  res.json(task);
});

// =================== TRAINING PLANS (same as before) ===================
app.post('/api/plans', (req, res) => {
  const { title, scoreName, parts, startDate, endDate, phases, creator } = req.body;
  if (!title || !scoreName || !parts || parts.length === 0) return res.status(400).json({ error: 'Title, scoreName and parts required' });
  const plan = { id: 'plan_' + Date.now(), title, scoreName, parts, startDate: startDate || new Date().toLocaleDateString(), endDate: endDate || new Date(Date.now() + 14 * 86400000).toLocaleDateString(), phases: phases || [], creator: creator || 'unknown', shared: true, createdAt: new Date().toISOString() };
  trainingPlans.push(plan);
  res.json(plan);
});

app.get('/api/plans', (req, res) => { res.json(trainingPlans.filter(p => p.shared)); });
app.get('/api/plans/:id', (req, res) => { const p = trainingPlans.find(x => x.id === req.params.id); if (!p) return res.status(404).json({ error: 'Not found' }); res.json(p); });
app.delete('/api/plans/:id', (req, res) => { const idx = trainingPlans.findIndex(p => p.id === req.params.id); if (idx === -1) return res.status(404); trainingPlans.splice(idx, 1); res.json({ success: true }); });

// =================== CHAT - Kimi API (supports images) ===================
function callKimi(msgs, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ model: 'moonshot-v1-8k', messages: msgs, temperature: 0.7 });
    const req = https.request({
      hostname: 'api.moonshot.cn', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey || KIMI_API_KEY}`, 'Content-Length': Buffer.byteLength(postData) },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.choices?.[0]) resolve(p.choices[0].message.content);
          else reject(new Error(p.error?.message || 'No response'));
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(postData); req.end();
  });
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId, useKimi, attachments, kimiKey } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const sid = sessionId || Date.now();
  const history = messages.filter(m => m.session_id === sid);

  // Build messages
  const msgs = [{ role: 'system', content: '你是 ChoirAI 合唱智能训练助手，擅长合唱训练指导、乐理知识、谱面分析、声部协调。' }];
  history.forEach(h => msgs.push({ role: h.role, content: h.content }));

  // Check Kimi key: from request body > env var
  const effectiveKimiKey = kimiKey || KIMI_API_KEY;
  // If Kimi is requested and API key is available, use Kimi (supports images)
  const useKimiApi = useKimi && effectiveKimiKey;

  if (useKimiApi && attachments && attachments.length > 0) {
    // Kimi supports multimodal input
    const contentParts = [];
    contentParts.push({ type: 'text', text: message });
    attachments.forEach(att => {
      if (att.type && att.type.startsWith('image/')) {
        contentParts.push({ type: 'image_url', image_url: { url: `data:${att.type};base64,${att.data}` } });
      } else {
        contentParts.push({ type: 'text', text: `[附件: ${att.name || '文件'}]` });
      }
    });
    msgs.push({ role: 'user', content: contentParts });
  } else {
    msgs.push({ role: 'user', content: message });
  }

  messages.push({ session_id: sid, role: 'user', content: message, created_at: new Date().toISOString() });

  try {
    let aiContent;
    if (useKimiApi) {
      aiContent = await callKimi(msgs, effectiveKimiKey);
    } else {
      // Fallback to DeepSeek
      const postData = JSON.stringify({ model: 'deepseek-chat', messages: msgs, temperature: 0.7, max_tokens: 2048 });
      aiContent = await new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Length': Buffer.byteLength(postData) }, timeout: 30000 }, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { const p = JSON.parse(data); if (p.choices?.[0]) resolve(p.choices[0].message.content); else reject(new Error('No response')); } catch(e) { reject(e); } }); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(postData); req.end();
      });
    }
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

// =================== REHEARSAL ===================
app.post('/api/rehearsal/start', (req, res) => { res.json({ id: Date.now() }); });
app.get('/api/rehearsal/records', (req, res) => { res.json([]); });

// =================== SERVE FRONTEND ===================
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '..', 'dist', 'index.html')); });

module.exports = app;
