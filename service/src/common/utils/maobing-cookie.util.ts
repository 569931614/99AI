import { Logger } from '@nestjs/common';
import axios from 'axios';

type CookieAction = 1 | 2;

interface CookieAdjustParams {
  userId: number;
  amount: number;
  remark?: string;
  maobingBaseUrl?: string;
  timeoutMs?: number;
}

interface CookieAdjustResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * 调用猫饼开放接口调整饼干
 */
export class MaobingCookieUtil {
  private static readonly logger = new Logger('MaobingCookie');
  private static readonly DEFAULT_BASE_URL = 'https://maobingai.lnkj5.com';

  private static buildEndpoint(baseUrl?: string) {
    const root = (baseUrl || this.DEFAULT_BASE_URL).replace(/\/$/, '');
    return `${root}/api/open/user/cookie`;
  }

  private static async adjustCookie(params: CookieAdjustParams, type: CookieAction) {
    const url = this.buildEndpoint(params.maobingBaseUrl);
    try {
      const response = await axios.post(
        url,
        {
          userId: params.userId,
          type,
          num: params.amount,
          remark: params.remark,
        },
        {
          timeout: params.timeoutMs ?? 5000,
        },
      );
      const payload = response.data;
      if (payload?.code === 1) {
        return {
          success: true,
          message: payload?.msg || '操作成功',
          data: payload?.data,
        } as CookieAdjustResult;
      }
      return {
        success: false,
        message: payload?.msg || '饼干操作失败',
        data: payload?.data,
      } as CookieAdjustResult;
    } catch (error: any) {
      const message =
        error?.response?.data?.msg ||
        error?.message ||
        (type === 2 ? '饼干扣费失败' : '饼干返还失败');
      this.logger.error(`Maobing cookie adjust failed (${url}): ${message}`);
      return {
        success: false,
        message,
      };
    }
  }

  static deductCookies(params: CookieAdjustParams): Promise<CookieAdjustResult> {
    return this.adjustCookie(params, 2);
  }

  static refundCookies(params: CookieAdjustParams): Promise<CookieAdjustResult> {
    return this.adjustCookie(params, 1);
  }
}
