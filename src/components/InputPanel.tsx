import React, { useState } from 'react';
import { Link2, Code2, Film, Sparkles, ArrowRight, Loader2, AlertCircle, HelpCircle } from 'lucide-react';

interface InputPanelProps {
  onScrapeUrl: (url: string) => Promise<void>;
  onScrapeHtml: (html: string) => Promise<void>;
  onDirectVideo: (link: string) => Promise<void>;
  isLoading: boolean;
  onOpenGuide: () => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  onScrapeUrl,
  onScrapeHtml,
  onDirectVideo,
  isLoading,
  onOpenGuide,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'html' | 'direct'>('url');
  const [urlInput, setUrlInput] = useState('https://www.skool.com/nuclear/classroom/75e6bd71?md=786f65c7d5984a7e9715ba74418b7190');
  const [htmlInput, setHtmlInput] = useState('');
  const [directVideoInput, setDirectVideoInput] = useState('');

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onScrapeUrl(urlInput.trim());
    }
  };

  const handleHtmlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (htmlInput.trim()) {
      onScrapeHtml(htmlInput.trim());
    }
  };

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (directVideoInput.trim()) {
      onDirectVideo(directVideoInput.trim());
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50/70">
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex-1 py-3.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
            activeTab === 'url'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>Por Enlace URL (Recomendado)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('html')}
          className={`flex-1 py-3.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
            activeTab === 'html'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>Por Código Fuente HTML (Anti-Bloqueo)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('direct')}
          className={`flex-1 py-3.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
            activeTab === 'direct'
              ? 'border-indigo-600 text-indigo-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Enlace de Video Directo</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-6">
        {activeTab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Enlace de Classroom, Curso o Lección en Skool:
              </label>
              <button
                type="button"
                onClick={onOpenGuide}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                ¿Qué debo ingresar?
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Ejemplo: https://www.skool.com/pablo-martinez-garcia/classroom/5277a67e"
                className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Escaneando...</span>
                  </>
                ) : (
                  <>
                    <span>Escanear y Extraer</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Quick preset chips */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Accesos rápidos en Nuclear:</span>
              <button
                type="button"
                onClick={() => {
                  const u = 'https://www.skool.com/nuclear/classroom/75e6bd71?md=786f65c7d5984a7e9715ba74418b7190';
                  setUrlInput(u);
                  onScrapeUrl(u);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors font-medium"
              >
                🤖 Agentes de Whatsapp
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = 'https://www.skool.com/nuclear/classroom/93e501fc';
                  setUrlInput(u);
                  onScrapeUrl(u);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-medium"
              >
                ⚛️ Empieza aquí (5 videos)
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = 'https://www.skool.com/nuclear/classroom/b975e00e';
                  setUrlInput(u);
                  onScrapeUrl(u);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                🚀 Proyectos reales
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = 'https://www.skool.com/nuclear/classroom';
                  setUrlInput(u);
                  onScrapeUrl(u);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                📁 Todo el Classroom Nuclear
              </button>
            </div>
          </form>
        )}

        {activeTab === 'html' && (
          <form onSubmit={handleHtmlSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block">
                  Pegar Código Fuente HTML de la página:
                </label>
                <p className="text-xs text-slate-500">
                  Abre la clase en Skool en tu navegador, presiona <kbd className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">Ctrl + U</kbd>, copia todo (<kbd className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">Ctrl + A</kbd>) y pégalo abajo:
                </p>
              </div>
            </div>

            <textarea
              required
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              placeholder="Pega aquí el código HTML completo (&lt;!DOCTYPE html&gt;&lt;html&gt;...&lt;script id=&quot;__NEXT_DATA__&quot;...&lt;/html&gt;)"
              rows={6}
              className="w-full font-mono text-xs p-3 bg-slate-50 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading || !htmlInput.trim()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analizando HTML...</span>
                  </>
                ) : (
                  <>
                    <span>Extraer Videos desde HTML</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'direct' && (
          <form onSubmit={handleDirectSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1">
                Vínculo directo de Vimeo, Mux, YouTube o MP4:
              </label>
              <p className="text-xs text-slate-500">
                Ingresa una URL individual de video para descargar directamente en MP4 alta resolución.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="url"
                required
                value={directVideoInput}
                onChange={(e) => setDirectVideoInput(e.target.value)}
                placeholder="Ejemplo: https://vimeo.com/1094733924 o https://stream.mux.com/..."
                className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resolviendo...</span>
                  </>
                ) : (
                  <>
                    <span>Procesar Video</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
