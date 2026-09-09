import { SkoolVideo, CookieItem, DownloadTask } from '../types.ts';

export async function downloadVideoWithProgress(
  video: SkoolVideo,
  cookies: CookieItem[],
  onProgress: (update: Partial<DownloadTask>) => void,
  abortSignal: AbortSignal
): Promise<{ success: boolean; blob?: Blob; filename: string; directUrl?: string }> {
  // 1. Resolve video source URLs
  onProgress({ status: 'resolving' });

  const resolveRes = await fetch('/api/resolve-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoLink: video.videoLink, cookies }),
    signal: abortSignal,
  });

  if (!resolveRes.ok) {
    throw new Error(`No se pudo resolver el video (Error ${resolveRes.status})`);
  }

  const data = await resolveRes.json();
  if (!data.success && !data.mp4Url && !data.hlsUrl && !data.qualities?.length) {
    throw new Error(data.error || 'No se pudo obtener el archivo del video');
  }

  const directMp4 = data.mp4Url || data.qualities?.find((q: any) => q.isDirectMp4)?.downloadUrl;
  const safeFilename = (video.title || 'video').replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
  const filename = safeFilename.endsWith('.mp4') ? safeFilename : `${safeFilename}.mp4`;

  onProgress({
    directUrl: directMp4,
    thumbnail: data.thumbnail || video.thumbnail,
    format: 'MP4',
    resolution: '1080p',
    status: 'downloading',
  });

  let response: Response | null = null;

  // 2. Direct CDN Fetch (Identical to MAX Video Downloader extension logic!)
  // CDNs like Loom (cdn.loom.com) permit CORS with Access-Control-Allow-Origin: *
  // This completely bypasses Cloud Run proxy and prevents 500 timeout errors
  if (directMp4 && directMp4.startsWith('http')) {
    try {
      response = await fetch(directMp4, { signal: abortSignal });
      if (!response.ok) {
        response = null;
      }
    } catch {
      // CORS or network fallback
      response = null;
    }
  }

  // 3. Fallback to authenticated server proxy if direct CDN was restricted
  if (!response || !response.ok) {
    response = await fetch('/api/download-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoLink: video.videoLink,
        directUrl: directMp4,
        m3u8: data.hlsUrl,
        type: video.provider === 'vimeo' ? 'vimeo_hls' : 'mux_hls',
        title: safeFilename,
        cookies,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(errText || `Error en el servidor de descarga (${response.status})`);
    }
  }

  // 4. Stream response body with real-time download metrics
  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

  if (!response.body) {
    throw new Error('No se pudo recibir el flujo de datos del video.');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  let lastSampleTime = Date.now();
  let lastSampleBytes = 0;
  let speedBytesPerSec = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedBytes += value.length;

      const now = Date.now();
      if (now - lastSampleTime > 350) {
        const timeDiffSec = (now - lastSampleTime) / 1000;
        const bytesDiff = receivedBytes - lastSampleBytes;
        speedBytesPerSec = timeDiffSec > 0 ? bytesDiff / timeDiffSec : 0;
        lastSampleTime = now;
        lastSampleBytes = receivedBytes;

        const progress = totalBytes > 0 ? Math.min(99.9, (receivedBytes / totalBytes) * 100) : 0;
        const remainingBytes = Math.max(0, totalBytes - receivedBytes);
        const timeRemainingSec = speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : undefined;

        onProgress({
          progress,
          receivedBytes,
          totalBytes: totalBytes > 0 ? totalBytes : receivedBytes,
          speedBytesPerSec,
          timeRemainingSec,
        });
      }
    }
  }

  const finalBlob = new Blob(chunks, { type: 'video/mp4' });
  onProgress({
    progress: 100,
    receivedBytes,
    totalBytes: receivedBytes,
    speedBytesPerSec: 0,
    timeRemainingSec: 0,
    status: 'completed',
    completedAt: Date.now(),
  });

  return { success: true, blob: finalBlob, filename, directUrl: directMp4 };
}
