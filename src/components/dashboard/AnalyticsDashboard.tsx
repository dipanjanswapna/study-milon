
'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { UserProfile } from '@/firebase/firestore/users';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, PieChart, BarChart, Trophy, Zap, TrendingUp, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, isAfter, startOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
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
    // Real-time listener for sessions
    return query(
      collection(firestore, 'users', user.uid, 'studySessions'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);

  const { data: sessions, loading: sessionsLoading } = useCollection<any>(sessionsQuery);

  const stats = useMemo(() => {
    if (!sessions) return { chartData: [], subjectData: [], hustleScore: 0, currentPeriodMins: 0, activeSubjects: [] };

    const now = new Date();
    let chartData: any[] = [];
    let filteredSessions: any[] = [];
    const activeSubjectsSet = new Set<string>();

    if (filter === 'daily') {
      const todayStr = format(now, 'yyyy-MM-dd');
      const todaySessions = sessions.filter(s => s.date === todayStr);
      filteredSessions = todaySessions;

      // Initialize 24 hour buckets for a full day view
      const hourlyData: Record<string, any> = {};
      for (let i = 0; i < 24; i++) {
        const dateObj = new Date();
        dateObj.setHours(i, 0, 0, 0);
        const label = format(dateObj, 'h a');
        hourlyData[i] = { date: label, hour: i };
      }

      for (const session of todaySessions) {
        const subName = session.subject || 'Other';
        activeSubjectsSet.add(subName);
        if (session.hourlyBreakdown) {
          Object.entries(session.hourlyBreakdown).forEach(([hr, mins]) => {
            const h = parseInt(hr);
            if (hourlyData[h]) {
              hourlyData[h][subName] = (hourlyData[h][subName] || 0) + (mins as number);
            }
          });
        }
      }
      chartData = Object.values(hourlyData);
    } 
    else if (filter === 'weekly') {
      const sevenDaysAgo = subDays(now, 6);
      const interval = eachDayOfInterval({ start: sevenDaysAgo, end: now });
      
      const dailyAgg: Record<string, any> = {};
      interval.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        dailyAgg[key] = { date: format(day, 'EEE'), key };
      });

      filteredSessions = sessions.filter(s => s.date && isAfter(new Date(s.date), subDays(now, 7)));
      
      filteredSessions.forEach(s => {
        if (dailyAgg[s.date]) {
          const subName = s.subject || 'Other';
          activeSubjectsSet.add(subName);
          dailyAgg[s.date][subName] = (dailyAgg[s.date][subName] || 0) + s.duration;
        }
      });

      chartData = Object.values(dailyAgg);
    }
    else if (filter === 'monthly') {
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

    const currentPeriodMins = filteredSessions.reduce((acc, curr) => acc + curr.duration, 0);

    const subjectMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      const sub = session.subject || 'Other';
      subjectMinutes[sub] = (subjectMinutes[sub] || 0) + session.duration;
    }
    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({ name, value }));

    // Hustle Score Calculation
    const uniqueDays = new Set(filteredSessions.map(s => s.date)).size;
    const consistencyFactor = (uniqueDays / Math.max(1, chartData.length));
    const goalMins = profile?.daily_goal_minutes || 360;
    const volumeFactor = Math.min(1.2, (profile?.daily_study_minutes || 0) / goalMins);
    const hustleScore = Math.round(consistencyFactor * volumeFactor * 100);

    return { 
      chartData, 
      subjectData, 
      hustleScore, 
      currentPeriodMins, 
      activeSubjects: Array.from(activeSubjectsSet) 
    };
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
        <Skeleton className="h-[200px] rounded-[2rem]" />
        <Skeleton className="h-[400px] rounded-[2rem]" />
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
          <h2 className="text-2xl font-black tracking-tight font-headline uppercase">Hustle Insights</h2>
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
        {/* Status Highlights */}
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
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 rounded-[2rem] border-none shadow-xl bg-card overflow-hidden border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
              <Trophy className="inline-block h-3.5 w-3.5 mr-1 text-primary" /> Million Minute Quest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black tracking-tighter">
                {(profile?.total_study_minutes || 0).toLocaleString()}
              </h3>
              <span className="text-[10px] font-black text-muted-foreground uppercase">Minutes</span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5 text-primary">
                 <span>Quest Progress</span>
                 <span>{((profile?.total_study_minutes || 0) / 1000000 * 100).toFixed(4)}%</span>
              </div>
              <Progress value={((profile?.total_study_minutes || 0) / 1000000 * 100)} className="h-2 bg-secondary" />
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Charts Section - Stacked for Desktop as requested */}
        <div className="md:col-span-6 space-y-8">
           {/* Consistency Tracker */}
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <BarChart className="h-6 w-6 text-primary" /> Consistency Tracker
                </CardTitle>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Live Hourly Session Mapping</p>
              </div>
              <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50">
                 <ChevronRight className="h-3 w-3 text-muted-foreground animate-pulse" />
                 <span className="text-[8px] font-black uppercase text-muted-foreground">Scroll to explore</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              <StudyActivityChart 
                data={stats.chartData} 
                showTargetLine={filter === 'daily' || filter === 'weekly'} 
                targetValue={profile?.daily_goal_minutes || 360}
                isHourly={filter === 'daily'}
                subjects={stats.activeSubjects}
              />
            </CardContent>
          </Card>

          {/* Focus Areas Distribution - Now below the main chart */}
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl font-black flex items-center gap-2">
                <PieChart className="h-6 w-6 text-primary" /> Focus Areas
              </CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Subject-wise Distribution for {filter}</p>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <SubjectDistributionChart data={stats.subjectData} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
