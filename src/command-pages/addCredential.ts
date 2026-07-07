import * as p from '@clack/prompts';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'node:fs';
import { readPublicKey } from '../keys';
import { encryptData } from '../crypto';
import { loadUsers, addEntry, newId } from '../store';
import { credentialTypeOptions } from '../ui';
import { checkCancel, resolvePath, passwordOrGenerate } from '../utils';
import type {
  SimpleCredentialEntry,
  SshCredEntry,
  SshKeyEntry,
  CredentialType,
} from '../types';

export async function addCredentialFlow() {
  const type = checkCancel(
    await p.select({
      message: 'Select credential type',
      options: credentialTypeOptions(),
    }),
  ) as CredentialType;

  const users = loadUsers();
  let cred_user_id: string | null = null;
  if (users.length) {
    const userChoice = checkCancel(
      await p.select({
        message: 'Link to a user?',
        options: [
          { value: '__none__', label: chalk.dim('— No User —') },
          ...users.map((u) => ({ value: u.id, label: u.name })),
        ],
      }),
    ) as string;
    cred_user_id = userChoice === '__none__' ? null : userChoice;
  }

  const publicKey = readPublicKey();
  const id = newId();
  const createdAt = new Date().toISOString();

  if (type === 'ssh_key') {
    const source = checkCancel(
      await p.text({
        message: 'Name / label (source)',
        placeholder: 'e.g. server-prod',
      }),
    );
    const description = checkCancel(
      await p.text({ message: 'Description (optional)', defaultValue: '' }),
    );
    const privateKeyPath = checkCancel(
      await p.text({
        message: 'Private key file path',
        placeholder: '~/.ssh/id_rsa',
        validate(v) {
          if (!v) return 'Required';
          if (!existsSync(resolvePath(v))) return 'File not found';
        },
      }),
    );
    const publicKeyPath = checkCancel(
      await p.text({
        message: 'Public key file path',
        placeholder: '~/.ssh/id_rsa.pub',
        validate(v) {
          if (!v) return 'Required';
          if (!existsSync(resolvePath(v))) return 'File not found';
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
      cred_user_id,
      encrypted_private_key: encryptData(publicKey, privateKeyContent),
      public_key: publicKeyContent,
    };

    addEntry(entry);
    p.log.success(
      chalk.green(`✔ SSH Key '${chalk.bold(source)}' saved successfully.`),
    );
    return;
  }

  if (type === 'ssh_cred') {
    const source = checkCancel(
      await p.text({
        message: 'Name / label (source)',
        placeholder: 'e.g. server-prod',
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
          if (v && Number.isNaN(Number(v))) return 'Port must be a number';
        },
      }),
    );
    const username = checkCancel(await p.text({ message: 'Username' }));
    const password = await passwordOrGenerate();
    const description = checkCancel(
      await p.text({ message: 'Description (optional)', defaultValue: '' }),
    );

    const entry: SshCredEntry = {
      id,
      type,
      source,
      description: description || '',
      createdAt,
      cred_user_id,
      host,
      port: Number(portInput || '22'),
      username,
      encrypted_password: encryptData(publicKey, password),
    };

    addEntry(entry);
    p.log.success(
      chalk.green(
        `✔ SSH Credential '${chalk.bold(source)}' saved successfully.`,
      ),
    );
    return;
  }

  // github, gitlab, gmail, bank, website
  const source = checkCancel(
    await p.text({
      message: 'Source / Name (e.g. github.com, bank name, website URL)',
    }),
  );
  const username = checkCancel(
    await p.text({ message: 'Username / Email / Account number' }),
  );
  const password = await passwordOrGenerate();
  const description = checkCancel(
    await p.text({ message: 'Description (optional)', defaultValue: '' }),
  );

  let extra: Record<string, string> | undefined;

  if (type === 'bank') {
    const accountNumber = checkCancel(
      await p.text({ message: 'Account number (optional)', defaultValue: '' }),
    );
    if (accountNumber)
      extra = { ...(extra || {}), account_number: accountNumber };
  }

  if (type === 'website') {
    const url = checkCancel(
      await p.text({ message: 'Website URL (optional)', defaultValue: '' }),
    );
    if (url) extra = { ...(extra || {}), url };
  }

  const entry: SimpleCredentialEntry = {
    id,
    type,
    source,
    description: description || '',
    createdAt,
    cred_user_id,
    username,
    encrypted_password: encryptData(publicKey, password),
    extra,
  };

  addEntry(entry);
  p.log.success(
    chalk.green(`✔ Credential '${chalk.bold(source)}' saved successfully.`),
  );
}
