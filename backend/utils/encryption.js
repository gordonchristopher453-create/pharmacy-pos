const crypto = require('crypto');

// Secure key for AES-256-CBC. In production, this should be set in process.env.ENCRYPTION_KEY.
// We use a derivation of a base key to ensure we always have exactly 32 bytes.
const rawKey = process.env.ENCRYPTION_KEY || 'kenya-dha-khie-compliance-encryption-key-2026';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(rawKey).digest(); // Always exactly 32 bytes
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypts a plaintext string using AES-256-CBC
 */
function encrypt(text) {
  if (text === null || text === undefined) return text;
  const str = String(text).trim();
  if (!str) return str;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(str, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `enc::${iv.toString('hex')}::${encrypted}`;
  } catch (err) {
    console.error('[Encryption Error] Failed to encrypt field:', err.message);
    return text;
  }
}

/**
 * Decrypts a ciphertext string starting with 'enc::'
 */
function decrypt(text) {
  if (!text) return text;
  if (typeof text !== 'string' || !text.startsWith('enc::')) return text;
  try {
    const parts = text.split('::');
    if (parts.length !== 3) return text;
    const iv = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Decryption Error] Failed to decrypt field:', err.message);
    return text;
  }
}

module.exports = { encrypt, decrypt };
