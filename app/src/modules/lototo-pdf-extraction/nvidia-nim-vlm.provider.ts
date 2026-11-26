import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildLototoPdfPrompt } from './extraction-prompt';
import type { ProcedureLlmProvider } from './procedure-llm.provider';
import type {
  LototoPdfExtractedImage,
  LototoPdfLlmDraft,
  LototoPdfPage,
  LototoPdfTenantHints,
} from './lototo-pdf-extraction.types';

@Injectable()
export class NvidiaNimVlmProvider implements ProcedureLlmProvider {
  constructor(private readonly configService: ConfigService) {}

  async interpret(input: {
    pages: LototoPdfPage[];
    imageCount: number;
    figures?: LototoPdfExtractedImage[];
    hints: LototoPdfTenantHints;
    missingPhase?: 'apply' | 'remove';
  }): Promise<LototoPdfLlmDraft> {
    const apiKey = this.configService.get<string>('lototo.pdfImport.llmApiKey') ?? '';
    if (!apiKey) {
      throw new ServiceUnavailableException('LOTOTO PDF import is not configured (missing API key)');
    }
    const baseUrl = (this.configService.get<string>('lototo.pdfImport.llmBaseUrl') ?? '').replace(/\/$/, '');
    const model = this.configService.get<string>('lototo.pdfImport.llmModel');
    const timeoutMs = this.configService.get<number>('lototo.pdfImport.llmTimeoutMs') ?? 120000;
    const maxTokens = this.configService.get<number>('lototo.pdfImport.llmMaxTokens') ?? 8192;
    const pageText = input.pages.map((page) => `--- page ${page.pageNumber} ---\n${page.text}`).join('\n');
    const content: Array<Record<string, unknown>> = [];
    for (const page of input.pages) {
      if (!page.png.length) continue;
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${page.png.toString('base64')}` },
      });
    }
    for (const figure of input.figures ?? []) {
      content.push({ type: 'text', text: `Figure ${figure.index}` });
      content.push({
        type: 'image_url',
        image_url: { url: `data:${figure.contentType};base64,${figure.bytes.toString('base64')}` },
      });
    }
    content.push({
      type: 'text',
      text: buildLototoPdfPrompt(input.hints, input.imageCount, pageText, input.missingPhase),
    });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content }],
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException(
        `Procedure model request failed (${response.status}): ${detail.slice(0, 400)}`,
      );
    }
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return parseModelJson(body.choices?.[0]?.message?.content ?? '');
  }
}

export function parseModelJson(raw: string): LototoPdfLlmDraft {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('Model did not return JSON');
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as LototoPdfLlmDraft;
}
