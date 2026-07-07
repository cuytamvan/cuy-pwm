export type CredentialType =
  'github' | 'gitlab' | 'gmail' | 'bank' | 'website' | 'ssh_cred' | 'ssh_key';

export interface CredUser {
  id: string;
  name: string;
}

export interface BaseEntry {
  id: string;
  type: CredentialType;
  source: string;
  description: string;
  createdAt: string;
  cred_user_id: string | null;
}

/**
 * Dipakai untuk: github, gitlab, gmail, bank, website
 * `extra` dipakai untuk field tambahan spesifik tipe (mis. account_number, url)
 */
export interface SimpleCredentialEntry extends BaseEntry {
  type: 'github' | 'gitlab' | 'gmail' | 'website' | 'bank';
  username: string;
  encrypted_password: string;
  extra?: Record<string, string>;
}

/** SSH credential (host, port, username, password) */
export interface SshCredEntry extends BaseEntry {
  type: 'ssh_cred';
  username: string;
  encrypted_password: string;
  host: string;
  port: number;
}

/** SSH key pair (private key dienkripsi, public key disimpan apa adanya) */
export interface SshKeyEntry extends BaseEntry {
  type: 'ssh_key';
  encrypted_private_key: string;
  public_key: string;
}

export type PasswordEntry = SimpleCredentialEntry | SshCredEntry | SshKeyEntry;

export interface AppConfig {
  /** apakah private key diproteksi dengan passphrase */
  protected: boolean;
}
