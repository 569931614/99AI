import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Maobing平台Token验证工具
 */
export class MaobingAuthUtil {
  private static readonly logger = new Logger('MaobingAuth');

  // Token缓存，避免频繁请求
  // 格式：{ token: { userId: number, expireTime: number } }
  private static tokenCache = new Map<string, { userId: number; expireTime: number }>();

  // 缓存过期时间：12小时
  private static readonly CACHE_DURATION = 12 * 60 * 60 * 1000;

  /**
   * 验证token并获取用户ID
   * @param token - Maobing平台token
   * @param maobingBaseUrl - Maobing平台的base URL（可选，用于支持自定义域名）
   * @returns 用户ID，验证失败返回null
   */
  static async validateTokenAndGetUserId(
    token: string,
    maobingBaseUrl?: string,
  ): Promise<number | null> {
    if (!token) {
      return null;
    }

    // 检查缓存
    const cached = this.tokenCache.get(token);
    if (cached && cached.expireTime > Date.now()) {
      this.logger.debug(`Token缓存命中: userId=${cached.userId}`);
      return cached.userId;
    }

    // 构建API URL（支持自定义域名）
    const baseUrl = maobingBaseUrl || process.env.MAOBING_BASE_URL;
    if (!baseUrl) {
      this.logger.error('MAOBING_BASE_URL 未配置');
      return null;
    }
    const apiUrl = `${baseUrl}/api/user/index`;

    // 缓存无效，向Maobing平台验证
    try {
      const response = await axios.post(apiUrl, `token=${encodeURIComponent(token)}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 5000,
      });

      if (response.data.code === 1 && response.data.data?.id) {
        const userId = response.data.data.id;

        // 更新缓存
        this.tokenCache.set(token, {
          userId,
          expireTime: Date.now() + this.CACHE_DURATION,
        });

        // 清理过期缓存
        this.cleanExpiredCache();

        this.logger.debug(`Token验证成功: userId=${userId}, API=${apiUrl}`);
        return userId;
      } else {
        this.logger.warn(`Token验证失败: ${response.data.msg || 'Invalid token'}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Token验证请求失败 (${apiUrl}): ${error.message}`);
      return null;
    }
  }

  /**
   * 清理过期的缓存条目
   */
  private static cleanExpiredCache() {
    const now = Date.now();
    for (const [token, cache] of this.tokenCache.entries()) {
      if (cache.expireTime <= now) {
        this.tokenCache.delete(token);
      }
    }
  }
}
