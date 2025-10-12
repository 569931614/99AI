import { VoiceService } from './voice.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const axios = require('axios');

describe('VoiceService', () => {
  let service: VoiceService;
  const mockGlobalConfigService = {
    getConfigs: jest.fn().mockResolvedValue('DUMMY_KEY'),
  } as any;
  const mockUploadService = {
    uploadFile: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new VoiceService(mockGlobalConfigService, mockUploadService);
  });

  it('enroll should call dashscope create_voice', async () => {
    (axios.default.post as jest.Mock).mockResolvedValue({ data: { ok: 1 } });
    const res = await service.enroll({ prefix: 'p', url: 'http://a/b.mp3' });
    expect(axios.default.post).toHaveBeenCalled();
    expect(res).toEqual({ ok: 1 });
  });

  it('list should call dashscope list_voice', async () => {
    (axios.default.post as jest.Mock).mockResolvedValue({ data: { voices: [] } });
    const res = await service.list({ page_index: 0, page_size: 10 });
    expect(axios.default.post).toHaveBeenCalled();
    expect(res).toEqual({ voices: [] });
  });

  it('query should call dashscope query_voice', async () => {
    (axios.default.post as jest.Mock).mockResolvedValue({ data: { status: 'SUCCEEDED' } });
    const res = await service.query('voice-123');
    expect(axios.default.post).toHaveBeenCalled();
    expect(res).toEqual({ status: 'SUCCEEDED' });
  });

  it('update should call dashscope update_voice', async () => {
    (axios.default.post as jest.Mock).mockResolvedValue({ data: { updated: true } });
    const res = await service.update({ voice_id: 'voice-123', url: 'http://a/b.mp3' });
    expect(axios.default.post).toHaveBeenCalled();
    expect(res).toEqual({ updated: true });
  });

  it('remove should call dashscope delete_voice', async () => {
    (axios.default.post as jest.Mock).mockResolvedValue({ data: { deleted: true } });
    const res = await service.remove({ voice_id: 'voice-123' });
    expect(axios.default.post).toHaveBeenCalled();
    expect(res).toEqual({ deleted: true });
  });
});
