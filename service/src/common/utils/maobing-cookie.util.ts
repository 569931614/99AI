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
  // 语音通话专用参数
  isVoiceCall?: boolean;
  callMinutes?: number;
}

interface CookieAdjustResult {
  success: boolean;
  message: string;
  data?: any;
  // 语音通话返回的额外信息
  callMinutes?: number;
  freeMinutesUsed?: number;
  cookieDeducted?: number;
  remainingFreeMinutes?: number;
}

interface CookieBalanceParams {
  token: string;
  maobingBaseUrl?: string;
  timeoutMs?: number;
}

interface CookieBalanceResult {
  success: boolean;
  balance: number;
  message?: string;
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

      // 语音通话专用参数
      if (params.isVoiceCall) {
        formData.append('is_voice_call', '1');
        formData.append('check_free_chat', '0');
        formData.append('check_free_call', '1');
        if (params.callMinutes !== undefined) {
          formData.append('call_minutes', String(params.callMinutes));
        }
      } else {
        // 非语音聊天
        formData.append('check_free_chat', '1');
      }

      const response = await axios.post(url, formData, {
        timeout: params.timeoutMs ?? 5000,
        headers: formData.getHeaders(),
      });
      const payload = response.data;
      if (payload?.code === 1) {
        const logMsg = params.isVoiceCall
          ? `语音通话扣费成功 - userId: ${params.userId}, callMinutes: ${params.callMinutes}, freeUsed: ${payload?.data?.free_minutes_used}, cookieDeducted: ${payload?.data?.cookie_deducted}`
          : `饼干${type === 2 ? '扣除' : '返还'}成功 - userId: ${params.userId}, amount: ${params.amount}, remark: ${params.remark}`;
        this.logger.log(logMsg);

        return {
          success: true,
          message: payload?.msg || '操作成功',
          data: payload?.data,
          // 语音通话返回的额外信息
          callMinutes: payload?.data?.call_minutes,
          freeMinutesUsed: payload?.data?.free_minutes_used,
          cookieDeducted: payload?.data?.cookie_deducted,
          remainingFreeMinutes: payload?.data?.remaining_free_minutes,
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

  /**
   * 查询用户饼干余额
   */
  static async getCookieBalance(params: CookieBalanceParams): Promise<CookieBalanceResult> {
    const root = (params.maobingBaseUrl || process.env.MAOBING_BASE_URL || '').replace(/\/$/, '');
    if (!root) {
      return { success: false, balance: 0, message: 'MAOBING_BASE_URL 未配置' };
    }

    const url = `${root}/api/user/index`;

    try {
      const formData = new FormData();
      formData.append('token', params.token);

      const response = await axios.post(url, formData, {
        timeout: params.timeoutMs ?? 5000,
        headers: formData.getHeaders(),
      });

      const payload = response.data;
      if (payload?.code === 1 && payload?.data) {
        const balance = Number(payload.data.cookie) || 0;
        this.logger.debug(`查询饼干余额成功: balance=${balance}`);
        return { success: true, balance };
      }

      return {
        success: false,
        balance: 0,
        message: payload?.msg || '查询余额失败',
      };
    } catch (error: any) {
      const message = error?.response?.data?.msg || error?.message || '查询余额失败';
      this.logger.error(`查询饼干余额失败 (${url}): ${message}`);
      return { success: false, balance: 0, message };
    }
  }
}
