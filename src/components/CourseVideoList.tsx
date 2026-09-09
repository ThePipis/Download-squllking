import React, { useState, useMemo } from 'react';
import { SkoolVideo, DownloadTask } from '../types.ts';
import {
  Download,
  Play,
  Copy,
  Check,
  Search,
  Filter,
  Film,
  Clock,
  Folder,
  FileText,
  ExternalLink,
  ChevronDown,
  Sparkles,
  ArrowDownToLine,
  FileSpreadsheet,
  CheckCircle2,
  StopCircle,
  BookOpen,
} from 'lucide-react';
import { parseTipTapToMarkdown, buildLessonMarkdown, downloadMarkdownFile } from '../utils/markdownExporter.ts';

interface CourseVideoListProps {
  courseTitle: string;
  courseDesc?: string;
  communityName?: string;
  videos: SkoolVideo[];
  downloadTasks?: DownloadTask[];
  onOpenDownloadManager?: () => void;
  onCancelDownload?: (taskId: string) => void;
  onPreviewVideo: (video: SkoolVideo) => void;
  onDownloadVideo: (video: SkoolVideo) => void;
  onOpenNotes?: (video: SkoolVideo) => void;
  onBackToCourses?: () => void;
}

export const CourseVideoList: React.FC<CourseVideoListProps> = ({
  courseTitle,
  courseDesc,
  communityName,
  videos,
  downloadTasks = [],
  onOpenDownloadManager,
  onCancelDownload,
  onPreviewVideo,
  onDownloadVideo,
  onOpenNotes,
  onBackToCourses,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());

  // Unique sections
  const sections = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => {
      if (v.section) set.add(v.section);
    });
    return Array.from(set);
  }, [videos]);

  // Filtered list
  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const matchQuery =
        v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.section.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSection = selectedSection === 'all' || v.section === selectedSection;
      return matchQuery && matchSection;
    });
  }, [videos, searchTerm, selectedSection]);

  const handleCopyLink = (video: SkoolVideo) => {
    navigator.clipboard.writeText(video.videoLink);
    setCopiedId(video.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = async (video: SkoolVideo) => {
    setDownloadingId(video.id);
    try {
      await onDownloadVideo(video);
    } finally {
      setTimeout(() => setDownloadingId(null), 3500);
    }
  };

  const handleBatchDownload = async () => {
    const targets = filteredVideos.filter((v) => selectedVideoIds.has(v.id));
    if (targets.length === 0) return;
    setIsBatchDownloading(true);
    for (let i = 0; i < targets.length; i++) {
      const v = targets[i];
      setDownloadingId(v.id);
      await onDownloadVideo(v);
      if (i < targets.length - 1) {
        // Stagger browser downloads by 1.8s
        await new Promise((r) => setTimeout(r, 1800));
      }
    }
    setDownloadingId(null);
    setIsBatchDownloading(false);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s} min`;
  };

  const toggleSelectAll = () => {
    if (selectedVideoIds.size === filteredVideos.length) {
      setSelectedVideoIds(new Set());
    } else {
      setSelectedVideoIds(new Set(filteredVideos.map((v) => v.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedVideoIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedVideoIds(next);
  };

  const exportLinksAsTxt = () => {
    const content = filteredVideos
      .map((v, i) => `${i + 1}. [${v.section}] ${v.title} => ${v.videoLink}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_enlaces.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsJson = () => {
    const content = JSON.stringify(filteredVideos, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_videos.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAllMarkdown = () => {
    const targets = selectedVideoIds.size > 0
      ? filteredVideos.filter((v) => selectedVideoIds.has(v.id))
      : filteredVideos;

    if (targets.length === 0) return;

    let fullMarkdown = `# Curso: ${courseTitle}\n`;
    if (communityName) fullMarkdown += `**Comunidad:** ${communityName}\n`;
    if (courseDesc) fullMarkdown += `\n${courseDesc}\n`;
    fullMarkdown += `\n*Exportado el ${new Date().toLocaleDateString()} - Total lecciones: ${targets.length}*\n\n---\n\n`;

    targets.forEach((v, idx) => {
      fullMarkdown += `## ${idx + 1}. ${v.title}\n`;
      if (v.section) fullMarkdown += `**Módulo:** ${v.section} | `;
      if (v.videoLink) fullMarkdown += `[Video](${v.videoLink})\n\n`;
      const lessonText = parseTipTapToMarkdown(v.desc);
      if (lessonText) {
        fullMarkdown += `${lessonText}\n\n`;
      }
      if (v.resources && v.resources.length > 0) {
        fullMarkdown += `**Recursos:**\n`;
        v.resources.forEach((r) => {
          fullMarkdown += `- [${r.title || 'Enlace'}](${r.url})\n`;
        });
        fullMarkdown += `\n`;
      }
      fullMarkdown += `---\n\n`;
    });

    const filename = `${courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_todas_las_notas.md`;
    downloadMarkdownFile(filename, fullMarkdown);
  };

  return (
    <div id="course-video-list" className="space-y-6">
      {/* Course Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
              <span>{communityName || 'Skool Classroom'}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> {videos.length} videos detectados
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{courseTitle}</h1>
            {courseDesc && (
              <p className="text-xs text-slate-600 max-w-3xl leading-relaxed whitespace-pre-line">
                {courseDesc}
              </p>
            )}
          </div>

          {onBackToCourses && (
            <button
              onClick={onBackToCourses}
              className="self-start md:self-auto px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
            >
              ← Ver Otros Cursos
            </button>
          )}
        </div>

        {/* Quick Batch Actions */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Seleccionados: {selectedVideoIds.size} de {filteredVideos.length}</span>
            <button
              onClick={toggleSelectAll}
              className="text-indigo-600 hover:text-indigo-800 font-medium underline"
            >
              {selectedVideoIds.size === filteredVideos.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedVideoIds.size > 0 && (
              <button
                type="button"
                onClick={handleBatchDownload}
                disabled={isBatchDownloading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg flex items-center gap-1.5 transition-colors font-semibold shadow-xs"
              >
                <Download className={`w-3.5 h-3.5 ${isBatchDownloading ? 'animate-bounce' : ''}`} />
                <span>
                  {isBatchDownloading
                    ? 'Descargando lote a tu laptop...'
                    : `Descargar ${selectedVideoIds.size} seleccionados (.MP4)`}
                </span>
              </button>
            )}
            <button
              onClick={exportLinksAsTxt}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
            >
              <FileText className="w-3.5 h-3.5" />
              Exportar Lista (.TXT)
            </button>
            <button
              onClick={exportAllMarkdown}
              title="Descargar notas y textos de las lecciones en un solo archivo Markdown"
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              Exportar Notas (.MD)
            </button>
            <button
              onClick={exportAsJson}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors font-medium"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar JSON
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar lección por título o tema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {sections.length > 0 && (
          <div className="relative min-w-[220px]">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none cursor-pointer"
            >
              <option value="all">Todas las Secciones ({sections.length})</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Videos List */}
      <div className="space-y-3">
        {filteredVideos.map((video, idx) => {
          const isDownloading = downloadingId === video.id;
          const isSelected = selectedVideoIds.has(video.id);

          return (
            <div
              key={video.id}
              className={`bg-white rounded-xl border transition-all p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isSelected
                  ? 'border-indigo-400 bg-indigo-50/20 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Left Column: Checkbox, Number, Info */}
              <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectOne(video.id)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-1 sm:mt-0 cursor-pointer"
                />

                <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 uppercase">
                      {video.section || 'General'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        video.provider === 'loom'
                          ? 'bg-amber-100 text-amber-800 font-bold'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {video.provider === 'loom' ? 'Loom (1080p MP4)' : video.provider}
                    </span>
                    {video.durationMs ? (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(video.durationMs)}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="font-semibold text-slate-900 text-sm truncate" title={video.title}>
                    {video.title}
                  </h3>

                  {video.desc && (() => {
                    const cleanText = parseTipTapToMarkdown(video.desc).replace(/[*_#`[\]()>-]/g, '').trim();
                    return cleanText ? (
                      <p className="text-xs text-slate-500 line-clamp-1">{cleanText}</p>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {/* Notes button */}
                <button
                  type="button"
                  onClick={() => onOpenNotes && onOpenNotes(video)}
                  title="Ver texto y notas de la lección (.md)"
                  className="px-2.5 py-2 text-xs font-medium text-slate-700 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5 border border-transparent hover:border-indigo-200"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden lg:inline">Notas (.md)</span>
                </button>

                {/* Copy link */}
                <button
                  type="button"
                  onClick={() => handleCopyLink(video)}
                  title="Copiar vínculo directo"
                  className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  {copiedId === video.id ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>

                {/* Preview */}
                <button
                  type="button"
                  onClick={() => onPreviewVideo(video)}
                  title="Previsualizar video"
                  className="px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600" />
                  <span className="hidden md:inline">Ver</span>
                </button>

                {/* Download MP4 button or Active Task */}
                {(() => {
                  const activeTask = downloadTasks.find(
                    (t) => t.videoId === video.id && (t.status === 'downloading' || t.status === 'resolving')
                  );
                  const completedTask = downloadTasks.find(
                    (t) => t.videoId === video.id && t.status === 'completed'
                  );

                  if (activeTask) {
                    return (
                      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={onOpenDownloadManager}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 flex items-center gap-1.5 hover:text-emerald-900"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>
                            {activeTask.status === 'resolving'
                              ? 'Resolviendo...'
                              : `${activeTask.progress.toFixed(0)}%`}
                          </span>
                        </button>
                        {onCancelDownload && (
                          <button
                            type="button"
                            onClick={() => onCancelDownload(activeTask.id)}
                            className="p-1 text-rose-600 hover:bg-rose-100 rounded"
                            title="Detener descarga"
                          >
                            <StopCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (completedTask) {
                    return (
                      <button
                        type="button"
                        onClick={onOpenDownloadManager}
                        className="px-3 py-2 text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs border border-emerald-300"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Listo</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      type="button"
                      onClick={() => handleDownload(video)}
                      disabled={isDownloading}
                      className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white rounded-lg transition-colors flex items-center gap-2 shadow-xs"
                    >
                      <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                      <span>{isDownloading ? 'Iniciando...' : 'Descargar .MP4'}</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {filteredVideos.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
          No se encontraron videos en la sección seleccionada o con ese término de búsqueda.
        </div>
      )}
    </div>
  );
};
