'use client';

import { useState } from 'react';
import { Header } from '@/components/dashboard/Header';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { StudyTimer } from '@/components/dashboard/StudyTimer';
import { GoalTracker } from '@/components/dashboard/GoalTracker';
import { DailyGoalChecklist } from '@/components/dashboard/DailyGoalChecklist';
import { AiPromptGenerator } from '@/components/dashboard/AiPromptGenerator';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export type Goal = {
  id: number;
  text: string;
  completed: boolean;
};

export default function DashboardPage() {
  const [goals, setGoals] = useState<Goal[]>([
    { id: 1, text: 'Review lecture notes for Physics', completed: true },
    { id: 2, text: 'Complete Calculus homework (Set A)', completed: false },
    { id: 3, text: 'Read Chapter 4 of "A Brief History of Time"', completed: false },
    { id: 4, text: 'Practice 3 coding challenges', completed: false },
  ]);

  const completedGoals = goals.filter((g) => g.completed).length;
  const dailyProgress =
    goals.length > 0 ? Math.round((completedGoals / goals.length) * 100) : 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-card text-card-foreground">
        <Header />
        <main className="p-4 md:p-8 space-y-8">
          <WelcomeBanner />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <StudyTimer />
            </div>
            <div className="space-y-8">
              <GoalTracker dailyProgress={dailyProgress} weeklyProgress={80} />
              <DailyGoalChecklist goals={goals} setGoals={setGoals} />
            </div>
          </div>

          <div>
            <AiPromptGenerator />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
