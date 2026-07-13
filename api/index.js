// ChoirAI Backend
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const { parseMidi } = require('midi-file');

// =================== DATA PERSISTENCE ===================
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData(filename, fallback) {
  const fp = path.join(DATA_DIR, filename);
  if (fs.existsSync(fp)) { try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch {} }
  return fallback;
}
function saveData(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

// =================== USER SYSTEM ===================
// roles: admin (团干), captain (声部长), member (部员)
let users = loadData('users.json', []);
let userIdCounter = users.length > 0 ? Math.max(...users.map(u => parseInt(u.id.replace('u_', '')) || 0)) + 1 : 1;
const sessions = {}; // token -> { userId, createdAt }

function hashPwd(pwd) { return crypto.createHash('sha256').update(pwd).digest('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }

function getUser(req) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (!token) return null;
  const s = sessions[token];
  if (!s) return null;
  return users.find(u => u.id === s.userId) || null;
}

function requireAuth(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: '请先登录' });
  req.user = user;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '请先登录' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: '权限不足' });
    next();
  };
}

// =================== MUSICXML PARSER ===================

// =================== MUSICXML PARSER ===================
function parseMusicXML(xmlString) {
  try {
    // Extract title
    const titleMatch = xmlString.match(/<work-title>([^<]+)<\/work-title>/) || xmlString.match(/<movement-title>([^<]+)<\/movement-title>/);
    const title = titleMatch ? titleMatch[1] : 'Unknown';

    // Extract parts
    const parts = [];
    const partRegex = /<part\s+id="([^"]+)">([\s\S]*?)<\/part>/g;
    let partMatch;

    while ((partMatch = partRegex.exec(xmlString)) !== null) {
      const partId = partMatch[1];
      const partContent = partMatch[2];

      // Extract part name
      const scorePartMatch = xmlString.match(new RegExp(`<score-part\\s+id="${partId}">([\\s\\S]*?)<\\/score-part>`));
      let partName = partId;
      if (scorePartMatch) {
        const nameMatch = scorePartMatch[1].match(/<part-name>([^<]+)<\/part-name>/);
        if (nameMatch) partName = nameMatch[1];
      }

      // Extract measures
      const measures = [];
      const measureRegex = /<measure\s+number="(\d+)"[^>]*>([\s\S]*?)<\/measure>/g;
      let measureMatch;

      while ((measureMatch = measureRegex.exec(partContent)) !== null) {
        const measureNum = parseInt(measureMatch[1]);
        const measureContent = measureMatch[2];

        // Extract attributes (time signature, key, divisions)
        let divisions = 1;
        let beats = 4;
        let beatType = 4;
        let tempo = 120;

        const divisionsMatch = measureContent.match(/<divisions>(\d+)<\/divisions>/);
        if (divisionsMatch) divisions = parseInt(divisionsMatch[1]);

        const timeMatch = measureContent.match(/<time>\s*<beats>(\d+)<\/beats>\s*<beat-type>(\d+)<\/beat-type>/);
        if (timeMatch) { beats = parseInt(timeMatch[1]); beatType = parseInt(timeMatch[2]); }

        const tempoMatch = measureContent.match(/<sound\s+tempo="(\d+)"\s*\/>/);
        if (tempoMatch) tempo = parseInt(tempoMatch[1]);

        // Extract notes in this measure
        const notes = [];
        const noteRegex = /<note>([\s\S]*?)<\/note>/g;
        let noteMatch;
        let currentTime = 0;

        while ((noteMatch = noteRegex.exec(measureContent)) !== null) {
          const noteContent = noteMatch[1];

          // Check if rest
          if (noteContent.includes('<rest')) {
            const durationMatch = noteContent.match(/<duration>(\d+)<\/duration>/);
            if (durationMatch) currentTime += parseInt(durationMatch[1]);
            continue;
          }

          // Extract pitch
          const stepMatch = noteContent.match(/<step>([A-G])<\/step>/);
          const octaveMatch = noteContent.match(/<octave>(\d+)<\/octave>/);
          const alterMatch = noteContent.match(/<alter>(-?\d)<\/alter>/);
          const durationMatch = noteContent.match(/<duration>(\d+)<\/duration>/);

          if (stepMatch && octaveMatch && durationMatch) {
            const step = stepMatch[1];
            const octave = parseInt(octaveMatch[1]);
            const alter = alterMatch ? parseInt(alterMatch[1]) : 0;
            const duration = parseInt(durationMatch[1]);

            // Convert to MIDI note number
            const semitoneMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
            let semitone = semitoneMap[step] + alter;
            const midiNote = (octave + 1) * 12 + semitone;
            const noteName = step + (alter === 1 ? '#' : alter === -1 ? 'b' : '') + octave;

            // Convert duration to Tone.js format (4n = quarter note)
            const quarterDuration = divisions * (4 / beatType); // duration of a quarter note in divisions
            const toneDuration = divisionsToToneDuration(duration, divisions, beatType);

            notes.push({
              note: noteName,
              midi: midiNote,
              time: `${measureNum - 1}:${Math.floor(currentTime / divisions)}:${Math.floor((currentTime % divisions) * 4 / divisions)}`,
              duration: toneDuration,
              measure: measureNum,
            });

            currentTime += duration;
          }
        }

        if (notes.length > 0) {
          measures.push({ number: measureNum, notes, tempo, divisions, beats, beatType });
        }
      }

      if (measures.length > 0) {
        parts.push({ id: partId, name: partName, measures });
      }
    }

    // Get global tempo and time signature from first measure
    let globalTempo = 120;
    let globalBeats = 4;
    let globalBeatType = 4;
    if (parts.length > 0 && parts[0].measures.length > 0) {
      globalTempo = parts[0].measures[0].tempo || 120;
      globalBeats = parts[0].measures[0].beats || 4;
      globalBeatType = parts[0].measures[0].beatType || 4;
    }

    // Flatten notes per part for Tone.js playback
    const toneTracks = parts.map(p => ({
      name: p.name,
      notes: p.measures.flatMap(m => m.notes),
    }));

    return {
      title,
      tempo: globalTempo,
      timeSignature: `${globalBeats}/${globalBeatType}`,
      parts: toneTracks,
    };
  } catch (e) {
    console.error('MusicXML parse error:', e);
    return null;
  }
}

