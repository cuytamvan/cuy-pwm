#!/usr/bin/env bun
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'node:fs';
import {
  ensureKeys,
  readPublicKey,
  readPrivateKeyPem,
  getPrivateKeyPassphraseIfNeeded,
} from './keys';
import { encryptData, decryptData } from './crypto';
import { loadEntries, addEntry, deleteEntry, newId } from './store';
import { promptGeneratePassword } from './generator';
import type {
  PasswordEntry,
  SimpleCredentialEntry,
  SshCredEntry,
  SshKeyEntry,
  CredentialType,
} from './types';

function checkCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Dibatalkan.');
    process.exit(0);
  }
  return value as T;
}

function resolvePath(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', process.env.HOME || process.env.USERPROFILE || '');
  }
  return path;
}

function printBanner() {
  console.clear();
  p.intro(chalk.bgCyan.black(' 🔐 cuy-pwm — CLI Password Manager '));
}

async function main() {
  printBanner();

  await ensureKeys();

  while (true) {
    printBanner();

    const action = checkCancel(
      await p.select({
        message: 'Mau ngapain nih?',
        options: [
          { value: 'add', label: '➕ Tambah Credential' },
          { value: 'view', label: '👁  Lihat Credential' },
          { value: 'generate', label: '🎲 Generate Password' },
          { value: 'delete', label: '🗑  Hapus Credential' },
          { value: 'exit', label: '🚪 Keluar' },
        ],
      }),
    );

    if (action === 'exit') {
      p.outro(chalk.green('Sampai jumpa 👋'));
      break;
    }

    try {
      if (action === 'add') await addCredentialFlow();
      else if (action === 'view') await viewCredentialFlow();
      else if (action === 'generate') await generatePasswordFlow();
      else if (action === 'delete') await deleteCredentialFlow();
    } catch (err) {
      p.log.error(chalk.red(String(err instanceof Error ? err.message : err)));
    }

    // biar user sempat baca hasil sebelum layar di-clear lagi di iterasi berikutnya
    await p.text({
      message: chalk.dim('Tekan Enter untuk kembali ke menu...'),
      defaultValue: '',
    });
  }
}

async function passwordOrGenerate(): Promise<string> {
  const choice = checkCancel(
    await p.select({
      message: 'Password diisi bagaimana?',
      options: [
        { value: 'manual', label: 'Input manual' },
        { value: 'generate', label: 'Generate password' },
      ],
    }),
  );

  if (choice === 'generate') {
    const generated = await promptGeneratePassword();
    if (!generated) {
      p.log.warn('Generate dibatalkan, lanjut input manual.');
      return checkCancel(await p.password({ message: 'Password' }));
    }
    p.note(chalk.yellow(generated), 'Password ter-generate');
    return generated;
  }

  return checkCancel(await p.password({ message: 'Password' }));
}

async function addCredentialFlow() {
  const type = checkCancel(
    await p.select({
      message: 'Pilih tipe credential',
      options: [
        { value: 'github', label: 'GitHub' },
        { value: 'gitlab', label: 'GitLab' },
        { value: 'gmail', label: 'Gmail' },
        { value: 'bank', label: 'Akun Bank' },
        { value: 'website', label: 'Akun Website' },
        { value: 'ssh_cred', label: 'SSH Credential (host/port/user/pass)' },
        { value: 'ssh_key', label: 'SSH Key (private + public key)' },
      ],
    }),
  ) as CredentialType;

  const publicKey = readPublicKey();
  const id = newId();
  const createdAt = new Date().toISOString();

  if (type === 'ssh_key') {
    const source = checkCancel(
      await p.text({
        message: 'Nama/label (source)',
        placeholder: 'misal: server-prod',
      }),
    );
    const description = checkCancel(
      await p.text({ message: 'Deskripsi (opsional)', defaultValue: '' }),
    );
    const privateKeyPath = checkCancel(
      await p.text({
        message: 'Path file private key',
        placeholder: '~/.ssh/id_rsa',
        validate(v) {
          if (!v) return 'Wajib diisi';
          if (!existsSync(resolvePath(v))) return 'File tidak ditemukan';
        },
      }),
    );
    const publicKeyPath = checkCancel(
      await p.text({
        message: 'Path file public key',
        placeholder: '~/.ssh/id_rsa.pub',
        validate(v) {
          if (!v) return 'Wajib diisi';
          if (!existsSync(resolvePath(v))) return 'File tidak ditemukan';
        },
      }),
    );

    const privateKeyContent = readFileSync(resolvePath(privateKeyPath), 'utf8');
    const publicKeyContent = readFileSync(resolvePath(publicKeyPath), 'utf8');

    const entry: SshKeyEntry = {
      id,
      type,
      source,
      description: description || '',
      createdAt,
      encrypted_private_key: encryptData(publicKey, privateKeyContent),
      public_key: publicKeyContent,
    };

    addEntry(entry);
    p.log.success(chalk.green(`SSH Key '${source}' berhasil disimpan.`));
    return;
  }

  if (type === 'ssh_cred') {
    const source = checkCancel(
      await p.text({
        message: 'Nama/label (source)',
        placeholder: 'misal: server-prod',
      }),
    );
    const host = checkCancel(
      await p.text({ message: 'Host', placeholder: '192.168.1.1' }),
    );
    const portInput = checkCancel(
      await p.text({
        message: 'Port',
        placeholder: '22',
        initialValue: '22',
        validate(v) {
          if (v && Number.isNaN(Number(v))) return 'Port harus angka';
        },
      }),
    );
    const username = checkCancel(await p.text({ message: 'Username' }));
    const password = await passwordOrGenerate();
    const description = checkCancel(
      await p.text({ message: 'Deskripsi (opsional)', defaultValue: '' }),
    );

    const entry: SshCredEntry = {
      id,
      type,
      source,
      description: description || '',
      createdAt,
      host,
      port: Number(portInput || '22'),
      username,
      encrypted_password: encryptData(publicKey, password),
    };

    addEntry(entry);
    p.log.success(chalk.green(`SSH Credential '${source}' berhasil disimpan.`));
    return;
  }

  // github, gitlab, gmail, bank, website
  const source = checkCancel(
    await p.text({
      message: 'Source / Nama (misal: github.com, nama bank, url website)',
    }),
  );
  const username = checkCancel(
    await p.text({ message: 'Username / Email / No. Rekening' }),
  );
  const password = await passwordOrGenerate();
  const description = checkCancel(
    await p.text({ message: 'Deskripsi (opsional)', defaultValue: '' }),
  );

  let extra: Record<string, string> | undefined;

  if (type === 'bank') {
    const accountNumber = checkCancel(
      await p.text({ message: 'Nomor rekening (opsional)', defaultValue: '' }),
    );
    if (accountNumber)
      extra = { ...(extra || {}), account_number: accountNumber };
  }

  if (type === 'website') {
    const url = checkCancel(
      await p.text({ message: 'URL website (opsional)', defaultValue: '' }),
    );
    if (url) extra = { ...(extra || {}), url };
  }

  const entry: SimpleCredentialEntry = {
    id,
    type,
    source,
    description: description || '',
    createdAt,
    username,
    encrypted_password: encryptData(publicKey, password),
    extra,
  };

  addEntry(entry);
  p.log.success(chalk.green(`Credential '${source}' berhasil disimpan.`));
}

