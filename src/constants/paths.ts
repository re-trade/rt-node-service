import path from 'path';

// Directory paths
export const RECORDINGS_DIR = path.join(process.cwd(), 'recordings');
export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
export const TEMP_DIR = path.join(process.cwd(), 'temp');

// Ensure all path constants are absolute
export const ROOT_DIR = process.cwd();
export const SRC_DIR = path.join(ROOT_DIR, 'src');
export const CONFIG_DIR = path.join(ROOT_DIR, 'config');

// Media paths
export const VIDEO_RECORDINGS_DIR = path.join(RECORDINGS_DIR, 'video');
export const AUDIO_RECORDINGS_DIR = path.join(RECORDINGS_DIR, 'audio');
export const SCREENSHOTS_DIR = path.join(RECORDINGS_DIR, 'screenshots');

// Cleanup helper function
export function getCleanupPaths(): string[] {
  return [
    RECORDINGS_DIR,
    UPLOADS_DIR,
    TEMP_DIR,
    VIDEO_RECORDINGS_DIR,
    AUDIO_RECORDINGS_DIR,
    SCREENSHOTS_DIR,
  ];
}
