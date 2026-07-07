import chalk from 'chalk';
import { loadEntries, loadUsers } from './store';
import { readPrivateKeyPem, getPrivateKeyPassphraseIfNeeded } from './keys';
import { decryptData } from './crypto';
import { entriesTable, TYPE_META } from './ui';
import type { PasswordEntry, CredentialType } from './types';

function showHelp() {
  const T = chalk.bold.cyan;
  const D = chalk.dim;
  const types = Object.keys(TYPE_META).join(', ');
  console.log(`
${T('cuypwm')} — CLI Password Manager
${D('powered by Bun & OpenSSL')}

${chalk.bold('Usage:')}
  cuypwm                           Launch interactive TUI
  cuypwm -h                        Show this help

${chalk.bold('Commands:')}
  ${T('cuypwm ls')}
    List all credentials (table view).

  ${T('cuypwm get')} ${chalk.yellow('<cred_id>')}
    Show credential detail without decrypting password.

  ${T('cuypwm get')} ${chalk.yellow('<cred_id>')} ${chalk.green('--copy-password')}
    Decrypt and copy password to clipboard (macOS / Linux).

  ${T('cuypwm search')} ${chalk.yellow('<query>')}
    Search across source, username, host, port, description.

  ${T('cuypwm search')} ${chalk.green('--type')} ${chalk.yellow('<type>')}
    Filter by credential type.
    Available types: ${D(types)}

  ${T('cuypwm search')} ${chalk.yellow('<query>')} ${chalk.green('--type')} ${chalk.yellow('<type>')}
    Combine text search and type filter.
`);
}

async function copyToClipboard(text: string): Promise<void> {
  let cmd: string[];
  if (process.platform === 'darwin') {
    cmd = ['pbcopy'];
  } else {
    // try xclip, fallback to xsel
    const which = Bun.spawnSync(['which', 'xclip']);
    cmd =
      which.exitCode === 0
        ? ['xclip', '-selection', 'clipboard']
        : ['xsel', '--clipboard', '--input'];
  }
  const proc = Bun.spawn(cmd, { stdin: 'pipe' });
  proc.stdin!.write(text);
  await proc.stdin!.end();
  await proc.exited;
}

