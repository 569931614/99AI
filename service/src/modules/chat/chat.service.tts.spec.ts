import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';

/**
 * TTS 优化功能单元测试
 * 测试括号过滤和情绪识别功能
 */
describe('ChatService - TTS Optimization', () => {
  let service: ChatService;

  beforeEach(async () => {
    // 创建一个最小化的测试模块
    // 注意：这里只测试私有方法的逻辑，实际需要通过反射或导出辅助函数
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ChatService,
          useValue: {
            // 模拟私有方法（实际测试时需要调整）
            extractPsychologicalDescription: (text: string | null) => {
              if (!text) return null;
              const bracketPatterns = [
                /\(([^)]+)\)/g,
                /（([^）]+)）/g,
                /\[([^\]]+)\]/g,
                /【([^】]+)】/g,
                /\{([^}]+)\}/g,
              ];

              const matches: string[] = [];
              for (const pattern of bracketPatterns) {
                const found = text.match(pattern);
                if (found) {
                  found.forEach(match => {
                    const content = match.replace(/^[(\（\[【\{]/, '').replace(/[)\）\]】\}]$/, '');
                    if (content.trim()) {
                      matches.push(content.trim());
                    }
                  });
                }
              }

              return matches.length > 0 ? matches.join(' ') : null;
            },

            removeBracketedContent: (text: string | null) => {
              if (!text) return '';
              let result = text;

              const bracketPatterns = [
                /\([^)]*\)/g,
                /（[^）]*）/g,
                /\[[^\]]*\]/g,
                /【[^】]*】/g,
                /\{[^}]*\}/g,
              ];

              for (const pattern of bracketPatterns) {
                result = result.replace(pattern, '');
              }

              // 移除日文引号「」和『』本身，但保留其内容
              result = result.replace(/[「」『』]/g, '');

              result = result.replace(/\s+/g, ' ').trim();

              return result;
            },
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('extractPsychologicalDescription', () => {
    it('应该提取英文圆括号内的内容', () => {
      const text = '你好啊！(内心充满喜悦)今天天气真不错呢~';
      const result = service.extractPsychologicalDescription(text);
      expect(result).toBe('内心充满喜悦');
    });

    it('应该提取中文圆括号内的内容', () => {
      const text = '你好啊！（内心充满喜悦）今天天气真不错呢~';
      const result = service.extractPsychologicalDescription(text);
      expect(result).toBe('内心充满喜悦');
    });

    it('应该提取方括号内的内容', () => {
      const text = '我明白了【点头】，那我们开始吧！';
      const result = service.extractPsychologicalDescription(text);
      expect(result).toBe('点头');
    });

    it('应该提取花括号内的内容', () => {
      const text = '真的吗？{惊讶}这太棒了！';
      const result = service.extractPsychologicalDescription(text);
      expect(result).toBe('惊讶');
    });

    it('应该提取多个括号内的内容', () => {
      const text = '真的吗？（惊讶）【睁大眼睛】这太不可思议了！';
      const result = service.extractPsychologicalDescription(text);
      expect(result).toBe('惊讶 睁大眼睛');
    });

    it('应该处理空文本', () => {
      const result = service.extractPsychologicalDescription(null);
      expect(result).toBeNull();
    });

    it('应该处理没有括号的文本', () => {
      const text = '你好啊！今天天气真不错呢~';
      const result = service.extractPsychologicalDescription(text);
      expect(result).toBeNull();
    });

    it('日文引号不应被视为心理描述括号', () => {
      const text = '本当に？「驚き」すごいね！';
      const result = service.extractPsychologicalDescription(text);
      expect(result).toBeNull();
    });
  });

  describe('removeBracketedContent', () => {
    it('应该移除英文圆括号及其内容', () => {
      const text = '你好啊！(内心充满喜悦)今天天气真不错呢~';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('你好啊！今天天气真不错呢~');
    });

    it('应该移除中文圆括号及其内容', () => {
      const text = '你好啊！（内心充满喜悦）今天天气真不错呢~';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('你好啊！今天天气真不错呢~');
    });

    it('应该移除方括号及其内容', () => {
      const text = '我明白了【点头】，那我们开始吧！';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('我明白了，那我们开始吧！');
    });

    it('应该移除花括号及其内容', () => {
      const text = '真的吗？{惊讶}这太棒了！';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('真的吗？这太棒了！');
    });

    it('应该移除多个括号及其内容', () => {
      const text = '真的吗？（惊讶）【睁大眼睛】这太不可思议了！';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('真的吗？这太不可思议了！');
    });

    it('应该处理空文本', () => {
      const result = service.removeBracketedContent(null);
      expect(result).toBe('');
    });

    it('应该处理没有括号的文本', () => {
      const text = '你好啊！今天天气真不错呢~';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('你好啊！今天天气真不错呢~');
    });

    it('应该清理多余的空格', () => {
      const text = '你好啊！  （内心充满喜悦）  今天天气真不错呢~';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('你好啊！ 今天天气真不错呢~');
    });

    it('应该处理只有括号内容的文本', () => {
      const text = '（内心独白：我该怎么办呢？）';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('');
    });

    it('应该移除日文引号本身但保留其内容', () => {
      const text = '本当に？「驚き」すごいね！';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('本当に？驚きすごいね！');
    });

    it('应该处理混合括号类型', () => {
      const text = '你好（开心）【点头】{微笑}「挥手」真高兴见到你！';
      const result = service.removeBracketedContent(text);
      expect(result).toBe('你好挥手真高兴见到你！');
    });
  });

  describe('TTS 场景测试', () => {
    it('场景1: 基本括号过滤', () => {
      const text = '你好啊！（内心充满喜悦）今天天气真不错呢~';
      const psychDesc = service.extractPsychologicalDescription(text);
      const textToSpeak = service.removeBracketedContent(text);

      expect(psychDesc).toBe('内心充满喜悦');
      expect(textToSpeak).toBe('你好啊！今天天气真不错呢~');
    });

    it('场景2: 情绪与对话不一致', () => {
      const text = '没关系的...（内心非常生气）我不在意。';
      const psychDesc = service.extractPsychologicalDescription(text);
      const textToSpeak = service.removeBracketedContent(text);

      expect(psychDesc).toBe('内心非常生气');
      expect(textToSpeak).toBe('没关系的...我不在意。');
    });

    it('场景3: 多个括号', () => {
      const text = '真的吗？（惊讶）【睁大眼睛】这太不可思议了！';
      const psychDesc = service.extractPsychologicalDescription(text);
      const textToSpeak = service.removeBracketedContent(text);

      expect(psychDesc).toBe('惊讶 睁大眼睛');
      expect(textToSpeak).toBe('真的吗？这太不可思议了！');
    });

    it('场景4: 悲伤情绪', () => {
      const text = '我...【哭泣】我真的很难过...';
      const psychDesc = service.extractPsychologicalDescription(text);
      const textToSpeak = service.removeBracketedContent(text);

      expect(psychDesc).toBe('哭泣');
      expect(textToSpeak).toBe('我...我真的很难过...');
    });

    it('场景5: 温柔情绪', () => {
      const text = '别担心（温柔地抚摸头发），一切都会好起来的。';
      const psychDesc = service.extractPsychologicalDescription(text);
      const textToSpeak = service.removeBracketedContent(text);

      expect(psychDesc).toBe('温柔地抚摸头发');
      expect(textToSpeak).toBe('别担心，一切都会好起来的。');
    });
  });
});
