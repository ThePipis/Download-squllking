import React, { useState } from 'react';
import { CookieItem } from '../types.ts';
import { X, Check, Copy, RefreshCw, Key, ShieldCheck, AlertTriangle } from 'lucide-react';
import { INITIAL_COOKIES } from '../data/defaultCookies.ts';

interface CookieManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cookies: CookieItem[];
  onSaveCookies: (cookies: CookieItem[]) => void;
}

export const CookieManagerModal: React.FC<CookieManagerModalProps> = ({
  isOpen,
  onClose,
  cookies,
  onSaveCookies,
}) => {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(cookies, null, 2));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetToDefault = () => {
    setJsonInput(JSON.stringify(INITIAL_COOKIES, null, 2));
    onSaveCookies(INITIAL_COOKIES);
    setError(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        throw new Error('El formato debe ser una lista de cookies (Array JSON).');
      }
      onSaveCookies(parsed);
      setError(null);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'JSON inválido');
    }
  };

  const authToken = cookies.find((c) => c.name === 'auth_token')?.value;
  const wafToken = cookies.find((c) => c.name === 'aws-waf-token')?.value;

  return (
    <div
      id="cookie-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4"
    >
      <div
        id="cookie-modal-content"
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">
                Gestor de Cookies de Autenticación
              </h3>
              <p className="text-xs text-slate-500">
                {cookies.length} cookies configuradas para www.skool.com
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

        {/* Quick status summary */}
        <div className="px-6 py-3 bg-emerald-50/70 border-b border-emerald-100 flex flex-wrap gap-4 text-xs text-emerald-900">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>auth_token: {authToken ? '✓ Presente' : '✗ Falta'}</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>aws-waf-token: {wafToken ? '✓ Presente' : '✗ Falta'}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <p className="text-sm text-slate-600">
            Tus cookies proporcionadas vienen pre-configuradas para autenticar las peticiones al classroom. Si en algún momento caduca tu sesión en Skool, puedes exportar nuevas cookies desde la extensión de tu navegador y pegarlas aquí:
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>¡Cookies guardadas correctamente!</span>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                JSON de Cookies
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado' : 'Copiar JSON'}
                </button>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-xs flex items-center gap-1 text-amber-700 hover:text-amber-800 px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restaurar Originales
                </button>
              </div>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={12}
              className="w-full font-mono text-xs p-3 bg-slate-900 text-slate-200 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 selection:bg-indigo-600"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
          >
            Guardar y Aplicar Cookies
          </button>
        </div>
      </div>
    </div>
  );
};
