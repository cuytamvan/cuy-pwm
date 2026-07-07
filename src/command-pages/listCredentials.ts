import * as p from '@clack/prompts';
import chalk from 'chalk';
import { entriesTable } from '../ui';
import { pickFilteredEntries } from '../utils';

export async function listCredentialsFlow() {
  const { entries, users, total } = await pickFilteredEntries();

  if (!total) {
    p.log.warn(chalk.yellow('No credentials saved yet.'));
    return;
  }

  if (!entries.length) {
    p.log.warn(chalk.yellow('No credentials found for this user.'));
    return;
  }

  console.log();
  console.log(entriesTable(entries, users));
}
