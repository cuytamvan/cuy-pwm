import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { SOURCE_FILE, ensureAppDir } from './config';
import type { PasswordEntry, CredUser } from './types';

interface DbStore {
  cred_users: CredUser[];
  cred_entries: PasswordEntry[];
}

function loadDb(): DbStore {
  ensureAppDir();
  if (!existsSync(SOURCE_FILE)) return { cred_users: [], cred_entries: [] };
  try {
    return JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));
  } catch {
    return { cred_users: [], cred_entries: [] };
  }
}

function saveDb(db: DbStore) {
  ensureAppDir();
  writeFileSync(SOURCE_FILE, JSON.stringify(db, null, 2));
}

// --- Credential Entries ---

export function loadEntries(): PasswordEntry[] {
  return loadDb().cred_entries;
}

export function addEntry(entry: PasswordEntry) {
  const db = loadDb();
  db.cred_entries.push(entry);
  saveDb(db);
}

export function deleteEntry(id: string) {
  const db = loadDb();
  db.cred_entries = db.cred_entries.filter((e) => e.id !== id);
  saveDb(db);
}

export function updateEntry(updated: PasswordEntry) {
  const db = loadDb();
  db.cred_entries = db.cred_entries.map((e) =>
    e.id === updated.id ? updated : e,
  );
  saveDb(db);
}

// --- Cred Users ---

export function loadUsers(): CredUser[] {
  return loadDb().cred_users;
}

export function addUser(user: CredUser) {
  const db = loadDb();
  db.cred_users.push(user);
  saveDb(db);
}

export function updateUser(updated: CredUser) {
  const db = loadDb();
  db.cred_users = db.cred_users.map((u) => (u.id === updated.id ? updated : u));
  saveDb(db);
}

export function deleteUser(id: string) {
  const db = loadDb();
  db.cred_users = db.cred_users.filter((u) => u.id !== id);
  saveDb(db);
}

export function newId(): string {
  return randomUUID();
}
