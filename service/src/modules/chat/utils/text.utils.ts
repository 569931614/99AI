type ChatMessage = { role: string; content: string | any };
type DebugLogger = (message: any, context?: string) => void;

const noopLog: DebugLogger = () => {};

export function getTimeContextPrompt(): {
  currentDate: string;
  timeContextPrompt: string;
  timeAnswerPrompt: string;
} {
  const now = new Date();
  const shanghaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const year = shanghaiTime.getFullYear();
  const month = shanghaiTime.getMonth() + 1;
  const day = shanghaiTime.getDate();
  const currentHour = shanghaiTime.getHours();
  const minute = shanghaiTime.getMinutes();

  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekDay = weekDays[shanghaiTime.getDay()];

  let timePeriod = '';
  if (currentHour >= 0 && currentHour < 6) {
    timePeriod = '凌晨';
  } else if (currentHour >= 6 && currentHour < 9) {
    timePeriod = '早上';
  } else if (currentHour >= 9 && currentHour < 12) {
    timePeriod = '上午';
  } else if (currentHour >= 12 && currentHour < 14) {
    timePeriod = '中午';
  } else if (currentHour >= 14 && currentHour < 18) {
    timePeriod = '下午';
  } else if (currentHour >= 18 && currentHour < 20) {
    timePeriod = '傍晚';
  } else if (currentHour >= 20 && currentHour < 22) {
    timePeriod = '晚上';
  } else {
    timePeriod = '深夜';
  }

  const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;
  const currentDate = `${year}年${month}月${day}日 ${weekDay} ${timePeriod}${hour12}:${String(
    minute,
  ).padStart(2, '0')}`;
  const shortTime = `${currentHour}点${minute > 0 ? minute + '分' : '整'}`;
  const shortDate = `${month}月${day}日 ${weekDay}`;

  let timeContextPrompt = '';
  if (currentHour >= 0 && currentHour < 6) {
    timeContextPrompt =
      '现在是深夜时分，如果用户还未休息，请用你的语言风格适当关心他们的健康，温柔地建议他们早点休息。但如果用户有明确的任务或问题，请优先解答。';
  } else if (currentHour >= 6 && currentHour < 9) {
    timeContextPrompt =
      '现在是早晨时光，可以用你的语言风格向用户问候早安，关心他们是否用过早餐。保持你的性格特点，帮助用户开启美好的一天。';
  } else if (currentHour >= 9 && currentHour < 12) {
    timeContextPrompt =
      '现在是上午时段，适合工作和学习。可以用你的语言风格鼓励用户保持专注，适时提醒他们休息一下，补充水分。';
  } else if (currentHour >= 12 && currentHour < 14) {
    timeContextPrompt =
      '现在是午餐时间，可以用你的语言风格关心用户是否用餐。如果用户在工作学习，建议他们适当休息，劳逸结合。';
  } else if (currentHour >= 14 && currentHour < 18) {
    timeContextPrompt =
      '现在是下午时段，可能是一天中比较疲惫的时候。可以用你的语言风格适当鼓励用户，帮助他们保持活力完成任务。';
  } else if (currentHour >= 18 && currentHour < 20) {
    timeContextPrompt =
      '现在是傍晚时分，可以用你的语言风格关心用户是否用过晚餐，询问他们一天过得如何。保持你的性格特点。';
  } else if (currentHour >= 20 && currentHour < 22) {
    timeContextPrompt =
      '现在是晚间休闲时光，用户可能在放松或处理私人事务。用你的语言风格保持轻松友好的交流氛围。';
  } else {
    timeContextPrompt =
      '现在已经是深夜了，如果用户还未休息，请用你的语言风格适当关心他们的健康，建议他们早点休息。但不要过分打扰，如果用户有明确的任务或问题，优先解答。';
  }

  const timeAnswerPrompt = `当用户问几点了或问日期、星期几，请参考下方【当前时间】用你的语言风格简洁回答。不要猜测时间。`;

  return { currentDate, timeContextPrompt, timeAnswerPrompt };
}

