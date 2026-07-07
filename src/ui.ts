import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import type { PasswordEntry, CredentialType, CredUser } from './types';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function gradientText(text: string, fromHex: string, toHex: string): string {
  const [r1, g1, b1] = hexToRgb(fromHex);
  const [r2, g2, b2] = hexToRgb(toHex);
  const chars = [...text];

  return chars
    .map((ch, i) => {
      if (ch === ' ') return ch;
      const t = chars.length <= 1 ? 0 : i / (chars.length - 1);
      const r = lerp(r1, r2, t);
      const g = lerp(g1, g2, t);
      const b = lerp(b1, b2, t);
      return chalk.rgb(r, g, b)(ch);
    })
    .join('');
}

const LOGO_LINES = [
  ' ██████╗██╗   ██╗██╗   ██╗      ██████╗ ██╗    ██╗███╗   ███╗',
  '██╔════╝██║   ██║╚██╗ ██╔╝      ██╔══██╗██║    ██║████╗ ████║',
  '██║     ██║   ██║ ╚████╔╝ █████╗██████╔╝██║ █╗ ██║██╔████╔██║',
  '██║     ██║   ██║  ╚██╔╝  ╚════╝██╔═══╝ ██║███╗██║██║╚██╔╝██║',
  '╚██████╗╚██████╔╝   ██║         ██║     ╚███╔███╔╝██║ ╚═╝ ██║',
  ' ╚═════╝ ╚═════╝    ╚═╝         ╚═╝      ╚══╝╚══╝ ╚═╝     ╚═╝',
];

export function printBanner() {
  console.clear();

  const logo = LOGO_LINES.map((line) =>
    gradientText(line, '#22d3ee', '#c084fc'),
  ).join('\n');

  console.log();
  console.log(logo);
  console.log(
    chalk.dim('    🔐 CLI Password Manager  •  powered by Bun & OpenSSL'),
  );
  console.log(
    chalk.dim('  ────────────────────────────────────────────────────────'),
  );
  console.log();
}

export function divider() {
  console.log(
    chalk.dim('────────────────────────────────────────────────────────'),
  );
}

export function pressEnterHint() {
  return chalk.dim.italic('Press Enter to return to the menu...');
}

export const TYPE_META: Record<
  CredentialType,
  { icon: string; label: string; color: string }
> = {
  github: { icon: '🐙', label: 'GitHub', color: '#e6edf3' },
  gitlab: { icon: '🦊', label: 'GitLab', color: '#fc6d26' },
  gmail: { icon: '✉️ ', label: 'Gmail', color: '#ea4335' },
  bank: { icon: '🏦', label: 'Bank Account', color: '#facc15' },
  website: { icon: '🌐', label: 'Website', color: '#38bdf8' },
  ssh_cred: { icon: '🖥️ ', label: 'SSH Credential', color: '#34d399' },
  ssh_key: { icon: '🔑', label: 'SSH Key', color: '#a78bfa' },
};

export function typeBadge(type: CredentialType): string {
  const meta = TYPE_META[type];
  return chalk.hex(meta.color).bold(`${meta.icon} ${meta.label}`);
}

export function entryLabel(e: PasswordEntry): string {
  const desc = e.description ? chalk.dim(` — ${e.description}`) : '';
  return `${typeBadge(e.type)}  ${chalk.whiteBright(e.source)}${desc}`;
}

export function credentialTypeOptions() {
  return (Object.keys(TYPE_META) as CredentialType[]).map((type) => ({
    value: type,
    label: typeBadge(type),
  }));
}

export function detailBox(entry: PasswordEntry, body: string): string {
  const meta = TYPE_META[entry.type];
  return boxen(body, {
    title: `${meta.icon} ${entry.source}`,
    titleAlignment: 'center',
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: meta.color,
  });
}

export function passwordBox(password: string, title = '🎲 Password'): string {
  return boxen(chalk.bold.hex('#facc15')(password), {
    title,
    titleAlignment: 'center',
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'double',
    borderColor: 'yellow',
  });
}

export function dangerBox(title: string, body: string): string {
  return boxen(body, {
    title,
    titleAlignment: 'center',
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'red',
  });
}

export function successBox(title: string, body: string): string {
  return boxen(body, {
    title,
    titleAlignment: 'center',
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'green',
  });
}

function truncate(text: string, max: number): string {
  if (!text) return chalk.dim('-');
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function entryUsernameCol(e: PasswordEntry): string {
  if (e.type === 'ssh_key') return chalk.dim('(key pair)');
  if (e.type === 'ssh_cred')
    return `${e.username}${chalk.dim('@' + e.host + ':' + e.port)}`;
  return e.username;
}

export function entriesTable(
  entries: PasswordEntry[],
  users?: CredUser[],
  showId: boolean = true,
): string {
  const userMap = new Map((users ?? []).map((u) => [u.id, u.name]));
  const showUser = users !== undefined;

  const head = [
    ...(showId ? [chalk.bold.cyan('ID')] : []),
    chalk.bold.cyan('Type'),
    chalk.bold.cyan('Source'),
    chalk.bold.cyan('Username / Info'),
    chalk.bold.cyan('Description'),
    chalk.bold.cyan('Created'),
  ];
  if (showUser) head.push(chalk.bold.cyan('User'));

  const table = new Table({
    head,
    style: { head: [], border: ['dim'] },
    wordWrap: true,
  });

  entries.forEach((e) => {
    const meta = TYPE_META[e.type];
    const typeCol = chalk.hex(meta.color).bold(`${meta.icon} ${meta.label}`);
    const createdCol = chalk.dim(
      new Date(e.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    );

    const row = [
      ...(showId ? [chalk.whiteBright(e.id)] : []),
      typeCol,
      chalk.whiteBright(truncate(e.source, 24)),
      entryUsernameCol(e),
      truncate(e.description, 28),
      createdCol,
    ];
    if (showUser) {
      const userName = e.cred_user_id
        ? (userMap.get(e.cred_user_id) ?? chalk.dim('?'))
        : chalk.dim('-');
      row.push(chalk.whiteBright(userName));
    }
    table.push(row);
  });

  const header = chalk.dim(`📋 Total: ${entries.length} credential(s) saved\n`);
  return header + table.toString();
}
