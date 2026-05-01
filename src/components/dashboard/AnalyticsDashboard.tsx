'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { StudySession } from '@/firebase/firestore/studySessions';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, PieChart, BarChart, Trophy, Calendar, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, isAfter, startOfDay, isSameDay, subMonths } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

type FilterType = 'daily' | 'weekly' | 'monthly' | 'total';

export function AnalyticsDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<FilterType>('weekly');

  const sessionsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'studySessions'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: sessions, loading } = useCollection<StudySession>(sessionsQuery);

  const stats = useMemo(() => {
    if (!sessions) return { totalMinutes: 0, chartData: [], subjectData: [], subjectList: [] };

    const now = new Date();
    let filteredSessions = sessions;
    let chartDays = 7;

    if (filter === 'daily') {
      const today = startOfDay(now);
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), today));
      chartDays = 1; // Handled specially for hours if needed, but keeping it simple for now
    } else if (filter === 'weekly') {
      const sevenDaysAgo = startOfDay(subDays(now, 6));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), sevenDaysAgo));
      chartDays = 7;
    } else if (filter === 'monthly') {
      const thirtyDaysAgo = startOfDay(subDays(now, 29));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), thirtyDaysAgo));
      chartDays = 30;
    }

    const totalMinutes = filteredSessions.reduce((acc, s) => acc + s.duration, 0);

    // Activity Chart Data
    const dailyMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      if (!session.createdAt) continue;
      const day = format(session.createdAt.toDate(), 'yyyy-MM-dd');
      dailyMinutes[day] = (dailyMinutes[day] || 0) + session.duration;
    }

    const chartData = Array.from({ length: chartDays })
      .map((_, i) => {
        const date = subDays(now, i);
        const dayKey = format(date, 'yyyy-MM-dd');
        const displayLabel = filter === 'monthly' ? format(date, 'd MMM') : format(date, 'E');
        return { date: displayLabel, minutes: dailyMinutes[dayKey] || 0 };
      })
      .reverse();

    // Subject Breakdown
    const subjectMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      const sub = session.subject || 'Uncategorized';
      subjectMinutes[sub] = (subjectMinutes[sub] || 0) + session.duration;
    }

    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({
      name,
      value,
    }));

    const subjectList = Object.entries(subjectMinutes)
      .map(([name, minutes]) => ({
        name,
        minutes,
        percentage: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return { totalMinutes, chartData, subjectData, subjectList };
  }, [sessions, filter]);

  const millionMinutesProgress = (stats.totalMinutes / 1000000) * 100;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground font-headline">Study Analytics</h2>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1">
            <TabsTrigger value="daily" className="text-xs sm:text-sm">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs sm:text-sm">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs sm:text-sm">Monthly</TabsTrigger>
            <TabsTrigger value="total" className="text-xs sm:text-sm">Total</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Total Stats Card */}
        <Card className="md:col-span-6 shadow-md border-primary/10 relative overflow-hidden bg-card">
          <div className="absolute -top-4 -right-4 opacity-5 pointer-events-none">
            <Trophy size={160} className="text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              <Clock className="h-4 w-4 text-primary" /> Focus Time ({filter})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-primary tracking-tighter">
                  {stats.totalMinutes.toLocaleString()}
                </span>
                <span className="text-lg font-medium text-muted-foreground">minutes</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Progress to 1 Million</span>
                  <span className="text-primary">{millionMinutesProgress.toFixed(4)}%</span>
                </div>
                <Progress value={millionMinutesProgress} className="h-2 bg-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Activity Chart */}
        <Card className="md:col-span-4 shadow-md border-none bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-headline">
              <BarChart className="h-5 w-5 text-primary" /> Study Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <StudyActivityChart data={stats.chartData} />
          </CardContent>
        </Card>

        {/* Subject Breakdown Chart */}
        <Card className="md:col-span-2 shadow-md border-none bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-headline">
              <PieChart className="h-5 w-5 text-primary" /> Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <SubjectDistributionChart data={stats.subjectData} />
          </CardContent>
        </Card>

        {/* Detailed Breakdown List */}
        <Card className="md:col-span-6 shadow-md border-none bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-headline">Subject Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.subjectList.length > 0 ? (
                stats.subjectList.map((item, idx) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: `hsl(var(--chart-${(idx % 5) + 1}))` }} />
                        {item.name}
                      </span>
                      <span className="text-muted-foreground">
                        {Math.floor(item.minutes / 60)}h {item.minutes % 60}m ({item.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress 
                      value={item.percentage} 
                      className="h-1.5 opacity-80" 
                      style={{ '--progress-background': `hsl(var(--chart-${(idx % 5) + 1}))` } as React.CSSProperties}
                    />
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4 italic">No study sessions logged for this period.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
