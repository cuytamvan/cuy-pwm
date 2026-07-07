import {
  publicEncrypt,
  privateDecrypt,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  constants,
} from 'node:crypto';

interface EncryptedPayload {
  k: string;
  iv: string;
  tag: string;
  data: string;
}

export function encryptData(publicKeyPem: string, plaintext: string): string {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const encryptedKey = publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey,
  );

  const payload: EncryptedPayload = {
    k: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decryptData(
  privateKeyPem: string,
  passphrase: string | undefined,
  encryptedString: string,
): string {
  const payload: EncryptedPayload = JSON.parse(
    Buffer.from(encryptedString, 'base64').toString('utf8'),
  );

  const aesKey = privateDecrypt(
    {
      key: privateKeyPem,
      passphrase,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(payload.k, 'base64'),
  );

  const decipher = createDecipheriv(
    'aes-256-gcm',
    aesKey,
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
