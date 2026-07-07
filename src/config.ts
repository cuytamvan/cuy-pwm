import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

export const APP_DIR = join(homedir(), '.cuy-pwm');
export const KEYS_DIR = join(APP_DIR, 'keys');
export const PRIVATE_KEY_PATH = join(KEYS_DIR, 'private.pem');
export const PUBLIC_KEY_PATH = join(KEYS_DIR, 'public.pem');
export const SOURCE_FILE = join(APP_DIR, 'source.json');
export const CONFIG_FILE = join(APP_DIR, 'config.json');

export function ensureAppDir() {
  if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
  if (!existsSync(KEYS_DIR)) mkdirSync(KEYS_DIR, { recursive: true });
}
