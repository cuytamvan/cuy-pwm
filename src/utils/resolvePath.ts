export function resolvePath(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', process.env.HOME || process.env.USERPROFILE || '');
  }
  return path;
}
