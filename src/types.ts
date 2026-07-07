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

export interface SimpleCredentialEntry extends BaseEntry {
  type: 'github' | 'gitlab' | 'gmail' | 'website' | 'bank';
  username: string;
  encrypted_password: string;
  extra?: Record<string, string>;
}

export interface SshCredEntry extends BaseEntry {
  type: 'ssh_cred';
  username: string;
  encrypted_password: string;
  host: string;
  port: number;
}

export interface SshKeyEntry extends BaseEntry {
  type: 'ssh_key';
  encrypted_private_key: string;
  public_key: string;
}

export type PasswordEntry = SimpleCredentialEntry | SshCredEntry | SshKeyEntry;

export interface AppConfig {
  protected: boolean;
}
