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
import {
  loadEntries,
  addEntry,
  deleteEntry,
  updateEntry,
  newId,
} from './store';
import { promptGeneratePassword } from './generator';
import {
  printBanner,
  entryLabel,
  credentialTypeOptions,
  detailBox,
  passwordBox,
  dangerBox,
  pressEnterHint,
  entriesTable,
} from './ui';
import type {
  SimpleCredentialEntry,
  SshCredEntry,
  SshKeyEntry,
  CredentialType,
  PasswordEntry,
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
          { value: 'add', label: `Tambah Credential` },
          { value: 'list', label: `List Semua Credential` },
          { value: 'view', label: `Lihat Credential` },
          { value: 'generate', label: `Generate Password` },
          { value: 'exit', label: `Keluar` },
        ],
      }),
    );

    if (action === 'exit') {
      p.outro(chalk.greenBright.bold('Sampai jumpa 👋'));
      break;
    }

    try {
      if (action === 'add') await addCredentialFlow();
      else if (action === 'list') await listCredentialsFlow();
      else if (action === 'view') await viewCredentialFlow();
      else if (action === 'generate') await generatePasswordFlow();
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

async function listCredentialsFlow() {
  const entries = loadEntries();
  if (!entries.length) {
    p.log.warn(chalk.yellow('Belum ada credential tersimpan.'));
    return;
  }

  console.log();
  console.log(entriesTable(entries));
}

async function viewCredentialFlow() {
  const entries = loadEntries();
  if (!entries.length) {
    p.log.warn(chalk.yellow('Belum ada credential tersimpan.'));
    return;
  }

  const selected = checkCancel(
    await p.select({
      message: 'Pilih credential',
      options: entries.map((e) => ({ value: e.id, label: entryLabel(e) })),
    }),
  );

  const entry = entries.find((e) => e.id === selected)!;

  const subAction = checkCancel(
    await p.select({
      message: `Aksi untuk '${chalk.bold(entry.source)}'`,
      options: [
        { value: 'view', label: `${chalk.cyan('👁 ')}  Lihat Detail` },
        { value: 'edit', label: `${chalk.yellow('✏️ ')}  Edit Credential` },
        { value: 'delete', label: `${chalk.red('🗑 ')}  Hapus Credential` },
      ],
    }),
  );

  if (subAction === 'view') {
    await showEntryDetail(entry);
  } else if (subAction === 'edit') {
    await editEntryFlow(entry);
  } else if (subAction === 'delete') {
    await confirmAndDeleteEntry(entry);
  }
}

async function showEntryDetail(entry: PasswordEntry) {
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

async function confirmAndDeleteEntry(entry: PasswordEntry) {
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

async function editEntryFlow(entry: PasswordEntry) {
  const publicKey = readPublicKey();

  if (entry.type === 'ssh_key') {
    const source = checkCancel(
      await p.text({
        message: 'Nama/label (source)',
        initialValue: entry.source,
      }),
    );
    const description = checkCancel(
      await p.text({
        message: 'Deskripsi (opsional)',
        initialValue: entry.description,
        defaultValue: '',
      }),
    );

    const changeKey = checkCancel(
      await p.confirm({ message: 'Ganti file key?', initialValue: false }),
    );

    let encrypted_private_key = entry.encrypted_private_key;
    let public_key = entry.public_key;

    if (changeKey) {
      const privateKeyPath = checkCancel(
        await p.text({
          message: 'Path file private key baru',
          placeholder: '~/.ssh/id_rsa',
          validate(v) {
            if (!v) return 'Wajib diisi';
            if (!existsSync(resolvePath(v))) return 'File tidak ditemukan';
          },
        }),
      );
      const publicKeyPath = checkCancel(
        await p.text({
          message: 'Path file public key baru',
          placeholder: '~/.ssh/id_rsa.pub',
          validate(v) {
            if (!v) return 'Wajib diisi';
            if (!existsSync(resolvePath(v))) return 'File tidak ditemukan';
          },
        }),
      );
      encrypted_private_key = encryptData(
        publicKey,
        readFileSync(resolvePath(privateKeyPath), 'utf8'),
      );
      public_key = readFileSync(resolvePath(publicKeyPath), 'utf8');
    }

    updateEntry({
      ...entry,
      source,
      description: description || '',
      encrypted_private_key,
      public_key,
    });
    p.log.success(
      chalk.green(`✔ SSH Key '${chalk.bold(source)}' berhasil diperbarui.`),
    );
    return;
  }

  if (entry.type === 'ssh_cred') {
    const source = checkCancel(
      await p.text({
        message: 'Nama/label (source)',
        initialValue: entry.source,
      }),
    );
    const host = checkCancel(
      await p.text({ message: 'Host', initialValue: entry.host }),
    );
    const portInput = checkCancel(
      await p.text({
        message: 'Port',
        initialValue: String(entry.port),
        validate(v) {
          if (v && Number.isNaN(Number(v))) return 'Port harus angka';
        },
      }),
    );
    const username = checkCancel(
      await p.text({ message: 'Username', initialValue: entry.username }),
    );
    const description = checkCancel(
      await p.text({
        message: 'Deskripsi (opsional)',
        initialValue: entry.description,
        defaultValue: '',
      }),
    );

    const changePassword = checkCancel(
      await p.confirm({ message: 'Ganti password?', initialValue: false }),
    );
    let encrypted_password = entry.encrypted_password;
    if (changePassword) {
      const newPw = await passwordOrGenerate();
      encrypted_password = encryptData(publicKey, newPw);
    }

    updateEntry({
      ...entry,
      source,
      host,
      port: Number(portInput || entry.port),
      username,
      description: description || '',
      encrypted_password,
    });
    p.log.success(
      chalk.green(
        `✔ SSH Credential '${chalk.bold(source)}' berhasil diperbarui.`,
      ),
    );
    return;
  }

  // github, gitlab, gmail, bank, website
  const source = checkCancel(
    await p.text({ message: 'Source / Nama', initialValue: entry.source }),
  );
  const username = checkCancel(
    await p.text({
      message: 'Username / Email / No. Rekening',
      initialValue: entry.username,
    }),
  );
  const description = checkCancel(
    await p.text({
      message: 'Deskripsi (opsional)',
      initialValue: entry.description,
      defaultValue: '',
    }),
  );

  const changePassword = checkCancel(
    await p.confirm({ message: 'Ganti password?', initialValue: false }),
  );
  let encrypted_password = entry.encrypted_password;
  if (changePassword) {
    const newPw = await passwordOrGenerate();
    encrypted_password = encryptData(publicKey, newPw);
  }

  let extra = entry.extra;

  if (entry.type === 'bank') {
    const accountNumber = checkCancel(
      await p.text({
        message: 'Nomor rekening (opsional)',
        initialValue: entry.extra?.account_number || '',
        defaultValue: '',
      }),
    );
    if (accountNumber)
      extra = { ...(extra || {}), account_number: accountNumber };
  }

  if (entry.type === 'website') {
    const url = checkCancel(
      await p.text({
        message: 'URL website (opsional)',
        initialValue: entry.extra?.url || '',
        defaultValue: '',
      }),
    );
    if (url) extra = { ...(extra || {}), url };
  }

  updateEntry({
    ...entry,
    source,
    username,
    description: description || '',
    encrypted_password,
    extra,
  });
  p.log.success(
    chalk.green(`✔ Credential '${chalk.bold(source)}' berhasil diperbarui.`),
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
