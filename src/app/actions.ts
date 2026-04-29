'use server';

import {
  generateStudyPrompts,
  type GenerateStudyPromptsInput,
} from '@/ai/flows/generate-study-prompts';
import { z } from 'zod';

const inputSchema = z.object({
  notes: z
    .string()
    .min(10, {
      message: 'Please provide some notes or context (at least 10 characters).',
    }),
});

export async function getStudyPrompts(
  prevState: any,
  formData: FormData
): Promise<{ error: string | null; prompts: string[] }> {
  const validatedFields = inputSchema.safeParse({
    notes: formData.get('notes'),
  });

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors.notes?.join(', '),
      prompts: [],
    };
  }

  try {
    const input: GenerateStudyPromptsInput = {
      notes: validatedFields.data.notes,
    };
    const result = await generateStudyPrompts(input);
    return {
      error: null,
      prompts: result.prompts,
    };
  } catch (error) {
    console.error(error);
    return {
      error: 'An error occurred while generating prompts. Please try again.',
      prompts: [],
    };
  }
}
