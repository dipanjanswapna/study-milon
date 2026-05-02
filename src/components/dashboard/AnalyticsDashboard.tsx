'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { UserProfile } from '@/firebase/firestore/users';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, PieChart, BarChart, Trophy, Target, Zap, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, isAfter, startOfDay, getISOWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getWeek } from 'date-fns';
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

  const sessionsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'studySessions'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: sessions, loading: sessionsLoading } = useCollection<any>(sessionsQuery);

  const stats = useMemo(() => {
    if (!sessions) return { chartData: [], subjectData: [], hustleScore: 0, totalMinutes: 0 };

    const now = new Date();
    let chartData: any[] = [];
    let filteredSessions: any[] = [];

    if (filter === 'daily') {
      const todayStr = format(now, 'yyyy-MM-dd');
      const todaySessions = sessions.filter(s => s.date === todayStr);
      filteredSessions = todaySessions;

      // Aggregate hourly breakdown across all subjects for today
      const hourlyMins: Record<string, number> = {};
      for (const session of todaySessions) {
        if (session.hourlyBreakdown) {
          Object.entries(session.hourlyBreakdown).forEach(([hr, mins]) => {
            hourlyMins[hr] = (hourlyMins[hr] || 0) + (mins as number);
          });
        }
      }

      chartData = Array.from({ length: 24 }).map((_, i) => {
        const h = i.toString();
        const displayLabel = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`;
        return { date: displayLabel, minutes: hourlyMins[h] || 0 };
      });
    } 
    else if (filter === 'weekly') {
      const sevenDaysAgo = subDays(now, 6);
      const interval = eachDayOfInterval({ start: sevenDaysAgo, end: now });
      
      const dailyAgg: Record<string, number> = {};
      sessions.forEach(s => {
        if (s.date) dailyAgg[s.date] = (dailyAgg[s.date] || 0) + s.duration;
      });

      chartData = interval.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        return { date: format(day, 'EEE'), minutes: dailyAgg[key] || 0 };
      });
      filteredSessions = sessions.filter(s => s.date && isAfter(new Date(s.date), subDays(now, 7)));
    }
    else if (filter === 'monthly') {
      // Show Weeks 1-4 for current month
      const monthStart = startOfMonth(now);
      const dailyAgg: Record<string, number> = {};
      sessions.forEach(s => {
        if (s.date && s.date.startsWith(format(now, 'yyyy-MM'))) {
          dailyAgg[s.date] = (dailyAgg[s.date] || 0) + s.duration;
        }
      });

      const weeks: Record<string, number> = {};
      Object.entries(dailyAgg).forEach(([date, mins]) => {
        const w = `Week ${Math.ceil(new Date(date).getDate() / 7)}`;
        weeks[w] = (weeks[w] || 0) + mins;
      });

      chartData = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'].map(w => ({
        date: w,
        minutes: weeks[w] || 0
      }));
      filteredSessions = sessions.filter(s => s.date && s.date.startsWith(format(now, 'yyyy-MM')));
    }
    else if (filter === 'yearly') {
      const months: Record<string, number> = {};
      sessions.forEach(s => {
        if (s.date) {
          const m = format(new Date(s.date), 'MMM yy');
          months[m] = (months[m] || 0) + s.duration;
        }
      });

      chartData = Array.from({ length: 12 }).map((_, i) => {
        const d = subDays(now, (11 - i) * 30);
        const m = format(d, 'MMM yy');
        return { date: m, minutes: months[m] || 0 };
      });
      filteredSessions = sessions;
    }

    // Subject Breakdown (Doughnut)
    const subjectMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      const sub = session.subject || 'Other';
      subjectMinutes[sub] = (subjectMinutes[sub] || 0) + session.duration;
    }
    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({ name, value }));

    // Hustle Score Calculation (Consistency based)
    // Formula: (StudiedDaysInLast7Days / 7) * (MinutesToday / GoalToday)
    const last7Days = sessions.filter(s => s.date && isAfter(new Date(s.date), subDays(now, 7)));
    const uniqueDays = new Set(last7Days.map(s => s.date)).size;
    const todayMins = profile?.daily_study_minutes || 0;
    const consistencyFactor = (uniqueDays / 7);
    const volumeFactor = Math.min(1.2, todayMins / (profile?.daily_goal_minutes || 360));
    const hustleScore = Math.round(consistencyFactor * volumeFactor * 100);

    return { chartData, subjectData, hustleScore, totalMinutes: profile?.total_study_minutes || 0 };
  }, [sessions, filter, profile]);

  const formatStudyTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

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
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-black tracking-tight text-foreground font-headline">Hustle Insights</h2>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1 rounded-xl">
            <TabsTrigger value="daily" className="rounded-lg font-bold text-xs">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="rounded-lg font-bold text-xs">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="rounded-lg font-bold text-xs">Monthly</TabsTrigger>
            <TabsTrigger value="yearly" className="rounded-lg font-bold text-xs">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Dynamic Summary Card */}
        <Card className="md:col-span-3 rounded-[2rem] border-none shadow-xl bg-primary text-primary-foreground overflow-hidden group relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Zap className="h-24 w-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary-foreground/70">
              Current Period Hustle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-black tracking-tighter">
                {formatStudyTime(stats.chartData.reduce((acc, curr) => acc + curr.minutes, 0))}
              </h3>
              <span className="text-sm font-bold text-primary-foreground/60">{filter} total</span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
                 <span>Hustle Score</span>
                 <span>{stats.hustleScore}%</span>
              </div>
              <Progress value={stats.hustleScore} className="h-2 bg-white/20" />
            </div>
          </CardContent>
        </Card>

        {/* Million Minute Quest */}
        <Card className="md:col-span-3 rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
              <Trophy className="inline-block h-3.5 w-3.5 mr-1 text-primary" /> Million Minute Quest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black tracking-tighter text-foreground">
                {stats.totalMinutes.toLocaleString()}
              </h3>
              <span className="text-xs font-bold text-muted-foreground">Minutes</span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5 text-primary">
                 <span>Progress</span>
                 <span>{(stats.totalMinutes / 1000000 * 100).toFixed(4)}%</span>
              </div>
              <Progress value={(stats.totalMinutes / 1000000 * 100)} className="h-2 bg-secondary" />
            </div>
          </CardContent>
        </Card>

        {/* Consistency Tracker (Scrollable) */}
        <Card className="md:col-span-4 rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Consistency Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <StudyActivityChart data={stats.chartData} showTargetLine={filter === 'weekly'} targetValue={dailyGoalMinutes} />
          </CardContent>
        </Card>

        {/* Subject Distribution */}
        <Card className="md:col-span-2 rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" /> Focus Distribution
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