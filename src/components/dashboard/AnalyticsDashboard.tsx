'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { UserProfile } from '@/firebase/firestore/users';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, PieChart, BarChart, Trophy, Zap, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, isAfter, startOfMonth, eachDayOfInterval, endOfMonth, startOfWeek, endOfWeek, getISOWeek, isSameMonth } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

type FilterType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function AnalyticsDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<FilterType>('daily');

  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userRef as any);

  const sessionsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'studySessions'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: sessions, loading: sessionsLoading } = useCollection<any>(sessionsQuery);

  const stats = useMemo(() => {
    if (!sessions) return { chartData: [], subjectData: [], hustleScore: 0, currentPeriodMins: 0 };

    const now = new Date();
    let chartData: any[] = [];
    let filteredSessions: any[] = [];

    if (filter === 'daily') {
      const todayStr = format(now, 'yyyy-MM-dd');
      const todaySessions = sessions.filter(s => s.date === todayStr);
      filteredSessions = todaySessions;

      const hourlyMins: Record<string, number> = {};
      for (const session of todaySessions) {
        if (session.hourlyBreakdown) {
          Object.entries(session.hourlyBreakdown).forEach(([hr, mins]) => {
            hourlyMins[hr] = (hourlyMins[hr] || 0) + (mins as number);
          });
        }
      }

      // 24-hour breakdown for precision
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
      const startOfCurrentMonth = startOfMonth(now);
      const endOfCurrentMonth = endOfMonth(now);
      
      const dailyAgg: Record<string, number> = {};
      sessions.forEach(s => {
        if (s.date && isSameMonth(new Date(s.date), now)) {
          dailyAgg[s.date] = (dailyAgg[s.date] || 0) + s.duration;
        }
      });

      const weeks: Record<string, number> = {};
      Object.entries(dailyAgg).forEach(([dateStr, mins]) => {
        const date = new Date(dateStr);
        const weekOfMonth = Math.ceil(date.getDate() / 7);
        const w = `Week ${weekOfMonth}`;
        weeks[w] = (weeks[w] || 0) + mins;
      });

      chartData = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'].map(w => ({
        date: w,
        minutes: weeks[w] || 0
      }));
      filteredSessions = sessions.filter(s => s.date && isSameMonth(new Date(s.date), now));
    }
    else if (filter === 'yearly') {
      const monthsAgg: Record<string, number> = {};
      sessions.forEach(s => {
        if (s.date) {
          const m = format(new Date(s.date), 'MMM yy');
          monthsAgg[m] = (monthsAgg[m] || 0) + s.duration;
        }
      });

      chartData = Array.from({ length: 12 }).map((_, i) => {
        const d = subDays(now, (11 - i) * 30);
        const m = format(d, 'MMM yy');
        return { date: m, minutes: monthsAgg[m] || 0 };
      });
      filteredSessions = sessions;
    }

    const currentPeriodMins = chartData.reduce((acc, curr) => acc + curr.minutes, 0);

    const subjectMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      const sub = session.subject || 'Other';
      subjectMinutes[sub] = (subjectMinutes[sub] || 0) + session.duration;
    }
    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({ name, value }));

    // Hustle Score Logic: Consistency * Goal Achievement
    const last7Days = sessions.filter(s => s.date && isAfter(new Date(s.date), subDays(now, 7)));
    const uniqueDays = new Set(last7Days.map(s => s.date)).size;
    const consistencyFactor = (uniqueDays / 7);
    const todayMins = profile?.daily_study_minutes || 0;
    const goalMins = profile?.daily_goal_minutes || 360;
    const volumeFactor = Math.min(1.2, todayMins / goalMins);
    const hustleScore = Math.round(consistencyFactor * volumeFactor * 100);

    return { chartData, subjectData, hustleScore, currentPeriodMins };
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
        <div className="flex justify-between items-center">
           <Skeleton className="h-10 w-48 rounded-xl" />
           <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          <Skeleton className="md:col-span-3 h-48 rounded-[2rem]" />
          <Skeleton className="md:col-span-3 h-48 rounded-[2rem]" />
          <Skeleton className="md:col-span-4 h-[400px] rounded-[2rem]" />
          <Skeleton className="md:col-span-2 h-[400px] rounded-[2rem]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground font-headline uppercase">Hustle Insights</h2>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1 rounded-xl h-11">
            <TabsTrigger value="daily" className="rounded-lg font-bold text-xs">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="rounded-lg font-bold text-xs">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="rounded-lg font-bold text-xs">Monthly</TabsTrigger>
            <TabsTrigger value="yearly" className="rounded-lg font-bold text-xs">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Total Period Status */}
        <Card className="md:col-span-3 rounded-[2rem] border-none shadow-xl bg-primary text-primary-foreground overflow-hidden group relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Zap className="h-24 w-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary-foreground/70">
              {filter} Hustle Total
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-black tracking-tighter">
                {formatStudyTime(stats.currentPeriodMins)}
              </h3>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
                 <span>Hustle Score</span>
                 <span>{stats.hustleScore}%</span>
              </div>
              <Progress value={stats.hustleScore} className="h-2 bg-white/20" />
              <p className="text-[9px] font-bold text-primary-foreground/50 mt-2 uppercase">Based on consistency & goal performance</p>
            </div>
          </CardContent>
        </Card>

        {/* Global Progress */}
        <Card className="md:col-span-3 rounded-[2rem] border-none shadow-xl bg-card overflow-hidden border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
              <Trophy className="inline-block h-3.5 w-3.5 mr-1 text-primary" /> Million Minute Quest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black tracking-tighter text-foreground">
                {(profile?.total_study_minutes || 0).toLocaleString()}
              </h3>
              <span className="text-[10px] font-black text-muted-foreground uppercase">Minutes</span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5 text-primary">
                 <span>Global Rank Progress</span>
                 <span>{((profile?.total_study_minutes || 0) / 1000000 * 100).toFixed(4)}%</span>
              </div>
              <Progress value={((profile?.total_study_minutes || 0) / 1000000 * 100)} className="h-2 bg-secondary" />
            </div>
          </CardContent>
        </Card>

        {/* Consistency Bar Chart (Scrollable) */}
        <Card className="md:col-span-4 rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <BarChart className="h-5 w-5 text-primary" /> Consistency Tracker
              </CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Study time distribution</p>
            </div>
            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full border border-border/50">
               <span className="text-[8px] font-black uppercase text-muted-foreground">Scroll to view more</span>
               <ChevronRight className="h-2.5 w-2.5 text-muted-foreground animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <StudyActivityChart 
              data={stats.chartData} 
              showTargetLine={filter === 'weekly'} 
              targetValue={profile?.daily_goal_minutes || 360} 
            />
          </CardContent>
        </Card>

        {/* Subject Distribution Doughnut */}
        <Card className="md:col-span-2 rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" /> Focus Areas
            </CardTitle>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{filter} Subject Breakdown</p>
          </CardHeader>
          <CardContent className="p-2">
            <SubjectDistributionChart data={stats.subjectData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
