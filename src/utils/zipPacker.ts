import JSZip from 'jszip';
import { SkoolVideo, SkoolCourse, CookieItem, ZipBatchProgress } from '../types.ts';
import { buildLessonMarkdown } from './markdownExporter.ts';

export function sanitizeFilename(name: string): string {
  if (!name) return 'sin_nombre';
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

export function padNumber(num: number, total: number): string {
  const digits = Math.max(2, String(total).length);
  return String(num).padStart(digits, '0');
}

// Download image as ArrayBuffer via proxy to avoid CORS
export async function downloadImageBlob(
  imageUrl: string,
  signal?: AbortSignal
): Promise<{ buffer: ArrayBuffer; extension: string } | null> {
  try {
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    const res = await fetch(proxyUrl, { signal });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';

    const buffer = await res.arrayBuffer();
    return { buffer, extension: ext };
  } catch {
    return null;
  }
}

// Download video as ArrayBuffer using the app resolution engine
export async function downloadVideoBlob(
  video: SkoolVideo,
  cookies: CookieItem[],
  onProgress?: (receivedBytes: number, totalBytes: number) => void,
  signal?: AbortSignal
): Promise<{ buffer: ArrayBuffer; extension: string } | null> {
  try {
    // 1. Resolve video source
    const resolveRes = await fetch('/api/resolve-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoLink: video.videoLink,
        provider: video.provider,
        title: video.title,
        cookies,
      }),
      signal,
    });

    if (!resolveRes.ok) return null;
    const resolveData = await resolveRes.json();
    if (!resolveData.success) return null;

    let targetUrl = '';
    if (resolveData.directDownloadUrl) {
      targetUrl = resolveData.directDownloadUrl;
    } else if (resolveData.qualities && resolveData.qualities.length > 0) {
      const best =
        resolveData.qualities.find((q: any) => q.quality === '1080p') ||
        resolveData.qualities.find((q: any) => q.quality === '720p') ||
        resolveData.qualities[0];
      targetUrl = best.downloadUrl;
    } else if (resolveData.streamUrl) {
      targetUrl = `/api/stream-video?url=${encodeURIComponent(resolveData.streamUrl)}&title=${encodeURIComponent(
        video.title
      )}`;
    }

    if (!targetUrl) return null;

    const res = await fetch(targetUrl, { signal });
    if (!res.ok) return null;

    const contentLength = Number(res.headers.get('content-length')) || 0;
    if (!res.body) {
      const buffer = await res.arrayBuffer();
      return { buffer, extension: 'mp4' };
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (onProgress) onProgress(received, contentLength);
      }
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return { buffer: result.buffer, extension: 'mp4' };
  } catch (err: any) {
    if (signal?.aborted) throw new Error('Descarga cancelada');
    console.warn(`Error descargando video ${video.title}:`, err);
    return null;
  }
}

export interface PackageCourseOptions {
  courseTitle: string;
  communityName?: string;
  videos: SkoolVideo[];
  totalCourseLessons?: number;
  cookies: CookieItem[];
  includeVideos?: boolean;
  includeMarkdown?: boolean;
  includeImages?: boolean;
  onProgress?: (progress: ZipBatchProgress) => void;
  signal?: AbortSignal;
}

