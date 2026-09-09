export interface CookieItem {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string | null;
  expirationDate?: number;
  hostOnly?: boolean;
  session?: boolean;
  storeId?: string | null;
}

export type VideoProvider = 'vimeo' | 'mux' | 'youtube' | 'loom' | 'wistia' | 'direct' | 'unknown';

export interface LessonResource {
  id?: string;
  title?: string;
  name?: string;
  url?: string;
  type?: string;
}

export interface SkoolVideo {
  id: string;
  title: string;
  section: string;
  videoLink: string;
  provider: VideoProvider;
  thumbnail?: string;
  durationMs?: number;
  hasAccess?: boolean;
  desc?: string;
  resources?: LessonResource[];
  resolvedQuality?: string;
}

export interface SkoolCourse {
  id: string;
  name: string;
  title: string;
  desc?: string;
  coverImage?: string;
  numModules?: number;
  url?: string;
}

export interface ScrapeResult {
  success: boolean;
  type: 'course' | 'classroom' | 'lesson';
  communityName?: string;
  title?: string;
  courses?: SkoolCourse[];
  currentCourse?: {
    id: string;
    name: string;
    title: string;
    desc?: string;
    coverImage?: string;
  };
  videos?: SkoolVideo[];
  totalVideos?: number;
  selectedLessonId?: string;
  error?: string;
}

export interface ResolveVideoResult {
  success: boolean;
  provider: VideoProvider;
  originalUrl: string;
  title?: string;
  duration?: number;
  thumbnail?: string;
  qualities?: Array<{
    label: string;
    quality: string;
    resolution?: string;
    downloadUrl: string;
  }>;
  streamUrl?: string;
  directDownloadUrl?: string;
  error?: string;
}

export interface DownloadTask {
  id: string;
  videoId: string;
  title: string;
  provider: VideoProvider;
  thumbnail?: string;
  status: 'pending' | 'resolving' | 'downloading' | 'completed' | 'error' | 'cancelled';
  progress: number; // 0 - 100
  receivedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  timeRemainingSec?: number;
  error?: string;
  directUrl?: string;
  blobUrl?: string;
  format?: 'MP4' | 'HLS';
  resolution?: string;
  markdownContent?: string;
  markdownDownloaded?: boolean;
  startedAt: number;
  completedAt?: number;
  abortController?: AbortController;
}