function divisionsToToneDuration(duration, divisions, beatType) {
  // duration in divisions, convert to Tone.js notation
  const quarterNoteDivisions = divisions * (4 / beatType);
  const ratio = duration / quarterNoteDivisions;

  if (ratio >= 3.5) return '1n';
  if (ratio >= 1.75) return '2n';
  if (ratio >= 1.0) return '4n';
  if (ratio >= 0.5) return '8n';
  if (ratio >= 0.25) return '16n';
  return '32n';
}

const app = express();

// API config
const DEEPSEEK_API_KEY = process.env.DEEPEEK_API_KEY || 'sk-7fa9ea181c2748d793f26f184fe756de';
const KIMI_API_KEY = process.env.KIMI_API_KEY || 'sk-mB6NN8flAt7hsVbxfMhzOjMP15qCS87kZnYeS3yXTo1miPqg';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// =================== FILE STORAGE ===================
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function saveUpload(safeName, fileData, fileType, originalName) {
  const buffer = Buffer.from(fileData, 'base64');
  fs.writeFileSync(path.join(UPLOADS_DIR, safeName), buffer);
  const meta = loadData('uploads_meta.json', {});
  meta[safeName] = { type: fileType || 'application/octet-stream', name: originalName, size: buffer.length };
  saveData('uploads_meta.json', meta);
}

function getUpload(safeName) {
  const filePath = path.join(UPLOADS_DIR, safeName);
  if (!fs.existsSync(filePath)) return null;
  const meta = loadData('uploads_meta.json', {})[safeName] || {};
  return { path: filePath, type: meta.type || 'application/octet-stream', name: meta.name || safeName };
}