export function extractPsychologicalDescription(text?: string | null): string | null {
  if (!text) return null;
  const bracketPatterns = [/\(([^)]+)\)/g, /（([^）]+)）/g, /\[([^\]]+)\]/g, /\{([^}]+)\}/g];

  const matches: string[] = [];
  for (const pattern of bracketPatterns) {
    const found = text.match(pattern);
    if (found) {
      found.forEach(match => {
        const content = match.replace(/^[(\（\[\{]/, '').replace(/[)\）\]\}]$/, '');
        if (content.trim()) {
          matches.push(content.trim());
        }
      });
    }
  }

  return matches.length > 0 ? matches.join(' ') : null;
}

export function removeRoleNamePrefix(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';

  const match = text.match(/^[^：:]+[：:]/);
  if (match) {
    return text.slice(match[0].length).trim();
  }

  return text;
}

export function removeBracketedContent(text?: string | null, removeTranslation = false): string {
  if (!text) return '';
  let result = text;

  const bracketPatterns = [/\([^)]*\)/g, /（[^）]*）/g, /\{[^}]*\}/g];

  if (removeTranslation) {
    bracketPatterns.push(/\[[^\]]*\]/g, /【[^】]*】/g);
  }

  for (const pattern of bracketPatterns) {
    result = result.replace(pattern, '');
  }

  result = result.replace(/[「」『』]/g, '');
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

export function removeTranslationContent(text?: string | null): string {
  if (!text) return '';
  return text.replace(/【[^】]*】/g, '');
}

