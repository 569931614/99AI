import { Logger } from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';

type CookieAction = 1 | 2;

interface CookieAdjustParams {
  userId: number;
  amount: number;
  remark?: string;
  maobingBaseUrl?: string;
  timeoutMs?: number;
  token?: string;
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

  private static buildEndpoint(baseUrl?: string) {
    const root = (baseUrl || process.env.MAOBING_BASE_URL || '').replace(/\/$/, '');
    if (!root) {
      throw new Error('MAOBING_BASE_URL 未配置');
    }
    return `${root}/api/user/updateCookie`;
  }

  private static async adjustCookie(params: CookieAdjustParams, type: CookieAction) {
    const url = this.buildEndpoint(params.maobingBaseUrl);
    try {
      const formData = new FormData();
      formData.append('token', params.token || '');
      formData.append('type', String(type));
      formData.append('num', String(params.amount));
      formData.append('remark', params.remark || '');

      const response = await axios.post(url, formData, {
        timeout: params.timeoutMs ?? 5000,
        headers: formData.getHeaders(),
      });
      const payload = response.data;
      if (payload?.code === 1) {
        this.logger.log(
          `饼干${type === 2 ? '扣除' : '返还'}成功 - userId: ${params.userId}, amount: ${
            params.amount
          }, remark: ${params.remark}`,
        );
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
