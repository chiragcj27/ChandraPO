import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export interface ExtractionOptions {
  prompt: string;
  fileType?: 'pdf' | 'excel';
}

export async function extractWithOpenAI(options: ExtractionOptions): Promise<string> {
  const { prompt } = options;

  try {
    console.log(`[OpenAI] Starting extraction with model: gpt-4o-mini`);
    console.log(`[OpenAI] Prompt length: ${prompt.length} chars`);

    const fullPrompt = prompt;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    console.log(`[OpenAI] Extraction completed. Response length: ${content.length} chars`);

    return content;
  } catch (error) {
    console.error('[OpenAI] Extraction failed:', error);
    if (error instanceof Error) {
      throw new Error(`OpenAI extraction failed: ${error.message}`);
    }
    throw new Error('OpenAI extraction failed: Unknown error');
  }
}
