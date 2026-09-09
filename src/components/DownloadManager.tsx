import React, { useState } from 'react';
import { DownloadTask } from '../types.ts';
import {
  Download,
  StopCircle,
  Trash2,
  RefreshCw,
  FolderDown,
  ExternalLink,
  Copy,
  Check,
  Film,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  HardDrive,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import { downloadMarkdownFile } from '../utils/markdownExporter.ts';

interface DownloadManagerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: DownloadTask[];
  onCancelTask: (taskId: string) => void;
  onRetryTask: (task: DownloadTask) => void;
  onClearHistory: () => void;
  onRemoveTask: (taskId: string) => void;
  autoDownloadMarkdown?: boolean;
  onToggleAutoDownloadMarkdown?: (val: boolean) => void;
}

export const DownloadManager: React.FC<DownloadManagerProps> = ({
  isOpen,
  onClose,
  tasks,
  onCancelTask,
  onRetryTask,
  onClearHistory,
  onRemoveTask,
  autoDownloadMarkdown = true,
  onToggleAutoDownloadMarkdown,
}) => {
  const [activeTab, setActiveTab] = useState<'downloads' | 'settings'>('downloads');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeTasks = tasks.filter((t) => t.status === 'downloading' || t.status === 'resolving');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const otherTasks = tasks.filter((t) => t.status === 'error' || t.status === 'cancelled');

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || bytesPerSec === 0) return '0 KB/s';
    const mb = bytesPerSec / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
    const kb = bytesPerSec / 1024;
    return `${kb.toFixed(0)} KB/s`;
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return 'calculando...';
    if (seconds <= 0) return 'completando...';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}:${secs.toString().padStart(2, '0')}m`;
  };

  const handleCopyDirectLink = (task: DownloadTask) => {
    if (task.directUrl) {
      navigator.clipboard.writeText(task.directUrl);
      setCopiedId(task.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSaveCompletedBlob = (task: DownloadTask) => {
    if (task.blobUrl) {
      const a = document.createElement('a');
      a.href = task.blobUrl;
      a.download = task.title.endsWith('.mp4') ? task.title : `${task.title}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (task.directUrl) {
      window.open(task.directUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[90vh] animate-in slide-in-from-right-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header matching MAX Video Downloader Extension UI */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('downloads')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'downloads'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>Descargas</span>
              {activeTasks.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-[10px] font-bold flex items-center justify-center text-white animate-pulse">
                  {activeTasks.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Motor CDN
            </button>
          </div>

          <div className="flex items-center gap-1">
            {completedTasks.length > 0 && (
              <button
                onClick={onClearHistory}
                title="Limpiar historial completado"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-xs flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'settings' ? (
            <div className="space-y-3 text-xs text-slate-600">
              {/* Option to automatically download markdown notes */}
              {onToggleAutoDownloadMarkdown && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold text-indigo-950">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Descargar Notas Markdown (.md) junto al Video</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoDownloadMarkdown}
                        onChange={(e) => onToggleAutoDownloadMarkdown(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <p className="text-[11px] text-indigo-800/80 leading-relaxed">
                    Al descargar un video, también se guardará automáticamente un archivo <code>.md</code> con toda la descripción, texto explicativo, listas y enlaces que aparecen al pie de la lección en Skool.
                  </p>
                </div>
              )}

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                <div className="flex items-center gap-2 font-semibold text-emerald-900 mb-1">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Descarga Directa tipo Extensión Chrome</span>
                </div>
                <p className="leading-relaxed">
                  Esta aplicación utiliza la misma técnica que la extensión MAX Video Downloader:
                  se conecta directamente a los servidores CDN de Loom (AWS CloudFront) aprovechando las cabeceras CORS libres (<code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">Access-Control-Allow-Origin: *</code>).
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-semibold text-slate-800">¿Por qué elimina el Error 500?</div>
                <p className="leading-relaxed">
                  Los videos de Skool alojados en Loom pesan entre 150 MB y 650 MB. Cuando se intentaban descargar a través de un proxy intermediario en el servidor, los límites de tiempo de Cloud Run cortaban la conexión y arrojaban 500. Al descargarlo directamente en tu navegador como hace la extensión, la descarga es directa, sin cortes y a máxima velocidad.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 1. Activos y en cola */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 tracking-wide uppercase">
                  <span>Activos y en cola</span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {activeTasks.length}
                  </span>
                </div>

                {activeTasks.length === 0 ? (
                  <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 text-xs">
                    No hay descargas activas en este momento.
                  </div>
                ) : (
                  activeTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2.5 transition-all hover:border-slate-300"
                    >
                      <div className="flex items-start gap-3">
                        {/* Thumbnail or Video Icon */}
                        <div className="w-14 h-11 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-700">
                          {task.thumbnail ? (
                            <img
                              src={task.thumbnail}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Film className="w-5 h-5 text-slate-400" />
                          )}
                          <span className="absolute bottom-0.5 right-1 text-[9px] font-bold bg-black/70 px-1 rounded text-white">
                            {task.resolution || '1080p'}
                          </span>
                        </div>

                        {/* Video Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
                            <span className="font-semibold text-emerald-600 uppercase">
                              {task.provider}
                            </span>
                            <span>•</span>
                            <span className="bg-slate-100 px-1.5 py-0.2 rounded font-mono text-[10px]">
                              {task.format || 'MP4'}
                            </span>
                          </div>
                          <div
                            className="text-xs font-semibold text-slate-900 truncate"
                            title={task.title}
                          >
                            {task.title.endsWith('.mp4') ? task.title : `${task.title}.mp4`}
                          </div>
                        </div>

                        {/* Stop / Cancel Button */}
                        <button
                          onClick={() => onCancelTask(task.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors flex items-center gap-1 shrink-0 shadow-xs"
                          title="Detener descarga"
                        >
                          <StopCircle className="w-3.5 h-3.5" />
                          <span>Detener</span>
                        </button>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${Math.max(3, task.progress)}%` }}
                        />
                      </div>

                      {/* Real-time stats */}
                      <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-emerald-600">
                            {task.progress.toFixed(1)}%
                          </span>
                          <span>↓</span>
                          <span>
                            {formatBytes(task.receivedBytes)} / {formatBytes(task.totalBytes)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <span>{formatSpeed(task.speedBytesPerSec)}</span>
                          <span>•</span>
                          <span>{formatTimeRemaining(task.timeRemainingSec)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 2. Historial de Descargas */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 tracking-wide uppercase">
                  <span>Historial</span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {completedTasks.length}
                  </span>
                </div>

                {completedTasks.length === 0 && otherTasks.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-slate-50 text-slate-400 text-xs">
                    Las descargas completadas aparecerán aquí.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 bg-emerald-50/40 border border-emerald-200/70 rounded-xl space-y-2 hover:border-emerald-300 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                              {task.completedAt
                                ? new Date(task.completedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Completado'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                              {task.format || 'MP4'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                              {task.resolution || '1080p'}
                            </span>
                            <span className="text-slate-500 font-mono">
                              {formatBytes(task.totalBytes)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {task.directUrl && (
                              <button
                                onClick={() => handleCopyDirectLink(task)}
                                title="Copiar enlace directo CDN"
                                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                              >
                                {copiedId === task.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            {task.markdownContent && (
                              <button
                                onClick={() =>
                                  downloadMarkdownFile(`${task.title}.md`, task.markdownContent!)
                                }
                                title="Descargar notas de la lección (.md)"
                                className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 rounded transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleSaveCompletedBlob(task)}
                              title="Guardar archivo en disco"
                              className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded transition-colors"
                            >
                              <FolderDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onRemoveTask(task.id)}
                              title="Quitar del historial"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-slate-800 truncate" title={task.title}>
                          {task.title.endsWith('.mp4') ? task.title : `${task.title}.mp4`}
                        </div>
                      </div>
                    ))}

                    {/* Failed / Cancelled Tasks */}
                    {otherTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-rose-700">
                            {task.status === 'cancelled' ? 'Cancelado' : 'Error en descarga'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onRetryTask(task)}
                              title="Reintentar descarga"
                              className="p-1 text-slate-600 hover:text-slate-900 rounded"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onRemoveTask(task.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-700 font-medium truncate">{task.title}</p>
                        {task.error && <p className="text-[11px] text-rose-600">{task.error}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Motor CDN directo activado</span>
          </div>
          <span>Archivos .MP4 1080p</span>
        </div>
      </div>
    </div>
  );
};
