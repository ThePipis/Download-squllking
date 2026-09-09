import express, { Request, Response } from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { createServer as createViteServer } from 'vite';
import { INITIAL_COOKIES } from './src/data/defaultCookies.ts';
import { CookieItem, SkoolVideo, SkoolCourse, VideoProvider } from './src/types.ts';

const app = express();
const PORT = 3000;

// Support large payloads for when users paste complete page HTML sources
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function buildCookieString(cookies: CookieItem[]): string {
  if (!cookies || !Array.isArray(cookies)) return '';
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

function detectProvider(url: string): VideoProvider {
  if (!url) return 'unknown';
  const low = url.toLowerCase();
  if (low.includes('vimeo.com') || low.includes('player.vimeo.com')) return 'vimeo';
  if (low.includes('stream.mux.com') || low.includes('mux.com')) return 'mux';
  if (low.includes('youtube.com') || low.includes('youtu.be')) return 'youtube';
  if (low.includes('loom.com')) return 'loom';
  if (low.includes('wistia.com') || low.includes('wistia.net')) return 'wistia';
  if (low.endsWith('.mp4') || low.includes('.mp4?')) return 'direct';
  return 'unknown';
}

function extractVideosFromTree(rootNode: any): SkoolVideo[] {
  const results: SkoolVideo[] = [];
  if (!rootNode) return results;

  function walk(node: any, sectionName = '') {
    if (!node) return;

    const item = node.course || node;
    const title = item.metadata?.title || item.name || 'Sin título';
    const currentSection = item.unitType === 'set' ? title : sectionName;

    // Determine if this item is a lesson/module (not a container folder/course/set)
    const isContainer = item.unitType === 'course' || item.unitType === 'set';
    const isLesson =
      !isContainer &&
      (item.unitType === 'module' || !node.children || node.children.length === 0);

    if (isLesson) {
      const videoLink = item.metadata?.videoLink || '';
      const muxPlaybackId = item.metadata?.muxPlaybackId || '';
      const directVideo = item.metadata?.video;
      let finalVideoLink = videoLink;

      if (!finalVideoLink && muxPlaybackId) {
        finalVideoLink = `https://stream.mux.com/${muxPlaybackId}.m3u8`;
      } else if (
        !finalVideoLink &&
        typeof directVideo === 'string' &&
        directVideo.startsWith('http')
      ) {
        finalVideoLink = directVideo;
      } else if (
        !finalVideoLink &&
        typeof directVideo === 'object' &&
        directVideo?.video_url
      ) {
        finalVideoLink = directVideo.video_url;
      }

      let resources = [];
      try {
        if (typeof item.metadata?.resources === 'string') {
          resources = JSON.parse(item.metadata.resources);
        } else if (Array.isArray(item.metadata?.resources)) {
          resources = item.metadata.resources;
        }
      } catch {
        resources = [];
      }

      const descStr = typeof item.metadata?.desc === 'string' ? item.metadata.desc : '';
      const hasVideo = Boolean(finalVideoLink && finalVideoLink.trim().length > 0);
      const hasText = Boolean(descStr && descStr.trim().length > 0);

      // Extract image URLs from description
      const imageUrls: string[] = [];
      if (descStr) {
        const imgMatches = descStr.match(/https:\/\/[^\s"'<>\\]+?\.(?:png|jpg|jpeg|webp|gif)/gi);
        if (imgMatches) {
          imgMatches.forEach((img) => {
            if (
              !imageUrls.includes(img) &&
              !img.includes('avatar') &&
              !img.includes('favicon') &&
              !img.includes('slack-protected-video')
            ) {
              imageUrls.push(img);
            }
          });
        }
      }

      results.push({
        id: item.id || Math.random().toString(36).substring(2),
        title: title.trim(),
        section: sectionName || 'General',
        videoLink: finalVideoLink || '',
        provider: hasVideo ? detectProvider(finalVideoLink) : 'unknown',
        thumbnail: item.metadata?.videoThumbnail || item.metadata?.coverImage || '',
        durationMs: item.metadata?.videoLenMs || 0,
        hasAccess: item.metadata?.hasAccess !== 0,
        desc: descStr,
        resources,
        hasVideo,
        hasText,
        hasImages: imageUrls.length > 0,
        imageUrls,
        unitType: item.unitType || 'module',
        orderIndex: results.length + 1,
      });
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child, currentSection);
      }
    }
  }

  walk(rootNode, '');

  // Collect ordered unique sections
  const sectionList: string[] = [];
  results.forEach((v) => {
    const sec = v.section || 'General';
    if (!sectionList.includes(sec)) {
      sectionList.push(sec);
    }
  });

  const sectionLessonTotals = new Map<string, number>();
  results.forEach((v) => {
    const sec = v.section || 'General';
    sectionLessonTotals.set(sec, (sectionLessonTotals.get(sec) || 0) + 1);
  });

  const sectionCurrentIndices = new Map<string, number>();
  results.forEach((v, index) => {
    const sec = v.section || 'General';
    const currentLessonInSec = (sectionCurrentIndices.get(sec) || 0) + 1;
    sectionCurrentIndices.set(sec, currentLessonInSec);

    v.orderIndex = index + 1;
    v.section = sec;
    v.sectionOrder = sectionList.indexOf(sec) + 1;
    v.totalSectionsInCourse = sectionList.length;
    v.lessonOrderInSection = currentLessonInSec;
    v.totalLessonsInSection = sectionLessonTotals.get(sec) || 1;
  });

  return results;
}

function findNodeInTree(node: any, targetId: string): any {
  if (!node) return null;
  const item = node.course || node;
  if (item.id === targetId) return item;
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNodeInTree(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

// 1. Get initial pre-loaded cookies
app.get('/api/default-cookies', (_req: Request, res: Response) => {
  res.json({ cookies: INITIAL_COOKIES });
});

// 2. Test session connectivity with Skool
app.post('/api/test-session', async (req: Request, res: Response) => {
  try {
    const cookies: CookieItem[] = req.body.cookies || INITIAL_COOKIES;
    const cookieStr = buildCookieString(cookies);

    const response = await fetch('https://www.skool.com/', {
      headers: {
        Cookie: cookieStr,
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const text = await response.text();
    const nextDataMatch = text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

    if (nextDataMatch) {
      const parsed = JSON.parse(nextDataMatch[1]);
      const self = parsed.props?.pageProps?.self;
      const groups = parsed.props?.pageProps?.groups || [];

      res.json({
        success: true,
        status: response.status,
        authenticated: !!self || response.status === 200,
        user: self?.user || null,
        groupsCount: Array.isArray(groups) ? groups.length : 0,
        groups: Array.isArray(groups)
          ? groups.map((g: any) => ({
              id: g.id,
              name: g.name,
              title: g.metadata?.title || g.name,
              url: `https://www.skool.com/${g.name}/classroom`,
            }))
          : [],
      });
    } else {
      res.json({
        success: false,
        status: response.status,
        message: 'No se pudo leer __NEXT_DATA__ de Skool. Podría haber una verificación WAF o sesión expirada.',
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Scrape Skool classroom or specific course
app.post('/api/scrape', async (req: Request, res: Response) => {
  try {
    const { url, htmlContent, cookies } = req.body;
    const cookieList: CookieItem[] = cookies || INITIAL_COOKIES;
    const cookieStr = buildCookieString(cookieList);

    let html = htmlContent;

    if (!html && url) {
      const targetUrl = url.trim();
      const response = await fetch(targetUrl, {
        headers: {
          Cookie: cookieStr,
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Referer: 'https://www.skool.com/',
        },
      });

      if (!response.ok && response.status === 403) {
        return res.status(403).json({
          success: false,
          error:
            'Skool respondió con 403 Forbidden (Protección AWS WAF / Cloudflare). Por favor usa la pestaña "Pegar Código Fuente (HTML)" copiando el HTML de tu navegador.',
        });
      }

      html = await response.text();
    }

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'Debes proporcionar una URL de Skool o el contenido HTML de la página.',
      });
    }

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      // Fallback: check if raw JSON was pasted
      try {
        const directJson = JSON.parse(html);
        if (directJson.props?.pageProps) {
          return await handlePageProps(directJson.props.pageProps, res, directJson.buildId, cookieStr);
        }
      } catch {
        // not raw json
      }

      return res.status(422).json({
        success: false,
        error:
          'No se encontró el bloque __NEXT_DATA__ en el HTML. Asegúrate de copiar el código fuente completo (Ctrl + U en la página de Skool).',
      });
    }

    const nextData = JSON.parse(nextDataMatch[1]);
    const pageProps = nextData.props?.pageProps;
    const buildId = nextData.buildId;

    if (!pageProps) {
      return res.status(422).json({
        success: false,
        error: 'El contenido analizado no contiene datos válidos de página de Skool.',
      });
    }

    return await handlePageProps(pageProps, res, buildId, cookieStr);
  } catch (error: any) {
    console.error('Error en scrape:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

async function handlePageProps(pageProps: any, res: Response, buildId?: string, cookieStr?: string) {
  const currentGroup = pageProps.currentGroup;
  const communityName = currentGroup?.name || currentGroup?.metadata?.title || 'Skool Community';

  // Case A: Specific course with lessons tree
  if (pageProps.course) {
    const courseNode = pageProps.course;
    const currentCourse = {
      id: courseNode.course?.id || '',
      name: courseNode.course?.name || '',
      title: courseNode.course?.metadata?.title || courseNode.course?.name || 'Curso',
      desc: courseNode.course?.metadata?.desc || '',
      coverImage: courseNode.course?.metadata?.coverImage || '',
    };

    const videos = extractVideosFromTree(courseNode);

    // Auto-fetch missing descriptions and resources for all lessons in the course
    const groupName = currentGroup?.name;
    const courseSlugOrId = currentCourse.name || currentCourse.id;

    if (buildId && groupName && courseSlugOrId) {
      const missingVideos = videos.filter((v) => !v.desc || v.desc.trim().length === 0);
      if (missingVideos.length > 0) {
        await Promise.all(
          missingVideos.slice(0, 50).map(async (v) => {
            try {
              const url = `https://www.skool.com/_next/data/${buildId}/${groupName}/classroom/${courseSlugOrId}.json?md=${v.id}`;
              const dataRes = await fetch(url, {
                headers: {
                  Cookie: cookieStr || '',
                  'User-Agent': DEFAULT_USER_AGENT,
                  Accept: '*/*',
                  'x-nextjs-data': '1',
                  Referer: `https://www.skool.com/${groupName}/classroom/${courseSlugOrId}`,
                },
              });
              if (dataRes.ok) {
                const data = await dataRes.json();
                const node = findNodeInTree(data.pageProps?.course, v.id);
                if (node?.metadata?.desc) {
                  v.desc = node.metadata.desc;
                  v.hasText = Boolean(v.desc && v.desc.trim().length > 0);
                  const imgMatches = v.desc.match(
                    /https:\/\/[^\s"'<>\\]+?\.(?:png|jpg|jpeg|webp|gif)/gi
                  );
                  if (imgMatches) {
                    v.imageUrls = v.imageUrls || [];
                    imgMatches.forEach((img) => {
                      if (
                        !v.imageUrls!.includes(img) &&
                        !img.includes('avatar') &&
                        !img.includes('favicon') &&
                        !img.includes('slack-protected-video')
                      ) {
                        v.imageUrls!.push(img);
                      }
                    });
                    v.hasImages = v.imageUrls.length > 0;
                  }
                }
                if (node?.metadata?.resources) {
                  try {
                    v.resources =
                      typeof node.metadata.resources === 'string'
                        ? JSON.parse(node.metadata.resources)
                        : node.metadata.resources;
                  } catch {}
                }
              }
            } catch (err: any) {
              console.warn(`Pre-fetch error for module ${v.id}:`, err.message);
            }
          })
        );
      }
    }

    return res.json({
      success: true,
      type: 'course',
      communityName,
      title: currentCourse.title,
      currentCourse,
      videos,
      totalVideos: videos.length,
      selectedLessonId: pageProps.selectedModule || null,
    });
  }

  // Case B: Classroom overview with list of all courses
  if (pageProps.allCourses && Array.isArray(pageProps.allCourses)) {
    const courses: SkoolCourse[] = pageProps.allCourses.map((c: any) => ({
      id: c.id,
      name: c.name,
      title: c.metadata?.title || c.name || 'Sin título',
      desc: c.metadata?.desc || '',
      coverImage: c.metadata?.coverImage || '',
      numModules: c.metadata?.numModules || 0,
      url: currentGroup ? `https://www.skool.com/${currentGroup.name}/classroom/${c.name}` : '',
    }));

    return res.json({
      success: true,
      type: 'classroom',
      communityName,
      title: `Classroom de ${communityName}`,
      courses,
      totalCourses: courses.length,
    });
  }

  return res.json({
    success: false,
    error: 'No se detectó un curso ni una lista de cursos en los datos de la página proporcionada.',
  });
}

// 3.5. Fetch single lesson details on demand (fallback & dynamic refresh)
app.post('/api/lesson-details', async (req: Request, res: Response) => {
  try {
    const { communityName, courseId, lessonId, cookies } = req.body;
    if (!communityName || !courseId || !lessonId) {
      return res.status(400).json({
        success: false,
        error: 'Faltan parámetros requeridos (communityName, courseId, lessonId)',
      });
    }
    const cookieList: CookieItem[] = cookies || INITIAL_COOKIES;
    const cookieStr = buildCookieString(cookieList);

    const targetUrl = `https://www.skool.com/${communityName}/classroom/${courseId}?md=${lessonId}`;
    const pageRes = await fetch(targetUrl, {
      headers: {
        Cookie: cookieStr,
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: 'https://www.skool.com/',
      },
    });

    if (!pageRes.ok) {
      return res.status(pageRes.status).json({
        success: false,
        error: `Error HTTP ${pageRes.status} al consultar lección en Skool`,
      });
    }

    const html = await pageRes.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      return res.status(422).json({
        success: false,
        error: 'No se pudo leer __NEXT_DATA__ de la lección',
      });
    }

    const nextData = JSON.parse(nextDataMatch[1]);
    const courseNode = nextData.props?.pageProps?.course;
    const node = findNodeInTree(courseNode, lessonId);

    let resources: any[] = [];
    if (node?.metadata?.resources) {
      try {
        resources =
          typeof node.metadata.resources === 'string'
            ? JSON.parse(node.metadata.resources)
            : node.metadata.resources;
      } catch {}
    }

    return res.json({
      success: true,
      lessonId,
      title: node?.metadata?.title || '',
      desc: node?.metadata?.desc || '',
      resources,
      videoLink: node?.metadata?.videoLink || '',
    });
  } catch (error: any) {
    console.error('Error in lesson-details:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3.6. Proxy image to allow clean local blob downloads without CORS issues
app.get('/api/proxy-image', async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return res.status(400).send('URL de imagen no válida');
    }
    const cookieStr = buildCookieString(INITIAL_COOKIES);
    const imgRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: 'https://www.skool.com/',
        Cookie: cookieStr,
      },
    });
    if (!imgRes.ok) {
      return res.status(imgRes.status).send('No se pudo obtener la imagen');
    }
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).send(err.message);
  }
});

// Helper to resolve Vimeo HLS / Progressive streams
async function resolveVimeo(url: string, cookies?: CookieItem[]) {
  const vimeoIdMatch = url.match(/(?:vimeo\.com\/|video\/)(\d+)/);
  if (!vimeoIdMatch) throw new Error('No se pudo extraer el ID de Vimeo.');
  const vimeoId = vimeoIdMatch[1];
  const cookieStr = cookies ? buildCookieString(cookies) : '';

  const playerRes = await fetch(`https://player.vimeo.com/video/${vimeoId}`, {
    headers: {
      Referer: 'https://www.skool.com/',
      'User-Agent': DEFAULT_USER_AGENT,
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
  });

  const playerHtml = await playerRes.text();
  const configUrlMatch = playerHtml.match(/"config_refresh_url":"([^"]+)"/);

  if (!configUrlMatch) {
    // Try to see if direct progressive files exist in playerHtml
    const titleMatch = playerHtml.match(/"title":"([^"]+)"/);
    return {
      success: false,
      error: 'Vimeo restringió la lectura de streams para este video sin referer autorizado.',
      title: titleMatch ? titleMatch[1] : `Vimeo ${vimeoId}`,
      vimeoId,
    };
  }

  const rawConfigUrl = configUrlMatch[1].replace(/\\u0026/g, '&');
  const configRes = await fetch(rawConfigUrl, {
    headers: {
      Referer: 'https://player.vimeo.com/',
      'User-Agent': DEFAULT_USER_AGENT,
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
  });

  const configData = await configRes.json();
  const files = configData.files || {};
  const qualities: any[] = [];
  let hlsUrl = '';

  if (files.progressive && Array.isArray(files.progressive)) {
    for (const prog of files.progressive) {
      qualities.push({
        label: `${prog.quality || prog.height}p (MP4 Directo)`,
        quality: `${prog.height || prog.quality}`,
        width: prog.width,
        height: prog.height,
        downloadUrl: prog.url,
      });
    }
  }

  if (files.hls) {
    const cdnKey = files.hls.default_cdn || Object.keys(files.hls.cdns || {})[0];
    if (cdnKey && files.hls.cdns[cdnKey]) {
      hlsUrl = files.hls.cdns[cdnKey].url;
      qualities.push({
        label: 'Máxima Calidad (1080p/Auto HLS a MP4)',
        quality: '1080p',
        downloadUrl: `/api/download-video?type=vimeo_hls&m3u8=${encodeURIComponent(hlsUrl)}&title=${encodeURIComponent(configData.video?.title || 'vimeo_video')}`,
      });
    }
  }

  return {
    success: true,
    provider: 'vimeo',
    title: configData.video?.title || `Vimeo ${vimeoId}`,
    duration: configData.video?.duration || 0,
    thumbnail: configData.video?.thumbnail_url || '',
    hlsUrl,
    qualities,
  };
}

// Helper to resolve Loom video to signed direct MP4 (Full HD 1080p)
async function resolveLoom(url: string) {
  const loomIdMatch = url.match(/(?:loom\.com\/(?:share|embed)\/)([a-zA-Z0-9_-]+)/);
  if (!loomIdMatch) {
    throw new Error('No se pudo extraer el identificador del video de Loom.');
  }
  const loomId = loomIdMatch[1];

  let mp4Url = '';
  let title = `Loom_${loomId}`;
  let thumbnail = '';
  let hlsUrl = '';

  // 1. Fetch Loom transcoded-url API for signed 1080p MP4
  try {
    const transRes = await fetch(`https://www.loom.com/api/campaigns/sessions/${loomId}/transcoded-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': DEFAULT_USER_AGENT,
      },
      body: JSON.stringify({}),
    });
    if (transRes.ok) {
      const transData = await transRes.json();
      if (transData.url) {
        mp4Url = transData.url;
      }
    }
  } catch (err: any) {
    console.error('Error al resolver transcoded-url de Loom:', err.message);
  }

  // 2. Fetch Loom share page to extract title, thumbnail and Luna HLS stream
  try {
    const pageRes = await fetch(`https://www.loom.com/share/${loomId}`, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const ogTitle =
        html.match(/<meta property="og:title" content="([^"]+)"/i) ||
        html.match(/<title>([^<]+)<\/title>/i);
      if (ogTitle && ogTitle[1]) {
        title = ogTitle[1].replace(/\s*\|\s*Loom/i, '').trim();
      }
      const ogImg = html.match(/<meta property="og:image" content="([^"]+)"/i);
      if (ogImg && ogImg[1]) {
        thumbnail = ogImg[1];
      }
      const hlsMatch = html.match(/(https:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/i);
      if (hlsMatch) {
        hlsUrl = hlsMatch[1].replace(/\\u0026/g, '&');
      }
    }
  } catch (err: any) {
    console.warn('Error al obtener metadatos de Loom:', err.message);
  }

  const qualities = [];
  if (mp4Url) {
    qualities.push({
      label: 'Máxima Calidad (1080p MP4 Directo Loom)',
      quality: '1080p',
      downloadUrl: mp4Url,
      isDirectMp4: true,
    });
  }

  return {
    success: true,
    provider: 'loom',
    loomId,
    title,
    thumbnail,
    mp4Url,
    downloadUrl: mp4Url,
    hlsUrl,
    qualities,
  };
}

function streamHlsWithFfmpeg(m3u8: string, isVimeo: boolean, res: Response) {
  const ffmpegArgs = [
    ...(isVimeo ? ['-headers', 'Referer: https://player.vimeo.com/\r\n'] : []),
    '-i',
    m3u8,
    '-c',
    'copy',
    '-bsf:a',
    'aac_adtstoasc',
    '-f',
    'mp4',
    '-movflags',
    'frag_keyframe+empty_moov',
    'pipe:1',
  ];

  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
  ffmpegProcess.stdout.pipe(res);

  ffmpegProcess.stderr.on('data', () => {});

  ffmpegProcess.on('error', (err) => {
    console.error('FFmpeg process error:', err);
    if (!res.headersSent) {
      res.status(500).send('FFmpeg stream error');
    }
  });

  res.on('close', () => {
    try {
      ffmpegProcess.kill('SIGKILL');
    } catch {}
  });
}

// 4. Resolve video URL to downloadable MP4 qualities
app.post('/api/resolve-video', async (req: Request, res: Response) => {
  try {
    const { videoLink, cookies } = req.body;
    if (!videoLink) {
      return res.status(400).json({ success: false, error: 'Falta videoLink' });
    }

    const provider = detectProvider(videoLink);

    if (provider === 'vimeo') {
      const vimeoData = await resolveVimeo(videoLink, cookies);
      return res.json(vimeoData);
    }

    if (provider === 'mux') {
      const muxIdMatch = videoLink.match(/(?:mux\.com\/)([a-zA-Z0-9_-]+)/);
      const muxId = muxIdMatch ? muxIdMatch[1].replace('.m3u8', '') : '';
      const m3u8Url = videoLink.includes('.m3u8') ? videoLink : `https://stream.mux.com/${muxId}.m3u8`;

      // Check if direct static MP4 is available on Mux
      let staticMp4Available = false;
      if (muxId) {
        try {
          const checkRes = await fetch(`https://stream.mux.com/${muxId}/high.mp4`, { method: 'HEAD' });
          if (checkRes.ok) staticMp4Available = true;
        } catch {
          // ignore
        }
      }

      const qualities = [];
      if (staticMp4Available) {
        qualities.push({
          label: 'Alta Calidad (MP4 Directo Mux)',
          quality: 'high',
          downloadUrl: `https://stream.mux.com/${muxId}/high.mp4`,
        });
      }

      qualities.push({
        label: 'Máxima Calidad (Stream Mux a MP4)',
        quality: 'master',
        downloadUrl: `/api/download-video?type=mux_hls&m3u8=${encodeURIComponent(m3u8Url)}&title=${encodeURIComponent('mux_video')}`,
      });

      return res.json({
        success: true,
        provider: 'mux',
        hlsUrl: m3u8Url,
        qualities,
      });
    }

    if (provider === 'youtube') {
      const ytMatch = videoLink.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      const ytId = ytMatch ? ytMatch[1] : '';
      return res.json({
        success: true,
        provider: 'youtube',
        ytId,
        embedUrl: `https://www.youtube.com/embed/${ytId}`,
        message: 'Video alojado en YouTube',
        qualities: [
          {
            label: 'Ver/Descargar en YouTube',
            quality: 'original',
            downloadUrl: videoLink,
          },
        ],
      });
    }

    if (provider === 'loom') {
      const loomData = await resolveLoom(videoLink);
      return res.json(loomData);
    }

    // Direct MP4
    return res.json({
      success: true,
      provider: 'direct',
      mp4Url: videoLink,
      qualities: [
        {
          label: 'Archivo MP4 Directo',
          quality: 'original',
          downloadUrl: videoLink,
          isDirectMp4: true,
        },
      ],
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Stream download as clean MP4 file directly into user local laptop
app.all('/api/download-video', async (req: Request, res: Response) => {
  try {
    const params = req.method === 'POST' ? req.body : req.query;
    const { type, m3u8, title, directUrl, videoLink, cookies } = params || {};
    const cookieList: CookieItem[] = cookies || INITIAL_COOKIES;
    const cookieStr = buildCookieString(cookieList);

    const safeTitle = ((title as string) || 'video')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    const filename = safeTitle.endsWith('.mp4') ? safeTitle : `${safeTitle}.mp4`;
    const asciiFilename = filename.replace(/[^\x20-\x7E]/g, '_');

    const sendDownloadHeaders = (contentLength?: string | null) => {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
    };

    // Clean headers for direct streaming from CDNs (Loom, CloudFront, AWS S3)
    const cleanCdnHeaders: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: '*/*',
    };
    if (req.headers.range) {
      cleanCdnHeaders['Range'] = req.headers.range as string;
    }

    // PRIORITY 1: directUrl provided (the exact signed MP4 URL resolved for this video)
    if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
      try {
        const remoteRes = await fetch(directUrl, { headers: cleanCdnHeaders });
        if (remoteRes.ok && remoteRes.body) {
          sendDownloadHeaders(remoteRes.headers.get('content-length'));
          if (remoteRes.status === 206) {
            res.status(206);
            const contentRange = remoteRes.headers.get('content-range');
            if (contentRange) res.setHeader('Content-Range', contentRange);
          }
          const stream = Readable.fromWeb(remoteRes.body as any);
          stream.on('error', (err) => {
            console.error('Remote stream pipe error:', err);
            if (!res.headersSent) res.status(500).send('Error en flujo de datos.');
          });
          stream.pipe(res);
          res.on('close', () => stream.destroy());
          return;
        } else {
          console.warn('directUrl fetch returned non-ok status:', remoteRes.status);
        }
      } catch (err: any) {
        console.warn('directUrl fetch failed, falling back to videoLink:', err.message);
      }
    }

    // PRIORITY 2: videoLink provided directly (Loom, Vimeo, Mux, Direct)
    if (videoLink && typeof videoLink === 'string') {
      const provider = detectProvider(videoLink);
      if (provider === 'loom') {
        const loomResult = await resolveLoom(videoLink);
        if (loomResult.mp4Url) {
          const remoteRes = await fetch(loomResult.mp4Url, { headers: cleanCdnHeaders });
          if (remoteRes.ok && remoteRes.body) {
            sendDownloadHeaders(remoteRes.headers.get('content-length'));
            const stream = Readable.fromWeb(remoteRes.body as any);
            stream.pipe(res);
            res.on('close', () => stream.destroy());
            return;
          }
        }
        // Fallback: If Loom transcoded MP4 is unavailable, stream Loom HLS with FFmpeg
        if (loomResult.hlsUrl) {
          sendDownloadHeaders();
          return streamHlsWithFfmpeg(loomResult.hlsUrl, false, res);
        }
      } else if (provider === 'vimeo') {
        const vimeoData = await resolveVimeo(videoLink, cookieList);
        const prog = vimeoData.qualities?.find(
          (q: any) =>
            q.downloadUrl &&
            q.downloadUrl.startsWith('http') &&
            !q.downloadUrl.includes('api/download-video')
        );
        if (prog && prog.downloadUrl) {
          const remoteRes = await fetch(prog.downloadUrl, {
            headers: { 'User-Agent': DEFAULT_USER_AGENT, Referer: 'https://player.vimeo.com/' },
          });
          if (remoteRes.ok && remoteRes.body) {
            sendDownloadHeaders(remoteRes.headers.get('content-length'));
            const stream = Readable.fromWeb(remoteRes.body as any);
            stream.pipe(res);
            res.on('close', () => stream.destroy());
            return;
          }
        } else if (vimeoData.hlsUrl) {
          sendDownloadHeaders();
          return streamHlsWithFfmpeg(vimeoData.hlsUrl, true, res);
        }
      } else if (provider === 'mux') {
        const muxIdMatch = videoLink.match(/(?:mux\.com\/)([a-zA-Z0-9_-]+)/);
        const muxId = muxIdMatch ? muxIdMatch[1].replace('.m3u8', '') : '';
        const highMp4 = `https://stream.mux.com/${muxId}/high.mp4`;
        try {
          const testRes = await fetch(highMp4, { method: 'HEAD' });
          if (testRes.ok) {
            const remoteRes = await fetch(highMp4, { headers: cleanCdnHeaders });
            if (remoteRes.ok && remoteRes.body) {
              sendDownloadHeaders(remoteRes.headers.get('content-length'));
              const stream = Readable.fromWeb(remoteRes.body as any);
              stream.pipe(res);
              res.on('close', () => stream.destroy());
              return;
            }
          }
        } catch {
          // fallback to hls
        }
        const m3u8Url = videoLink.includes('.m3u8') ? videoLink : `https://stream.mux.com/${muxId}.m3u8`;
        sendDownloadHeaders();
        return streamHlsWithFfmpeg(m3u8Url, false, res);
      } else if (provider === 'direct') {
        const remoteRes = await fetch(videoLink, { headers: cleanCdnHeaders });
        if (remoteRes.ok && remoteRes.body) {
          sendDownloadHeaders(remoteRes.headers.get('content-length'));
          const stream = Readable.fromWeb(remoteRes.body as any);
          stream.pipe(res);
          res.on('close', () => stream.destroy());
          return;
        }
      }
    }

    // PRIORITY 3: m3u8 stream via FFmpeg
    if (m3u8 && typeof m3u8 === 'string') {
      sendDownloadHeaders();
      const isVimeo = type === 'vimeo_hls';
      return streamHlsWithFfmpeg(m3u8, isVimeo, res);
    }

    return res.status(400).json({
      success: false,
      error: 'Parámetros de descarga no válidos o archivo de video no accesible.',
    });
  } catch (err: any) {
    console.error('Download error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: `Error generando descarga: ${err.message || 'Fallo interno'}`,
      });
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
