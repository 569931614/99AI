import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseService } from './database.service';

// Import all entities explicitly
import { AffectionRuleEntity, UserAppAffectionEntity } from '../affection/affection.entity';
import { AppEntity } from '../app/app.entity';
import { AppCatsEntity } from '../app/appCats.entity';
import { AppEmotionVoiceEntity } from '../app/appEmotionVoice.entity';
import { AppVoiceEntity } from '../app/appVoice.entity';
import { RoleEmotionEntity } from '../app/roleEmotion.entity';
import { UserAppsEntity } from '../app/userApps.entity';
import { AutoReplyEntity } from '../autoReply/autoReply.entity';
import { BadWordsEntity } from '../badWords/badWords.entity';
import { ViolationLogEntity } from '../badWords/violationLog.entity';
import { ChatGroupEntity } from '../chatGroup/chatGroup.entity';
import { ChatLogEntity } from '../chatLog/chatLog.entity';
import { ConversationSummaryEntity } from '../conversationSummary/conversationSummary.entity';
import { CramiEntity } from '../crami/crami.entity';
import { CramiPackageEntity } from '../crami/cramiPackage.entity';
import { ConfigEntity } from '../globalConfig/config.entity';
import { ModelsEntity } from '../models/models.entity';
import { OrderEntity } from '../order/order.entity';
import { PluginEntity } from '../plugin/plugin.entity';
import { Share } from '../share/share.entity';
import { SigninEntity } from '../signin/signIn.entity';
import { UserEntity } from '../user/user.entity';
import { AccountLogEntity } from '../userBalance/accountLog.entity';
import { BalanceEntity } from '../userBalance/balance.entity';
import { FingerprintLogEntity } from '../userBalance/fingerprint.entity';
import { UserBalanceEntity } from '../userBalance/userBalance.entity';
import { UserAppSettingsEntity } from '../userAppSettings/userAppSettings.entity';
import { VerificationEntity } from '../verification/verification.entity';
import { VoiceEntity } from '../voice/voice.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () =>
        ({
          type: 'mysql',
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT, 10),
          username: process.env.DB_USER,
          password: process.env.DB_PASS,
          database: process.env.DB_DATABASE,
          // entities: [__dirname + '/../**/*.entity{.ts,.js}'], // <-- Remove glob pattern
          entities: [
            // <-- Use explicit array of imported classes
            Share,
            AutoReplyEntity,
            CramiEntity,
            CramiPackageEntity,
            BadWordsEntity,
            ChatGroupEntity,
            VerificationEntity,
            SigninEntity,
            ViolationLogEntity,
            ModelsEntity,
            UserEntity,
            AccountLogEntity,
            FingerprintLogEntity,
            BalanceEntity,
            UserBalanceEntity,
            PluginEntity,
            ConfigEntity,
            ChatLogEntity,
            UserAppsEntity,
            AppCatsEntity,
            AppEntity,
            OrderEntity,
            AppVoiceEntity,
            RoleEmotionEntity,
            AppEmotionVoiceEntity,
            VoiceEntity,
            AffectionRuleEntity,
            UserAppAffectionEntity,
            ConversationSummaryEntity,
            UserAppSettingsEntity,
          ],
          synchronize: false,
          logging: false,
          charset: 'utf8mb4',
          timezone: '+08:00',
          // 连接池与keepalive，缓解 MySQL 连接被动断开导致的 ECONNRESET
          extra: {
            connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
            waitForConnections: true,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 10000,
            connectTimeout: 10000,
          },
        } as DataSourceOptions),
    }),
  ],
  providers: [DatabaseService],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly connection: DataSource) {}
  private readonly logger = new Logger(DatabaseModule.name);
  private pingTimer: NodeJS.Timer | null = null;

  async onModuleInit(): Promise<void> {
    const { database } = this.connection.options;
    this.logger.log(`Your MySQL database named ${database} has been connected`);
    // 定时心跳，防止闲置连接被网关/服务器回收，触发 ECONNRESET
    try {
      this.pingTimer = setInterval(async () => {
        try {
          await this.connection.query('SELECT 1');
        } catch (e) {
          this.logger.warn(`DB keepalive failed: ${(e as any)?.message || e}`);
        }
      }, 30000);
    } catch {}
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
