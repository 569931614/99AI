import axios from 'axios';
import * as sharp from 'sharp';

/**
 * 头像布局配置接口
 */
interface AvatarLayout {
  rows: number; // 行数
  cols: number; // 列数
  positions: Array<{ row: number; col: number }>; // 每个头像的位置
}

/**
 * 根据群成员数量获取头像布局配置
 * @param memberCount 成员数量
 * @returns 布局配置
 */
export function getAvatarLayout(memberCount: number): AvatarLayout {
  switch (memberCount) {
    case 1:
      return {
        rows: 1,
        cols: 1,
        positions: [{ row: 0, col: 0 }],
      };
    case 2:
      return {
        rows: 1,
        cols: 2,
        positions: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
      };
    case 3:
      return {
        rows: 2,
        cols: 2,
        positions: [
          { row: 0, col: 0 }, // 第1行居中
          { row: 1, col: 0 }, // 第2行左
          { row: 1, col: 1 }, // 第2行右
        ],
      };
    case 4:
      return {
        rows: 2,
        cols: 2,
        positions: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 0 },
          { row: 1, col: 1 },
        ],
      };
    case 5:
      return {
        rows: 2,
        cols: 3,
        positions: [
          { row: 0, col: 0 }, // 第1行左
          { row: 0, col: 1 }, // 第1行右
          { row: 1, col: 0 }, // 第2行左
          { row: 1, col: 1 }, // 第2行中
          { row: 1, col: 2 }, // 第2行右
        ],
      };
    case 6:
      return {
        rows: 2,
        cols: 3,
        positions: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
          { row: 1, col: 0 },
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
      };
    case 7:
    case 8:
    case 9:
      // 3x3 网格,未占用的位置留空
      const positions: Array<{ row: number; col: number }> = [];
      for (let i = 0; i < memberCount; i++) {
        positions.push({
          row: Math.floor(i / 3),
          col: i % 3,
        });
      }
      return {
        rows: 3,
        cols: 3,
        positions,
      };
    default:
      // 10人以上不生成拼图
      throw new Error('不支持10人以上的群组头像合成');
  }
}

/**
 * 下载图片
 * @param url 图片URL
 * @param timeout 超时时间(毫秒)
 * @returns 图片Buffer
 */
export async function downloadImage(url: string, timeout: number = 5000): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`下载头像失败: ${url}`, error.message);
    // 返回默认灰色头像
    return createDefaultAvatar();
  }
}

/**
 * 创建默认头像(灰色圆形)
 * @param size 头像尺寸
 * @returns 默认头像Buffer
 */
async function createDefaultAvatar(size: number = 100): Promise<Buffer> {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#cccccc" rx="${size / 2}" />
      <circle cx="${size / 2}" cy="${size / 2 - 10}" r="${size / 4}" fill="#ffffff" />
      <path d="M ${size / 4} ${size * 0.8} Q ${size / 2} ${size * 0.6} ${size * 0.75} ${
    size * 0.8
  } L ${size * 0.75} ${size} L ${size / 4} ${size} Z" fill="#ffffff" />
    </svg>
  `;
  return Buffer.from(svg);
}

/**
 * 合成群组拼图头像
 * @param avatarUrls 成员头像URL列表
 * @param outputSize 输出图片尺寸(正方形)
 * @param userAvatarUrl 可选的用户头像URL（将添加到成员头像列表的第一位）
 * @returns 合成后的图片Buffer
 */
export async function compositeGroupAvatar(
  avatarUrls: string[],
  outputSize: number = 300,
  userAvatarUrl?: string,
): Promise<Buffer> {
  // 如果提供了用户头像，添加到列表的第一位
  const allAvatarUrls = userAvatarUrl ? [userAvatarUrl, ...avatarUrls] : avatarUrls;
  const memberCount = allAvatarUrls.length;

  // 10人以上不生成
  if (memberCount > 9) {
    throw new Error('不支持10人以上的群组头像合成');
  }

  // 单人直接下载返回
  if (memberCount === 1) {
    const buffer = await downloadImage(allAvatarUrls[0]);
    // 调整为正方形并裁剪
    return await sharp(buffer)
      .resize(outputSize, outputSize, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  // 获取布局
  const layout = getAvatarLayout(memberCount);
  const { rows, cols, positions } = layout;

  // 计算每个头像的尺寸
  const avatarSize = Math.floor(outputSize / Math.max(rows, cols));
  const spacing = 2; // 头像间距
  const actualAvatarSize = avatarSize - spacing;

  // 下载所有头像(并发)
  const avatarBuffers = await Promise.all(allAvatarUrls.map(url => downloadImage(url)));

  // 处理每个头像:调整大小并裁剪为正方形
  const processedAvatars = await Promise.all(
    avatarBuffers.map(buffer =>
      sharp(buffer).resize(actualAvatarSize, actualAvatarSize, { fit: 'cover' }).toBuffer(),
    ),
  );

  // 创建画布(白色背景)
  const canvas = sharp({
    create: {
      width: outputSize,
      height: outputSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  });

  // 准备合成图层
  const compositeInputs = processedAvatars.map((buffer, index) => {
    const pos = positions[index];

    // 特殊处理:3人时第1个头像居中
    let left = pos.col * avatarSize + spacing / 2;
    const top = pos.row * avatarSize + spacing / 2;

    if (memberCount === 3 && index === 0) {
      // 第1行只有1个头像,居中显示
      left = (outputSize - actualAvatarSize) / 2;
    } else if (memberCount === 5 && index < 2) {
      // 5人时第1行只有2个,居中显示
      const firstRowWidth = 2 * avatarSize;
      const firstRowOffset = (outputSize - firstRowWidth) / 2;
      left = firstRowOffset + pos.col * avatarSize + spacing / 2;
    }

    return {
      input: buffer,
      left: Math.floor(left),
      top: Math.floor(top),
    };
  });

  // 合成图片
  const result = await canvas.composite(compositeInputs).jpeg({ quality: 90 }).toBuffer();

  return result;
}
