import { Global, Logger, Module } from '@nestjs/common';
import { createClient } from 'redis';
import { RedisCacheService } from './redisCache.service';

@Global()
@Module({
  imports: [],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: async () => {
        const host = process.env.REDIS_HOST;
        const port = parseInt(process.env.REDIS_PORT, 10);
        const password = process.env.REDIS_PASSWORD;
        const username = process.env.REDIS_USER;
        const database = parseInt(process.env.REDIS_DB, 10) || 0;

        if (!host || !port) {
          Logger.error(
            `Please configure Redis config | 未配置 Redis 配置信息，请确认配置 Redis 服务以获得更好的体验`,
            'RedisCacheModule',
          );
          return;
        }

        const client = createClient({
          socket: {
            host,
            port,
            reconnectStrategy: retries => {
              if (retries > 10) {
                Logger.error('Redis 重连次数超过限制，停止重连', 'RedisCacheModule');
                return new Error('Redis 重连失败');
              }
              const delay = Math.min(retries * 100, 3000);
              Logger.warn(
                `Redis 连接断开，${delay}ms 后进行第 ${retries} 次重连`,
                'RedisCacheModule',
              );
              return delay;
            },
          },
          username,
          password,
          database,
        });

        client.on('ready', () => {
          Logger.log(`Redis connection successful`, 'RedisCacheModule');
        });

        client.on('error', err => {
          // 只记录错误，不抛出异常，避免影响应用启动
          if (err.message && !err.message.includes('ECONNRESET')) {
            Logger.error(`Redis connection error: ${err.message}`, 'RedisCacheModule');
          }
        });

        client.on('reconnecting', () => {
          Logger.warn('Redis 正在重新连接...', 'RedisCacheModule');
        });

        try {
          await client.connect();
          Logger.log('Redis 客户端连接成功', 'RedisCacheModule');
        } catch (error) {
          Logger.error(
            `Redis 初始连接失败: ${error.message}，将在后台自动重连`,
            'RedisCacheModule',
          );
        }

        return client;
      },
    },
    RedisCacheService,
  ],
  exports: ['REDIS_CLIENT', RedisCacheService],
})
export class RedisCacheModule {}
