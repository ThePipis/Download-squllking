import React from 'react';
import { SkoolVideo } from '../types.ts';
import { X, ExternalLink, Download, Clock, Folder } from 'lucide-react';

interface VideoPreviewModalProps {
  video: SkoolVideo | null;
  onClose: () => void;
  onDownload: (video: SkoolVideo) => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({ video, onClose, onDownload }) => {
  if (!video) return null;

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s} min`;
  };

  const renderPlayer = () => {
    const link = video.videoLink;

    if (video.provider === 'vimeo') {
      const match = link.match(/(?:vimeo\.com\/|video\/)(\d+)/);
      const id = match ? match[1] : '';
      return (
        <iframe
          src={`https://player.vimeo.com/video/${id}?autoplay=1&color=6366f1`}
          className="w-full h-full border-0 rounded-lg"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={video.title}
        />
      );
    }

    if (video.provider === 'loom') {
      const match = link.match(/(?:loom\.com\/(?:share|embed)\/)([a-zA-Z0-9_-]+)/);
      const id = match ? match[1] : '';
      return (
        <iframe
          src={`https://www.loom.com/embed/${id}?autoplay=1&hide_owner=true&hide_share=true`}
          className="w-full h-full border-0 rounded-lg"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={video.title}
        />
      );
    }

    if (video.provider === 'youtube') {
      const match = link.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      const id = match ? match[1] : '';
      return (
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          className="w-full h-full border-0 rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={video.title}
        />
      );
    }

    if (video.provider === 'direct') {
      return (
        <video src={link} controls autoPlay className="w-full h-full rounded-lg bg-black object-contain">
          Tu navegador no soporta reproducción directa de video.
        </video>
      );
    }

    // Default fallback player / external preview
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-300">
        <p className="text-sm mb-4">
          Este video está alojado en <span className="font-semibold text-white uppercase">{video.provider}</span>.
        </p>
        <a
          href={video.videoLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Abrir en nueva pestaña
        </a>
      </div>
    );
  };

  return (
    <div
      id="video-preview-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
    >
      <div
        id="video-preview-content"
        className="relative w-full max-w-4xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex-1 pr-4 min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-400 block truncate">
              {video.section}
            </span>
            <h3 className="font-semibold text-white text-base truncate">{video.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Canvas */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {renderPlayer()}
        </div>

        {/* Details & Actions Footer */}
        <div className="p-5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 uppercase font-medium">
              {video.provider}
            </span>
            {video.section && (
              <span className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-slate-500" />
                {video.section}
              </span>
            )}
            {video.durationMs ? (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {formatDuration(video.durationMs)}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <a
              href={video.videoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Original
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(video.videoLink);
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Copiar Enlace
            </button>
            <button
              onClick={() => onDownload(video)}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              Descargar .MP4
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
