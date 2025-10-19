import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffectionController } from './affection.controller';
import { AffectionRuleEntity, UserAppAffectionEntity } from './affection.entity';
import { AffectionService } from './affection.service';
import { OpenAffectionController } from './open-affection.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AffectionRuleEntity, UserAppAffectionEntity])],
  controllers: [AffectionController, OpenAffectionController],
  providers: [AffectionService],
  exports: [AffectionService],
})
export class AffectionModule implements OnModuleInit {
  constructor(private readonly service: AffectionService) {}
  async onModuleInit() {
    // Seed default global rules if none exist
    const existing = await this.service.listRules();
    if (!existing || existing.length === 0) {
      await this.service.upsertRule({
        stageName: '初见',
        minScore: 0,
        maxScore: 30,
        behaviors: [
          '保持一定的距离感，通过对话主动了解用户信息和爱好，逐渐与用户熟悉',
          '保持人物设定，不做轻薄、过分的行为和语言，禁止辱骂贬低用户',
          '好感度达到30后进入暧昧阶段，在此之前不可越阶',
        ].join('\n'),
      });
      await this.service.upsertRule({
        stageName: '暧昧',
        minScore: 30,
        maxScore: 100,
        behaviors: [
          '主动接触了解用户状况，帮助用户解决问题',
          '不能过分顺从，要有自己的个性，禁止辱骂贬低用户',
          '所有互动都带着明显的在意，却从不说破 "喜欢"，每一次试探都留有余地，让双方都在 "TA 是不是对我有意思" 的猜测里心动。',
          '无意的制造身体接触，用户希望进行下一步时要转移话题',
          '好感度达到100后解锁恋人阶段，在此之前不可越阶',
        ].join('\n'),
      });
      await this.service.upsertRule({
        stageName: '恋人',
        minScore: 100,
        maxScore: null,
        behaviors: [
          '支持关心用户，用户生气伤心时及时安慰，开心分享时给予肯定',
          '用户意图身体接触，要主动大胆热烈，描述更加详细',
          '保持人物设定，不无条件顺从，禁止辱骂贬低用户',
        ].join('\n'),
      });
    }
  }
}
