import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { SOURCE_FILE, ensureAppDir } from './config';
import type { PasswordEntry } from './types';

export function loadEntries(): PasswordEntry[] {
  ensureAppDir();
  if (!existsSync(SOURCE_FILE)) return [];
  try {
    return JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));
  } catch {
    return [];
  }
}

export function saveEntries(entries: PasswordEntry[]) {
  ensureAppDir();
  writeFileSync(SOURCE_FILE, JSON.stringify(entries, null, 2));
}

export function addEntry(entry: PasswordEntry) {
  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
}

export function deleteEntry(id: string) {
  const entries = loadEntries().filter((e) => e.id !== id);
  saveEntries(entries);
}

export function newId(): string {
  return randomUUID();
}
