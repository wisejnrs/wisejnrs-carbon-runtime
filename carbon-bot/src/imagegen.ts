import { config } from './config.js';

// Image generation - same providers as wisejnrs-website's /api/ai-images:
// OpenAI gpt-image-1 (DALL-E 3's successor) and Google Gemini 2.5 Flash Image.

export type ImageProvider = 'openai' | 'gemini';
export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536';

export interface GeneratedImage {
  buffer: Buffer;
  filename: string;
  note?: string;
}

export function availableImageProviders(): ImageProvider[] {
  const providers: ImageProvider[] = [];
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (config.geminiApiKey) providers.push('gemini');
  return providers;
}

export async function generateImage(
  prompt: string,
  provider: ImageProvider,
  size: ImageSize = '1024x1024',
): Promise<GeneratedImage> {
  return provider === 'gemini' ? generateGemini(prompt) : generateOpenAi(prompt, size);
}

async function generateOpenAi(prompt: string, size: ImageSize): Promise<GeneratedImage> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size, n: 1 }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI image request failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };
  const image = data.data[0];
  const buffer = image.b64_json
    ? Buffer.from(image.b64_json, 'base64')
    : Buffer.from(await (await fetch(image.url!)).arrayBuffer());
  return { buffer, filename: 'openai.png', note: image.revised_prompt };
}

async function generateGemini(prompt: string): Promise<GeneratedImage> {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': config.geminiApiKey!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini request failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> };
    }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData);
  if (!imagePart?.inlineData) {
    const text = parts.find((part) => part.text)?.text;
    throw new Error(`Gemini returned no image${text ? `: ${text.slice(0, 150)}` : ''}`);
  }
  const extension = imagePart.inlineData.mimeType.includes('jpeg') ? 'jpg' : 'png';
  return {
    buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    filename: `gemini.${extension}`,
    note: parts.find((part) => part.text)?.text?.slice(0, 300),
  };
}
