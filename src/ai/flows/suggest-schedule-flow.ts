'use server';
/**
 * @fileOverview AI Study Schedule Generator.
 * 
 * - suggestSchedule - Generates a daily study plan based on user subjects and goals.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestScheduleInputSchema = z.object({
  category: z.string().describe('The academic category of the student (e.g. HSC, SSC)'),
  batch: z.string().describe('The graduation batch/year'),
  dailyGoalMinutes: z.number().describe('The target study duration for the day in minutes'),
  subjects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    chapters: z.array(z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      timeSpent: z.number()
    }))
  })).describe('The list of subjects and chapters in the user roadmap')
});

export type SuggestScheduleInput = z.infer<typeof SuggestScheduleInputSchema>;

const SuggestScheduleOutputSchema = z.object({
  suggestedTasks: z.array(z.object({
    subjectId: z.string(),
    chapterId: z.string(),
    subjectName: z.string(),
    chapterName: z.string(),
    duration: z.number().describe('Duration in minutes'),
    reason: z.string().describe('Why this task is suggested')
  })),
  strategyNote: z.string().describe('A motivational note or strategy for the day')
});

export type SuggestScheduleOutput = z.infer<typeof SuggestScheduleOutputSchema>;

const prompt = ai.definePrompt({
  name: 'suggestSchedulePrompt',
  input: { schema: SuggestScheduleInputSchema },
  output: { schema: SuggestScheduleOutputSchema },
  prompt: `You are an elite academic advisor specializing in the {{category}} curriculum for the {{batch}} batch.
  
Your goal is to create a highly efficient daily study plan for a student who wants to study for {{dailyGoalMinutes}} minutes today.

Here is their Academic Roadmap:
{{#each subjects}}
Subject: {{name}}
Chapters:
{{#each chapters}}
- {{name}} (Status: {{status}}, Time spent: {{timeSpent}}m)
{{/each}}
{{/each}}

Guidelines:
1. Prioritize chapters marked as 'pending' or 'revision'.
2. Balance the plan with at least 2-3 different subjects if possible.
3. Ensure the total duration of suggested tasks is close to {{dailyGoalMinutes}} minutes.
4. Provide a brief reason for each task (e.g., 'Needs revision', 'New topic to master').
5. Write a short, powerful motivational note in Bengali or English that resonates with a {{category}} student.

Return the plan in the specified JSON format.`
});

export async function suggestSchedule(input: SuggestScheduleInput): Promise<SuggestScheduleOutput> {
  const { output } = await prompt(input);
  if (!output) throw new Error('Failed to generate study plan');
  return output;
}
