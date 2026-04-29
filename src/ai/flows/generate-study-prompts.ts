'use server';
/**
 * @fileOverview A Genkit flow for generating personalized study questions or prompts.
 *
 * - generateStudyPrompts - A function that handles the study prompt generation process.
 * - GenerateStudyPromptsInput - The input type for the generateStudyPrompts function.
 * - GenerateStudyPromptsOutput - The return type for the generateStudyPrompts function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateStudyPromptsInputSchema = z.object({
  keywords: z
    .array(z.string())
    .optional()
    .describe('An array of keywords related to the study material.'),
  topics: z
    .array(z.string())
    .optional()
    .describe('An array of topics to focus on.'),
  notes: z
    .string()
    .optional()
    .describe('User-provided notes or summary text for context.'),
});
export type GenerateStudyPromptsInput = z.infer<
  typeof GenerateStudyPromptsInputSchema
>;

const GenerateStudyPromptsOutputSchema = z.object({
  prompts: z
    .array(z.string())
    .describe('A list of generated study questions or prompts.'),
});
export type GenerateStudyPromptsOutput = z.infer<
  typeof GenerateStudyPromptsOutputSchema
>;

export async function generateStudyPrompts(
  input: GenerateStudyPromptsInput
): Promise<GenerateStudyPromptsOutput> {
  return generateStudyPromptsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStudyPromptsPrompt',
  input: { schema: GenerateStudyPromptsInputSchema },
  output: { schema: GenerateStudyPromptsOutputSchema },
  prompt: `You are an AI study assistant tasked with generating personalized study questions or prompts.
Your goal is to help a student actively test their understanding and reinforce learning.

Based on the following information, generate a list of 5-10 challenging and insightful study prompts or questions.

Instructions:
- Generate prompts that encourage critical thinking, application of knowledge, and recall.
- Ensure the prompts are directly relevant to the provided context.
- Format the output as a JSON object with a single 'prompts' key containing an array of strings.

Context:
{{#if keywords}}Keywords: {{{keywords}}}.{{/if}}
{{#if topics}}Topics to focus on: {{{topics}}}.{{/if}}
{{#if notes}}Student Notes: """{{{notes}}}""".{{/if}}

Generated Study Prompts:`,
});

const generateStudyPromptsFlow = ai.defineFlow(
  {
    name: 'generateStudyPromptsFlow',
    inputSchema: GenerateStudyPromptsInputSchema,
    outputSchema: GenerateStudyPromptsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