function entryLabel(e: PasswordEntry): string {
  return `[${e.type}] ${e.source}${e.description ? ' - ' + e.description : ''}`;
}

async function viewCredentialFlow() {
  const entries = loadEntries();
  if (!entries.length) {
    p.log.warn('Belum ada credential tersimpan.');
    return;
  }

  const selected = checkCancel(
    await p.select({
      message: 'Pilih credential yang ingin dilihat',
      options: entries.map((e) => ({ value: e.id, label: entryLabel(e) })),
    }),
  );

  const entry = entries.find((e) => e.id === selected)!;
  const privateKeyPem = readPrivateKeyPem();
  const passphrase = await getPrivateKeyPassphraseIfNeeded();

  const s = p.spinner();
  s.start('Decrypting...');

  try {
    let output = `${chalk.bold('Source     :')} ${entry.source}\n`;
    output += `${chalk.bold('Tipe       :')} ${entry.type}\n`;
    output += `${chalk.bold('Deskripsi  :')} ${entry.description || '-'}\n`;

    if (entry.type === 'ssh_key') {
      const decryptedPrivate = decryptData(
        privateKeyPem,
        passphrase,
        entry.encrypted_private_key,
      );
      output += `\n${chalk.bold('Public Key:')}\n${entry.public_key.trim()}\n`;
      output += `\n${chalk.bold('Private Key:')}\n${chalk.magenta(decryptedPrivate.trim())}\n`;
    } else if (entry.type === 'ssh_cred') {
      const decryptedPassword = decryptData(
        privateKeyPem,
        passphrase,
        entry.encrypted_password,
      );
      output += `${chalk.bold('Host       :')} ${entry.host}\n`;
      output += `${chalk.bold('Port       :')} ${entry.port}\n`;
      output += `${chalk.bold('Username   :')} ${entry.username}\n`;
      output += `${chalk.bold('Password   :')} ${chalk.magenta(decryptedPassword)}\n`;
    } else {
      const decryptedPassword = decryptData(
        privateKeyPem,
        passphrase,
        entry.encrypted_password,
      );
      output += `${chalk.bold('Username   :')} ${entry.username}\n`;
      output += `${chalk.bold('Password   :')} ${chalk.magenta(decryptedPassword)}\n`;
      if (entry.extra) {
        for (const [k, v] of Object.entries(entry.extra)) {
          output += `${chalk.bold(k + '     :')} ${v}\n`;
        }
      }
    }

    s.stop('Berhasil decrypt.');
    p.note(output.trim(), 'Detail Credential');
  } catch (err) {
    s.stop('Gagal decrypt.');
    throw new Error(
      'Gagal decrypt data. Pastikan passphrase private key benar. Detail: ' +
        String(err),
    );
  }
}

async function deleteCredentialFlow() {
  const entries = loadEntries();
  if (!entries.length) {
    p.log.warn('Belum ada credential tersimpan.');
    return;
  }

  const selected = checkCancel(
    await p.select({
      message: 'Pilih credential yang ingin dihapus',
      options: entries.map((e) => ({ value: e.id, label: entryLabel(e) })),
    }),
  );

  const entry = entries.find((e) => e.id === selected)!;

  const confirmed = checkCancel(
    await p.confirm({
      message: `Yakin ingin menghapus '${entry.source}'? Aksi ini tidak bisa dibatalkan.`,
      initialValue: false,
    }),
  );

  if (!confirmed) {
    p.log.info('Dibatalkan.');
    return;
  }

  deleteEntry(entry.id);
  p.log.success(chalk.green(`Credential '${entry.source}' berhasil dihapus.`));
}

async function generatePasswordFlow() {
  const generated = await promptGeneratePassword();
  if (!generated) {
    p.log.warn('Generate password dibatalkan.');
    return;
  }
  p.note(chalk.magenta.bold(generated), 'Password hasil generate');
}

main().catch((err) => {
  console.error(chalk.red(err));
  process.exit(1);
});
