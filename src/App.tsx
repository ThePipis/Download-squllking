import React, { useState, useEffect } from 'react';
import { INITIAL_COOKIES } from './data/defaultCookies.ts';
import { CookieItem, ScrapeResult, SkoolVideo, SkoolCourse, DownloadTask, ZipBatchProgress } from './types.ts';
import { InputPanel } from './components/InputPanel.tsx';
import { CourseVideoList } from './components/CourseVideoList.tsx';
import { ClassroomExplorer } from './components/ClassroomExplorer.tsx';
import { CookieManagerModal } from './components/CookieManagerModal.tsx';
import { HowToGuideModal } from './components/HowToGuideModal.tsx';
import { VideoPreviewModal } from './components/VideoPreviewModal.tsx';
import { DownloadManager } from './components/DownloadManager.tsx';
import { LessonNotesModal } from './components/LessonNotesModal.tsx';
import { ZipBatchModal } from './components/ZipBatchModal.tsx';
import { downloadVideoWithProgress } from './utils/downloadEngine.ts';
import { buildLessonMarkdown, downloadMarkdownFile } from './utils/markdownExporter.ts';
import { downloadCommunityClassroomZip, downloadSingleCourseZip } from './utils/zipPacker.ts';
import {
  ShieldCheck,
  Key,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Video,
  Download,
  Loader2,
  ExternalLink,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  const [cookies, setCookies] = useState<CookieItem[]>(() => {
    try {
      const saved = localStorage.getItem('skool_cookies');
      if (saved) {
        const parsed: CookieItem[] = JSON.parse(saved);
        const currentWaf = INITIAL_COOKIES.find((ic) => ic.name === 'aws-waf-token')?.value;
        const savedWaf = parsed.find((c) => c.name === 'aws-waf-token')?.value;
        if (savedWaf === currentWaf) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    try {
      localStorage.setItem('skool_cookies', JSON.stringify(INITIAL_COOKIES));
    } catch {}
    return INITIAL_COOKIES;
  });

  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<SkoolVideo | null>(null);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Download Manager State (matches MAX Video Downloader extension logic)
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [isDownloadManagerOpen, setIsDownloadManagerOpen] = useState(false);
  const [autoDownloadMarkdown, setAutoDownloadMarkdown] = useState(true);

  // Lesson Notes modal state
  const [selectedNotesVideo, setSelectedNotesVideo] = useState<SkoolVideo | null>(null);

  // ZIP Batch Download state
  const [zipProgress, setZipProgress] = useState<ZipBatchProgress | null>(null);
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [zipAbortController, setZipAbortController] = useState<AbortController | null>(null);

  // Auto-save cookies to localStorage
  const handleSaveCookies = (newCookies: CookieItem[]) => {
    setCookies(newCookies);
    try {
      localStorage.setItem('skool_cookies', JSON.stringify(newCookies));
    } catch {
      // ignore
    }
    showToast('Cookies actualizadas correctamente');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const normalizeCourseVideos = (videos: SkoolVideo[]): SkoolVideo[] => {
    const sectionList: string[] = [];
    videos.forEach((v) => {
      const sec = v.section || 'General';
      if (!sectionList.includes(sec)) {
        sectionList.push(sec);
      }
    });

    const sectionLessonTotals = new Map<string, number>();
    videos.forEach((v) => {
      const sec = v.section || 'General';
      sectionLessonTotals.set(sec, (sectionLessonTotals.get(sec) || 0) + 1);
    });

    const sectionCurrentIndices = new Map<string, number>();
    return videos.map((v, globalIdx) => {
      const sec = v.section || 'General';
      const currentLessonInSec = (sectionCurrentIndices.get(sec) || 0) + 1;
      sectionCurrentIndices.set(sec, currentLessonInSec);

      return {
        ...v,
        section: sec,
        sectionOrder: v.sectionOrder ?? (sectionList.indexOf(sec) + 1),
        totalSectionsInCourse: v.totalSectionsInCourse ?? sectionList.length,
        lessonOrderInSection: v.lessonOrderInSection ?? currentLessonInSec,
        totalLessonsInSection: v.totalLessonsInSection ?? (sectionLessonTotals.get(sec) || 1),
        orderIndex: v.orderIndex ?? (globalIdx + 1),
      };
    });
  };

  // Perform scrape by URL
  const handleScrapeUrl = async (url: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, cookies }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al obtener datos de Skool');
      }

      if (data.videos && Array.isArray(data.videos)) {
        data.videos = normalizeCourseVideos(data.videos);
      }

      setScrapeResult(data);
      if (data.type === 'course') {
        showToast(`¡Se detectaron ${data.totalVideos || 0} videos listos para descargar!`);
      } else if (data.type === 'classroom') {
        showToast(`Classroom cargado con ${data.totalCourses || 0} cursos.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  // Perform scrape by pasted HTML
  const handleScrapeHtml = async (html: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: html, cookies }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al analizar el código HTML');
      }

      if (data.videos && Array.isArray(data.videos)) {
        data.videos = normalizeCourseVideos(data.videos);
      }

      setScrapeResult(data);
      if (data.type === 'course') {
        showToast(`¡Éxito! Se extrajeron ${data.totalVideos || 0} videos del HTML.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el HTML');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle selecting a course from classroom explorer
  const handleSelectCourse = async (course: SkoolCourse) => {
    if (!course.url) return;
    setIsLoadingCourse(true);
    try {
      await handleScrapeUrl(course.url);
    } finally {
      setIsLoadingCourse(false);
    }
  };

  // Handle direct video link
  const handleDirectVideo = async (link: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/resolve-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoLink: link, cookies }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo resolver el enlace de video');
      }

      // Create a single-video result
      const singleVideo: SkoolVideo = {
        id: 'direct-1',
        title: data.title || 'Video Individual',
        section: 'Video Directo',
        videoLink: link,
        provider: data.provider,
        thumbnail: data.thumbnail || '',
        durationMs: (data.duration || 0) * 1000,
        hasAccess: true,
        orderIndex: 1,
      };

      setScrapeResult({
        success: true,
        type: 'course',
        title: data.title || 'Video Directo',
        videos: [singleVideo],
        totalVideos: 1,
      });

      showToast('Video individual analizado y listo para descargar.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Download video directly using the MAX Video Downloader CDN engine
  const handleUpdateVideoDesc = (videoId: string, desc: string, resources?: any[]) => {
    setScrapeResult((prev) => {
      if (!prev || !prev.videos) return prev;
      return {
        ...prev,
        videos: prev.videos.map((v) =>
          v.id === videoId ? { ...v, desc, resources: resources || v.resources } : v
        ),
      };
    });
    setSelectedNotesVideo((prev) =>
      prev && prev.id === videoId ? { ...prev, desc, resources: resources || prev.resources } : prev
    );
  };

  const handleDownloadVideo = async (video: SkoolVideo) => {
    let currentVideo = video;

    // If description is missing and autoDownloadMarkdown is enabled, ensure we fetch the notes first!
    if (
      (!video.desc || video.desc.trim().length === 0) &&
      scrapeResult?.communityName &&
      (scrapeResult?.currentCourse?.name || scrapeResult?.currentCourse?.id)
    ) {
      try {
        const detailRes = await fetch('/api/lesson-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            communityName: scrapeResult.communityName,
            courseId: scrapeResult.currentCourse?.name || scrapeResult.currentCourse?.id,
            lessonId: video.id,
            cookies,
          }),
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          if (detailData.success && detailData.desc) {
            currentVideo = {
              ...video,
              desc: detailData.desc,
              resources: detailData.resources || video.resources,
            };
            handleUpdateVideoDesc(video.id, detailData.desc, detailData.resources);
          }
        }
      } catch (err) {
        console.warn('Could not pre-fetch lesson details:', err);
      }
    }

    const taskId = `${video.id}-${Date.now()}`;
    const abortController = new AbortController();

    const markdownText = buildLessonMarkdown(
      currentVideo,
      scrapeResult?.currentCourse?.title || scrapeResult?.title,
      scrapeResult?.communityName
    );

    const newTask: DownloadTask = {
      id: taskId,
      videoId: video.id,
      title: video.title || 'Video sin título',
      provider: video.provider,
      thumbnail: video.thumbnail,
      status: 'resolving',
      progress: 0,
      receivedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      markdownContent: markdownText,
      markdownDownloaded: false,
      startedAt: Date.now(),
      abortController,
    };

    setDownloadTasks((prev) => [newTask, ...prev.filter((t) => t.videoId !== video.id)]);
    setIsDownloadManagerOpen(true);
    showToast(`Iniciando descarga de "${video.title}"...`);

    try {
      const result = await downloadVideoWithProgress(
        video,
        cookies,
        (update) => {
          setDownloadTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, ...update } : t))
          );
        },
        abortController.signal
      );

      if (result.blob) {
        const blobUrl = URL.createObjectURL(result.blob);
        setDownloadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  blobUrl,
                  status: 'completed',
                  completedAt: Date.now(),
                  markdownDownloaded: autoDownloadMarkdown,
                }
              : t
          )
        );

        // 1. Save video MP4 file locally to user's downloads folder
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = blobUrl;
        downloadAnchor.download = result.filename;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();

        setTimeout(() => {
          if (document.body.contains(downloadAnchor)) {
            document.body.removeChild(downloadAnchor);
          }
        }, 5000);

        // 2. If autoDownloadMarkdown is enabled, also download accompanying .md file!
        if (autoDownloadMarkdown && markdownText) {
          setTimeout(() => {
            const baseTitle = result.filename.replace(/\.mp4$/i, '');
            downloadMarkdownFile(`${baseTitle}.md`, markdownText);
          }, 800);
        }

        showToast(
          autoDownloadMarkdown
            ? `¡Video (.mp4) y Notas (.md) descargados: "${video.title}"!`
            : `¡Video descargado exitosamente: "${result.filename}"!`
        );
      }
    } catch (err: any) {
      if (abortController.signal.aborted) {
        setDownloadTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: 'cancelled' } : t))
        );
        showToast('Descarga detenida por el usuario.');
      } else {
        setDownloadTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'error', error: err.message || 'Error en la descarga' }
              : t
          )
        );
        setErrorMessage(`Error al descargar video: ${err.message}`);
      }
    }
  };

  const handleCancelTask = (taskId: string) => {
    setDownloadTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          t.abortController?.abort();
          return { ...t, status: 'cancelled' };
        }
        return t;
      })
    );
  };

  const handleRetryTask = (task: DownloadTask) => {
    const video = scrapeResult?.videos?.find((v) => v.id === task.videoId);
    if (video) {
      handleDownloadVideo(video);
    }
  };

  const handleClearHistory = () => {
    setDownloadTasks((prev) =>
      prev.filter((t) => t.status === 'downloading' || t.status === 'resolving')
    );
  };

  const handleRemoveTask = (taskId: string) => {
    setDownloadTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // ZIP Batch Download handlers
  const handleDownloadCommunityCoursesZip = async (selectedCourses: SkoolCourse[]) => {
    if (selectedCourses.length === 0) return;
    const controller = new AbortController();
    setZipAbortController(controller);
    setIsZipModalOpen(true);

    try {
      await downloadCommunityClassroomZip({
        communityName: scrapeResult?.communityName || 'skool_community',
        courses: selectedCourses,
        cookies,
        includeVideos: true,
        includeMarkdown: true,
        includeImages: true,
        onProgress: (progress) => {
          setZipProgress({ ...progress });
        },
        signal: controller.signal,
      });
    } catch (err: any) {
      if (controller.signal.aborted) {
        showToast('Empaquetado ZIP cancelado');
      } else {
        setErrorMessage(`Error en descarga por lotes: ${err.message}`);
      }
    }
  };

  const handleDownloadSingleCourseZip = async (selectedVideos?: SkoolVideo[]) => {
    const courseTitle = scrapeResult?.currentCourse?.title || scrapeResult?.title || 'Curso';
    const videosToDownload =
      selectedVideos && selectedVideos.length > 0
        ? selectedVideos
        : (scrapeResult?.videos || []);

    if (videosToDownload.length === 0) {
      showToast('No hay lecciones para descargar');
      return;
    }

    const controller = new AbortController();
    setZipAbortController(controller);
    setIsZipModalOpen(true);

    try {
      await downloadSingleCourseZip({
        courseTitle,
        communityName: scrapeResult?.communityName || 'skool',
        videos: videosToDownload,
        totalCourseLessons: scrapeResult?.videos?.length || videosToDownload.length,
        cookies,
        includeVideos: true,
        includeMarkdown: true,
        includeImages: true,
        onProgress: (progress) => {
          setZipProgress({ ...progress });
        },
        signal: controller.signal,
      });
    } catch (err: any) {
      if (controller.signal.aborted) {
        showToast('Empaquetado ZIP cancelado');
      } else {
        setErrorMessage(`Error en descarga por lotes: ${err.message}`);
      }
    }
  };

  const handleCancelZipBatch = () => {
    if (zipAbortController) {
      zipAbortController.abort();
    }
  };

  // Initial load: automatically load the user's paid Nuclear classroom course!
  useEffect(() => {
    handleScrapeUrl('https://www.skool.com/nuclear/classroom/75e6bd71?md=786f65c7d5984a7e9715ba74418b7190');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation & Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">Skool Video Downloader</span>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/60">
                  MP4 1080p Lossless
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Extractor automático de lecciones para Skool Classroom
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Download Manager Tab Button (matches MAX Video Downloader tab) */}
            <button
              onClick={() => setIsDownloadManagerOpen(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                downloadTasks.some((t) => t.status === 'downloading' || t.status === 'resolving')
                  ? 'bg-emerald-600 text-white shadow-xs animate-pulse'
                  : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <Download className="w-4 h-4 text-emerald-500 group-hover:text-emerald-600" />
              <span>
                Descargas
                {downloadTasks.filter((t) => t.status === 'downloading' || t.status === 'resolving').length > 0 &&
                  ` (${downloadTasks.filter((t) => t.status === 'downloading' || t.status === 'resolving').length})`}
              </span>
            </button>

            <button
              onClick={() => setIsGuideModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1.5 transition-colors border border-indigo-200/50 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">¿Qué ingresar como input?</span>
            </button>

            <button
              onClick={() => setIsCookieModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Key className="w-4 h-4 text-slate-500" />
              <span>Cookies ({cookies.length})</span>
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              title="Refrescar aplicación"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Recargar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Toast / Alert Notifications */}
        {toastMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2 shadow-xs transition-all">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2.5 shadow-xs">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Aviso del extractor:</span>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Input panel: URL, HTML Source, or Direct Link */}
        <InputPanel
          onScrapeUrl={handleScrapeUrl}
          onScrapeHtml={handleScrapeHtml}
          onDirectVideo={handleDirectVideo}
          isLoading={isLoading}
          onOpenGuide={() => setIsGuideModalOpen(true)}
        />

        {/* Scraped Content Display */}
        {isLoading && !scrapeResult && (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <h3 className="font-semibold text-slate-800 text-sm">
              Escaneando la estructura del curso en Skool...
            </h3>
            <p className="text-xs text-slate-500">
              Analizando módulos, identificadores de video y streams en alta calidad.
            </p>
          </div>
        )}

        {scrapeResult?.type === 'classroom' && scrapeResult.courses && (
          <ClassroomExplorer
            courses={scrapeResult.courses}
            communityName={scrapeResult.communityName}
            onSelectCourse={handleSelectCourse}
            isLoadingCourse={isLoadingCourse}
            onDownloadCoursesZip={handleDownloadCommunityCoursesZip}
            isDownloadingZip={isZipModalOpen && zipProgress?.status === 'downloading'}
          />
        )}

        {scrapeResult?.type === 'course' && scrapeResult.videos && (
          <CourseVideoList
            courseTitle={scrapeResult.currentCourse?.title || scrapeResult.title || 'Curso'}
            courseDesc={scrapeResult.currentCourse?.desc}
            communityName={scrapeResult.communityName}
            videos={scrapeResult.videos}
            downloadTasks={downloadTasks}
            onOpenDownloadManager={() => setIsDownloadManagerOpen(true)}
            onCancelDownload={handleCancelTask}
            onPreviewVideo={(v) => setPreviewVideo(v)}
            onDownloadVideo={handleDownloadVideo}
            onOpenNotes={(v) => setSelectedNotesVideo(v)}
            onDownloadCourseZip={handleDownloadSingleCourseZip}
            isDownloadingZip={isZipModalOpen && zipProgress?.status === 'downloading'}
            onBackToCourses={
              scrapeResult.communityName
                ? () => handleScrapeUrl(`https://www.skool.com/${scrapeResult.communityName}/classroom`)
                : undefined
            }
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Motor CDN directo estilo Extensión con exportador de texto y notas Markdown (.md)</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDownloadManagerOpen(true)}
              className="text-emerald-700 font-semibold hover:text-emerald-800 transition-colors"
            >
              Gestor de Descargas
            </button>
            <button
              onClick={() => setIsGuideModalOpen(true)}
              className="hover:text-indigo-600 transition-colors"
            >
              Guía de Parámetros
            </button>
            <button
              onClick={() => setIsCookieModalOpen(true)}
              className="hover:text-indigo-600 transition-colors"
            >
              Configuración de Cookies
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <DownloadManager
        isOpen={isDownloadManagerOpen}
        onClose={() => setIsDownloadManagerOpen(false)}
        tasks={downloadTasks}
        onCancelTask={handleCancelTask}
        onRetryTask={handleRetryTask}
        onClearHistory={handleClearHistory}
        onRemoveTask={handleRemoveTask}
        autoDownloadMarkdown={autoDownloadMarkdown}
        onToggleAutoDownloadMarkdown={(val) => setAutoDownloadMarkdown(val)}
      />

      <LessonNotesModal
        isOpen={!!selectedNotesVideo}
        onClose={() => setSelectedNotesVideo(null)}
        video={selectedNotesVideo}
        courseTitle={scrapeResult?.currentCourse?.title || scrapeResult?.title}
        courseId={scrapeResult?.currentCourse?.name || scrapeResult?.currentCourse?.id}
        communityName={scrapeResult?.communityName}
        userCookies={cookies}
        onUpdateVideoDesc={handleUpdateVideoDesc}
      />

      <CookieManagerModal
        isOpen={isCookieModalOpen}
        onClose={() => setIsCookieModalOpen(false)}
        cookies={cookies}
        onSaveCookies={handleSaveCookies}
      />

      <HowToGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      <VideoPreviewModal
        video={previewVideo}
        onClose={() => setPreviewVideo(null)}
        onDownload={handleDownloadVideo}
      />

      <ZipBatchModal
        isOpen={isZipModalOpen}
        progress={zipProgress}
        onClose={() => setIsZipModalOpen(false)}
        onCancel={handleCancelZipBatch}
      />
    </div>
  );
}
