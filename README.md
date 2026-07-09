# cuy-pwm

CLI Password Manager berbasis **Bun**, dengan tampilan cantik pakai
[`@clack/prompts`](https://www.npmjs.com/package/@clack/prompts) dan
[`chalk`](https://www.npmjs.com/package/chalk).

## Fitur

- Enkripsi credential pakai **RSA 4096-bit + AES-256-GCM (hybrid)** — key pair
  di-generate lewat `openssl` saat pertama kali dijalankan.
- Simpan berbagai jenis credential: **GitHub, GitLab, Gmail, Akun Bank, Akun
  Website, SSH Credential (host/port/user/pass), SSH Key (private+public
  key)**.
- Generate password dengan checklist karakter (**UPPERCASE, lowercase,
  numeric, symbol**) + custom panjang password (default 8).
- Data tersimpan lokal di `~/.cuy-pwm/source.json`, key pair di
  `~/.cuy-pwm/keys/`.

## Instalasi

Pastikan [Bun](https://bun.sh) dan `openssl` sudah terpasang di sistem kamu.

```bash
cd cuy-pwm
bun install
```

atau bisa juga install via npm:

```bash
npm install -g @cuytamvan/cuypwm
```

## Menjalankan

```bash
bun run src/index.ts
# atau
bun run start
```

### (Opsional) Install sebagai command global

```bash
bun link
cuy-pwm
```

## Alur Pertama Kali Dijalankan

1. Aplikasi cek apakah `~/.cuy-pwm/keys/private.pem` dan `public.pem` sudah
   ada.
2. Kalau belum ada, aplikasi akan menanyakan apakah private key ingin
   diproteksi passphrase, lalu men-generate key pair RSA 4096-bit via
   `openssl genrsa` & `openssl rsa -pubout`.
3. Passphrase (kalau dipilih) **tidak pernah** dikirim lewat argumen command
   line — dikirim lewat environment variable ke proses `openssl` supaya tidak
   tampak di `ps aux`.

## Struktur Data (`source.json`)

Tipe dasarnya mengikuti bentuk berikut, dengan field tambahan menyesuaikan
tipe credential:

```typescript
interface BaseEntry {
  id: string;
  type:
    'github' | 'gitlab' | 'gmail' | 'bank' | 'website' | 'ssh_cred' | 'ssh_key';
  source: string;
  description: string;
  createdAt: string;
}

// github, gitlab, gmail, bank, website
interface SimpleCredentialEntry extends BaseEntry {
  username: string;
  encrypted_password: string;
  extra?: Record<string, string>; // mis. account_number, url
}

// ssh_cred
interface SshCredEntry extends BaseEntry {
  username: string;
  encrypted_password: string;
  host: string;
  port: number;
}

// ssh_key
interface SshKeyEntry extends BaseEntry {
  encrypted_private_key: string;
  public_key: string;
}
```

Semua field sensitif (`encrypted_password`, `encrypted_private_key`)
dienkripsi hybrid: AES-256-GCM untuk data asli, lalu AES key-nya dienkripsi
pakai RSA public key kamu. Ini supaya SSH private key yang panjang tetap bisa
dienkripsi (RSA murni punya batas ukuran plaintext).

## Catatan Keamanan

- Jangan commit folder `~/.cuy-pwm` ke git manapun.
- Kalau private key diproteksi passphrase, kamu akan diminta passphrase tiap
  kali membuka/melihat credential yang terenkripsi.
- File `source.json` aman dibagikan/backup karena semua data sensitif sudah
  terenkripsi — asal `private.pem` tidak ikut bocor.
