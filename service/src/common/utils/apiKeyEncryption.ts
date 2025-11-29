import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
const logger = new Logger('ApiKeyEncryption');

/**
 * 获取加密密钥
 * 从环境变量读取，如果没有则使用默认值（仅用于开发环境）
 */
function getEncryptionKey(): Buffer {
  const secretKey = process.env.API_KEY_ENCRYPTION_SECRET;

  if (!secretKey) {
    logger.warn(
      'API_KEY_ENCRYPTION_SECRET 未设置，使用默认密钥（仅用于开发环境，生产环境必须设置）',
    );
    // 默认密钥（仅用于开发环境）- 32字节
    return Buffer.from('99ai-default-encryption-key-32b');
  }

  // 如果是十六进制字符串，直接解析
  if (secretKey.length === 64) {
    try {
      return Buffer.from(secretKey, 'hex');
    } catch (error) {
      logger.error('API_KEY_ENCRYPTION_SECRET 格式错误，应为64位十六进制字符串');
      throw new Error('加密密钥格式错误');
    }
  }

  // 如果是普通字符串，使用SHA256生成32字节密钥
  return crypto.createHash('sha256').update(secretKey).digest();
}

/**
 * 加密API Key
 * @param plaintext 明文API Key
 * @returns 加密后的字符串（格式：iv:authTag:encrypted）
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // 格式: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error(`加密API Key失败: ${error.message}`);
    throw new Error('API Key加密失败');
  }
}

/**
 * 解密API Key
 * @param ciphertext 加密后的字符串（格式：iv:authTag:encrypted）
 * @returns 解密后的明文API Key
 */
export function decryptApiKey(ciphertext: string): string {
  if (!ciphertext) {
    return '';
  }

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('加密数据格式错误');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error(`解密API Key失败: ${error.message}`);
    throw new Error('API Key解密失败');
  }
}

/**
 * 脱敏显示API Key
 * @param apiKey API Key（明文或密文）
 * @returns 脱敏后的字符串
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '***';
  }

  // 如果是加密后的格式（包含冒号），尝试解密后再脱敏
  if (apiKey.includes(':')) {
    try {
      const decrypted = decryptApiKey(apiKey);
      if (decrypted.length < 8) {
        return '***';
      }
      return `${decrypted.substring(0, 7)}***${decrypted.substring(decrypted.length - 3)}`;
    } catch {
      // 解密失败，直接返回***
      return '***';
    }
  }

  // 明文直接脱敏
  return `${apiKey.substring(0, 7)}***${apiKey.substring(apiKey.length - 3)}`;
}

/**
 * 生成随机加密密钥（用于初始化）
 * @returns 64位十六进制字符串
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
