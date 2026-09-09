import React from 'react';
import { ZipBatchProgress } from '../types.ts';
import { FolderArchive, X, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface ZipBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: ZipBatchProgress | null;
  onCancel: () => void;
}

export const ZipBatchModal: React.FC<ZipBatchModalProps> = ({
  isOpen,
  onClose,
  progress,
  onCancel,
}) => {
  if (!isOpen || !progress) return null;

  const isCompleted = progress.status === 'completed';
  const isError = progress.status === 'error';
  const isCancelled = progress.status === 'cancelled';
  const isWorking = !isCompleted && !isError && !isCancelled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isCompleted
                  ? '¡Empaquetado Completado!'
                  : isError
                  ? 'Error en la Descarga'
                  : 'Descargando Classroom (.ZIP)'}
              </h2>
              <p className="text-xs text-slate-500">
                {isCompleted
                  ? 'El archivo ZIP estructurado ya se guardó en tu equipo'
                  : 'Organizando videos, notas y recursos en carpetas'}
              </p>
            </div>
          </div>

          {(isCompleted || isError || isCancelled) && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Progreso Total</span>
              <span className="font-mono font-bold text-indigo-600">
                {progress.overallPercent}%
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isError
                    ? 'bg-rose-500'
                    : 'bg-linear-to-r from-indigo-500 to-emerald-500'
                }`}
                style={{ width: `${Math.max(5, progress.overallPercent)}%` }}
              />
            </div>
          </div>

          {/* Status Message Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-start gap-2.5">
              {isWorking && (
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin mt-0.5 shrink-0" />
              )}
              {isCompleted && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              )}
              {isError && (
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              )}
              <div className="text-xs space-y-1">
                <p className="font-medium text-slate-800 leading-relaxed">
                  {progress.message}
                </p>
                {progress.currentCourseTitle && (
                  <p className="text-[11px] text-slate-500">
                    <span className="font-semibold">Curso actual:</span> {progress.currentCourseTitle}
                    {progress.totalCourses > 1 &&
                      ` (${progress.currentCourseIndex} de ${progress.totalCourses})`}
                  </p>
                )}
                {progress.currentLessonTitle && isWorking && (
                  <p className="text-[11px] text-slate-500">
                    <span className="font-semibold">Lección:</span> {progress.currentLessonTitle}
                    {progress.totalLessons > 1 &&
                      ` (${progress.currentLessonIndex} de ${progress.totalLessons})`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="text-[11px] text-slate-500 space-y-1.5 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Estructura de salida:</span>
            </div>
            <p className="text-slate-500 pl-5">
              • Carpetas ordenadas y numeradas secuencialmente (01, 02, 03...).
              <br />
              • Cada lección incluye su video (.mp4) y sus apuntes formateados (.md).
              <br />
              • Lecciones con solo texto/código conservan todo su contenido íntegro.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {isWorking ? (
            <>
              <span className="text-xs text-slate-400">Por favor, mantén esta pestaña abierta</span>
              <button
                onClick={onCancel}
                className="px-4 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
              >
                Cancelar Descarga
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-xs"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
