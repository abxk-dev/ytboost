const crypto = require('crypto');

function isHexString(v) {
  return typeof v === 'string' && v.length > 0 && v.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(v);
}

function getKey() {
  const raw = String(process.env.WALLET_ENCRYPTION_KEY || '').trim();
  if (!isHexString(raw)) {
    throw new Error('WALLET_ENCRYPTION_KEY must be a hex string');
  }
  const key = Buffer.from(raw, 'hex');
  if (key.length !== 32) {
    throw new Error('WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex chars) for aes-256-gcm');
  }
  return key;
}

function encrypt(text) {
  if (typeof text !== 'string') {
    throw new TypeError('encrypt(text) expects a string');
  }

  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    content: ciphertext.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'object') {
    throw new TypeError('decrypt(encryptedData) expects an object');
  }

  const { iv, content, authTag } = encryptedData;
  if (!isHexString(iv) || !isHexString(content) || !isHexString(authTag)) {
    throw new TypeError('encryptedData.iv/content/authTag must be hex strings');
  }

  const ivBuf = Buffer.from(iv, 'hex');
  const contentBuf = Buffer.from(content, 'hex');
  const tagBuf = Buffer.from(authTag, 'hex');

  if (ivBuf.length !== 12) {
    throw new Error('Invalid IV length (expected 12 bytes)');
  }
  if (tagBuf.length !== 16) {
    throw new Error('Invalid authTag length (expected 16 bytes)');
  }

  const key = getKey();
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf);
    decipher.setAuthTag(tagBuf);
    const plaintext = Buffer.concat([decipher.update(contentBuf), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    throw new Error('Decryption failed');
  }
}

module.exports = { encrypt, decrypt };

if (require.main === module) {
  const input = 'hello-wallet';
  const encrypted = encrypt(input);
  const decrypted = decrypt(encrypted);
  console.log({ encrypted, decrypted });
}

