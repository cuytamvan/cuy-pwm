import * as p from '@clack/prompts';
import chalk from 'chalk';
import { readFileSync, existsSync } from 'node:fs';
import {
  readPublicKey,
  readPrivateKeyPem,
  getPrivateKeyPassphraseIfNeeded,
} from '../keys';
import { encryptData, decryptData } from '../crypto';
import { deleteEntry, updateEntry, loadUsers } from '../store';
import { entryLabel, detailBox, dangerBox } from '../ui';
import {
  checkCancel,
  resolvePath,
  passwordOrGenerate,
  pickFilteredEntries,
} from '../utils';
import type { PasswordEntry } from '../types';

export async function viewCredentialFlow() {
  const { entries, total } = await pickFilteredEntries();

  if (!total) {
    p.log.warn(chalk.yellow('No credentials saved yet.'));
    return;
  }

  if (!entries.length) {
    p.log.warn(chalk.yellow('No credentials found for this user.'));
    return;
  }

  const selected = checkCancel(
    await p.select({
      message: 'Select a credential',
      options: entries.map((e) => ({ value: e.id, label: entryLabel(e) })),
    }),
  );

  const entry = entries.find((e) => e.id === selected)!;

  const subAction = checkCancel(
    await p.select({
      message: `Actions for '${chalk.bold(entry.source)}'`,
      options: [
        { value: 'view', label: `${chalk.cyan('👁 ')}  View Detail` },
        { value: 'edit', label: `${chalk.yellow('✏️ ')}  Edit Credential` },
        { value: 'delete', label: `${chalk.red('🗑 ')}  Delete Credential` },
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

export async function showEntryDetail(entry: PasswordEntry) {
  const privateKeyPem = readPrivateKeyPem();
  const passphrase = await getPrivateKeyPassphraseIfNeeded();

  const s = p.spinner();
  s.start('🔐 Decrypting data...');

  try {
    let body = `${chalk.dim('Description')} : ${entry.description || '-'}\n`;

    if (entry.type === 'ssh_key') {
      const decryptedPrivate = decryptData(
        privateKeyPem,
        passphrase,
        entry.encrypted_private_key,
      );
      body += `\n${chalk.bold.cyan('Public Key')}\n${chalk.gray(entry.public_key.trim())}\n`;
      body += `\n${chalk.bold.cyan('Private Key')}\n${chalk.magentaBright(decryptedPrivate.trim())}\n`;
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

    s.stop(chalk.green('✔ Decrypted successfully.'));
    console.log(detailBox(entry, body.trim()));
  } catch (err) {
    s.stop(chalk.red('✖ Decryption failed.'));
    throw new Error(
      'Failed to decrypt data. Make sure the private key passphrase is correct. Detail: ' +
        String(err),
    );
  }
}

export async function confirmAndDeleteEntry(entry: PasswordEntry) {
  console.log(
    dangerBox(
      '⚠️  Confirm Delete',
      `${entryLabel(entry)}\n${chalk.dim('This action cannot be undone.')}`,
    ),
  );

  const confirmed = checkCancel(
    await p.confirm({
      message: `Are you sure you want to delete '${entry.source}'?`,
      initialValue: false,
    }),
  );

  if (!confirmed) {
    p.log.info(chalk.dim('Cancelled.'));
    return;
  }

  deleteEntry(entry.id);
  p.log.success(
    chalk.green(
      `✔ Credential '${chalk.bold(entry.source)}' deleted successfully.`,
    ),
  );
}

export async function editEntryFlow(entry: PasswordEntry) {
  const publicKey = readPublicKey();

  const users = loadUsers();
  let cred_user_id = entry.cred_user_id;
  if (users.length) {
    const userChoice = checkCancel(
      await p.select({
        message: 'Linked user',
        options: [
          { value: '__none__', label: chalk.dim('— No User —') },
          ...users.map((u) => ({ value: u.id, label: u.name })),
        ],
      }),
    ) as string;
    cred_user_id = userChoice === '__none__' ? null : userChoice;
  }

  if (entry.type === 'ssh_key') {
    const source = checkCancel(
      await p.text({
        message: 'Name / label (source)',
        initialValue: entry.source,
      }),
    );
    const description = checkCancel(
      await p.text({
        message: 'Description (optional)',
        initialValue: entry.description,
        defaultValue: '',
      }),
    );

    const changeKey = checkCancel(
      await p.confirm({ message: 'Replace key file?', initialValue: false }),
    );

    let encrypted_private_key = entry.encrypted_private_key;
    let public_key = entry.public_key;

    if (changeKey) {
      const privateKeyPath = checkCancel(
        await p.text({
          message: 'New private key file path',
          placeholder: '~/.ssh/id_rsa',
          validate(v) {
            if (!v) return 'Required';
            if (!existsSync(resolvePath(v))) return 'File not found';
          },
        }),
      );
      const publicKeyPath = checkCancel(
        await p.text({
          message: 'New public key file path',
          placeholder: '~/.ssh/id_rsa.pub',
          validate(v) {
            if (!v) return 'Required';
            if (!existsSync(resolvePath(v))) return 'File not found';
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
      cred_user_id,
      encrypted_private_key,
      public_key,
    });
    p.log.success(
      chalk.green(`✔ SSH Key '${chalk.bold(source)}' updated successfully.`),
    );
    return;
  }

  if (entry.type === 'ssh_cred') {
    const source = checkCancel(
      await p.text({
        message: 'Name / label (source)',
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
          if (v && Number.isNaN(Number(v))) return 'Port must be a number';
        },
      }),
    );
    const username = checkCancel(
      await p.text({ message: 'Username', initialValue: entry.username }),
    );
    const description = checkCancel(
      await p.text({
        message: 'Description (optional)',
        initialValue: entry.description,
        defaultValue: '',
      }),
    );

    const changePassword = checkCancel(
      await p.confirm({ message: 'Change password?', initialValue: false }),
    );
    let encrypted_password = entry.encrypted_password;
    if (changePassword) {
      encrypted_password = encryptData(publicKey, await passwordOrGenerate());
    }

    updateEntry({
      ...entry,
      source,
      host,
      port: Number(portInput || entry.port),
      username,
      description: description || '',
      cred_user_id,
      encrypted_password,
    });
    p.log.success(
      chalk.green(
        `✔ SSH Credential '${chalk.bold(source)}' updated successfully.`,
      ),
    );
    return;
  }

  // github, gitlab, gmail, bank, website
  const source = checkCancel(
    await p.text({ message: 'Source / Name', initialValue: entry.source }),
  );
  const username = checkCancel(
    await p.text({
      message: 'Username / Email / Account number',
      initialValue: entry.username,
    }),
  );
  const description = checkCancel(
    await p.text({
      message: 'Description (optional)',
      initialValue: entry.description,
      defaultValue: '',
    }),
  );

  const changePassword = checkCancel(
    await p.confirm({ message: 'Change password?', initialValue: false }),
  );
  let encrypted_password = entry.encrypted_password;
  if (changePassword) {
    encrypted_password = encryptData(publicKey, await passwordOrGenerate());
  }

  let extra = entry.extra;

  if (entry.type === 'bank') {
    const accountNumber = checkCancel(
      await p.text({
        message: 'Account number (optional)',
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
        message: 'Website URL (optional)',
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
    cred_user_id,
    encrypted_password,
    extra,
  });
  p.log.success(
    chalk.green(`✔ Credential '${chalk.bold(source)}' updated successfully.`),
  );
}
