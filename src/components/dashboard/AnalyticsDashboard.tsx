'use client';

import React, { useMemo } from 'react';
import { useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { StudySession } from '@/firebase/firestore/studySessions';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, PieChart, BarChart, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, isAfter, startOfDay } from 'date-fns';

export function AnalyticsDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

  const sessionsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'studySessions'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: sessions, loading } = useCollection<StudySession>(sessionsQuery);

  const { totalMinutes, weeklyData, subjectData } = useMemo(() => {
    if (!sessions) return { totalMinutes: 0, weeklyData: [], subjectData: [] };

    const totalMinutes = sessions.reduce((acc, s) => acc + s.duration, 0);

    // Weekly data (last 7 days)
    const sevenDaysAgo = startOfDay(subDays(new Date(), 6));
    const weeklySessions = sessions.filter(
      (s) => s.createdAt && isAfter(s.createdAt.toDate(), sevenDaysAgo)
    );

    const dailyMinutes: Record<string, number> = {};
    for (const session of weeklySessions) {
      const day = format(session.createdAt.toDate(), 'yyyy-MM-dd');
      dailyMinutes[day] = (dailyMinutes[day] || 0) + session.duration;
    }

    const weeklyData = Array.from({ length: 7 })
      .map((_, i) => {
        const date = subDays(new Date(), i);
        const day = format(date, 'yyyy-MM-dd');
        const shortDay = format(date, 'E');
        return { date: shortDay, minutes: dailyMinutes[day] || 0 };
      })
      .reverse();

    // Subject distribution data
    const subjectMinutes = sessions.reduce((acc, session) => {
      const subject = session.subject || 'Uncategorized';
      acc[subject] = (acc[subject] || 0) + session.duration;
      return acc;
    }, {} as Record<string, number>);

    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({
      name,
      value,
    }));

    return { totalMinutes, weeklyData, subjectData };
  }, [sessions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-40 col-span-full" />
          <Skeleton className="h-80 md:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Your Progress</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Total Stats Card */}
        <Card className="md:col-span-6 shadow-sm border-primary/10 overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy size={80} className="text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
              <Clock className="h-4 w-4" /> Total Study Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-baseline gap-2">
              <span className="text-5xl font-extrabold text-primary">
                {totalMinutes.toLocaleString()}
              </span>
              <span className="text-muted-foreground font-medium">minutes</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Keep pushing! You are {(totalMinutes / 1000000 * 100).toFixed(4)}% of the way to a million.
            </p>
          </CardContent>
        </Card>

        {/* Weekly Activity Chart */}
        <Card className="md:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart className="h-5 w-5 text-primary" /> Weekly Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <StudyActivityChart data={weeklyData} />
          </CardContent>
        </Card>

        {/* Subject Breakdown Chart */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5 text-primary" /> Subjects
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <SubjectDistributionChart data={subjectData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
