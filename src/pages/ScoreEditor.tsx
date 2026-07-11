import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Download, Save, ExternalLink, Music, RotateCcw, X } from 'lucide-react';
import { API_BASE } from '@/config';
import abcjs from 'abcjs';
import * as Tone from 'tone';

// Default ABC notation - a simple 4-part choral piece
const DEFAULT_ABC = `X:1
T:送别
C:约翰·庞德·奥特威
M:4/4
L:1/4
Q:1/4=72
K:C
%%score (1 2) (3 4)
V:1 clef=treble name="女高音"
"C"C E G A | "F"A G E C | "G"D E D C | "C"C4 |
V:2 clef=treble name="女低音"
G, C E F | F E C G, | G, C B, G, | G,4 |
V:3 clef=bass name="男高音"
E, G, C D | D C G, E, | G, G, F, E, | E,4 |
V:4 clef=bass name="男低音"
C, C, E, F, | F, E, G, C, | B,, C, G,, C, | C,4 |`;

const EXAMPLE_TEMPLATES = [
  { name: '送别 (C大调四部)', abc: DEFAULT_ABC },
  { name: '音阶练习 (C大调)', abc: `X:1
T:C大调音阶练习
M:4/4
L:1/4
K:C
V:1 clef=treble
C D E F | G A B c | c B A G | F E D C |` },
  { name: '和弦进行 (I-V-vi-IV)', abc: `X:1
T:和弦进行练习
M:4/4
L:1/2
K:C
V:1 clef=treble
[C E G]2 [G B d]2 | [A c e]2 [F A c]2 | [C E G]4 |` },
];

