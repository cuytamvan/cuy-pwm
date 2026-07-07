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
import {
  printBanner,
  entryLabel,
  credentialTypeOptions,
  detailBox,
  passwordBox,
  dangerBox,
  pressEnterHint,
} from './ui';
import type {
  SimpleCredentialEntry,
  SshCredEntry,
  SshKeyEntry,
  CredentialType,
} from './types';

function checkCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel(chalk.red('Dibatalkan.'));
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

async function main() {
  printBanner();
  await ensureKeys();

  while (true) {
    printBanner();

    const action = checkCancel(
      await p.select({
        message: 'Mau ngapain nih?',
        options: [
          { value: 'add', label: `${chalk.green('➕')} Tambah Credential` },
          { value: 'view', label: `${chalk.cyan('👁 ')} Lihat Credential` },
          {
            value: 'generate',
            label: `${chalk.yellow('🎲')} Generate Password`,
          },
          { value: 'delete', label: `${chalk.red('🗑 ')} Hapus Credential` },
          { value: 'exit', label: `${chalk.dim('🚪')} Keluar` },
        ],
      }),
    );

    if (action === 'exit') {
      p.outro(chalk.greenBright.bold('Sampai jumpa 👋'));
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

    await p.text({ message: pressEnterHint(), defaultValue: '' });
  }
}

async function passwordOrGenerate(): Promise<string> {
  const choice = checkCancel(
    await p.select({
      message: 'Password diisi bagaimana?',
      options: [
        { value: 'manual', label: `${chalk.blue('⌨️ ')}  Input manual` },
        { value: 'generate', label: `${chalk.yellow('🎲')} Generate password` },
      ],
    }),
  );

  if (choice === 'generate') {
    const generated = await promptGeneratePassword();
    if (!generated) {
      p.log.warn(chalk.yellow('Generate dibatalkan, lanjut input manual.'));
      return checkCancel(await p.password({ message: 'Password' }));
    }
    console.log(passwordBox(generated, '🎲 Password ter-generate'));
    return generated;
  }

  return checkCancel(await p.password({ message: 'Password' }));
}

async function addCredentialFlow() {
  const type = checkCancel(
    await p.select({
      message: 'Pilih tipe credential',
      options: credentialTypeOptions(),
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
    p.log.success(
      chalk.green(`✔ SSH Key '${chalk.bold(source)}' berhasil disimpan.`),
    );
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
    p.log.success(
      chalk.green(
        `✔ SSH Credential '${chalk.bold(source)}' berhasil disimpan.`,
      ),
    );
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
  p.log.success(
    chalk.green(`✔ Credential '${chalk.bold(source)}' berhasil disimpan.`),
  );
}

async function viewCredentialFlow() {
  const entries = loadEntries();
  if (!entries.length) {
    p.log.warn(chalk.yellow('Belum ada credential tersimpan.'));
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
  s.start('🔐 Decrypting data...');

  try {
    let body = `${chalk.dim('Deskripsi')} : ${entry.description || '-'}\n`;

    if (entry.type === 'ssh_key') {
      const decryptedPrivate = decryptData(
        privateKeyPem,
        passphrase,
        entry.encrypted_private_key,
      );
      body += `\n${chalk.bold.cyan('Public Key')}\n${chalk.gray(entry.public_key.trim())}\n`;
      body += `\n${chalk.bold.cyan('Private Key')}\n${chalk.magentaBright(
        decryptedPrivate.trim(),
      )}\n`;
    } else if (entry.type === 'ssh_cred') {
      const decryptedPassword = decryptData(
        privateKeyPem,
        passphrase,
        entry.encrypted_password,
      );
      body += `${chalk.dim('Host')}     : ${chalk.whiteBright(entry.host)}\n`;
      body += `${chalk.dim('Port')}     : ${chalk.whiteBright(String(entry.port))}\n`;
      body += `${chalk.dim('Username')} : ${chalk.whiteBright(entry.username)}\n`;
      body += `${chalk.dim('Password')} : ${chalk.magentaBright.bold(decryptedPassword)}\n`;
    } else {
      const decryptedPassword = decryptData(
        privateKeyPem,
        passphrase,
        entry.encrypted_password,
      );
      body += `${chalk.dim('Username')} : ${chalk.whiteBright(entry.username)}\n`;
      body += `${chalk.dim('Password')} : ${chalk.magentaBright.bold(decryptedPassword)}\n`;
      if (entry.extra) {
        for (const [k, v] of Object.entries(entry.extra)) {
          body += `${chalk.dim(k)} : ${chalk.whiteBright(v)}\n`;
        }
      }
    }

    s.stop(chalk.green('✔ Berhasil decrypt.'));
    console.log(detailBox(entry, body.trim()));
  } catch (err) {
    s.stop(chalk.red('✖ Gagal decrypt.'));
    throw new Error(
      'Gagal decrypt data. Pastikan passphrase private key benar. Detail: ' +
        String(err),
    );
  }
}

async function deleteCredentialFlow() {
  const entries = loadEntries();
  if (!entries.length) {
    p.log.warn(chalk.yellow('Belum ada credential tersimpan.'));
    return;
  }

  const selected = checkCancel(
    await p.select({
      message: 'Pilih credential yang ingin dihapus',
      options: entries.map((e) => ({ value: e.id, label: entryLabel(e) })),
    }),
  );

  const entry = entries.find((e) => e.id === selected)!;

  console.log(
    dangerBox(
      '⚠️  Konfirmasi Hapus',
      `${entryLabel(entry)}\n${chalk.dim('Aksi ini tidak bisa dibatalkan.')}`,
    ),
  );

  const confirmed = checkCancel(
    await p.confirm({
      message: `Yakin ingin menghapus '${entry.source}'?`,
      initialValue: false,
    }),
  );

  if (!confirmed) {
    p.log.info(chalk.dim('Dibatalkan.'));
    return;
  }

  deleteEntry(entry.id);
  p.log.success(
    chalk.green(`✔ Credential '${chalk.bold(entry.source)}' berhasil dihapus.`),
  );
}

async function generatePasswordFlow() {
  const generated = await promptGeneratePassword();
  if (!generated) {
    p.log.warn(chalk.yellow('Generate password dibatalkan.'));
    return;
  }
  console.log(passwordBox(generated));
}

main().catch((err) => {
  console.error(chalk.red(err));
  process.exit(1);
});
