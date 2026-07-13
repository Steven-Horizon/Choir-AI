import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Music, Upload, Plus, FileMusic, Eye, X, ExternalLink, Link as LinkIcon, Search } from 'lucide-react';
import { API_BASE } from '@/config';
import { syncData, saveLocal } from '@/lib/localStorage';


interface Score {
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
  created_at: string;
}

export default function ScoreLibrary() {
  const [scores, setScores] = useState<Score[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<Score | null>(null);
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync: load from localStorage first, then sync with server
  useEffect(() => {
    syncData<Score>('scores',
      () => fetch(`${API_BASE}/api/scores`).then(r => r.json()),
      (items) => fetch(`${API_BASE}/api/scores/sync`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      }).then(() => {})
    ).then(setScores);
  }, []);

  // Search filter
  const filteredScores = searchQuery.trim()
    ? scores.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.composer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : scores;

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const MAX_FILE_SIZE = 35 * 1024 * 1024; // 35MB limit (Railway supports up to 50MB)

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setUploading(true);
    setUploadError('');
    try {
      let fileData = null;
      let fileName = null;
      let fileType = null;
      let extUrl = null;

      if (uploadMode === 'file' && file) {
        // Check file size - if too large, skip file content
        if (file.size > MAX_FILE_SIZE) {
          fileName = file.name;
          fileType = file.type;
        } else {
          fileData = await fileToBase64(file);
          fileName = file.name;
          fileType = file.type;
        }
      } else if (uploadMode === 'link' && externalUrl.trim()) {
        extUrl = externalUrl.trim();
      }

      const res = await fetch(`${API_BASE}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, composer, fileData, fileName, fileType, externalUrl: extUrl }),
      });

      if (res.status === 413) {
        throw new Error('文件太大。已保存谱子信息，文件未上传。建议用"网盘链接"方式上传大文件。');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `上传失败 (${res.status})`);
      }

      const result = await res.json();

      // Save to localStorage immediately
      const updated = [result, ...scores];
      saveLocal('scores', updated);
      setScores(updated);

      setShowUpload(false);
      setTitle(''); setComposer(''); setFile(null); setExternalUrl(''); setUploadMode('file');
    } catch (err: any) {
      setUploadError(err.message || '上传失败');
    }
    setUploading(false);
  };

  const isPdf = (path: string | null) => path?.toLowerCase().endsWith('.pdf');
  const isImage = (path: string | null) => path && /\.(png|jpg|jpeg)$/i.test(path);
  const isAudio = (path: string | null) => path && /\.(mp3|wav|m4a)$/i.test(path);

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h2 className="text-2xl font-bold">我的谱子库</h2>
          <p className="text-sm text-neutral-500 mt-1">上传谱子或直接贴网盘链接</p>
        </div>
        <div className="flex gap-2">
          <Link to="/editor"
            className="flex items-center gap-2 px-4 py-2.5 bg-green-500/15 text-green-400 rounded-lg hover:bg-green-500/25 text-sm font-medium">
            <Music className="w-4 h-4" />在线打谱
          </Link>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-2.5 rounded-lg">
            <Plus className="w-4 h-4" />上传谱子
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索曲目或作曲家..."
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-neutral-600 mt-1">
            {filteredScores.length > 0 ? `找到 ${filteredScores.length} 个结果` : '未找到相关谱子'}
          </p>
        )}
      </div>

      {filteredScores.length === 0 ? (
        <div className="text-center py-20 bg-neutral-900 rounded-xl border border-neutral-800 border-dashed">
          <FileMusic className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
          {searchQuery ? (
            <>
              <p className="text-neutral-500">未找到相关谱子</p>
              <p className="text-sm text-neutral-600">试试其他关键词</p>
            </>
          ) : (
            <>
              <p className="text-neutral-500">还没有谱子</p>
              <p className="text-sm text-neutral-600">点击右上角上传你的第一首合唱谱</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredScores.map(s => (
            <div key={s.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-5 hover:border-amber-500/30 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Music className="w-6 h-6 text-amber-400" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-neutral-600 bg-neutral-800 px-2 py-1 rounded">{s.time_signature}</span>
                  {s.midi_parsed && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">MIDI</span>
                  )}
                  {s.musicxml_parsed && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">五线谱</span>
                  )}
                  {s.external_url && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">网盘</span>
                  )}
                </div>
              </div>
              <h3 className="font-semibold mb-1 group-hover:text-amber-400 transition-colors">{s.title}</h3>
              <p className="text-sm text-neutral-500 mb-2">{s.composer || ''}</p>
              <div className="flex gap-2">
                {(s.file_path || s.external_url) && (
                  <button onClick={() => setPreview(s)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-neutral-800 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors">
                    <Eye className="w-3.5 h-3.5" />预览
                  </button>
                )}
                <Link to={`/sheet/${s.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500/10 rounded-lg text-xs text-green-400 hover:bg-green-500/20 transition-colors text-center">
                  <Music className="w-3.5 h-3.5" />五线谱
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-lg">上传谱子</h3>
              <button onClick={() => setShowUpload(false)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Upload mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setUploadMode('file')}
                className={`flex-1 py-2 rounded-lg text-sm ${uploadMode === 'file' ? 'bg-amber-500/15 text-amber-400' : 'bg-neutral-800 text-neutral-400'}`}>
                <Upload className="w-4 h-4 inline mr-1" />上传文件
              </button>
              <button
                onClick={() => setUploadMode('link')}
                className={`flex-1 py-2 rounded-lg text-sm ${uploadMode === 'link' ? 'bg-blue-500/15 text-blue-400' : 'bg-neutral-800 text-neutral-400'}`}>
                <LinkIcon className="w-4 h-4 inline mr-1" />网盘链接
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">曲目标题 *</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：送别"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" required />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">作曲家</label>
                <input type="text" value={composer} onChange={e => setComposer(e.target.value)} placeholder="例如：约翰·庞德·奥特威"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
              </div>

              {uploadMode === 'file' ? (
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">谱子文件（PDF或图片）</label>
                  <label className="border-2 border-dashed border-neutral-700 rounded-lg p-6 text-center cursor-pointer hover:border-amber-500/50 transition-colors block">
                    <Upload className="w-6 h-6 text-neutral-500 mx-auto mb-2" />
                    <p className="text-sm text-neutral-400">{file ? file.name : '点击上传文件'}</p>
                    <p className="text-xs text-neutral-600 mt-1">支持：PDF、图片、MIDI(.mid)、音频(mp3/wav)</p>
                    <p className="text-xs text-amber-500/70 mt-1">⚠ 超过35MB的文件需使用网盘链接</p>
                    {file && file.size > MAX_FILE_SIZE && (
                      <p className="text-xs text-amber-400 mt-1">此文件 { (file.size / 1024 / 1024).toFixed(1) }MB，超过35MB需使用网盘链接</p>
                    )}
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.mp3,.wav,.m4a,.mid,.midi" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">
                    <LinkIcon className="w-3.5 h-3.5 inline mr-1" />网盘分享链接
                  </label>
                  <input
                    type="text"
                    value={externalUrl}
                    onChange={e => setExternalUrl(e.target.value)}
                    placeholder="粘贴百度网盘/阿里云盘/腾讯微云等分享链接"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-neutral-500 mt-1">支持任意网盘链接，点击预览将跳转到对应网盘</p>
                  <p className="text-xs text-blue-400/70 mt-1">💡 推荐：百度网盘、阿里云盘、腾讯微云</p>
                </div>
              )}

              {uploadError && (
                <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 text-center">{uploadError}</div>
              )}
              <button type="submit" disabled={uploading || !title || (uploadMode === 'link' && !externalUrl.trim())}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-medium py-2.5 rounded-lg">
                {uploading ? '上传中...' : '确认上传'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal with Watermark */}
      {preview && (preview.file_path || preview.external_url) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 w-full max-w-4xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <div>
                <h3 className="font-semibold">{preview.title}</h3>
                <p className="text-xs text-neutral-500">{preview.composer} · {preview.key_sig} · ♩={preview.tempo}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/20">版权保护 · 禁止外传</span>
                <button onClick={() => setPreview(null)} className="text-neutral-500 hover:text-white p-1"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto relative bg-neutral-950">
              {/* Watermark overlay */}
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.06]">
                  <span className="text-5xl font-bold text-amber-500 rotate-[-30deg] select-none whitespace-nowrap">
                    ChoirAI · 仅供内部使用 · 禁止截图外传
                  </span>
                </div>
                {Array.from({ length: 15 }).map((_, row) =>
                  Array.from({ length: 4 }).map((_, col) => (
                    <span key={`${row}-${col}`} className="absolute text-xs text-amber-500/8 font-medium select-none"
                      style={{ top: `${row * 100 + 30}px`, left: `${col * 250 + 60}px`, transform: 'rotate(-15deg)' }}>
                      ChoirAI内部资料
                    </span>
                  ))
                )}
              </div>

              <div className="relative z-0 p-4 flex items-center justify-center min-h-full">
                {preview.external_url ? (
                  <div className="flex flex-col items-center justify-center">
                    <LinkIcon className="w-12 h-12 text-blue-400 mb-4" />
                    <p className="text-sm text-neutral-400 mb-2">文件存储在外部网盘</p>
                    <p className="text-xs text-neutral-600 mb-6 max-w-md text-center break-all">{preview.external_url}</p>
                    <a href={preview.external_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                      <ExternalLink className="w-4 h-4" />在网盘打开
                    </a>
                  </div>
                ) : isPdf(preview.file_path) ? (
                  <div className="w-full h-full min-h-[60vh]">
                    <iframe src={`${API_BASE}${preview.file_path}`} width="100%" height="100%" className="rounded-lg min-h-[60vh] border-0" title={preview.title} />
                  </div>
                ) : isImage(preview.file_path) ? (
                  <img src={`${API_BASE}${preview.file_path}`} alt={preview.title} className="max-w-full max-h-[70vh] mx-auto rounded-lg" />
                ) : isAudio(preview.file_path) ? (
                  <div className="flex flex-col items-center justify-center">
                    <audio controls src={`${API_BASE}${preview.file_path}`} className="w-full max-w-md" />
                    <p className="text-sm text-neutral-500 mt-4">{preview.title}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-neutral-500">
                    <p>此文件类型不支持在线预览</p>
                    <p className="text-sm text-neutral-600 mt-2">{preview.file_path?.split('/').pop()}</p>
                    <a href={`${API_BASE}${preview.file_path}`} download className="mt-4 px-4 py-2 bg-amber-500/15 text-amber-400 rounded-lg text-sm hover:bg-amber-500/25">下载文件</a>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-600">水印保护中</span>
              </div>
              <div className="flex gap-2">
                <Link to={`/sheet/${preview.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg text-sm text-green-400 hover:bg-green-500/20"
                  onClick={() => setPreview(null)}>
                  <Eye className="w-4 h-4" />五线谱视图
                </Link>
                <button onClick={() => setPreview(null)} className="px-4 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700">
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
