import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { randomBytes } from 'crypto';
import { RedisCacheService } from '../redisCache/redisCache.service';

export interface ChatTaskData {
  taskId: string;
  userId: number;
  body: any;
  headers: any;
  ip: string;
}

export interface ChatTaskResult {
  success: boolean;
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  data?: {
    text?: string;
    chatId?: number;
    emotion?: string;
    psychologicalDesc?: string;
    audioUrl?: string;
    voiceDuration?: number;
    imageUrl?: string;
  };
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class ChatQueueService {
  private readonly logger = new Logger(ChatQueueService.name);

  constructor(
    @InjectQueue('chat-queue') private chatQueue: Queue,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  /**
   * 添加聊天任务到队列
   */
  async addChatTask(data: Omit<ChatTaskData, 'taskId'>): Promise<ChatTaskResult> {
    // 使用 crypto.randomBytes 生成唯一ID
    const taskId = randomBytes(16).toString('hex');
    const taskData: ChatTaskData = {
      taskId,
      ...data,
    };

    // 添加到队列
    await this.chatQueue.add('process-chat', taskData, {
      attempts: 3, // 最多重试3次
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      timeout: 120000, // 2分钟超时
    });

    // 初始化任务状态
    const result: ChatTaskResult = {
      success: true,
      taskId,
      status: 'pending',
      createdAt: new Date(),
    };

    await this.saveTaskStatus(taskId, result);

    this.logger.log(`Chat task ${taskId} added to queue for user ${data.userId}`);

    return result;
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<ChatTaskResult | null> {
    const cacheKey = `chat-task:${taskId}`;
    const cached = await this.redisCacheService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    return null;
  }

  /**
   * 保存任务状态
   */
  async saveTaskStatus(taskId: string, result: ChatTaskResult): Promise<void> {
    const cacheKey = `chat-task:${taskId}`;
    result.updatedAt = new Date();

    // 保存到Redis，过期时间10分钟
    await this.redisCacheService.set({ key: cacheKey, val: JSON.stringify(result) }, 600);
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId: string, progress: number): Promise<void> {
    const status = await this.getTaskStatus(taskId);
    if (status) {
      status.progress = progress;
      status.updatedAt = new Date();
      await this.saveTaskStatus(taskId, status);
    }
  }

  /**
   * 标记任务为处理中
   */
  async markTaskProcessing(taskId: string): Promise<void> {
    const status = await this.getTaskStatus(taskId);
    if (status) {
      status.status = 'processing';
      status.updatedAt = new Date();
      await this.saveTaskStatus(taskId, status);
    }
  }

  /**
   * 标记任务完成
   */
  async markTaskCompleted(taskId: string, data: ChatTaskResult['data']): Promise<void> {
    const status = await this.getTaskStatus(taskId);
    if (status) {
      status.status = 'completed';
      status.data = data;
      status.progress = 100;
      status.updatedAt = new Date();
      await this.saveTaskStatus(taskId, status);
    }
  }

  /**
   * 标记任务失败
   */
  async markTaskFailed(taskId: string, error: string): Promise<void> {
    const status = await this.getTaskStatus(taskId);
    if (status) {
      status.status = 'failed';
      status.error = error;
      status.updatedAt = new Date();
      await this.saveTaskStatus(taskId, status);
    }
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.chatQueue.getWaitingCount(),
      this.chatQueue.getActiveCount(),
      this.chatQueue.getCompletedCount(),
      this.chatQueue.getFailedCount(),
      this.chatQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  }
}
