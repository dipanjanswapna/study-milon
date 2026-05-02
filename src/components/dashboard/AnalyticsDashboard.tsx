'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { StudySession } from '@/firebase/firestore/studySessions';
import type { UserProfile } from '@/firebase/firestore/users';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, PieChart, BarChart, Trophy, Filter, Target } from 'lucide-center';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, isAfter, startOfDay, getISOWeek } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

type FilterType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function AnalyticsDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<FilterType>('weekly');

  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userRef as any);

  const dailyGoalMinutes = profile?.daily_goal_minutes || 360;

  // Real-time synchronization buckets with "Virtual Reset" for immediate 12AM UI updates
  const summaryMinutes = useMemo(() => {
    if (!profile) return 0;
    
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const thisWeekStr = `${now.getFullYear()}-W${getISOWeek(now)}`;
    const thisMonthStr = format(now, 'yyyy-MM');

    switch (filter) {
      case 'daily': 
        return profile.last_study_day === todayStr ? (profile.daily_study_minutes || 0) : 0;
      case 'weekly': 
        return profile.last_study_week === thisWeekStr ? (profile.weekly_study_minutes || 0) : 0;
      case 'monthly': 
        return profile.last_study_month === thisMonthStr ? (profile.monthly_study_minutes || 0) : 0;
      case 'yearly': 
        return profile.total_study_minutes || 0;
      default: 
        return profile.daily_study_minutes || 0;
    }
  }, [profile, filter]);

  const sessionsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'studySessions'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: sessions, loading: sessionsLoading } = useCollection<StudySession>(sessionsQuery);

  const stats = useMemo(() => {
    if (!sessions) return { chartData: [], subjectData: [], subjectList: [] };

    const now = new Date();
    let filteredSessions = sessions;
    let chartDays = 7;

    if (filter === 'daily') {
      const todayStart = startOfDay(now);
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), todayStart));
      chartDays = 1;
    } else if (filter === 'weekly') {
      const sevenDaysAgo = startOfDay(subDays(now, 6));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), sevenDaysAgo));
      chartDays = 7;
    } else if (filter === 'monthly') {
      const thirtyDaysAgo = startOfDay(subDays(now, 29));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), thirtyDaysAgo));
      chartDays = 30;
    } else if (filter === 'yearly') {
      const yearAgo = startOfDay(subDays(now, 364));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), yearAgo));
      chartDays = 14; 
    }

    const filterTotalMinutes = filteredSessions.reduce((acc, s) => acc + s.duration, 0);

    // Sync chart labels with local date keys for absolute consistency
    const dailyMinutes: Record<string, number> = {};
    for (const session of sessions) {
      if (!session.date) continue;
      dailyMinutes[session.date] = (dailyMinutes[session.date] || 0) + session.duration;
    }

    const chartData = Array.from({ length: chartDays })
      .map((_, i) => {
        const date = subDays(now, i);
        const dayKey = format(date, 'yyyy-MM-dd');
        const displayLabel = filter === 'monthly' || filter === 'yearly' ? format(date, 'd MMM') : format(date, 'E');
        return { date: displayLabel, minutes: dailyMinutes[dayKey] || 0 };
      })
      .reverse();

    // Subject Breakdown
    const subjectMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      const sub = session.subject || 'Uncategorized';
      subjectMinutes[sub] = (subjectMinutes[sub] || 0) + session.duration;
    }

    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({ name, value }));

    const subjectList = Object.entries(subjectMinutes)
      .map(([name, minutes]) => ({
        name,
        minutes,
        percentage: filterTotalMinutes > 0 ? (minutes / filterTotalMinutes) * 100 : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return { chartData, subjectData, subjectList };
  }, [sessions, filter]);

  const formatStudyTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const todayMinutes = profile?.last_study_day === format(new Date(), 'yyyy-MM-dd') ? (profile.daily_study_minutes || 0) : 0;
  const dailyGoalProgress = Math.min(100, (todayMinutes / dailyGoalMinutes) * 100);
  const totalMinutes = profile?.total_study_minutes || 0;
  const millionMinutesProgress = (totalMinutes / 1000000) * 100;

  if (profileLoading || sessionsLoading) {
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
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-headline">Hustle Insights</h2>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Total</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Dynamic Summary Card with Virtual Reset */}
        <Card className="md:col-span-3 shadow-md border-primary/10 overflow-hidden bg-card group">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              <Target className="h-4 w-4 text-primary" /> {filter} Hustle Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-primary tracking-tighter">
                    {formatStudyTime(summaryMinutes)}
                  </span>
                  {filter === 'daily' && (
                    <span className="text-sm font-medium text-muted-foreground">/ {formatStudyTime(dailyGoalMinutes)}</span>
                  )}
                </div>
                {filter === 'daily' && (
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary">{dailyGoalProgress.toFixed(1)}%</span>
                  </div>
                )}
              </div>
              {filter === 'daily' && <Progress value={dailyGoalProgress} className="h-2.5 bg-secondary" />}
            </div>
          </CardContent>
        </Card>

        {/* Million Minute Quest */}
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
                    {totalMinutes.toLocaleString()}
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
              <Clock className="h-5 w-5 text-primary" /> Consistency Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <StudyActivityChart data={stats.chartData} showTargetLine={filter === 'daily' || filter === 'weekly'} targetValue={dailyGoalMinutes} />
          </CardContent>
        </Card>

        {/* Distribution */}
        <Card className="md:col-span-2 shadow-sm border-none bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-headline">
              <PieChart className="h-5 w-5 text-primary" /> Subject Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <SubjectDistributionChart data={stats.subjectData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
