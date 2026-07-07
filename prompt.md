buatkan script untuk aplikasi password manager berbasis CLI, namun menggunakan bun. untuk mempercantik cli nya tolong gunakan @clack/prompts dan chalk.

flow start up nya adalah check private key dan public key yang ada di `$homedir/.cuy-pwm/keys` dengan nama file nya `private.pem` dan `public.pem`, jika tidak ada maka di terminal nya menjalankan perintah untuk generate key nya (gunakan openssl).

type untuk list password nya adalah sebagai berikut (namun jika ada adjustment field boleh di tambahin juga):

```typescript
type PasswordList {
  source: string;
  username: string;
  encrypted_password: string;
  description: string;
}
```

peruntukan aplikasi ini untuk penyimpan credential: github, gmail, gitlab, akun bank, akun sebuah website, ssh cred (username, password, port, host), ssh key (private key dan public key)

data akan tersimpan di `$homedir/.cuy-pwm/source.json` 

aplikasi ini juga bisa generate password, saat memilih untuk generate password harus ada checklist dulu sebelum generate password, checklist nya adalah (UPPERCASE, lowercase, numeric, symbol), lalu ada input juga untuk length default nya 8