'use client';

import type { Goal } from '@/firebase/firestore/goals';
import { useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import {
  addGoal,
  updateGoalCompletion,
  deleteGoal,
} from '@/firebase/firestore/goals';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DailyGoalChecklistProps {
  goals: Goal[];
}

export function DailyGoalChecklist({ goals }: DailyGoalChecklistProps) {
  const [newGoal, setNewGoal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newGoal.trim() !== '' && user) {
      setIsSubmitting(true);
      try {
        await addGoal(firestore, user.uid, newGoal);
        setNewGoal('');
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not add goal. Please try again.',
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleToggleGoal = (id: string, completed: boolean) => {
    if (user) {
      updateGoalCompletion(firestore, user.uid, id, !completed).catch(() => {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not update goal. Please try again.',
        });
      });
    }
  };

  const handleDeleteGoal = (id: string) => {
    if (user) {
      deleteGoal(firestore, user.uid, id).catch(() => {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not delete goal. Please try again.',
        });
      });
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Daily Goal Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddGoal} className="flex gap-2 mb-4">
          <Input
            placeholder="Add a new goal..."
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            disabled={isSubmitting}
          />
          <Button type="submit" size="icon" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            <span className="sr-only">Add Goal</span>
          </Button>
        </form>
        <ul className="space-y-3 h-48 overflow-y-auto pr-2">
          {goals.length > 0 ? (
            goals.map((goal) => (
              <li key={goal.id} className="flex items-center gap-3 group">
                <Checkbox
                  id={`goal-${goal.id}`}
                  checked={goal.completed}
                  onCheckedChange={() =>
                    handleToggleGoal(goal.id, goal.completed)
                  }
                />
                <label
                  htmlFor={`goal-${goal.id}`}
                  className={`flex-grow text-sm cursor-pointer ${
                    goal.completed
                      ? 'line-through text-muted-foreground'
                      : 'text-card-foreground'
                  }`}
                >
                  {goal.text}
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeleteGoal(goal.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="sr-only">Delete Goal</span>
                </Button>
              </li>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center pt-8">
              No goals for today. Add one to get started!
            </p>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
