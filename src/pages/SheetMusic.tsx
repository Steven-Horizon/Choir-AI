import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '@/config';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Gauge, Music } from 'lucide-react';
import * as Tone from 'tone';

// Dynamically import OSMD to avoid SSR issues
let OSMDModule: any = null;

interface ScoreData {
  id: number;
  title: string;
  composer: string;
  file_path: string | null;
  external_url: string | null;
  midi_parsed: boolean;
  musicxml_parsed: boolean;
  tempo: number;
  key_sig: string;
  time_signature: string;
  total_measures: number;
  parts_data: {
    soprano: { name: string; color: string; notes: NoteData[] };
    alto: { name: string; color: string; notes: NoteData[] };
    tenor: { name: string; color: string; notes: NoteData[] };
    bass: { name: string; color: string; notes: NoteData[] };
    tempo: number;
    key: string;
    timeSignature: string;
    totalMeasures: number;
  };
}

interface NoteData {
  note: string;
  duration: string;
  time: string;
  midi?: number;
}

export default function SheetMusic() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const osmdContainerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<any>(null);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(100);
  const [currentMeasure, setCurrentMeasure] = useState(1);
  const [totalMeasures, setTotalMeasures] = useState(1);
  const synthRef = useRef<any>(null);
  const partRef = useRef<any>(null);
  const [xmlContent, setXmlContent] = useState<string>('');
  const [osmdReady, setOsmdReady] = useState(false);

  // Load OSMD
  useEffect(() => {
    const loadOSMD = async () => {
      try {
        const mod = await import('opensheetmusicdisplay');
        OSMDModule = mod;
        setOsmdReady(true);
      } catch (e) {
        console.error('Failed to load OSMD:', e);
      }
    };
    loadOSMD();
  }, []);

  // Fetch score data
  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/scores/${id}`)
      .then(r => r.json())
      .then((data: ScoreData) => {
        setScore(data);
        setTempo(data.tempo);
        setTotalMeasures(data.parts_data?.totalMeasures || 1);
        setLoading(false);

        // If there's a file_path, try to fetch the MusicXML content
        if (data.file_path) {
          fetch(`${API_BASE}${data.file_path}`)
            .then(r => r.text())
            .then(xml => {
              setXmlContent(xml);
            })
            .catch(() => {
              // Generate sample XML for display
              setXmlContent(generateSampleXML(data));
            });
        } else {
          setXmlContent(generateSampleXML(data));
        }
      })
      .catch(() => {
        setError('加载谱子失败');
        setLoading(false);
      });
  }, [id]);

  // Render OSMD when ready
  useEffect(() => {
    if (!osmdReady || !xmlContent || !osmdContainerRef.current) return;

    const render = async () => {
      try {
        if (osmdRef.current) {
          osmdRef.current.clear();
        }

        const osmd = new OSMDModule.OpenSheetMusicDisplay(osmdContainerRef.current, {
          autoResize: true,
          renderingMode: 1, // SVG
          drawTitle: true,
          drawSubtitle: true,
          drawComposer: true,
          drawPartNames: true,
          drawingParameters: {
            drawMeasureNumbers: true,
            drawTimeSignatures: true,
          },
        });

        await osmd.load(xmlContent);
        await osmd.render();
        osmdRef.current = osmd;

        // Highlight current measure
        if (currentMeasure > 1) {
          try {
            osmd.setCursorToPosition(currentMeasure - 1);
          } catch { /* ignore */ }
        }
      } catch (e) {
        console.error('OSMD render error:', e);
        // Show fallback message
        if (osmdContainerRef.current) {
          osmdContainerRef.current.innerHTML = `
            <div style="text-align:center; padding: 40px; color: #666;">
              <p>五线谱渲染需要 MusicXML 格式文件</p>
              <p style="font-size: 12px; margin-top: 8px;">
                请上传 .musicxml 或 .xml 格式的乐谱文件
              </p>
            </div>
          `;
        }
      }
    };

    render();
  }, [osmdReady, xmlContent, currentMeasure]);

  // Initialize Tone.js synth
  const initSynth = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.5 },
        volume: -8,
      }).toDestination();
    }
  }, []);

  // Play score using Tone.js
  const playScore = useCallback(async () => {
    if (!score) return;
    await Tone.start();
    initSynth();

    if (isPlaying) {
      // Stop
      if (partRef.current) {
        partRef.current.stop();
        partRef.current.dispose();
        partRef.current = null;
      }
      Tone.Transport.stop();
      setIsPlaying(false);
      return;
    }

    // Start playing
    setIsPlaying(true);
    Tone.Transport.bpm.value = tempo;

    // Create parts for each voice
    const allNotes = [
      ...score.parts_data.soprano.notes.map(n => ({ ...n, voice: 'soprano' })),
      ...score.parts_data.alto.notes.map(n => ({ ...n, voice: 'alto' })),
      ...score.parts_data.tenor.notes.map(n => ({ ...n, voice: 'tenor' })),
      ...score.parts_data.bass.notes.map(n => ({ ...n, voice: 'bass' })),
    ];

    if (allNotes.length === 0) {
      setIsPlaying(false);
      return;
    }

    // Create a single part with all notes
    const noteEvents: [number, { note: string; duration: string }][] = allNotes.map((n, i) => [i * 0.5, { note: n.note, duration: n.duration || '4n' }]);
    const part = new Tone.Part((time, value: { note: string; duration: string }) => {
      synthRef.current.triggerAttackRelease(value.note, value.duration, time);

      // Update current measure based on time
      const bars = Math.floor(Tone.Transport.seconds / (60 / tempo * 4));
      if (bars + 1 !== currentMeasure) {
        setCurrentMeasure(Math.min(bars + 1, totalMeasures));
      }
    }, noteEvents);

    part.loop = false;
    part.start(0);
    partRef.current = part;

    Tone.Transport.start();

    // Auto-stop when done
    const duration = allNotes.length * 0.5;
    setTimeout(() => {
      Tone.Transport.stop();
      setIsPlaying(false);
      setCurrentMeasure(1);
    }, duration * 1000 + 500);
  }, [score, isPlaying, tempo, initSynth, currentMeasure, totalMeasures]);

  // Handle tempo change
  const handleTempoChange = (newTempo: number) => {
    setTempo(newTempo);
    if (isPlaying) {
      Tone.Transport.bpm.value = newTempo;
    }
  };

  // Navigate to measure
  const goToMeasure = (m: number) => {
    const target = Math.max(1, Math.min(m, totalMeasures));
    setCurrentMeasure(target);
  };

  if (loading) return <div className="p-8 text-center text-neutral-500">加载中...</div>;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!score) return <div className="p-8 text-center text-neutral-500">谱子不存在</div>;

  return (
    <div className="h-full flex flex-col w-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/80">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-neutral-500 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-medium">{score.title}</h2>
            <p className="text-[10px] text-neutral-500">
              {score.composer} · {score.key_sig} · {score.time_signature} · ♩={tempo}
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-3">
          {/* Tempo Control */}
          <div className="flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1.5">
            <Gauge className="w-3.5 h-3.5 text-neutral-400" />
            <input
              type="range"
              min={40}
              max={200}
              value={tempo}
              onChange={e => handleTempoChange(Number(e.target.value))}
              className="w-24 accent-amber-500"
            />
            <span className="text-xs font-mono w-8">{tempo}</span>
          </div>

          {/* Measure Navigation */}
          <div className="flex items-center gap-1 bg-neutral-800 rounded-lg px-2 py-1.5">
            <button onClick={() => goToMeasure(currentMeasure - 1)} className="p-1 text-neutral-400 hover:text-white">
              <SkipBack className="w-4 h-4" />
            </button>
            <span className="text-xs mx-2">{currentMeasure}/{totalMeasures}</span>
            <button onClick={() => goToMeasure(currentMeasure + 1)} className="p-1 text-neutral-400 hover:text-white">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Play/Stop */}
          <button
            onClick={playScore}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium ${
              isPlaying ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-amber-500 text-black hover:bg-amber-600'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? '停止' : '播放'}
          </button>
        </div>
      </div>

      {/* Sheet Music Display */}
      <div className="flex-1 overflow-auto bg-white">
        <div
          ref={osmdContainerRef}
          style={{ minHeight: '400px', padding: '20px' }}
        />
        {!osmdReady && (
          <div className="flex items-center justify-center h-full text-neutral-400">
            <Music className="w-8 h-8 mr-2" />
            <span>正在加载五线谱渲染引擎...</span>
          </div>
        )}
      </div>

      {/* Voice Part Indicators */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-neutral-800 bg-neutral-900">
        {[
          { name: '女高音', color: '#ef4444', part: score.parts_data.soprano },
          { name: '女低音', color: '#3b82f6', part: score.parts_data.alto },
          { name: '男高音', color: '#22c55e', part: score.parts_data.tenor },
          { name: '男低音', color: '#d97706', part: score.parts_data.bass },
        ].map(v => (
          <div key={v.name} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
            <span className="text-neutral-400">{v.name}</span>
            <span className="text-neutral-600">({v.part.notes.length}音符)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Generate sample MusicXML for display when no MusicXML file is available
function generateSampleXML(score: ScoreData): string {
  const { title, composer, time_signature, parts_data } = score;
  const [beats, beatType] = time_signature.split('/');

  // Generate notes from parts_data
  const generateNotes = (notes: NoteData[]) => {
    return notes.slice(0, 32).map((n, i) => {
      const [step, octave] = [n.note.charAt(0), n.note.slice(-1)];
      const alter = n.note.includes('#') ? '<alter>1</alter>' : n.note.includes('b') ? '<alter>-1</alter>' : '';
      const duration = n.duration === '2n' ? '2' : n.duration === '8n' ? '0.5' : '1';

      return `
        <note default-x="${60 + i * 35}" default-y="${-10 - i * 2}">
          <pitch>
            <step>${step}</step>
            ${alter}
            <octave>${octave}</octave>
          </pitch>
          <duration>${duration}</duration>
          <type>${n.duration === '2n' ? 'half' : n.duration === '8n' ? 'eighth' : 'quarter'}</type>
          <stem>up</stem>
          <lyric number="1" default-x="6.58" default-y="-44.63" relative-y="-30.00">
            <syllabic>single</syllabic>
            <text>${i + 1}</text>
          </lyric>
        </note>
      `;
    }).join('');
  };

  const sopranoNotes = generateNotes(parts_data.soprano.notes);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${title}</work-title>
  </work>
  <identification>
    <creator type="composer">${composer || 'Unknown'}</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Soprano</part-name>
    </score-part>
    <score-part id="P2">
      <part-name>Alto</part-name>
    </score-part>
    <score-part id="P3">
      <part-name>Tenor</part-name>
    </score-part>
    <score-part id="P4">
      <part-name>Bass</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1" width="540">
      <print>
        <system-layout>
          <system-margins>
            <left-margin>70</left-margin>
            <right-margin>0</right-margin>
          </system-margins>
          <top-system-distance>211</top-system-distance>
        </system-layout>
        <measure-numbering>system</measure-numbering>
      </print>
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
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <sound tempo="${parts_data.tempo}" />
      ${sopranoNotes}
    </measure>
  </part>
  <part id="P2">
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
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      ${generateNotes(parts_data.alto.notes)}
    </measure>
  </part>
  <part id="P3">
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
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      ${generateNotes(parts_data.tenor.notes)}
    </measure>
  </part>
  <part id="P4">
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
          <sign>F</sign>
          <line>4</line>
        </clef>
      </attributes>
      ${generateNotes(parts_data.bass.notes)}
    </measure>
  </part>
</score-partwise>`;
}
