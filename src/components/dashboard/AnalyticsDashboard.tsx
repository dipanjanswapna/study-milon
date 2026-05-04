'use client';

import React, { useMemo, useState } from 'react';
import { useCollection, useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { UserProfile } from '@/firebase/firestore/users';
import { StudyActivityChart } from './StudyActivityChart';
import { SubjectDistributionChart } from './SubjectDistributionChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Clock, PieChart, BarChart, Trophy, Zap, TrendingUp, Activity, Calendar, History, BookOpen, Layers, Flame, Target, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays, format, isAfter, startOfMonth, eachDayOfInterval, isSameMonth, startOfDay, eachMonthOfInterval, startOfWeek, endOfMonth, endOfWeek, addDays, differenceInDays } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

      chartData = Object.values(monthsAgg).slice(-12);
    }

    const currentPeriodMins = filteredSessions.reduce((acc, curr) => acc + curr.duration, 0);

    const subjectMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      const sub = session.subject || 'Other';
      subjectMinutes[sub] = (subjectMinutes[sub] || 0) + session.duration;
    }
    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({ name, value }));

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
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary shadow-sm border border-primary/20">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h2 className="text-xl font-black tracking-tight font-headline uppercase">Hustle Insights</h2>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/50 p-1 rounded-xl h-10">
            <TabsTrigger value="daily" className="rounded-lg font-black text-[10px] uppercase">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="rounded-lg font-black text-[10px] uppercase">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="rounded-lg font-black text-[10px] uppercase">Monthly</TabsTrigger>
            <TabsTrigger value="yearly" className="rounded-lg font-black text-[10px] uppercase">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Consistency / Smart Streak Card */}
        <Card className="md:col-span-2 rounded-[2rem] border-none shadow-xl bg-primary text-primary-foreground overflow-hidden group relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 transition-transform group-hover:rotate-45 duration-1000">
            <Flame className="h-32 w-32" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground/70 flex items-center gap-2">
              <Star className="h-3 w-3 fill-current" /> SMART STREAK
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-2">
              <h3 className="text-6xl font-black tracking-tighter">
                {profile?.currentStreak || 0}
              </h3>
              <span className="text-xs font-black uppercase text-primary-foreground/60 tracking-widest">Days</span>
            </div>
            
            <div className="space-y-3 pt-2">
               <div className="p-3 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-[8px] font-black uppercase tracking-widest">Daily Progress</span>
                     <span className="text-[10px] font-black">{Math.min(100, Math.round(((profile?.daily_study_minutes || 0) / (profile?.daily_goal_minutes || 360)) * 100))}%</span>
                  </div>
                  <Progress value={((profile?.daily_study_minutes || 0) / (profile?.daily_goal_minutes || 360)) * 100} className="h-1 bg-white/20" />
               </div>
               <p className="text-[9px] font-bold text-center text-primary-foreground/60 uppercase tracking-tighter leading-relaxed">
                  { (profile?.daily_study_minutes || 0) >= (profile?.daily_goal_minutes || 360) 
                    ? "Goal achieved! Streak secured for today. 🔥" 
                    : "Hustle more to keep the streak alive!" }
               </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 rounded-[2rem] border-none shadow-xl bg-card overflow-hidden border">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3 text-primary" /> {filter} Hustle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-black tracking-tighter">
                {formatStudyTime(stats.currentPeriodMins)}
              </h3>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1.5 text-primary">
                 <span>Hustle Score</span>
                 <span>{stats.hustleScore}%</span>
              </div>
              <Progress value={stats.hustleScore} className="h-1.5 bg-secondary" />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 rounded-[2rem] border-none shadow-xl bg-card overflow-hidden border">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Trophy className="h-3 w-3 text-primary" /> Million Quest
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black tracking-tighter">
                {(profile?.total_study_minutes || 0).toLocaleString()}
              </h3>
              <span className="text-[9px] font-black text-muted-foreground uppercase">Min</span>
            </div>
            <div className="pt-2">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1.5 text-indigo-500">
                 <span>Mastery Path</span>
                 <span>{((profile?.total_study_minutes || 0) / 1000000 * 100).toFixed(4)}%</span>
              </div>
              <Progress value={((profile?.total_study_minutes || 0) / 1000000 * 100)} className="h-1.5 bg-secondary" />
            </div>
            <p className="text-[8px] font-bold text-muted-foreground/60 text-center uppercase tracking-widest">Longest Streak: {profile?.longestStreak || 0} Days</p>
          </CardContent>
        </Card>

        <div className="md:col-span-6 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-secondary/10 border-b p-6">
              <div>
                <CardTitle className="text-base font-black flex items-center gap-2 uppercase tracking-tight">
                  <BarChart className="h-5 w-5 text-primary" /> Session Mapping
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
                  {filter === 'daily' ? 'Hourly Focus Analysis' : 
                   filter === 'weekly' ? 'Daily Consistency (Fri-Thu)' : 
                   filter === 'monthly' ? 'Weekly Output Breakdown' : 'Monthly Performance Tracking'}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1 h-7 rounded-full bg-white">
                 <Layers className="h-3 w-3" /> Stacked Subjects
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-6">
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
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
              <CardHeader className="bg-secondary/10 border-b p-6 pb-4">
                <CardTitle className="text-base font-black flex items-center gap-2 uppercase tracking-tight">
                  <PieChart className="h-5 w-5 text-primary" /> Focus Areas
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
                  Subject Distribution for this {filter}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <SubjectDistributionChart data={stats.subjectData} />
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
               <CardHeader className="bg-secondary/10 border-b p-6 pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-black flex items-center gap-2 uppercase tracking-tight">
                  <History className="h-5 w-5 text-primary" /> Recent Logs
                </CardTitle>
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white h-7 px-3 rounded-full">{stats.filteredSessions.length} Logs</Badge>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  {stats.filteredSessions.length > 0 ? (
                    <div className="divide-y divide-secondary/30">
                      {stats.filteredSessions.slice(0, 20).map((session, idx) => (
                        <div key={idx} className="p-5 hover:bg-secondary/10 transition-colors flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner border border-primary/10 transition-transform hover:scale-110">
                                <BookOpen className="h-6 w-6" />
                             </div>
                             <div className="min-w-0">
                                <p className="text-sm font-black truncate tracking-tight">{session.subject || 'Focus Session'}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                                   <Calendar className="h-3 w-3 text-primary/50" /> {session.date}
                                </div>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-base font-black text-primary tabular-nums tracking-tighter">{formatStudyTime(session.duration)}</p>
                             <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">Focused</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-24 text-center flex flex-col items-center justify-center gap-4">
                       <div className="bg-secondary/50 p-6 rounded-full">
                          <Zap className="h-10 w-10 text-muted-foreground/20" />
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">No Sessions Logged</p>
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
