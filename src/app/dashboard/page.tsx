'use client';

import { useMemo } from 'react';
import { useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Header } from '@/components/dashboard/Header';
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner';
import { StudyTimer } from '@/components/dashboard/StudyTimer';
import { GoalTracker } from '@/components/dashboard/GoalTracker';
import { DailyGoalChecklist } from '@/components/dashboard/DailyGoalChecklist';
import { AiPromptGenerator } from '@/components/dashboard/AiPromptGenerator';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import type { Goal } from '@/firebase/firestore/goals';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const goalsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'goals'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: goals, loading: goalsLoading } =
    useCollection<Goal>(goalsQuery);

  const completedGoals = goals?.filter((g) => g.completed).length || 0;
  const dailyProgress =
    goals && goals.length > 0
      ? Math.round((completedGoals / goals.length) * 100)
      : 0;

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
              {goalsLoading ? (
                <Card className="shadow-md">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-4">
                      <Skeleton className="h-10 flex-grow" />
                      <Skeleton className="h-10 w-10" />
                    </div>
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <DailyGoalChecklist goals={goals || []} />
              )}
            </div>
          </div>
          
          <AnalyticsDashboard />

          <div>
            <AiPromptGenerator />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