// Package a single course into a structured JSZip instance or folder
export async function addCourseToZip(
  zipParent: JSZip,
  options: PackageCourseOptions,
  courseFolderPrefix = ''
): Promise<void> {
  const {
    courseTitle,
    communityName,
    videos,
    totalCourseLessons,
    cookies,
    includeVideos = true,
    includeMarkdown = true,
    includeImages = true,
    onProgress,
    signal,
  } = options;

  const safeCourseName = sanitizeFilename(courseTitle);
  const courseFolder = courseFolderPrefix
    ? zipParent.folder(`${courseFolderPrefix} ${safeCourseName}`)!
    : zipParent.folder(safeCourseName)!;

  const totalLessons = videos.length;
  // Calculate maxOrder to format padding correctly (e.g., 01..05 or 01..120)
  const maxOrder = Math.max(
    totalCourseLessons || 0,
    ...videos.map((v) => v.orderIndex || 0),
    totalLessons
  );

  for (let idx = 0; idx < totalLessons; idx++) {
    if (signal?.aborted) throw new Error('Proceso cancelado por el usuario');

    const video = videos[idx];
    
    // 1. Calculate section folder with proper ordering
    const sectionName = video.section || 'General';
    const safeSectionName = sanitizeFilename(sectionName);
    const sectionOrder = video.sectionOrder || 1;
    const maxSections = Math.max(
      video.totalSectionsInCourse || 1,
      ...videos.map((v) => v.sectionOrder || 1),
      1
    );
    const secNum = padNumber(sectionOrder, maxSections);
    const sectionFolder = courseFolder.folder(`${secNum}. ${safeSectionName}`)!;

    // 2. Calculate lesson subfolder with section-relative ordering
    const lessonOrder = video.lessonOrderInSection || video.orderIndex || (idx + 1);
    const maxLessonsInSection = Math.max(
      video.totalLessonsInSection || 1,
      ...videos
        .filter((v) => (v.section || 'General') === sectionName)
        .map((v) => v.lessonOrderInSection || 1),
      1
    );
    const lessonNum = padNumber(lessonOrder, maxLessonsInSection);
    const safeLessonTitle = sanitizeFilename(video.title);

    // Subfolder for the lesson inside its section folder
    const lessonFolder = sectionFolder.folder(`${lessonNum}. ${safeLessonTitle}`)!;

    onProgress?.({
      status: 'downloading',
      totalCourses: 1,
      currentCourseIndex: 1,
      currentCourseTitle: courseTitle,
      totalLessons,
      currentLessonIndex: idx + 1,
      currentLessonTitle: `${secNum}.${lessonNum}. ${video.title}`,
      overallPercent: Math.round(((idx + 0.1) / totalLessons) * 100),
      message: `Procesando [${secNum}.${lessonNum}] (${idx + 1}/${totalLessons}): "${video.title}"`,
    });

    // 1. Download Video if present and requested
    if (includeVideos && video.videoLink && video.hasVideo !== false) {
      onProgress?.({
        status: 'downloading',
        totalCourses: 1,
        currentCourseIndex: 1,
        currentCourseTitle: courseTitle,
        totalLessons,
        currentLessonIndex: idx + 1,
        currentLessonTitle: video.title,
        overallPercent: Math.round(((idx + 0.3) / totalLessons) * 100),
        message: `Descargando video: "${video.title}"...`,
      });

      const videoData = await downloadVideoBlob(video, cookies, undefined, signal);
      if (videoData) {
        lessonFolder.file(`${lessonNum}. ${safeLessonTitle}.${videoData.extension}`, videoData.buffer);
      }
    }

    // 2. Download Images if present and requested
    if (includeImages && video.imageUrls && video.imageUrls.length > 0) {
      for (let imgIdx = 0; imgIdx < video.imageUrls.length; imgIdx++) {
        const imgUrl = video.imageUrls[imgIdx];
        const imgNum = padNumber(imgIdx + 1, video.imageUrls.length);
        const imgData = await downloadImageBlob(imgUrl, signal);
        if (imgData) {
          lessonFolder.file(`imagen_${imgNum}.${imgData.extension}`, imgData.buffer);
        }
      }
    }

    // 3. Generate Markdown note file
    if (includeMarkdown) {
      const markdownContent = buildLessonMarkdown(video, courseTitle, communityName);
      lessonFolder.file(`${lessonNum}. ${safeLessonTitle}.md`, markdownContent);
    }
  }
}

// Download a single course and trigger .ZIP download
export async function downloadSingleCourseZip(
  options: PackageCourseOptions
): Promise<Blob> {
  const zip = new JSZip();
  await addCourseToZip(zip, options);

  options.onProgress?.({
    status: 'compressing',
    totalCourses: 1,
    currentCourseIndex: 1,
    currentCourseTitle: options.courseTitle,
    totalLessons: options.videos.length,
    currentLessonIndex: options.videos.length,
    currentLessonTitle: 'Comprimiendo carpeta ZIP...',
    overallPercent: 95,
    message: `Comprimiendo archivo ZIP para "${options.courseTitle}"...`,
  });

  const zipBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } },
    (metadata) => {
      options.onProgress?.({
        status: 'compressing',
        totalCourses: 1,
        currentCourseIndex: 1,
        currentCourseTitle: options.courseTitle,
        totalLessons: options.videos.length,
        currentLessonIndex: options.videos.length,
        currentLessonTitle: 'Generando archivo .ZIP',
        overallPercent: Math.round(90 + metadata.percent * 0.1),
        message: `Generando archivo ZIP: ${Math.round(metadata.percent)}%`,
      });
    }
  );

  // Trigger browser download
  const safeFilename = `${sanitizeFilename(options.courseTitle)}.zip`;
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(zipBlob);
  anchor.download = safeFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  options.onProgress?.({
    status: 'completed',
    totalCourses: 1,
    currentCourseIndex: 1,
    currentCourseTitle: options.courseTitle,
    totalLessons: options.videos.length,
    currentLessonIndex: options.videos.length,
    currentLessonTitle: 'Descarga completada',
    overallPercent: 100,
    message: `¡Curso empaquetado y descargado con éxito en ${safeFilename}!`,
  });

  return zipBlob;
}

