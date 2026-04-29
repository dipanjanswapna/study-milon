'use client';

import type { Goal } from '@/app/dashboard/page';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2 } from 'lucide-react';

interface DailyGoalChecklistProps {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
}

export function DailyGoalChecklist({
  goals,
  setGoals,
}: DailyGoalChecklistProps) {
  const [newGoal, setNewGoal] = useState('');

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGoal.trim() !== '') {
      setGoals([
        ...goals,
        { id: Date.now(), text: newGoal, completed: false },
      ]);
      setNewGoal('');
    }
  };

  const handleToggleGoal = (id: number) => {
    setGoals(
      goals.map((goal) =>
        goal.id === id ? { ...goal, completed: !goal.completed } : goal
      )
    );
  };

  const handleDeleteGoal = (id: number) => {
    setGoals(goals.filter((goal) => goal.id !== id));
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
          />
          <Button type="submit" size="icon">
            <PlusCircle className="h-4 w-4" />
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
                  onCheckedChange={() => handleToggleGoal(goal.id)}
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
