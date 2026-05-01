
'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { StudySession } from '@/firebase/firestore/studySessions';
import type { UserProfile } from '@/firebase/firestore/users';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, PieChart, BarChart, Trophy, Filter, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, isAfter, startOfDay, differenceInDays } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

type FilterType = 'daily' | 'weekly' | 'monthly' | 'total';

export function AnalyticsDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<FilterType>('weekly');

  // Fetch user profile for daily goal
  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserProfile>(userRef as any);

  const dailyGoalMinutes = profile?.daily_goal_minutes || 360;

  const sessionsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'studySessions'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: sessions, loading } = useCollection<StudySession>(sessionsQuery);

  const stats = useMemo(() => {
    if (!sessions) return { totalMinutes: 0, todayMinutes: 0, chartData: [], subjectData: [], subjectList: [] };

    const now = new Date();
    const todayStart = startOfDay(now);
    
    const todaySessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), todayStart));
    const todayMinutes = todaySessions.reduce((acc, s) => acc + s.duration, 0);

    let filteredSessions = sessions;
    let chartDays = 7;

    if (filter === 'daily') {
      filteredSessions = todaySessions;
      chartDays = 1;
    } else if (filter === 'weekly') {
      const sevenDaysAgo = startOfDay(subDays(now, 6));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), sevenDaysAgo));
      chartDays = 7;
    } else if (filter === 'monthly') {
      const thirtyDaysAgo = startOfDay(subDays(now, 29));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), thirtyDaysAgo));
      chartDays = 30;
    } else if (filter === 'total') {
      filteredSessions = sessions;
      const firstSession = sessions[sessions.length - 1];
      chartDays = firstSession?.createdAt ? Math.max(7, differenceInDays(now, firstSession.createdAt.toDate()) + 1) : 7;
    }

    const totalMinutes = sessions.reduce((acc, s) => acc + s.duration, 0);
    const filterTotalMinutes = filteredSessions.reduce((acc, s) => acc + s.duration, 0);

    // Activity Chart Data
    const dailyMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      if (!session.createdAt) continue;
      const day = format(session.createdAt.toDate(), 'yyyy-MM-dd');
      dailyMinutes[day] = (dailyMinutes[day] || 0) + session.duration;
    }

    const displayDays = filter === 'total' ? 14 : chartDays;
    const chartData = Array.from({ length: displayDays })
      .map((_, i) => {
        const date = subDays(now, i);
        const dayKey = format(date, 'yyyy-MM-dd');
        const displayLabel = filter === 'monthly' || filter === 'total' ? format(date, 'd MMM') : format(date, 'E');
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
        percentage: filterTotalMinutes > 0 ? (minutes / filterTotalMinutes) * 100 : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return { totalMinutes, todayMinutes, chartData, subjectData, subjectList };
  }, [sessions, filter]);

  const formatStudyTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const dailyGoalProgress = Math.min(100, (stats.todayMinutes / dailyGoalMinutes) * 100);
  const millionMinutesProgress = (stats.totalMinutes / 1000000) * 100;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          <Skeleton className="md:col-span-6 h-40" />
          <Skeleton className="md:col-span-4 h-80" />
          <Skeleton className="md:col-span-2 h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-headline">Study Analytics</h2>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="total">Total</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Daily Goal Card */}
        <Card className="md:col-span-3 shadow-md border-primary/10 overflow-hidden bg-card group">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              <Target className="h-4 w-4 text-primary" /> Today's Hustle Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-primary tracking-tighter">
                    {formatStudyTime(stats.todayMinutes)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">/ {formatStudyTime(dailyGoalMinutes)}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-primary">{dailyGoalProgress.toFixed(1)}%</span>
                </div>
              </div>
              <Progress value={dailyGoalProgress} className="h-2.5 bg-secondary" />
            </div>
          </CardContent>
        </Card>

        {/* Total Progress Card */}
        <Card className="md:col-span-3 shadow-md border-primary/10 overflow-hidden bg-card group">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              <Trophy className="h-4 w-4 text-primary" /> Million Minute Quest
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-primary tracking-tighter">
                    {stats.totalMinutes.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">mins total</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-primary">{millionMinutesProgress.toFixed(4)}%</span>
                </div>
              </div>
              <Progress value={millionMinutesProgress} className="h-2.5 bg-secondary" />
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart Activity */}
        <Card className="md:col-span-4 shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-headline">
              <Clock className="h-5 w-5 text-primary" /> Study Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <StudyActivityChart data={stats.chartData} showTargetLine={filter === 'daily' || filter === 'weekly'} targetValue={dailyGoalMinutes} />
          </CardContent>
        </Card>

        {/* Pie Chart Distribution */}
        <Card className="md:col-span-2 shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-headline">
              <PieChart className="h-5 w-5 text-primary" /> Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <SubjectDistributionChart data={stats.subjectData} />
          </CardContent>
        </Card>

        {/* Breakdown List */}
        <Card className="md:col-span-6 shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-headline flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" /> Subject Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.subjectList.length > 0 ? (
                stats.subjectList.map((item, idx) => (
                  <div key={item.name} className="p-4 rounded-xl border bg-secondary/30 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `hsl(var(--chart-${(idx % 5) + 1}))` }} />
                        <span className="font-bold text-foreground">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-2xl font-black tracking-tight">{formatStudyTime(item.minutes)}</span>
                    </div>
                    <Progress 
                      value={item.percentage} 
                      className="h-1.5"
                      style={{ '--progress-background': `hsl(var(--chart-${(idx % 5) + 1}))` } as React.CSSProperties}
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-muted-foreground italic bg-secondary/20 rounded-xl border-dashed border-2">
                  No study sessions logged for this period.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
