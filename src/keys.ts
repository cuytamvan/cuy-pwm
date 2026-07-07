import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import {
  PRIVATE_KEY_PATH,
  PUBLIC_KEY_PATH,
  CONFIG_FILE,
  ensureAppDir,
} from './config';
import type { AppConfig } from './types';

export function keysExist(): boolean {
  return existsSync(PRIVATE_KEY_PATH) && existsSync(PUBLIC_KEY_PATH);
}

export function loadConfig(): AppConfig {
  if (!existsSync(CONFIG_FILE)) return { protected: false };
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { protected: false };
  }
}

export function saveConfig(cfg: AppConfig) {
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

/**
 * Menjalankan perintah `openssl` lewat Bun.spawn.
 * Passphrase (kalau ada) dikirim lewat environment variable (bukan argumen
 * command line) supaya tidak nampak di `ps aux`.
 */
async function runOpenssl(args: string[], env?: Record<string, string>) {
  const proc = Bun.spawn(['openssl', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env },
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`openssl exited with code ${exitCode}: ${stderr.trim()}`);
  }
}

export async function generateKeysFlow() {
  ensureAppDir();

  p.log.warn(
    chalk.yellow(
      'Key pair belum ditemukan di ~/.cuy-pwm/keys. Kita generate dulu ya.',
    ),
  );

  const useProtect = await p.confirm({
    message: 'Proteksi private key pakai passphrase?',
    initialValue: true,
  });

  if (p.isCancel(useProtect)) {
    p.cancel('Dibatalkan.');
    process.exit(0);
  }

  let passphrase: string | undefined;

  if (useProtect) {
    const pass1 = await p.password({ message: 'Masukkan passphrase' });
    if (p.isCancel(pass1)) {
      p.cancel('Dibatalkan.');
      process.exit(0);
    }

    const pass2 = await p.password({ message: 'Konfirmasi passphrase' });
    if (p.isCancel(pass2)) {
      p.cancel('Dibatalkan.');
      process.exit(0);
    }

    if (pass1 !== pass2) {
      p.log.error(
        chalk.red('Passphrase tidak sama. Silakan jalankan ulang aplikasinya.'),
      );
      process.exit(1);
    }

    passphrase = pass1;
  }

  const s = p.spinner();
  s.start('Generating RSA 4096-bit key pair via openssl...');

  try {
    if (passphrase) {
      await runOpenssl(
        [
          'genrsa',
          '-aes256',
          '-passout',
          'env:PWM_PASSPHRASE',
          '-out',
          PRIVATE_KEY_PATH,
          '4096',
        ],
        { PWM_PASSPHRASE: passphrase },
      );

      await runOpenssl(
        [
          'rsa',
          '-in',
          PRIVATE_KEY_PATH,
          '-passin',
          'env:PWM_PASSPHRASE',
          '-pubout',
          '-out',
          PUBLIC_KEY_PATH,
        ],
        { PWM_PASSPHRASE: passphrase },
      );
    } else {
      await runOpenssl(['genrsa', '-out', PRIVATE_KEY_PATH, '4096']);
      await runOpenssl([
        'rsa',
        '-in',
        PRIVATE_KEY_PATH,
        '-pubout',
        '-out',
        PUBLIC_KEY_PATH,
      ]);
    }

    saveConfig({ protected: !!passphrase });

    s.stop('RSA key pair berhasil dibuat.');
    p.log.success(chalk.green(`Private key: ${PRIVATE_KEY_PATH}`));
    p.log.success(chalk.green(`Public key : ${PUBLIC_KEY_PATH}`));
  } catch (err) {
    s.stop('Gagal generate key.');
    p.log.error(chalk.red(String(err)));
    process.exit(1);
  }
}

export async function ensureKeys() {
  if (!keysExist()) {
    await generateKeysFlow();
  }
}

export function readPublicKey(): string {
  return readFileSync(PUBLIC_KEY_PATH, 'utf8');
}

export function readPrivateKeyPem(): string {
  return readFileSync(PRIVATE_KEY_PATH, 'utf8');
}

export async function getPrivateKeyPassphraseIfNeeded(): Promise<
  string | undefined
> {
  const cfg = loadConfig();
  if (!cfg.protected) return undefined;

  const pass = await p.password({ message: 'Masukkan passphrase private key' });
  if (p.isCancel(pass)) {
    p.cancel('Dibatalkan.');
    process.exit(0);
  }
  return pass;
}