function matchEntry(entry: PasswordEntry, query: string): boolean {
  const q = query.toLowerCase();
  if (entry.source.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  if (entry.type === 'ssh_cred') {
    if (entry.username.toLowerCase().includes(q)) return true;
    if (entry.host.toLowerCase().includes(q)) return true;
    if (String(entry.port).includes(q)) return true;
  }
  if (entry.type !== 'ssh_key') {
    if ((entry as { username: string }).username.toLowerCase().includes(q))
      return true;
  }
  return false;
}

async function cmdLs() {
  const entries = loadEntries();
  const users = loadUsers();
  if (!entries.length) {
    console.log(chalk.yellow('No credentials saved yet.'));
    return;
  }
  console.log(entriesTable(entries, users));
}

async function cmdGet(rest: string[]) {
  const idArg = rest.find((a) => !a.startsWith('-'));
  const copyFlag = rest.includes('--copy-password');

  if (!idArg) {
    console.error(chalk.red('Usage: cuypwm get <cred_id> [--copy-password]'));
    process.exit(1);
  }

  const entries = loadEntries();
  const users = loadUsers();
  const entry = entries.find((e) => e.id === idArg);

  if (!entry) {
    console.error(chalk.red(`Credential with id '${idArg}' not found.`));
    process.exit(1);
  }

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const meta = TYPE_META[entry.type];

  console.log();
  console.log(
    `  ${chalk.hex(meta.color).bold(`${meta.icon}  ${entry.source}`)}  ${chalk.dim(`[${entry.type}]`)}`,
  );
  console.log(`  ${chalk.dim('ID')}          : ${chalk.dim(entry.id)}`);
  if (entry.cred_user_id) {
    const userName = userMap.get(entry.cred_user_id) ?? chalk.dim('?');
    console.log(
      `  ${chalk.dim('User')}        : ${chalk.whiteBright(userName)}`,
    );
  }
  console.log(
    `  ${chalk.dim('Description')} : ${entry.description || chalk.dim('-')}`,
  );

  if (entry.type === 'ssh_key') {
    console.log(
      `  ${chalk.dim('Public Key')}  :\n${chalk.gray(entry.public_key.trim())}`,
    );
    if (copyFlag) {
      console.log(
        chalk.yellow('\n  --copy-password is not applicable for SSH Keys.'),
      );
    }
  } else if (entry.type === 'ssh_cred') {
    console.log(
      `  ${chalk.dim('Host')}        : ${chalk.whiteBright(entry.host)}`,
    );
    console.log(
      `  ${chalk.dim('Port')}        : ${chalk.whiteBright(String(entry.port))}`,
    );
    console.log(
      `  ${chalk.dim('Username')}    : ${chalk.whiteBright(entry.username)}`,
    );
    console.log(
      `  ${chalk.dim('Password')}    : ${chalk.dim('(encrypted — use --copy-password)')}`,
    );
    if (copyFlag) {
      const pw = await decryptEntry(entry.encrypted_password);
      await copyToClipboard(pw);
      console.log(chalk.green('\n  ✔ Password copied to clipboard.'));
    }
  } else {
    console.log(
      `  ${chalk.dim('Username')}    : ${chalk.whiteBright(entry.username)}`,
    );
    console.log(
      `  ${chalk.dim('Password')}    : ${chalk.dim('(encrypted — use --copy-password)')}`,
    );
    if (entry.extra) {
      for (const [k, v] of Object.entries(entry.extra)) {
        console.log(`  ${chalk.dim(k.padEnd(11))} : ${chalk.whiteBright(v)}`);
      }
    }
    if (copyFlag) {
      const pw = await decryptEntry(entry.encrypted_password);
      await copyToClipboard(pw);
      console.log(chalk.green('\n  ✔ Password copied to clipboard.'));
    }
  }
  console.log();
}

async function decryptEntry(encryptedPassword: string): Promise<string> {
  const privateKeyPem = readPrivateKeyPem();
  const passphrase = await getPrivateKeyPassphraseIfNeeded();
  return decryptData(privateKeyPem, passphrase, encryptedPassword);
}

async function cmdSearch(rest: string[]) {
  const typeIdx = rest.indexOf('--type');
  const typeFilter: CredentialType | undefined =
    typeIdx !== -1 ? (rest[typeIdx + 1] as CredentialType) : undefined;

  const queryTokens = rest.filter((a, i) => {
    if (a.startsWith('-')) return false;
    if (typeIdx !== -1 && i === typeIdx + 1) return false; // skip the type value
    return true;
  });
  const query = queryTokens.join(' ').trim();

  if (!query && !typeFilter) {
    console.error(chalk.red('Usage: cuypwm search <query> [--type <type>]'));
    process.exit(1);
  }

  const entries = loadEntries();
  const users = loadUsers();
  let results = entries;

  if (typeFilter) {
    results = results.filter((e) => e.type === typeFilter);
  }
  if (query) {
    results = results.filter((e) => matchEntry(e, query));
  }

  if (!results.length) {
    console.log(chalk.yellow('No matching results found.'));
    return;
  }

  console.log(entriesTable(results, users));
}

export async function runCli(args: string[]): Promise<boolean> {
  const [cmd, ...rest] = args;

  if (cmd === '-h' || cmd === '--help') {
    showHelp();
    return true;
  }

  if (cmd === 'ls') {
    await cmdLs();
    return true;
  }

  if (cmd === 'get') {
    await cmdGet(rest);
    return true;
  }

  if (cmd === 'search') {
    await cmdSearch(rest);
    return true;
  }

  return false;
}