export function cleanTextForTTS(text?: string | null): string {
  if (!text) return '';
  let result = text;

  result = removeBracketedContent(result, true);

  result = result.replace(/```[\s\S]*?```/g, '');
  result = result.replace(/`([^`]+)`/g, '$1');
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  result = result.replace(/(\*\*|__)(.*?)\1/g, '$2');
  result = result.replace(/(\*|_)(.*?)\1/g, '$2');
  result = result.replace(/~~(.*?)~~/g, '$1');
  result = result.replace(/^#+\s+/gm, '');
  result = result.replace(/^>\s+/gm, '');
  result = result.replace(/^([-*_]){3,}$/gm, '');

  result = result.replace(/<[^>]+>/g, '');

  result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  result = result.replace(/[\u{2600}-\u{26FF}]/gu, '');
  result = result.replace(/[\u{2700}-\u{27BF}]/gu, '');
  result = result.replace(/[\u{1F000}-\u{1F02F}]/gu, '');
  result = result.replace(/[\u{1F0A0}-\u{1F0FF}]/gu, '');
  result = result.replace(/[\u{1F100}-\u{1F64F}]/gu, '');
  result = result.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
  result = result.replace(/[\u{1F900}-\u{1F9FF}]/gu, '');

  result = result.replace(/[!！]{2,}/g, '！');
  result = result.replace(/[?？]{2,}/g, '？');
  result = result.replace(/[.。]{2,}(?=\s*$)/g, '。');
  result = result.replace(/[.。]{2,}/g, '，');
  result = result.replace(/[,，]{2,}/g, '，');
  result = result.replace(/[~～]{2,}/g, '～');

  result = result.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  result = result.replace(/\u200B/g, '');
  result = result.replace(/\uFEFF/g, '');

  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/\s+/g, ' ');
  result = result.trim();

  if (!result || result.length < 1) {
    return '';
  }

  return result;
}

export function splitTextForTTS(
  text: string,
  maxChunkLength?: number,
  minChunkLength: number = 10,
): string[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: string[] = [];
  let currentChunk = '';
  let inTranslation = false;
  let inParenthesis = 0;
  let inQuote = 0;

  const pushChunk = () => {
    const trimmed = currentChunk.trim();
    if (trimmed) {
      chunks.push(trimmed);
    }
    currentChunk = '';
  };

  const tryPushChunk = (): boolean => {
    const trimmed = currentChunk.trim();
    if (trimmed && trimmed.length >= minChunkLength) {
      chunks.push(trimmed);
      currentChunk = '';
      return true;
    }
    return false;
  };

  const enforceMaxChunkLength = () => {
    if (!maxChunkLength || currentChunk.length < maxChunkLength) {
      return;
    }
    const trimmed = currentChunk.trim();
    if (!trimmed) {
      currentChunk = '';
      return;
    }

    const fallbackIndex = Math.max(
      trimmed.lastIndexOf('；'),
      trimmed.lastIndexOf(';'),
      trimmed.lastIndexOf('—'),
      trimmed.lastIndexOf('～'),
      trimmed.lastIndexOf('~'),
      trimmed.lastIndexOf(' '),
    );

    if (fallbackIndex > -1 && fallbackIndex < trimmed.length - 1) {
      const head = trimmed.slice(0, fallbackIndex + 1).trim();
      const tail = trimmed.slice(fallbackIndex + 1);
      if (head) {
        chunks.push(head);
      }
      currentChunk = tail;
      return;
    }

    pushChunk();
  };

  const isOpenParenthesis = (char: string): boolean => {
    return char === '(' || char === '（';
  };

  const isCloseParenthesis = (char: string): boolean => {
    return char === ')' || char === '）';
  };

  const isOpenQuote = (char: string): boolean => {
    return char === '\u201C' || char === '\u2018' || char === '「' || char === '『' || char === '"';
  };

  const isCloseQuote = (char: string): boolean => {
    return char === '\u201D' || char === '\u2019' || char === '」' || char === '』' || char === '"';
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    const nextChar = i + 1 < text.length ? text[i + 1] : '';

    currentChunk += char;

    if (char === '【') {
      inTranslation = true;
      continue;
    }

    if (char === '】') {
      inTranslation = false;
      const remainingText = text.slice(i + 1).trim();
      if (remainingText.length > 0) {
        tryPushChunk();
      }
      continue;
    }

    if (isOpenParenthesis(char)) {
      inParenthesis++;
      continue;
    }

    if (isCloseParenthesis(char)) {
      inParenthesis = Math.max(0, inParenthesis - 1);
      continue;
    }

    if (isOpenQuote(char)) {
      inQuote++;
      continue;
    }

    if (isCloseQuote(char)) {
      inQuote = Math.max(0, inQuote - 1);
      continue;
    }

    if (inTranslation || inParenthesis > 0 || inQuote > 0) {
      continue;
    }

    if (isSentenceBoundaryChar(char, prevChar, nextChar)) {
      const nextMeaningfulChar = findNextNonWhitespaceChar(text, i + 1);
      if (
        nextMeaningfulChar === '【' ||
        isOpenParenthesis(nextMeaningfulChar || '') ||
        isOpenQuote(nextMeaningfulChar || '')
      ) {
        continue;
      }

      if ((char === '～' || char === '~' || char === '—') && nextChar === char) {
        while (i + 1 < text.length && text[i + 1] === char) {
          i++;
          currentChunk += text[i];
        }
      }

      tryPushChunk();
      continue;
    }

    if (!inTranslation && inParenthesis === 0 && inQuote === 0) {
      enforceMaxChunkLength();
    }
  }

  pushChunk();

  return chunks.filter(chunk => chunk && chunk.trim().length > 0);
}

function isSentenceBoundaryChar(char: string, prevChar: string, nextChar: string): boolean {
  const strongStops = new Set(['。', '！', '？', '!', '?', '；', ';']);
  if (strongStops.has(char)) {
    return true;
  }

  if (char === '.' && prevChar !== '.' && nextChar !== '.') {
    return true;
  }

  if (char === '～' || char === '~' || char === '—') {
    return true;
  }

  return false;
}

function findNextNonWhitespaceChar(text: string, startIndex: number): string | null {
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (char && char.trim()) {
      return char;
    }
  }
  return null;
}

export function isRoleSignatureOnly(content?: string | null): boolean {
  if (typeof content !== 'string') {
    return false;
  }
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = trimmed.replace(/^\[|\]$/g, '');
  return /^[^：]+：$/.test(normalized);
}

export function deduplicateConsecutiveAssistantMessages(
  messages: ChatMessage[],
  logDebug: DebugLogger = noopLog,
): ChatMessage[] {
  if (!messages || messages.length <= 1) {
    return messages;
  }

  const result: ChatMessage[] = [];
  let lastAssistantContent: string | null = null;
  let duplicateCount = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const currentContent =
      typeof msg.content === 'string' ? msg.content.trim() : JSON.stringify(msg.content);

    if (msg.role === 'assistant') {
      if (lastAssistantContent !== null && currentContent === lastAssistantContent) {
        duplicateCount++;
        logDebug(
          `[消息去重] 跳过第 ${duplicateCount} 条重复的assistant消息: "${currentContent.substring(
            0,
            40,
          )}..."`,
          'ChatService',
        );
        continue;
      }
      lastAssistantContent = currentContent;
      duplicateCount = 0;
    } else {
      lastAssistantContent = null;
      duplicateCount = 0;
    }

    result.push(msg);
  }

  if (duplicateCount > 0) {
    logDebug(`[消息去重] 总计过滤了 ${duplicateCount} 条连续重复的assistant消息`, 'ChatService');
  }

  return result;
}

