import React, { useState, useEffect } from 'react';
import { SkoolVideo, CookieItem } from '../types.ts';
import {
  buildLessonMarkdown,
  downloadMarkdownFile,
  parseTipTapToMarkdown,
} from '../utils/markdownExporter.ts';
import {
  FileText,
  Download,
  Copy,
  Check,
  X,
  Sparkles,
  ExternalLink,
  BookOpen,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface LessonNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: SkoolVideo | null;
  courseTitle?: string;
  courseId?: string;
  communityName?: string;
  userCookies?: CookieItem[];
  onUpdateVideoDesc?: (videoId: string, desc: string, resources?: any[]) => void;
}

export const LessonNotesModal: React.FC<LessonNotesModalProps> = ({
  isOpen,
  onClose,
  video,
  courseTitle,
  courseId,
  communityName,
  userCookies,
  onUpdateVideoDesc,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewRaw, setViewRaw] = useState(false);
  const [isLoadingDesc, setIsLoadingDesc] = useState(false);
  const [localDesc, setLocalDesc] = useState<string>('');
  const [localResources, setLocalResources] = useState<any[]>([]);

  // Sync state when video changes
  useEffect(() => {
    if (!video) return;
    setLocalDesc(video.desc || '');
    setLocalResources(video.resources || []);
    setViewRaw(false);
    setCopied(false);

    // If description is empty, attempt to fetch it automatically on demand
    const isDescMissing = !video.desc || video.desc.trim().length === 0;
    if (isDescMissing && communityName && courseId) {
      setIsLoadingDesc(true);
      fetch('/api/lesson-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityName,
          courseId,
          lessonId: video.id,
          cookies: userCookies,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.desc) {
            setLocalDesc(data.desc);
            if (data.resources && data.resources.length > 0) {
              setLocalResources(data.resources);
            }
            onUpdateVideoDesc?.(video.id, data.desc, data.resources);
          }
        })
        .catch((err) => console.warn('Error cargando notas de lección:', err))
        .finally(() => setIsLoadingDesc(false));
    }
  }, [video?.id, video?.desc, communityName, courseId]);

  // Handle escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !video) return null;

  const effectiveVideo: SkoolVideo = {
    ...video,
    desc: localDesc,
    resources: localResources.length > 0 ? localResources : video.resources,
  };

  const markdownContent = buildLessonMarkdown(effectiveVideo, courseTitle, communityName);
  const cleanBody = parseTipTapToMarkdown(localDesc);

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `${video.title || 'leccion'}.md`;
    downloadMarkdownFile(filename, markdownContent);
  };

  const handleRefreshDesc = () => {
    if (!communityName || !courseId) return;
    setIsLoadingDesc(true);
    fetch('/api/lesson-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        communityName,
        courseId,
        lessonId: video.id,
        cookies: userCookies,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.desc) {
          setLocalDesc(data.desc);
          if (data.resources) setLocalResources(data.resources);
          onUpdateVideoDesc?.(video.id, data.desc, data.resources);
        }
      })
      .catch((err) => console.warn('Error refrescando notas:', err))
      .finally(() => setIsLoadingDesc(false));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with guaranteed spacing and prominent Close button */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50/90 gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-sm font-bold text-slate-900 truncate"
                title={`Notas y Guía: ${video.title}`}
              >
                Notas: {video.title}
              </h2>
              <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                {video.section && <span>{video.section} •</span>}
                <span>Markdown (.md)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setViewRaw(!viewRaw)}
              title={viewRaw ? 'Ver texto con formato' : 'Ver Markdown crudo'}
              className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100/80 rounded-lg transition-colors font-medium shadow-2xs"
            >
              {viewRaw ? 'Ver Formato' : 'Ver Código .MD'}
            </button>

            <button
              onClick={handleCopy}
              className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100/80 rounded-lg transition-colors flex items-center gap-1 font-medium shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar .MD</span>
              <span className="sm:hidden">.MD</span>
            </button>

            {/* Guaranteed visible X Close button with high contrast */}
            <div className="h-5 w-px bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={onClose}
              title="Cerrar ventana (Esc)"
              aria-label="Cerrar modal"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {isLoadingDesc ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">
                Extrayendo texto y apuntes de la lección desde Skool...
              </span>
              <span className="text-xs text-slate-400">
                Sincronizando notas en formato Markdown (.md)
              </span>
            </div>
          ) : viewRaw ? (
            <pre className="p-4 bg-slate-900 text-slate-100 text-xs font-mono rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
              {markdownContent}
            </pre>
          ) : (
            <div className="space-y-4 text-slate-800 text-sm leading-relaxed">
              {cleanBody ? (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-3 mb-4">
                    <h1 className="text-xl font-bold text-slate-900">{video.title}</h1>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                      {communityName && (
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                          {communityName}
                        </span>
                      )}
                      {courseTitle && (
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium border border-indigo-100/60">
                          {courseTitle}
                        </span>
                      )}
                      {video.section && (
                        <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200/60">
                          {video.section}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="prose prose-slate max-w-none prose-sm leading-relaxed">
                    <ReactMarkdown>{cleanBody}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="py-12 px-4 text-center text-slate-500 text-xs bg-slate-50/70 rounded-xl border border-dashed border-slate-200 space-y-3">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-medium text-slate-600">
                    No se detectó texto explicativo en esta lección.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    Si sabes que esta lección tiene texto en Skool, pulsa el botón de abajo para forzar la sincronización en directo.
                  </p>
                  <button
                    onClick={handleRefreshDesc}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar lectura de texto</span>
                  </button>
                </div>
              )}

              {/* Resources & links */}
              {effectiveVideo.resources && effectiveVideo.resources.length > 0 && (
                <div className="pt-4 border-t border-slate-200/80 space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Recursos y Enlaces Adjuntos ({effectiveVideo.resources.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {effectiveVideo.resources.map((res, i) => (
                      <a
                        key={i}
                        href={res.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-xs flex items-center justify-between group transition-colors shadow-2xs"
                      >
                        <span className="font-medium text-slate-800 group-hover:text-indigo-700 truncate mr-2">
                          {res.title || 'Enlace adjunto'}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">Notas sincronizadas con el classroom de Skool</span>
          </div>
          <button
            onClick={handleDownload}
            className="text-emerald-700 font-semibold hover:text-emerald-800 transition-colors flex items-center gap-1.5 self-end sm:self-center"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="truncate max-w-[220px]">Guardar {video.title}.md</span>
          </button>
        </div>
      </div>
    </div>
  );
};