// =================== IN-MEMORY STORAGE (with persistence) ===================
const scores = loadData('scores.json', []);
const messages = loadData('messages.json', []);
let voiceParts = loadData('voiceParts.json', []);
const trainingPlans = loadData('trainingPlans.json', []);
const planProgress = loadData('planProgress.json', {});
const fileStorage = {}; // Legacy, kept for compatibility
const rehearsalRecords = loadData('rehearsalRecords.json', []);

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

// Batch sync scores (for localStorage recovery)
app.post('/api/scores/sync', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be array' });
  items.forEach(item => {
    if (!scores.find(s => s.id === item.id)) {
      scores.push(item);
    }
  });
  res.json({ success: true, count: scores.length });
});

app.get('/api/scores/:id', (req, res) => {
  const s = scores.find(x => x.id === parseInt(req.params.id));
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

app.post('/api/scores', (req, res) => {
  const { title, composer, fileData, fileName, fileType, externalUrl, midiData, musicXmlData } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  let file_path = null;
  let external_url = externalUrl || null;
  let midiParsed = null;
  let musicXmlParsed = null;

  if (fileData && fileName) {
    const ext = path.extname(fileName) || '';
    const safeName = Date.now() + '-' + Math.random().toString(36).slice(2) + ext;
    file_path = `/uploads/${safeName}`;
    saveUpload(safeName, fileData, fileType, fileName);

    // Parse MIDI if it's a MIDI file
    if (ext.toLowerCase() === '.mid' || ext.toLowerCase() === '.midi' || fileType === 'audio/midi') {
      midiParsed = parseMidiFile(fileData);
    }

    // Parse MusicXML if it's a MusicXML file
    if (ext.toLowerCase() === '.xml' || ext.toLowerCase() === '.musicxml' || fileType === 'application/vnd.recordare.musicxml') {
      try {
        const xmlBuffer = Buffer.from(fileData, 'base64').toString('utf-8');
        musicXmlParsed = parseMusicXML(xmlBuffer);
      } catch (e) { console.error('MusicXML parse error:', e); }
    }
  }

  // Also parse MusicXML if musicXmlData is provided directly
  if (musicXmlData && !musicXmlParsed) {
    musicXmlParsed = parseMusicXML(Buffer.from(musicXmlData, 'base64').toString('utf-8'));
  }

  let parts = null;
  let tempo = 72;
  let key_sig = '';
  let time_signature = '4/4';
  let total_measures = 0;

  // Only set parts_data if we successfully parsed a music file
  if (midiParsed && midiParsed.tracks.length > 0) {
    parts = generateScoreParts(title);
    const voiceNames = ['soprano', 'alto', 'tenor', 'bass'];
    const voiceLabels = ['女高音 (Soprano)', '女低音 (Alto)', '男高音 (Tenor)', '男低音 (Bass)'];
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#d97706'];
    midiParsed.tracks.slice(0, 4).forEach((track, i) => {
      parts[voiceNames[i]] = { name: voiceLabels[i], color: colors[i], notes: track.notes.slice(0, 100) };
    });
    parts.tempo = midiParsed.bpm;
    tempo = midiParsed.bpm;
  }

  if (musicXmlParsed && musicXmlParsed.parts.length > 0) {
    parts = generateScoreParts(title);
    const voiceNames = ['soprano', 'alto', 'tenor', 'bass'];
    const voiceLabels = ['女高音 (Soprano)', '女低音 (Alto)', '男高音 (Tenor)', '男低音 (Bass)'];
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#d97706'];
    musicXmlParsed.parts.slice(0, 4).forEach((part, i) => {
      parts[voiceNames[i]] = { name: voiceLabels[i], color: colors[i], notes: part.notes.slice(0, 200) };
    });
    parts.tempo = musicXmlParsed.tempo;
    parts.timeSignature = musicXmlParsed.timeSignature;
    tempo = musicXmlParsed.tempo;
    time_signature = musicXmlParsed.timeSignature;
  }

  // For other file types (PDF, images, audio), parts_data is null - no fake data
  if (parts) {
    key_sig = parts.key;
    time_signature = parts.timeSignature;
    total_measures = parts.totalMeasures;
  }

  const result = {
    id: scores.length + 1, title, composer: composer || '', file_path, external_url,
    tempo, key_sig, time_signature,
    total_measures,
    parts_data: parts,
    midi_parsed: !!midiParsed,
    musicxml_parsed: !!musicXmlParsed,
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
  const file = getUpload(req.params.filename);
  if (!file) {
    // Fallback: try legacy memory storage
    const legacy = fileStorage[req.params.filename];
    if (legacy) {
      const buffer = Buffer.from(legacy.data, 'base64');
      res.setHeader('Content-Type', legacy.type);
      res.setHeader('Content-Disposition', `inline; filename="${legacy.name}"`);
      return res.send(buffer);
    }
    return res.status(404).json({ error: 'File not found' });
  }
  res.setHeader('Content-Type', file.type);
  res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
  res.sendFile(file.path);
});

// =================== VOICE PARTS ===================
app.post('/api/voice-parts/sync', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be array' });
  items.forEach(item => {
    if (!voiceParts.find(p => p.id === item.id)) voiceParts.push(item);
  });
  res.json({ success: true, count: voiceParts.length });
});

app.post('/api/voice-parts', requireAuth, (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Name and password required' });
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const part = { id: 'vp_' + Date.now(), name, code, password, creator: req.user.name, creatorId: req.user.id, members: [req.user.name], tasks: [], createdAt: new Date().toISOString() };
  voiceParts.push(part);
  saveData('voiceParts.json', voiceParts);
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

app.delete('/api/voice-parts/:id', requireAuth, (req, res) => {
  const part = voiceParts.find(p => p.id === req.params.id);
  if (!part) return res.status(404).json({ error: 'Not found' });
  // Only creator or admin can delete
  if (part.creatorId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有创建者或团干可以删除声部' });
  }
  voiceParts = voiceParts.filter(p => p.id !== req.params.id);
  saveData('voiceParts.json', voiceParts);
  res.json({ success: true });
});

app.post('/api/voice-parts/:id/tasks', requireAuth, (req, res) => {
  // Only admin and captain can send tasks
  if (req.user.role !== 'admin' && req.user.role !== 'captain') {
    return res.status(403).json({ error: '只有团干和声部长可以派发任务' });
  }
  const part = voiceParts.find(p => p.id === req.params.id);
  if (!part) return res.status(404).json({ error: 'Not found' });
  const { title, type, assignee } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const task = { id: 'task_' + Date.now(), title, type: type || 'practice', assignee: assignee || '全体成员', completed: false, createdBy: req.user.name, createdAt: new Date().toLocaleDateString() };
  part.tasks.push(task);
  saveData('voiceParts.json', voiceParts);
  res.json(task);
});

app.patch('/api/voice-parts/:partId/tasks/:taskId', requireAuth, (req, res) => {
  const part = voiceParts.find(p => p.id === req.params.partId);
  if (!part) return res.status(404).json({ error: 'Not found' });
  const task = part.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  // Members can only complete their own tasks, captains/admin can toggle any
  if (req.user.role === 'member' && task.assignee !== req.user.name && task.assignee !== '全体成员') {
    return res.status(403).json({ error: '只能完成分配给自己的任务' });
  }
  task.completed = !task.completed;
  saveData('voiceParts.json', voiceParts);
  res.json(task);
});

// =================== CHAT - Kimi API (supports images) ===================
function callKimi(msgs, apiKey) {
  return new Promise((resolve, reject) => {
    // Use vision model when there are image attachments
    const hasImages = msgs.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'));
    const model = hasImages ? 'moonshot-v1-8k-vision-preview' : 'moonshot-v1-8k';
    const postData = JSON.stringify({ model, messages: msgs, temperature: 0.7 });
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

app.post('/api/chat', requireAuth, async (req, res) => {
  const { message, sessionId, forceModel, attachments } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const userId = req.user.id;
  const sid = sessionId || 'session_' + Date.now();
  const history = messages.filter(m => m.userId === userId && m.session_id === sid);

  const hasImageAttachments = attachments && attachments.some((a) => a.type && a.type.startsWith('image/'));

  let useKimiApi = false;
  if (forceModel === 'kimi' && KIMI_API_KEY) {
    useKimiApi = true;
  } else if (forceModel === 'deepseek') {
    useKimiApi = false;
  } else {
    useKimiApi = hasImageAttachments && !!KIMI_API_KEY;
  }

  const msgs = [{ role: 'system', content: '你是 ChoirAI 合唱智能训练助手，擅长合唱训练指导、乐理知识、谱面分析、声部协调。当用户提出训练需求（如"增强听力""改善音准"等），你需要分析其需求并给出专业的合唱练习建议。如果需要，你可以建议用户去"个人练习室"进行针对性训练。' }];
  history.forEach(h => msgs.push({ role: h.role, content: h.content }));

  if (useKimiApi && hasImageAttachments) {
    const contentParts = [];
    contentParts.push({ type: 'text', text: message });
    attachments.forEach(att => {
      if (att.type && att.type.startsWith('image/')) {
        contentParts.push({ type: 'image_url', image_url: { url: `data:${att.type};base64,${att.data}` } });
      }
    });
    msgs.push({ role: 'user', content: contentParts });
  } else {
    let finalMessage = message;
    if (attachments && attachments.length > 0) {
      const nonImageNames = attachments.filter(a => !a.type.startsWith('image/')).map(a => a.name).join(', ');
      if (nonImageNames) finalMessage += `\n[附件: ${nonImageNames}]`;
    }
    msgs.push({ role: 'user', content: finalMessage });
  }

  messages.push({ userId, session_id: sid, role: 'user', content: message, created_at: new Date().toISOString() });

  try {
    let aiContent;
    let usedModel = 'deepseek';

    if (useKimiApi) {
      usedModel = 'kimi';
      aiContent = await callKimi(msgs, KIMI_API_KEY);
    } else {
      const postData = JSON.stringify({ model: 'deepseek-chat', messages: msgs, temperature: 0.7, max_tokens: 2048 });
      aiContent = await new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Length': Buffer.byteLength(postData) }, timeout: 30000 }, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { const p = JSON.parse(data); if (p.choices?.[0]) resolve(p.choices[0].message.content); else reject(new Error('No response')); } catch(e) { reject(e); } }); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(postData); req.end();
      });
    }

    // AI Agent: detect training needs and auto-generate plan
    const planSuggestion = detectTrainingPlan(message, aiContent);

    messages.push({ userId, session_id: sid, role: 'assistant', content: aiContent, created_at: new Date().toISOString() });
    saveData('messages.json', messages);
    res.json({ sessionId: sid, content: aiContent, model: usedModel, planSuggestion });
  } catch (err) {
    console.error('Chat error:', err);
    const fallback = useKimiApi
      ? 'Kimi 服务暂时不可用。已自动切换到 DeepSeek，但图片分析功能不可用。'
      : '抱歉，AI服务暂时不可用。请稍后重试。';
    messages.push({ userId, session_id: sid, role: 'assistant', content: fallback, created_at: new Date().toISOString() });
    saveData('messages.json', messages);
    res.json({ sessionId: sid, content: fallback, _fallback: true });
  }
});

app.get('/api/chat/sessions', requireAuth, (req, res) => {
  const userId = req.user.id;
  const userMessages = messages.filter(m => m.userId === userId);
  const unique = [...new Set(userMessages.map(m => m.session_id))];
  res.json(unique.map(id => ({
    id, title: userMessages.find(m => m.session_id === id && m.role === 'user')?.content?.slice(0, 30) || '新会话',
    created_at: userMessages.find(m => m.session_id === id)?.created_at
  })));
});

// AI Agent: detect training needs from user message
function detectTrainingPlan(userMsg, aiReply) {
  const msg = userMsg.toLowerCase();
  const goals = [];

  if (msg.includes('听力') || msg.includes('听音') || msg.includes('听辨') || msg.includes('听写')) {
    goals.push({ type: 'ear_training', title: '听力训练计划', desc: '音程听辨、和弦识别、旋律听写' });
  }
  if (msg.includes('音准') || msg.includes('跑调') || msg.includes('不准')) {
    goals.push({ type: 'pitch', title: '音准强化计划', desc: '单音模唱、音程模唱、调式音阶' });
  }
  if (msg.includes('节奏') || msg.includes('节拍') || msg.includes('拍子')) {
    goals.push({ type: 'rhythm', title: '节奏训练计划', desc: '基本节拍、切分节奏、复合节奏' });
  }
  if (msg.includes('气息') || msg.includes('呼吸')) {
    goals.push({ type: 'breath', title: '气息控制计划', desc: '腹式呼吸、长音 sustaining、乐句控制' });
  }
  if (msg.includes('发声') || msg.includes('声音') || msg.includes('音色')) {
    goals.push({ type: 'voice', title: '发声技巧计划', desc: '共鸣位置、声区统一、音色美化' });
  }
  if (msg.includes('视唱') || msg.includes('识谱') || msg.includes('读谱')) {
    goals.push({ type: 'sight', title: '视唱练耳计划', desc: '五线谱速读、首调视唱、固定调视唱' });
  }

  if (goals.length === 0) return null;

  return {
    goals,
    suggestedDuration: 15,
    message: `根据你的需求，我为你制定了${goals.length}项训练计划。你可以：\n1. 点击"加入个人计划"添加到个人练习室\n2. 如果你是团干/声部长，可以选择"加入声部计划"推送给声部成员`,
  };
}

// =================== TRAINING PLANS ===================
function getCurrentDayIndex(plan) {
  const start = new Date(plan.createdAt);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return Math.max(0, Math.min(daysDiff, (plan.daysTotal || 1) - 1));
}

app.post('/api/plans', requireAuth, (req, res) => {
  const { title, type, exercises, targetPart, daysTotal } = req.body;
  const exercisesWithDays = (exercises || []).map((ex, i) => ({
    ...ex, id: ex.id || `ex_${Date.now()}_${i}`,
    dayIndex: Math.floor(i / 3),
    completed: false,
  }));
  const plan = {
    id: 'plan_' + Date.now(),
    userId: req.user.id, userName: req.user.name,
    title: title || '未命名计划',
    type: type || 'personal',
    targetPart: targetPart || req.user.part,
    exercises: exercisesWithDays,
    daysTotal: daysTotal || Math.ceil(exercisesWithDays.length / 3) || 1,
    createdAt: new Date().toISOString(),
  };
  trainingPlans.push(plan);
  saveData('trainingPlans.json', trainingPlans);
  res.json({ success: true, plan });
});

app.get('/api/plans', requireAuth, (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  let plans = trainingPlans;
  if (role === 'member') plans = trainingPlans.filter(p => p.userId === userId && p.type === 'personal');
  else if (role === 'captain') plans = trainingPlans.filter(p => p.userId === userId || (p.type === 'voicePart' && p.targetPart === req.user.part));
  // Add today's progress
  const today = new Date().toISOString().split('T')[0];
  const plansWithProgress = plans.map(p => {
    const progressKey = `${p.id}_${req.user.id}`;
    const todayProgress = (planProgress[progressKey] || {})[today] || { completed: [] };
    const currentDay = getCurrentDayIndex(p);
    const todayExercises = p.exercises.filter(e => e.dayIndex === currentDay);
    return { ...p, todayCompleted: todayProgress.completed.length, todayTotal: todayExercises.length, currentDay };
  });
  res.json(plansWithProgress.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.get('/api/plans/:id', requireAuth, (req, res) => {
  const plan = trainingPlans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: 'Not found' });
  if (plan.userId !== req.user.id && req.user.role !== 'admin') {
    if (plan.type === 'personal' || req.user.role === 'member') return res.status(403).json({ error: 'Permission denied' });
  }
  const today = new Date().toISOString().split('T')[0];
  const progressKey = `${plan.id}_${req.user.id}`;
  const userProgress = planProgress[progressKey] || {};
  const currentDay = getCurrentDayIndex(plan);
  const todayExercises = plan.exercises.filter(e => e.dayIndex === currentDay);
  const todayProgress = userProgress[today] || { completed: [] };
  res.json({ ...plan, currentDay, todayExercises, todayCompleted: todayProgress.completed, allProgress: userProgress });
});

app.post('/api/plans/:id/complete/:exId', requireAuth, (req, res) => {
  const plan = trainingPlans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: 'Not found' });
  const ex = plan.exercises.find(e => e.id === req.params.exId);
  if (!ex) return res.status(404).json({ error: 'Exercise not found' });
  const currentDay = getCurrentDayIndex(plan);
  if (ex.dayIndex !== currentDay) return res.status(400).json({ error: '只能完成当天的任务' });
  const today = new Date().toISOString().split('T')[0];
  const progressKey = `${plan.id}_${req.user.id}`;
  if (!planProgress[progressKey]) planProgress[progressKey] = {};
  if (!planProgress[progressKey][today]) planProgress[progressKey][today] = { completed: [] };
  if (!planProgress[progressKey][today].completed.includes(req.params.exId)) {
    planProgress[progressKey][today].completed.push(req.params.exId);
  }
  saveData('planProgress.json', planProgress);
  res.json({ success: true, completed: planProgress[progressKey][today].completed });
});

app.delete('/api/plans/:id', requireAuth, (req, res) => {
  const plan = trainingPlans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (plan.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Permission denied' });
  const idx = trainingPlans.findIndex(p => p.id === req.params.id);
  trainingPlans.splice(idx, 1);
  saveData('trainingPlans.json', trainingPlans);
  res.json({ success: true });
});

// =================== REHEARSAL RECORDINGS ===================
app.post('/api/rehearsal/record', requireAuth, (req, res) => {
  const { scoreId, scoreTitle, startMeasure, endMeasure, bpm, records } = req.body;
  const record = {
    id: 'rec_' + Date.now(),
    userId: req.user.id,
    userName: req.user.name,
    userPart: req.user.part || '',
    scoreId: scoreId || '',
    scoreTitle: scoreTitle || '',
    startMeasure: startMeasure || 1,
    endMeasure: endMeasure || 1,
    bpm: bpm || 72,
    records: records || [], // [{partKey, volume, cents, timestamp}]
    createdAt: new Date().toISOString(),
  };
  rehearsalRecords.push(record);
  saveData('rehearsalRecords.json', rehearsalRecords);
  res.json({ success: true, id: record.id });
});

app.get('/api/rehearsal/records', requireAuth, (req, res) => {
  // Admin sees all, captain/member sees their own and their voice part members'
  let records = rehearsalRecords;
  if (req.user.role !== 'admin') {
    records = rehearsalRecords.filter(r => r.userId === req.user.id);
  }
  res.json(records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50));
});

app.get('/api/rehearsal/stats', requireAuth, (req, res) => {
  // Return stats grouped by user for admin view
  if (req.user.role !== 'admin') {
    const mine = rehearsalRecords.filter(r => r.userId === req.user.id);
    res.json({ totalRehearsals: mine.length, totalMinutes: Math.round(mine.reduce((s, r) => s + ((r.records?.length || 0) * 2), 0) / 60) });
    return;
  }
  const userStats = {};
  rehearsalRecords.forEach(r => {
    if (!userStats[r.userId]) userStats[r.userId] = { name: r.userName, part: r.userPart, count: 0 };
    userStats[r.userId].count++;
  });
  res.json({ totalRehearsals: rehearsalRecords.length, userStats: Object.values(userStats) });
});

// =================== AUDIO RECORDINGS (120s max) ===================
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

app.post('/api/rehearsal/audio', requireAuth, (req, res) => {
  const { audioBase64, scoreId, scoreTitle, duration } = req.body;
  if (!audioBase64) return res.status(400).json({ error: 'No audio data' });
  if (duration > 120000) return res.status(400).json({ error: 'Recording exceeds 120 second limit' });

  const id = 'audio_' + Date.now();
  const filePath = path.join(RECORDINGS_DIR, `${id}.webm`);
  const buffer = Buffer.from(audioBase64, 'base64');

  try {
    fs.writeFileSync(filePath, buffer);
    const record = {
      id, userId: req.user.id, userName: req.user.name, userPart: req.user.part || '',
      scoreId: scoreId || '', scoreTitle: scoreTitle || '', duration: duration || 0,
      fileName: `${id}.webm`, fileSize: buffer.length,
      createdAt: new Date().toISOString(),
    };
    rehearsalRecords.push(record);
    saveData('rehearsalRecords.json', rehearsalRecords);
    res.json({ success: true, id, url: `/api/rehearsal/audio/${id}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save recording' });
  }
});

app.get('/api/rehearsal/audio/:id', requireAuth, (req, res) => {
  const record = rehearsalRecords.find(r => r.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  // Captain can listen to their voice part members' recordings
  if (req.user.role !== 'admin' && record.userId !== req.user.id) {
    if (req.user.role === 'captain' && record.userPart === req.user.part) {
      // captain can access
    } else {
      return res.status(403).json({ error: 'Permission denied' });
    }
  }
  const filePath = path.join(RECORDINGS_DIR, record.fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', 'audio/webm');
  fs.createReadStream(filePath).pipe(res);
});

app.get('/api/rehearsal/audio-list', requireAuth, (req, res) => {
  let records = rehearsalRecords.filter(r => r.fileName); // only audio recordings
  if (req.user.role === 'admin') {
    // admin sees all
  } else if (req.user.role === 'captain') {
    records = records.filter(r => r.userId === req.user.id || r.userPart === req.user.part);
  } else {
    records = records.filter(r => r.userId === req.user.id);
  }
  res.json(records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

// =================== USER AUTH ===================
app.post('/api/auth/register', (req, res) => {
  const { name, password, part, role } = req.body;
  if (!name || !password) return res.status(400).json({ error: '姓名和密码必填' });
  if (name.length < 2 || name.length > 20) return res.status(400).json({ error: '姓名2-20字' });
  if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });
  if (users.find(u => u.name === name)) return res.status(409).json({ error: '该姓名已被注册' });

  const userRole = ['admin', 'captain', 'member'].includes(role) ? role : 'member';
  const user = {
    id: 'u_' + (userIdCounter++),
    name: name.trim(),
    password: hashPwd(password),
    part: part || 'soprano',
    role: userRole,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveData('users.json', users);

  const token = genToken();
  sessions[token] = { userId: user.id, createdAt: Date.now() };
  res.json({ token, user: { id: user.id, name: user.name, part: user.part, role: user.role } });
});

app.post('/api/auth/login', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: '姓名和密码必填' });
  const user = users.find(u => u.name === name.trim());
  if (!user || user.password !== hashPwd(password)) return res.status(401).json({ error: '姓名或密码错误' });

  const token = genToken();
  sessions[token] = { userId: user.id, createdAt: Date.now() };
  res.json({ token, user: { id: user.id, name: user.name, part: user.part, role: user.role } });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: '未登录' });
  res.json({ id: user.id, name: user.name, part: user.part, role: user.role });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) delete sessions[token];
  res.json({ success: true });
});

// =================== ADMIN ===================
app.get('/api/admin/users', requireAuth, requireRole(['admin']), (req, res) => {
  res.json(users.map(u => ({ id: u.id, name: u.name, part: u.part, role: u.role, createdAt: u.createdAt })));
});

app.patch('/api/admin/users/:id/role', requireAuth, requireRole(['admin']), (req, res) => {
  const { role } = req.body;
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (!['admin', 'captain', 'member'].includes(role)) return res.status(400).json({ error: '无效角色' });
  user.role = role;
  saveData('users.json', users);
  res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
});

app.get('/api/admin/stats', requireAuth, requireRole(['admin']), (req, res) => {
  const userStats = {};
  rehearsalRecords.forEach(r => {
    if (!userStats[r.userId]) userStats[r.userId] = { name: r.userName, part: r.userPart, rehearsals: 0 };
    userStats[r.userId].rehearsals++;
  });
  res.json({
    totalUsers: users.length,
    totalScores: scores.length,
    totalVoiceParts: voiceParts.length,
    totalRehearsals: rehearsalRecords.length,
    userStats: Object.values(userStats),
  });
});

// =================== SERVE FRONTEND ===================
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '..', 'dist', 'index.html')); });

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ChoirAI server running on port ${PORT}`);
});

module.exports = app;