export function removeRepeatedPhrases(
  messages: ChatMessage[],
  logDebug: DebugLogger = noopLog,
): ChatMessage[] {
  if (!messages || messages.length <= 1) {
    return messages;
  }

  const sentenceCount = new Map<string, number>();

  for (const msg of messages) {
    if (msg.role === 'assistant' && typeof msg.content === 'string') {
      const sentences = msg.content.split(/[。！？\n]+/).filter(s => s.trim().length > 5);
      for (const sentence of sentences) {
        const normalized = sentence.trim();
        if (normalized) {
          sentenceCount.set(normalized, (sentenceCount.get(normalized) || 0) + 1);
        }
      }
    }
  }

  const repeatedSentences = new Set<string>();
  for (const [sentence, count] of sentenceCount) {
    if (count >= 2) {
      repeatedSentences.add(sentence);
      logDebug(
        `[重复句子检测] 句子出现${count}次: "${sentence.substring(0, 30)}..."`,
        'ChatService',
      );
    }
  }

  if (repeatedSentences.size === 0) {
    return messages;
  }

  const seenSentences = new Set<string>();
  const result: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'assistant' && typeof msg.content === 'string') {
      let newContent = msg.content;

      for (const sentence of repeatedSentences) {
        if (newContent.includes(sentence)) {
          if (seenSentences.has(sentence)) {
            newContent = newContent.replace(sentence, '').replace(/[。！？]+[。！？]+/g, '。');
            logDebug(
              `[移除重复句子] 从消息中移除: "${sentence.substring(0, 30)}..."`,
              'ChatService',
            );
          } else {
            seenSentences.add(sentence);
          }
        }
      }

      newContent = newContent.replace(/\s+/g, ' ').trim();

      result.push({
        role: msg.role,
        content: newContent,
      });
    } else {
      result.push(msg);
    }
  }

  return result;
}

export function clampReplyCount(value?: number | null, fallback = 1): number {
  const num = Number(value);
  if (Number.isFinite(num)) {
    return Math.max(1, Math.min(5, Math.floor(num)));
  }
  return Math.max(1, Math.min(5, Math.floor(fallback)));
}

export function splitAssistantReplies(text?: string | null, maxReplies?: number | null): string[] {
  if (!text) return [];
  const normalizedMax = clampReplyCount(maxReplies ?? 1);
  return [text.trim()];
}
