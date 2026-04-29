'use client';

import React, { useMemo } from 'react';
import { useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { StudySession } from '@/firebase/firestore/studySessions';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, PieChart, BarChart } from 'lucide-react';
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-3">
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-1/2" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Your Analytics</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-3 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock /> Total Study Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold">
              {totalMinutes.toLocaleString()}
            </p>
            <p className="text-muted-foreground">
              minutes logged on your way to a million!
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart /> Weekly Activity (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StudyActivityChart data={weeklyData} />
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart /> Subject Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SubjectDistributionChart data={subjectData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
