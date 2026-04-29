'use client';

import { useEffect, useRef, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { getStudyPrompts } from '@/app/actions';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Lightbulb } from 'lucide-react';

const initialState = {
  prompts: [],
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Prompts
        </>
      )}
    </Button>
  );
}

export function AiPromptGenerator() {
  const [state, formAction] = useActionState(getStudyPrompts, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Uh oh! Something went wrong.',
        description: state.error,
      });
    }
  }, [state, toast]);

  useEffect(() => {
    if (state.prompts.length > 0) {
      formRef.current?.reset();
    }
  }, [state.prompts]);

  return (
    <Card className="w-full shadow-lg">
      <form action={formAction} ref={formRef}>
        <CardHeader>
          <CardTitle>AI Study Prompt Generator</CardTitle>
          <CardDescription>
            Enter your notes, keywords, or a topic, and let AI generate study
            prompts for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            name="notes"
            placeholder="e.g., The mitochondria is the powerhouse of the cell. It generates most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy..."
            rows={5}
            required
            minLength={10}
          />
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
      {state.prompts && state.prompts.length > 0 && (
        <CardContent>
          <h3 className="mb-4 text-lg font-semibold">Generated Prompts:</h3>
          <ul className="space-y-3">
            {state.prompts.map((prompt, index) => (
              <li key={index} className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                <span>{prompt}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
