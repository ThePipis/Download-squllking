import React from 'react';
import { X, HelpCircle, CheckCircle2, ArrowRight, ShieldCheck, Download, Code2, Link2, Sparkles } from 'lucide-react';

interface HowToGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToGuideModal: React.FC<HowToGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="guide-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4"
    >
      <div
        id="guide-modal-content"
        className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">
                Guía de Uso: ¿Qué debes ingresar como input?
              </h3>
              <p className="text-xs text-slate-500">
                Instrucciones para extraer y descargar cualquier video de Skool Classroom en MP4
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6 text-sm text-slate-600">
          {/* Section 1: Inputs required */}
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">1</span>
              ¿Qué debes ingresar como input?
            </h4>
            <p className="leading-relaxed">
              Para descargar los videos no necesitas adivinar el enlace interno. Solo necesitas proporcionar uno de los siguientes:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-700 font-medium text-xs uppercase tracking-wider">
                  <Link2 className="w-4 h-4" /> Enlace URL de tu Navegador
                </div>
                <p className="text-xs text-slate-600">
                  Copia la URL de la barra de direcciones de tu navegador donde tienes abierto Skool:
                </p>
                <div className="p-2 bg-slate-900 text-slate-200 rounded font-mono text-xs break-all">
                  https://www.skool.com/.../classroom/5277a67e
                </div>
                <p className="text-[11px] text-slate-500">
                  Puede ser el Classroom completo, un curso, o una lección específica con <code>?md=...</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-700 font-medium text-xs uppercase tracking-wider">
                  <Code2 className="w-4 h-4" /> Código Fuente HTML (Respaldo)
                </div>
                <p className="text-xs text-slate-600">
                  Si AWS WAF / Cloudflare bloquea la conexión del servidor:
                </p>
                <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1">
                  <li>En Skool presiona <kbd className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">Ctrl + U</kbd></li>
                  <li>Selecciona todo (<kbd className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">Ctrl + A</kbd>)</li>
                  <li>Pégalo en la pestaña &quot;Código Fuente&quot;</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Section 2: Why Skool disables right click */}
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
            <h5 className="font-semibold text-amber-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              ¿Por qué está deshabilitado copiar el enlace en Skool?
            </h5>
            <p className="text-xs text-amber-900 leading-relaxed">
              Skool coloca capas de interfaz transparentes sobre sus reproductores y utiliza servicios como <strong>Vimeo Pro</strong>, <strong>Mux HLS</strong> y <strong>Loom</strong> con menús de clic derecho desactivados. 
              Nuestra aplicación analiza directamente los metadatos internos estructurados (<code className="font-mono bg-amber-100 px-1 rounded">__NEXT_DATA__</code>) donde se almacenan los identificadores reales de cada lección, permitiéndote extraer la biblioteca completa sin restricciones.
            </p>
          </div>

          {/* Section 3: How MP4 high quality is generated */}
          <div className="space-y-3">
            <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">2</span>
              ¿Cómo se obtienen y descargan en formato .MP4 en la mejor calidad?
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>Resolución del flujo HLS en 1080p:</strong> Para videos de Vimeo o Mux, el servidor solicita el manifiesto de reproducción de máxima tasa de bits disponible.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>Ensamblaje nativo sin pérdida (FFmpeg Stream):</strong> El motor FFmpeg integrado remuxea los fragmentos de video y audio en un contenedor <code className="font-mono bg-slate-100 px-1 rounded">.mp4</code> estándar con <code className="font-mono text-[11px]">-c copy</code> (sin recodificación, manteniendo el 100% de la nitidez original).
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>Descarga con 1 clic:</strong> Cada lección tiene un botón verde <strong>&quot;Descargar .MP4&quot;</strong>. Al hacer clic, tu navegador iniciará la descarga directa con el nombre del módulo ya formateado.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Cookies already loaded */}
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
            <div className="text-xs text-indigo-900">
              <strong>Tus cookies de autenticación ya están pre-cargadas:</strong> Incluyen <code className="font-mono text-[11px]">auth_token</code>, <code className="font-mono text-[11px]">aws-waf-token</code> y <code className="font-mono text-[11px]">client_id</code> para permitir la extracción inmediata de los cursos de tu cuenta.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
          >
            Entendido, empezar
          </button>
        </div>
      </div>
    </div>
  );
};
