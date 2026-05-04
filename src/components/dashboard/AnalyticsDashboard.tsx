'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { UserProfile } from '@/firebase/firestore/users';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock, PieChart, BarChart, Trophy, Zap, TrendingUp, Activity, Calendar, History, BookOpen, Layers } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, isAfter, startOfMonth, eachDayOfInterval, isSameMonth, startOfDay, eachMonthOfInterval, startOfWeek, endOfMonth, endOfWeek, addDays, differenceInDays } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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
    if (!sessions) return { chartData: [], subjectData: [], hustleScore: 0, currentPeriodMins: 0, activeSubjects: [], filteredSessions: [] };

    const now = new Date();
    let chartData: any[] = [];
    let filteredSessions: any[] = [];
    const activeSubjectsSet = new Set<string>();

    if (filter === 'daily') {
      const todayStr = format(now, 'yyyy-MM-dd');
      const todaySessions = sessions.filter(s => s.date === todayStr);
      filteredSessions = todaySessions;

      const hourlyData: Record<number, any> = {};
      for (let i = 0; i < 24; i++) {
        const dateObj = new Date();
        dateObj.setHours(i, 0, 0, 0);
        hourlyData[i] = { date: format(dateObj, 'h a'), hour: i };
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
      // Weekly: Starts on Friday as per "Study Milon" custom cycle
      const currentWeekStart = startOfWeek(now, { weekStartsOn: 5 });
      const interval = eachDayOfInterval({ start: currentWeekStart, end: now });
      
      const dailyAgg: Record<string, any> = {};
      interval.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        dailyAgg[key] = { date: format(day, 'EEE'), key };
      });

      filteredSessions = sessions.filter(s => s.date && isAfter(new Date(s.date), subDays(currentWeekStart, 1)));
      
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
      // Monthly: Grouped by Weeks (Week 1, Week 2...)
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      
      const weeksData: Record<string, any> = {
        'Week 1': { date: 'Week 1' },
        'Week 2': { date: 'Week 2' },
        'Week 3': { date: 'Week 3' },
        'Week 4': { date: 'Week 4' },
        'Week 5': { date: 'Week 5' }
      };

      filteredSessions = sessions.filter(s => s.date && isSameMonth(new Date(s.date), now));
      
      filteredSessions.forEach(s => {
        const date = new Date(s.date);
        const dayOfMonth = date.getDate();
        const weekKey = `Week ${Math.ceil(dayOfMonth / 7)}`;
        const subName = s.subject || 'Other';
        activeSubjectsSet.add(subName);
        
        if (weeksData[weekKey]) {
          weeksData[weekKey][subName] = (weeksData[weekKey][subName] || 0) + s.duration;
        }
      });

      chartData = Object.values(weeksData);
    }
    else if (filter === 'yearly') {
      // Yearly: Grouped by Months
      const createdAt = profile?.createdAt?.toDate() || subDays(now, 365);
      const startOfJoinMonth = startOfMonth(createdAt);
      const monthsInterval = eachMonthOfInterval({ start: startOfJoinMonth, end: now });

      const monthsAgg: Record<string, any> = {};
      monthsInterval.forEach(month => {
        const mKey = format(month, 'MMM yy');
        monthsAgg[mKey] = { date: mKey };
      });

      filteredSessions = sessions;
      sessions.forEach(s => {
        if (s.date) {
          const date = new Date(s.date);
          const mKey = format(date, 'MMM yy');
          if (monthsAgg[mKey]) {
            const subName = s.subject || 'Other';
            activeSubjectsSet.add(subName);
            monthsAgg[mKey][subName] = (monthsAgg[mKey][subName] || 0) + s.duration;
          }
        }
      });

      chartData = Object.values(monthsAgg).slice(-12); // Show last 12 months
    }

    const currentPeriodMins = filteredSessions.reduce((acc, curr) => acc + curr.duration, 0);

    const subjectMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      const sub = session.subject || 'Other';
      subjectMinutes[sub] = (subjectMinutes[sub] || 0) + session.duration;
    }
    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({ name, value }));

    // Consistency logic
    const uniqueDays = new Set(filteredSessions.map(s => s.date)).size;
    const periodDays = filter === 'daily' ? 1 : filter === 'weekly' ? 7 : filter === 'monthly' ? 30 : 365;
    const consistencyFactor = (uniqueDays / Math.max(1, Math.min(periodDays, differenceInDays(now, profile?.createdAt?.toDate() || now) + 1)));
    const goalMins = profile?.daily_goal_minutes || 360;
    const volumeFactor = Math.min(1.2, (profile?.daily_study_minutes || 0) / goalMins);
    const hustleScore = Math.round(consistencyFactor * volumeFactor * 100);

    return { 
      chartData, 
      subjectData, 
      hustleScore, 
      currentPeriodMins, 
      activeSubjects: Array.from(activeSubjectsSet),
      filteredSessions
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
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-xl font-black tracking-tight font-headline uppercase">Hustle Insights</h2>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1 rounded-lg h-9">
            <TabsTrigger value="daily" className="rounded-md font-bold text-[10px]">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="rounded-md font-bold text-[10px]">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="rounded-md font-bold text-[10px]">Monthly</TabsTrigger>
            <TabsTrigger value="yearly" className="rounded-md font-bold text-[10px]">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <Card className="md:col-span-3 rounded-xl border-none shadow-xl bg-primary text-primary-foreground overflow-hidden group relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Zap className="h-20 w-20" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground/70">
              {filter} Hustle Total
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black tracking-tighter">
                {formatStudyTime(stats.currentPeriodMins)}
              </h3>
            </div>
            <div className="pt-1">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1.5">
                 <span>Consistency Score</span>
                 <span>{stats.hustleScore}%</span>
              </div>
              <Progress value={stats.hustleScore} className="h-1.5 bg-white/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 rounded-xl border-none shadow-xl bg-card overflow-hidden border">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              <Trophy className="inline-block h-3 w-3 mr-1 text-primary" /> Million Quest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black tracking-tighter">
                {(profile?.total_study_minutes || 0).toLocaleString()}
              </h3>
              <span className="text-[9px] font-black text-muted-foreground uppercase">Min</span>
            </div>
            <div className="pt-1">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1.5 text-primary">
                 <span>Lifetime Progress</span>
                 <span>{((profile?.total_study_minutes || 0) / 1000000 * 100).toFixed(4)}%</span>
              </div>
              <Progress value={((profile?.total_study_minutes || 0) / 1000000 * 100)} className="h-1.5 bg-secondary" />
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-6 space-y-6">
          <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-secondary/10 border-b">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                  <BarChart className="h-4 w-4 text-primary" /> Session Mapping
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
                  {filter === 'daily' ? 'Hourly Focus Analysis' : 
                   filter === 'weekly' ? 'Daily Consistency (Fri-Thu)' : 
                   filter === 'monthly' ? 'Weekly Output Breakdown' : 'Monthly Performance Tracking'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                 <Layers className="h-2.5 w-2.5" /> Stacked Subjects
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-4">
              <StudyActivityChart 
                data={stats.chartData} 
                showTargetLine={filter === 'daily' || filter === 'weekly'} 
                targetValue={profile?.daily_goal_minutes || 360}
                scrollable={filter === 'daily' || filter === 'yearly'}
                subjects={stats.activeSubjects}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b pb-3">
                <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                  <PieChart className="h-4 w-4 text-primary" /> Focus Areas
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                  Subject Distribution for this {filter}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <SubjectDistributionChart data={stats.subjectData} />
              </CardContent>
            </Card>

            <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
               <CardHeader className="bg-secondary/10 border-b pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                  <History className="h-4 w-4 text-primary" /> Recent Logs
                </CardTitle>
                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest">{stats.filteredSessions.length} Logs</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[350px]">
                  {stats.filteredSessions.length > 0 ? (
                    <div className="divide-y">
                      {stats.filteredSessions.slice(0, 20).map((session, idx) => (
                        <div key={idx} className="p-4 hover:bg-secondary/10 transition-colors flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary shadow-sm border border-primary/10">
                                <BookOpen className="h-5 w-5" />
                             </div>
                             <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{session.subject || 'Focus Session'}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                                   <Calendar className="h-2.5 w-2.5" /> {session.date}
                                </div>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-black text-primary tabular-nums">{formatStudyTime(session.duration)}</p>
                             <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Focused</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                       <Zap className="h-10 w-10 text-muted-foreground/20" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">No Sessions Found</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
