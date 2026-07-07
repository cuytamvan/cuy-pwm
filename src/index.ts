#!/usr/bin/env bun
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { ensureKeys } from './keys';
import { printBanner, pressEnterHint } from './ui';
import { checkCancel } from './utils';
import { runCli } from './cli';
import { addCredentialFlow } from './command-pages/addCredential';
import { listCredentialsFlow } from './command-pages/listCredentials';
import { viewCredentialFlow } from './command-pages/viewCredential';
import { generatePasswordFlow } from './command-pages/generatePassword';
import { manageUsersFlow } from './command-pages/manageUsers';

async function main() {
  const cliArgs = process.argv.slice(2);

  if (cliArgs.length > 0) {
    const handled = await runCli(cliArgs);
    if (handled) return;
  }

  printBanner();
  await ensureKeys();

  while (true) {
    printBanner();

    const action = checkCancel(
      await p.select({
        message: 'What would you like to do?',
        options: [
          { value: 'add', label: 'Add Credential' },
          { value: 'list', label: 'List All Credentials' },
          { value: 'view', label: 'View Credential' },
          { value: 'generate', label: 'Generate Password' },
          { value: 'users', label: 'Manage Users' },
          { value: 'exit', label: 'Exit' },
        ],
      }),
    );

    if (action === 'exit') {
      p.outro(chalk.greenBright.bold('See you later 👋'));
      break;
    }

    try {
      if (action === 'add') await addCredentialFlow();
      else if (action === 'list') await listCredentialsFlow();
      else if (action === 'view') await viewCredentialFlow();
      else if (action === 'generate') await generatePasswordFlow();
      else if (action === 'users') await manageUsersFlow();
    } catch (err) {
      p.log.error(chalk.red(String(err instanceof Error ? err.message : err)));
    }

    await p.text({ message: pressEnterHint(), defaultValue: '' });
  }
}

main().catch((err) => {
  console.error(chalk.red(err));
  process.exit(1);
});