export interface PackageCommunityClassroomOptions {
  communityName: string;
  courses: SkoolCourse[];
  cookies: CookieItem[];
  includeVideos?: boolean;
  includeMarkdown?: boolean;
  includeImages?: boolean;
  onProgress?: (progress: ZipBatchProgress) => void;
  signal?: AbortSignal;
}

// Download multiple courses from a community classroom into one structured .ZIP
export async function downloadCommunityClassroomZip(
  options: PackageCommunityClassroomOptions
): Promise<Blob> {
  const {
    communityName,
    courses,
    cookies,
    includeVideos = true,
    includeMarkdown = true,
    includeImages = true,
    onProgress,
    signal,
  } = options;

  const zip = new JSZip();
  const rootFolderName = `${sanitizeFilename(communityName)}_Classroom`;
  const rootFolder = zip.folder(rootFolderName)!;

  const totalCourses = courses.length;

  for (let cIdx = 0; cIdx < totalCourses; cIdx++) {
    if (signal?.aborted) throw new Error('Descarga cancelada por el usuario');

    const course = courses[cIdx];
    const courseNum = padNumber(cIdx + 1, totalCourses);

    onProgress?.({
      status: 'preparing',
      totalCourses,
      currentCourseIndex: cIdx + 1,
      currentCourseTitle: course.title,
      totalLessons: 0,
      currentLessonIndex: 0,
      currentLessonTitle: 'Consultando lecciones...',
      overallPercent: Math.round((cIdx / totalCourses) * 100),
      message: `Analizando curso (${cIdx + 1}/${totalCourses}): "${course.title}"...`,
    });

    // 1. Scrape course details to get full lesson tree with descriptions
    const courseUrl =
      course.url || `https://www.skool.com/${communityName}/classroom/${course.name || course.id}`;

    const scrapeRes = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: courseUrl, cookies }),
      signal,
    });

    if (!scrapeRes.ok) {
      console.warn(`No se pudo extraer el curso ${course.title}`);
      continue;
    }

    const scrapeData = await scrapeRes.json();
    const videos: SkoolVideo[] = scrapeData.videos || [];

    if (videos.length === 0) {
      // Empty course or failed to extract
      continue;
    }

    // 2. Add course with subfolders into the ZIP
    await addCourseToZip(
      rootFolder,
      {
        courseTitle: course.title,
        communityName,
        videos,
        totalCourseLessons: videos.length,
        cookies,
        includeVideos,
        includeMarkdown,
        includeImages,
        onProgress: (subProg) => {
          const courseBasePercent = (cIdx / totalCourses) * 90;
          const courseWeight = 90 / totalCourses;
          const subPercent = (subProg.currentLessonIndex / (videos.length || 1)) * courseWeight;
          const currentTotalPercent = Math.round(courseBasePercent + subPercent);

          onProgress?.({
            ...subProg,
            totalCourses,
            currentCourseIndex: cIdx + 1,
            currentCourseTitle: course.title,
            overallPercent: currentTotalPercent,
            message: `Curso ${cIdx + 1}/${totalCourses} ("${course.title}") - Lección ${
              subProg.currentLessonIndex
            }/${videos.length}: "${subProg.currentLessonTitle}"`,
          });
        },
        signal,
      },
      `${courseNum}.`
    );
  }

  onProgress?.({
    status: 'compressing',
    totalCourses,
    currentCourseIndex: totalCourses,
    currentCourseTitle: 'Finalizando paquete',
    totalLessons: 0,
    currentLessonIndex: 0,
    currentLessonTitle: 'Comprimiendo archivo ZIP global...',
    overallPercent: 92,
    message: 'Comprimiendo todo el Classroom en un único archivo ZIP...',
  });

  const zipBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } },
    (metadata) => {
      onProgress?.({
        status: 'compressing',
        totalCourses,
        currentCourseIndex: totalCourses,
        currentCourseTitle: 'Finalizando paquete',
        totalLessons: 0,
        currentLessonIndex: 0,
        currentLessonTitle: 'Generando archivo .ZIP',
        overallPercent: Math.round(92 + metadata.percent * 0.08),
        message: `Generando archivo ZIP de la comunidad: ${Math.round(metadata.percent)}%`,
      });
    }
  );

  const finalZipFilename = `${sanitizeFilename(communityName)}_Classroom_Completo.zip`;
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(zipBlob);
  anchor.download = finalZipFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  onProgress?.({
    status: 'completed',
    totalCourses,
    currentCourseIndex: totalCourses,
    currentCourseTitle: 'Descarga completada',
    totalLessons: 0,
    currentLessonIndex: 0,
    currentLessonTitle: '¡Listo!',
    overallPercent: 100,
    message: `¡Todo el Classroom fue empaquetado y descargado exitosamente como ${finalZipFilename}!`,
  });

  return zipBlob;
}
