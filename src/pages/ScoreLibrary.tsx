import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Music, Upload, Plus, FileMusic, Eye, X } from 'lucide-react';
import { API_BASE } from '@/config';


interface Score {
  id: number;
  title: string;
  composer: string;
  file_path: string | null;
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => { fetchScores(); }, []);

  const fetchScores = () => {
    fetch(`${API_BASE}/api/scores`).then(r => r.json()).then(setScores);
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB limit for base64 upload

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setUploading(true);
    setUploadError('');
    try {
      let fileData = null;
      let fileName = null;
      let fileType = null;

      if (file) {
        // Check file size - if too large, only store metadata
        if (file.size > MAX_FILE_SIZE) {
          fileName = file.name;
          fileType = file.type;
          // fileData stays null - backend will create record without file content
        } else {
          fileData = await fileToBase64(file);
          fileName = file.name;
          fileType = file.type;
        }
      }

      const res = await fetch(`${API_BASE}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, composer, fileData, fileName, fileType }),
      });

      if (res.status === 413) {
        throw new Error('文件太大（超过2MB）。已保存谱子信息，文件未上传。如需上传大文件，建议压缩后重试。');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `上传失败 (${res.status})`);
      }

      setShowUpload(false);
      setTitle(''); setComposer(''); setFile(null);
      fetchScores();
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
          <p className="text-sm text-neutral-500 mt-1">上传PDF或图片格式的合唱谱</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-medium px-4 py-2.5 rounded-lg">
          <Plus className="w-4 h-4" />上传谱子
        </button>
      </div>

      {scores.length === 0 ? (
        <div className="text-center py-20 bg-neutral-900 rounded-xl border border-neutral-800 border-dashed">
          <FileMusic className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
          <p className="text-neutral-500">还没有谱子</p>
          <p className="text-sm text-neutral-600">点击右上角上传你的第一首合唱谱</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {scores.map(s => (
            <div key={s.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-5 hover:border-amber-500/30 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Music className="w-6 h-6 text-amber-400" />
                </div>
                <span className="text-xs text-neutral-600 bg-neutral-800 px-2 py-1 rounded">{s.time_signature}</span>
              </div>
              <h3 className="font-semibold mb-1 group-hover:text-amber-400 transition-colors">{s.title}</h3>
              <p className="text-sm text-neutral-500 mb-2">{s.composer || '未知作曲家'}</p>
              <div className="flex items-center gap-3 text-xs text-neutral-600 mb-3">
                <span>{s.key_sig}</span>
                <span>♩={s.tempo}</span>
                <span>{s.total_measures}小节</span>
              </div>
              <div className="flex gap-2">
                {s.file_path && (
                  <button onClick={() => setPreview(s)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-neutral-800 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 transition-colors">
                    <Eye className="w-3.5 h-3.5" />预览
                  </button>
                )}
                <Link to={`/rehearse/${s.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500/10 rounded-lg text-xs text-amber-400 hover:bg-amber-500/20 transition-colors text-center">
                  <Music className="w-3.5 h-3.5" />排练
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
              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">谱子文件（PDF或图片）</label>
                <label className="border-2 border-dashed border-neutral-700 rounded-lg p-6 text-center cursor-pointer hover:border-amber-500/50 transition-colors block">
                  <Upload className="w-6 h-6 text-neutral-500 mx-auto mb-2" />
                  <p className="text-sm text-neutral-400">{file ? file.name : '点击上传文件'}</p>
                  <p className="text-xs text-neutral-600 mt-1">支持：PDF、图片、音频(mp3/wav)</p>
                  <p className="text-xs text-amber-500/70 mt-1">⚠ 超过2MB的文件将只保存信息，不上传文件内容</p>
                  {file && file.size > MAX_FILE_SIZE && (
                    <p className="text-xs text-amber-400 mt-1">此文件 { (file.size / 1024 / 1024).toFixed(1) }MB 超过限制，将只保存谱子信息</p>
                  )}
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.mp3,.wav,.m4a" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
                </label>
              </div>
              {uploadError && (
                <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 text-center">{uploadError}</div>
              )}
              <button type="submit" disabled={uploading || !title}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-medium py-2.5 rounded-lg">
                {uploading ? '上传中...' : '确认上传'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {preview && preview.file_path && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <div>
                <h3 className="font-semibold">{preview.title}</h3>
                <p className="text-xs text-neutral-500">{preview.composer} · {preview.key_sig} · ♩={preview.tempo}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-neutral-950">
              {isPdf(preview.file_path) ? (
                <embed src={`${API_BASE}${preview.file_path}`} type="application/pdf" width="100%" height="100%" />
              ) : isImage(preview.file_path) ? (
                <img src={`${API_BASE}${preview.file_path}`} alt={preview.title} className="max-w-full mx-auto" />
              ) : isAudio(preview.file_path) ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <audio controls src={`${API_BASE}${preview.file_path}`} className="w-full max-w-md" />
                  <p className="text-sm text-neutral-500 mt-4">{preview.title}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <p>此文件类型不支持在线预览</p>
                  <p className="text-sm text-neutral-600 mt-2">{preview.file_path?.split('/').pop()}</p>
                  <a href={`${API_BASE}${preview.file_path}`} download className="mt-4 px-4 py-2 bg-amber-500/15 text-amber-400 rounded-lg text-sm hover:bg-amber-500/25">下载文件</a>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-neutral-800 flex gap-2">
              <Link to={`/rehearse/${preview.id}`}
                className="flex-1 text-center py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600"
                onClick={() => setPreview(null)}>
                进入排练
              </Link>
              <button onClick={() => setPreview(null)} className="px-4 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
