import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('affection_rule')
export class AffectionRuleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // 可选：按角色/应用粒度配置，null 表示全局规则
  @Column({ type: 'int', nullable: true })
  @Index()
  appId: number | null;

  @Column({ type: 'varchar', length: 50 })
  stageName: string; // 初见/暧昧/恋人

  @Column({ type: 'int' })
  minScore: number;

  @Column({ type: 'int', nullable: true })
  maxScore: number | null; // null 表示无上限

  @Column({ type: 'text' })
  behaviors: string; // 阶段行为规范，支持多行

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('user_app_affection')
@Index(['userId', 'appId'], { unique: true })
export class UserAppAffectionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  appId: number;

  @Column({ type: 'int', default: 0 })
  score: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