export default function ScoreEditor() {
  const navigate = useNavigate();
  const [abcText, setAbcText] = useState(DEFAULT_ABC);
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<any>(null);
  const synthControlRef = useRef<any>(null);
  const abcTuneRef = useRef<any>(null);

  // Render ABC notation to sheet music
  useEffect(() => {
    if (!sheetRef.current) return;
    try {
      const tune = abcjs.renderAbc(sheetRef.current, abcText, {
        responsive: 'resize',
        add_classes: true,
        clickListener: () => {},
      });
      abcTuneRef.current = tune;
      setError('');
    } catch (e: any) {
      setError('ABC 格式错误: ' + (e.message || '请检查语法'));
    }
  }, [abcText]);

  // Parse ABC to get title/composer
  useEffect(() => {
    const titleMatch = abcText.match(/^T:\s*(.+)$/m);
    const composerMatch = abcText.match(/^C:\s*(.+)$/m);
    if (titleMatch) setTitle(titleMatch[1]);
    if (composerMatch) setComposer(composerMatch[1]);
  }, [abcText]);

  // Initialize audio
  const initAudio = useCallback(async () => {
    if (!synthRef.current) {
      await Tone.start();
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.5 },
        volume: -8,
      }).toDestination();
    }
  }, []);

  // Play ABC using abcjs midi
  const playSheet = useCallback(async () => {
    if (isPlaying) {
      // Stop
      if (synthControlRef.current) {
        synthControlRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    await initAudio();
    setIsPlaying(true);

    try {
      // Create synth control for abcjs playback
      if (!synthControlRef.current) {
        synthControlRef.current = new abcjs.synth.CreateSynth();
      }

      const tune = abcTuneRef.current?.[0];
      if (!tune) {
        setIsPlaying(false);
        return;
      }

      await synthControlRef.current.init({
        visualObj: tune,
        audioContext: Tone.context as any,
        millisecondsPerMeasure: tune.getMillisecondsPerMeasure(),
      });

      await synthControlRef.current.prime();
      synthControlRef.current.start();

      // Auto-stop when done
      const duration = tune.getTotalTime() * 1000;
      setTimeout(() => {
        setIsPlaying(false);
      }, duration + 500);
    } catch (e) {
      console.error('Playback error:', e);
      setIsPlaying(false);
    }
  }, [isPlaying, initAudio]);

  // Convert ABC to MusicXML (simple converter)
  const abcToMusicXML = (abc: string): string => {
    // Extract info
    const titleMatch = abc.match(/^T:\s*(.+)$/m);
    const composerMatch = abc.match(/^C:\s*(.+)$/m);
    const keyMatch = abc.match(/^K:\s*(\w)/m);
    const timeMatch = abc.match(/^M:\s*(\d)\/(\d)/m);
    const tempoMatch = abc.match(/^Q:\s*\d+\/(\d+)=(\d+)/m) || abc.match(/^Q:\s*(\d+)/m);

    const title = titleMatch ? titleMatch[1] : 'Untitled';
    const composer = composerMatch ? composerMatch[1] : 'Unknown';
    const _key = keyMatch ? keyMatch[1] : 'C';
    void _key;
    const beats = timeMatch ? timeMatch[1] : '4';
    const beatType = timeMatch ? timeMatch[2] : '4';
    const tempo = tempoMatch ? tempoMatch[2] || tempoMatch[1] : '72';

    // Parse voice sections
    const voiceRegex = /^V:(\d+)\s+(.+)$/gm;
    const voices: { id: string; name: string; clef: string; notes: string }[] = [];
    let vMatch;
    while ((vMatch = voiceRegex.exec(abc)) !== null) {
      const vId = vMatch[1];
      const vConfig = vMatch[2];
      const clefMatch = vConfig.match(/clef=(\w+)/);
      const nameMatch = vConfig.match(/name="([^"]+)"/);
      voices.push({
        id: vId,
        name: nameMatch ? nameMatch[1] : `Voice ${vId}`,
        clef: clefMatch ? clefMatch[1] : 'treble',
        notes: '',
      });
    }

    // Default voice if none defined
    if (voices.length === 0) {
      voices.push({ id: '1', name: '女高音', clef: 'treble', notes: '' });
    }

    // Generate MusicXML
    const partList = voices.map(v =>
      `    <score-part id="P${v.id}">\n      <part-name>${v.name}</part-name>\n    </score-part>`
    ).join('\n');

    const parts = voices.map(v => {
      const clefSign = v.clef === 'bass' ? 'F' : 'G';
      const clefLine = v.clef === 'bass' ? '4' : '2';

      // Extract notes for this voice (simplified)
      const voiceSection = abc.split(`V:${v.id}`)[1];
      const notesLine = voiceSection ? voiceSection.split(/^V:/m)[0].trim() : '';

      // Simple note parsing
      const noteMatches = notesLine.match(/[A-Ga-g][,']*/g) || [];
      const notes = noteMatches.map((n, i) => {
        const step = n.charAt(0).toUpperCase();
        const octave = n.includes(',') ? 3 : n.includes("'") ? 5 : 4;
        return `
        <note default-x="${60 + i * 35}">
          <pitch>
            <step>${step}</step>
            <octave>${octave}</octave>
          </pitch>
          <duration>1</duration>
          <type>quarter</type>
          <stem>up</stem>
        </note>`;
      }).join('');

      return `
  <part id="P${v.id}">
    <measure number="1" width="540">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>${beats}</beats>
          <beat-type>${beatType}</beat-type>
        </time>
        <clef>
          <sign>${clefSign}</sign>
          <line>${clefLine}</line>
        </clef>
      </attributes>
      <sound tempo="${tempo}" />
      ${notes || '<note><rest/><duration>1</duration><type>quarter</type></note>'}
    </measure>
  </part>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${title}</work-title>
  </work>
  <identification>
    <creator type="composer">${composer}</creator>
  </identification>
  <part-list>
${partList}
  </part-list>
${parts}
</score-partwise>`;
  };

  // Export as MusicXML and save to ChoirAI
  const exportAndSave = async () => {
    try {
      const xmlContent = abcToMusicXML(abcText);
      const xmlBase64 = btoa(unescape(encodeURIComponent(xmlContent)));

      const res = await fetch(`${API_BASE}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || '未命名',
          composer: composer || '',
          fileData: xmlBase64,
          fileName: `${title || 'score'}.musicxml`,
          fileType: 'application/vnd.recordare.musicxml',
        }),
      });

      if (res.ok) {
        navigate('/scores');
      } else {
        setError('保存失败');
      }
    } catch (e) {
      setError('导出失败: ' + (e as Error).message);
    }
  };

  // Download as MusicXML file
  const downloadXML = () => {
    const xmlContent = abcToMusicXML(abcText);
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'score'}.musicxml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col w-full">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/80 gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/scores')} className="text-neutral-500 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" />
              在线打谱
            </h2>
            <p className="text-[10px] text-neutral-500">ABC 记谱法 → 五线谱</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Templates */}
          <select
            onChange={e => { if (e.target.value) setAbcText(e.target.value); }}
            className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-300 focus:outline-none"
            value=""
          >
            <option value="">📋 选择模板...</option>
            {EXAMPLE_TEMPLATES.map((t, i) => (
              <option key={i} value={t.abc}>{t.name}</option>
            ))}
          </select>

          <button onClick={() => setShowHelp(!showHelp)}
            className="px-3 py-1.5 bg-neutral-800 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700">
            ? 语法帮助
          </button>

          <button onClick={playSheet}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              isPlaying ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
            }`}>
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? '停止' : '播放'}
          </button>

          <button onClick={downloadXML}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-400 rounded-lg text-xs hover:bg-blue-500/25">
            <Download className="w-3.5 h-3.5" />导出 XML
          </button>

          <button onClick={exportAndSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black rounded-lg text-xs font-medium hover:bg-amber-600">
            <Save className="w-3.5 h-3.5" />保存到曲库
          </button>

          <a href="https://flat.io" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-300">
            <ExternalLink className="w-3 h-3" />专业版
          </a>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: ABC Editor */}
        <div className="w-full md:w-1/3 flex flex-col border-r border-neutral-800">
          <div className="p-2 bg-neutral-800/50 text-xs text-neutral-400 flex items-center justify-between">
            <span>ABC 记谱法编辑</span>
            <button onClick={() => setAbcText(DEFAULT_ABC)} className="text-neutral-500 hover:text-white">
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
          <textarea
            value={abcText}
            onChange={e => setAbcText(e.target.value)}
            className="flex-1 bg-neutral-900 text-sm font-mono p-4 resize-none focus:outline-none text-neutral-200 leading-relaxed"
            spellCheck={false}
          />
          {error && (
            <div className="p-2 bg-red-500/10 text-red-400 text-xs">{error}</div>
          )}
        </div>

        {/* Right: Sheet Music Preview */}
        <div className="flex-1 flex flex-col bg-white overflow-auto">
          <div className="p-2 bg-neutral-100 text-xs text-neutral-500 flex items-center justify-between">
            <span className="text-neutral-700 font-medium">五线谱预览</span>
            <span className="text-neutral-400">{title || '未命名'} {composer ? `- ${composer}` : ''}</span>
          </div>
          <div
            ref={sheetRef}
            className="flex-1 p-4 min-h-[400px]"
            style={{ background: 'white' }}
          />
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">ABC 记谱法语法帮助</h3>
              <button onClick={() => setShowHelp(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm text-neutral-300">
              <div>
                <h4 className="text-amber-400 font-medium mb-1">基本信息</h4>
                <pre className="bg-neutral-800 p-2 rounded text-xs">
{`X:1              ← 编号
T:曲目名称        ← 标题
C:作曲家          ← 作曲者
M:4/4            ← 拍号
L:1/4            ← 默认音符长度
Q:1/4=72         ← 速度 (BPM)
K:C              ← 调号`}
                </pre>
              </div>
              <div>
                <h4 className="text-amber-400 font-medium mb-1">声部定义</h4>
                <pre className="bg-neutral-800 p-2 rounded text-xs">
{`V:1 clef=treble name="女高音"    ← 高音谱号
V:2 clef=treble name="女低音"
V:3 clef=bass name="男高音"       ← 低音谱号
V:4 clef=bass name="男低音"`}
                </pre>
              </div>
              <div>
                <h4 className="text-amber-400 font-medium mb-1">音符输入</h4>
                <pre className="bg-neutral-800 p-2 rounded text-xs">
{`C D E F G A B c    ← C大调音阶
C, D, E,           ← 低八度 (加逗号)
c d e              ← 高八度 (小写字母)
C2                  ← 二分音符 (加数字)
C/2                 ← 八分音符 (除以2)
|                   ← 小节线`}
                </pre>
              </div>
              <div>
                <h4 className="text-amber-400 font-medium mb-1">和弦</h4>
                <pre className="bg-neutral-800 p-2 rounded text-xs">
{`[C E G]    ← C大三和弦
[G B d]    ← G大三和弦`}
                </pre>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                更多语法参考：<a href="http://abcnotation.com/wiki/abc:standard" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">abcnotation.com</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
