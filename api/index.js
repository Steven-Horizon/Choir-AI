// Vercel Serverless Function - ChoirAI Backend
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const { parseMidi } = require('midi-file');

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
    fileStorage[safeName] = { data: fileData, type: fileType || 'application/octet-stream', name: fileName };

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
  const file = fileStorage[req.params.filename];
  if (!file) return res.status(404).json({ error: 'File not found' });
  const buffer = Buffer.from(file.data, 'base64');
  res.setHeader('Content-Type', file.type);
  res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
  res.send(buffer);
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

// =================== TRAINING PLANS ===================
app.post('/api/plans/sync', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be array' });
  items.forEach(item => {
    if (!trainingPlans.find(p => p.id === item.id)) trainingPlans.push(item);
  });
  res.json({ success: true, count: trainingPlans.length });
});

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

app.post('/api/chat', async (req, res) => {
  const { message, sessionId, forceModel, attachments, kimiKey } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const sid = sessionId || Date.now();
  const history = messages.filter(m => m.session_id === sid);

  // Determine which model to use:
  // 1. If user forces a model, use that
  // 2. If there are image attachments AND Kimi key is available, use Kimi
  // 3. Otherwise use DeepSeek (default)
  const effectiveKimiKey = kimiKey || KIMI_API_KEY;
  const hasImageAttachments = attachments && attachments.some((a) => a.type && a.type.startsWith('image/'));

  let useKimiApi = false;
  if (forceModel === 'kimi' && effectiveKimiKey) {
    useKimiApi = true;
  } else if (forceModel === 'deepseek') {
    useKimiApi = false;
  } else {
    // Auto: use Kimi if images present and key available, else DeepSeek
    useKimiApi = hasImageAttachments && !!effectiveKimiKey;
  }

  // Build messages
  const msgs = [{ role: 'system', content: '你是 ChoirAI 合唱智能训练助手，擅长合唱训练指导、乐理知识、谱面分析、声部协调。' }];
  history.forEach(h => msgs.push({ role: h.role, content: h.content }));

  if (useKimiApi && hasImageAttachments) {
    // Kimi multimodal: send text + images
    const contentParts = [];
    contentParts.push({ type: 'text', text: message });
    attachments.forEach(att => {
      if (att.type && att.type.startsWith('image/')) {
        contentParts.push({ type: 'image_url', image_url: { url: `data:${att.type};base64,${att.data}` } });
      }
    });
    msgs.push({ role: 'user', content: contentParts });
  } else {
    // DeepSeek or Kimi without images: just text
    let finalMessage = message;
    // If there are non-image attachments, mention them in text
    if (attachments && attachments.length > 0) {
      const nonImageNames = attachments.filter(a => !a.type.startsWith('image/')).map(a => a.name).join(', ');
      if (nonImageNames) finalMessage += `\n[附件: ${nonImageNames}]`;
    }
    msgs.push({ role: 'user', content: finalMessage });
  }

  messages.push({ session_id: sid, role: 'user', content: message, created_at: new Date().toISOString() });

  try {
    let aiContent;
    let usedModel = 'deepseek';

    if (useKimiApi) {
      usedModel = 'kimi';
      aiContent = await callKimi(msgs, effectiveKimiKey);
    } else {
      // DeepSeek
      const postData = JSON.stringify({ model: 'deepseek-chat', messages: msgs, temperature: 0.7, max_tokens: 2048 });
      aiContent = await new Promise((resolve, reject) => {
        const req = https.request({ hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Length': Buffer.byteLength(postData) }, timeout: 30000 }, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { const p = JSON.parse(data); if (p.choices?.[0]) resolve(p.choices[0].message.content); else reject(new Error('No response')); } catch(e) { reject(e); } }); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(postData); req.end();
      });
    }
    messages.push({ session_id: sid, role: 'assistant', content: aiContent, created_at: new Date().toISOString() });
    res.json({ sessionId: sid, content: aiContent, model: usedModel });
  } catch (err) {
    console.error('Chat error:', err);
    const fallback = useKimiApi
      ? 'Kimi 服务暂时不可用。已自动切换到 DeepSeek，但图片分析功能不可用。'
      : '抱歉，AI服务暂时不可用。请稍后重试。';
    messages.push({ session_id: sid, role: 'assistant', content: fallback, created_at: new Date().toISOString() });
    res.json({ sessionId: sid, content: fallback, _fallback: true });
  }
});

app.get('/api/chat/sessions', (req, res) => {
  const unique = [...new Set(messages.map(m => m.session_id))];
  res.json(unique.map(id => ({ id, title: messages.find(m => m.session_id === id && m.role === 'user')?.content?.slice(0, 30) || '新会话', created_at: messages.find(m => m.session_id === id)?.created_at })));
});

// =================== PDF TO MUSICXML (Audiveris) ===================
const { exec } = require('child_process');
const fs = require('fs');

function runAudiveris(inputPath, outputDir) {
  return new Promise((resolve, reject) => {
    // Check if audiveris is installed
    const audiverisCmd = process.env.AUDIVERIS_PATH || 'audiveris';
    exec(`${audiverisCmd} -help`, (err) => {
      if (err) {
        reject(new Error('Audiveris not installed. Please install from https://github.com/Audiveris/audiveris'));
        return;
      }

      // Run conversion
      const cmd = `${audiverisCmd} -batch -export MusicXML -output "${outputDir}" "${inputPath}"`;
      exec(cmd, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Audiveris failed: ${stderr || error.message}`));
          return;
        }

        // Find output .mxl file
        const files = fs.readdirSync(outputDir);
        const mxlFile = files.find(f => f.endsWith('.mxl'));
        if (!mxlFile) {
          reject(new Error('No MusicXML output generated'));
          return;
        }

        resolve(path.join(outputDir, mxlFile));
      });
    });
  });
}

app.post('/api/convert/pdf-to-musicxml', async (req, res) => {
  const { fileData, fileName } = req.body;
  if (!fileData || !fileName) return res.status(400).json({ error: 'fileData and fileName required' });

  try {
    // Save PDF temporarily
    const tmpDir = `/tmp/audiveris_${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    const inputPath = path.join(tmpDir, fileName);
    fs.writeFileSync(inputPath, Buffer.from(fileData, 'base64'));

    // Run Audiveris
    const outputPath = await runAudiveris(inputPath, tmpDir);

    // Read output MusicXML
    const mxlBuffer = fs.readFileSync(outputPath);

    // Parse and return
    const xmlContent = mxlBuffer.toString('utf-8');

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });

    res.json({
      success: true,
      xmlData: xmlContent,
      message: 'Conversion successful'
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      fallback: 'Please use Audiveris locally: https://github.com/Audiveris/audiveris'
    });
  }
});

// =================== REHEARSAL ===================
app.post('/api/rehearsal/start', (req, res) => { res.json({ id: Date.now() }); });
app.get('/api/rehearsal/records', (req, res) => { res.json([]); });

// =================== SERVE FRONTEND ===================
const distPath = path.join(__dirname, '..', 'dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
} else {
  app.get('/', (req, res) => { res.json({ message: 'ChoirAI API Server Running', status: 'ok' }); });
}

module.exports = app;
