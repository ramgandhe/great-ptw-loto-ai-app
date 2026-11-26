import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NvidiaNimVlmProvider } from '../app/src/modules/lototo-pdf-extraction/nvidia-nim-vlm.provider';

function provider(values: Record<string, string | number>) {
  const config = { get: (key: string) => values[key] } as ConfigService;
  return new NvidiaNimVlmProvider(config);
}

const input = {
  pages: [{ pageNumber: 1, text: 'Lockout', png: Buffer.alloc(0) }],
  imageCount: 0,
  hints: { assets: [], workLocations: [] },
};

describe('Nvidia NIM procedure provider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fails before a network call when the API key is missing', async () => {
    global.fetch = jest.fn();
    await expect(provider({}).interpret(input)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('posts the configured model and parses JSON content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"code":"A-1","title":"Elevator"}' } }] }),
    });
    const result = await provider({
      'lototo.pdfImport.llmApiKey': 'test-key',
      'lototo.pdfImport.llmBaseUrl': 'https://integrate.example/v1',
      'lototo.pdfImport.llmModel': 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      'lototo.pdfImport.llmTimeoutMs': 1000,
      'lototo.pdfImport.llmMaxTokens': 100,
    }).interpret(input);
    expect(result.code).toBe('A-1');
    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [string, { body: string }];
    expect(request).toBeDefined();
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.model).toBe('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it('reports a failed model response without throwing the raw body through', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'unavailable',
    });
    await expect(
      provider({
        'lototo.pdfImport.llmApiKey': 'test-key',
        'lototo.pdfImport.llmBaseUrl': 'https://integrate.example/v1',
        'lototo.pdfImport.llmModel': 'test-model',
      }).interpret(input),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
