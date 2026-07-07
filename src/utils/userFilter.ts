import * as p from '@clack/prompts';
import chalk from 'chalk';
import { loadEntries, loadUsers } from '../store';
import type { PasswordEntry, CredUser } from '../types';
import { checkCancel } from './checkCancel';

export interface FilteredEntries {
  /** Entries after applying the user filter (may equal allEntries if no filter). */
  entries: PasswordEntry[];
  users: CredUser[];
  /** Total entries before filtering — used to differentiate "no data" vs "empty filter". */
  total: number;
}

export async function pickFilteredEntries(): Promise<FilteredEntries> {
  const allEntries = loadEntries();
  const users = loadUsers();
  let entries = allEntries;

  if (users.length) {
    const filterChoice = checkCancel(
      await p.select({
        message: 'Filter by user',
        options: [
          { value: '__all__', label: chalk.dim('All Users') },
          ...users.map((u) => ({ value: u.id, label: u.name })),
        ],
      }),
    ) as string;

    if (filterChoice !== '__all__') {
      entries = allEntries.filter((e) => e.cred_user_id === filterChoice);
    }
  }

  return { entries, users, total: allEntries.length };
}
