'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Trophy, 
  Users2, 
  School, 
  Mail, 
  Clock, 
  Calendar as CalendarIcon, 
  BarChart,
  PieChart,
  Target,
  Wifi
} from 'lucide-react';
import { format, startOfDay, isAfter, subDays, getISOWeek, subSeconds } from 'date-fns';
import { StudyActivityChart } from '@/components/dashboard/StudyActivityChart';
import { SubjectDistributionChart } from '@/components/dashboard/SubjectDistributionChart';

export default function PublicProfilePage() {
  const { userId } = useParams();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');

  // Fetch Target User Profile
  const userRef = useMemo(() => doc(firestore, 'users', userId as string), [firestore, userId]);
  const { data: profile, loading: profileLoading } = useDoc<any>(userRef as any);

  // Live status logic
  const isLive = useMemo(() => {
    if (!profile) return false;
    let currentlyStudying = profile.isStudying === true;
    if (profile.last_active_date) {
        const lastActive = profile.last_active_date.toDate();
        const twoMinsAgo = subSeconds(new Date(), 120);
        currentlyStudying = currentlyStudying && isAfter(lastActive, twoMinsAgo);
    }
    return currentlyStudying;
  }, [profile]);

  // Fetch Guild Info if exists
  const guildRef = useMemo(() => profile?.groupId ? doc(firestore, 'groups', profile.groupId) : null, [firestore, profile?.groupId]);
  const { data: guild } = useDoc<any>(guildRef as any);

  // Fetch Study Sessions for charts
  const sessionsQuery = useMemo(() => {
    return query(
      collection(firestore, 'users', userId as string, 'studySessions'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, userId]);
  const { data: sessions, loading: sessionsLoading } = useCollection<any>(sessionsQuery);

  const stats = useMemo(() => {
    if (!sessions) return { chartData: [], subjectData: [], totalMinutes: 0, currentPeriodMins: 0 };

    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const thisWeekStr = `${now.getFullYear()}-W${getISOWeek(now)}`;
    const thisMonthStr = format(now, 'yyyy-MM');

    let filteredSessions = sessions;
    let chartDays = 7;

    if (filter === 'daily') {
      const today = startOfDay(now);
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), today));
      chartDays = 1;
    } else if (filter === 'weekly') {
      const weekAgo = startOfDay(subDays(now, 6));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), weekAgo));
      chartDays = 7;
    } else if (filter === 'monthly') {
      const monthAgo = startOfDay(subDays(now, 29));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), monthAgo));
      chartDays = 30;
    } else if (filter === 'yearly') {
      const yearAgo = startOfDay(subDays(now, 364));
      filteredSessions = sessions.filter(s => s.createdAt && isAfter(s.createdAt.toDate(), yearAgo));
      chartDays = 14; 
    }

    const totalMinutes = sessions.reduce((acc: number, s: any) => acc + (s.duration || 0), 0);

    // Calculate display minutes with Virtual Reset for consistency
    let currentPeriodMins = 0;
    if (profile) {
      if (filter === 'daily') currentPeriodMins = profile.last_study_day === todayStr ? (profile.daily_study_minutes || 0) : 0;
      else if (filter === 'weekly') currentPeriodMins = profile.last_study_week === thisWeekStr ? (profile.weekly_study_minutes || 0) : 0;
      else if (filter === 'monthly') currentPeriodMins = profile.last_study_month === thisMonthStr ? (profile.monthly_study_minutes || 0) : 0;
      else currentPeriodMins = profile.total_study_minutes || 0;
    }

    // Activity Chart Data (Synced with local keys)
    const dailyMinutes: Record<string, number> = {};
    for (const session of sessions) {
      if (!session.date) continue;
      dailyMinutes[session.date] = (dailyMinutes[session.date] || 0) + session.duration;
    }

    const chartData = Array.from({ length: chartDays })
      .map((_, i) => {
        const date = subDays(now, i);
        const dayKey = format(date, 'yyyy-MM-dd');
        return { 
          date: filter === 'monthly' || filter === 'yearly' ? format(date, 'd MMM') : format(date, 'E'), 
          minutes: dailyMinutes[dayKey] || 0 
        };
      })
      .reverse();

    // Subject Breakdown
    const subjectMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      const sub = session.subject || 'Other';
      subjectMinutes[sub] = (subjectMinutes[sub] || 0) + session.duration;
    }

    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({ name, value }));

    return { chartData, subjectData, totalMinutes, currentPeriodMins };
  }, [sessions, filter, profile]);

  const formatTime = (minutes: number = 0) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="p-8 max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-48 rounded-[2.5rem]" />
          <Skeleton className="h-96 rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  if (!profile) return <div className="p-20 text-center">Student not found.</div>;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-20 md:pb-10">
        <Header />
        <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
          
          {/* Hero Profile Card */}
          <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-[#1A1C3D] text-white relative">
            <div className="absolute top-0 right-0 p-12 opacity-5">
              <Trophy className="h-48 w-48" />
            </div>
            <CardContent className="p-8 md:p-12 relative">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                <div className="relative">
                  <Avatar className="h-24 w-24 md:h-32 md:w-32 ring-4 ring-primary/20 shadow-2xl">
                    <AvatarImage src={profile.photoURL || undefined} />
                    <AvatarFallback className="text-3xl font-black bg-white/10">{profile.displayName?.[0]}</AvatarFallback>
                  </Avatar>
                  {isLive && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-success text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1.5 shadow-xl border-2 border-[#1A1C3D]">
                      <Wifi className="h-3 w-3" /> LIVE
                    </div>
                  )}
                </div>
                
                <div className="flex-1 text-center md:text-left space-y-4">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <Badge className="bg-primary/20 text-primary-foreground border-none font-black text-[10px] uppercase px-3">
                      {profile.category} {profile.batch}
                    </Badge>
                    {guild && (
                      <Badge variant="outline" className="border-white/20 text-white font-black text-[10px] uppercase px-3 flex items-center gap-1.5">
                        <Users2 className="h-3 w-3" /> {guild.name}
                      </Badge>
                    )}
                    {isLive && (
                      <Badge className="bg-success/20 text-success border-none font-black text-[10px] uppercase px-3">
                        Studying Now
                      </Badge>
                    )}
                  </div>
                  
                  <h1 className="text-3xl md:text-6xl font-black tracking-tighter leading-none">{profile.displayName}</h1>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-medium text-white/60">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <Mail className="h-4 w-4 text-primary" /> {profile.email}
                    </div>
                    {profile.institution && (
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <School className="h-4 w-4 text-primary" /> {profile.institution}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center min-w-[140px]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Total Hustle</p>
                  <h3 className="text-2xl md:text-3xl font-black">{(profile.total_study_minutes / 60).toFixed(1)}h</h3>
                  <p className="text-[10px] font-bold text-white/40">Since {profile.createdAt ? format(profile.createdAt.toDate(), 'MMM yyyy') : 'Joining'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analytics Section */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-2">
                  <BarChart className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-black tracking-tight">Hustle Insights</h2>
               </div>
               <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full sm:w-auto">
                  <TabsList className="grid grid-cols-4 bg-secondary/50 h-11 p-1 rounded-xl">
                    <TabsTrigger value="daily" className="rounded-lg font-bold text-xs">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="rounded-lg font-bold text-xs">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-lg font-bold text-xs">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="rounded-lg font-bold text-xs">Yearly</TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               
               {/* Left Column: Activity Chart */}
               <Card className="lg:col-span-8 rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                       <CalendarIcon className="h-5 w-5 text-primary" /> Consistency Tracker
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sessionsLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      <StudyActivityChart data={stats.chartData} showTargetLine={filter === 'weekly' || filter === 'daily'} targetValue={profile.daily_goal_minutes || 360} />
                    )}
                  </CardContent>
               </Card>

               {/* Right Column: Distribution */}
               <Card className="lg:col-span-4 rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                       <PieChart className="h-5 w-5 text-primary" /> Focus Areas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {sessionsLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      <SubjectDistributionChart data={stats.subjectData} />
                    )}
                  </CardContent>
               </Card>

               {/* Summary Stats */}
               <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <Card className="rounded-[2rem] border-none shadow-lg bg-primary/5 p-6 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">Daily Goal</p>
                    <div className="flex items-center justify-between">
                      <h4 className="text-2xl font-black">{formatTime(profile.daily_goal_minutes)}</h4>
                      <Target className="h-8 w-8 text-primary/20" />
                    </div>
                  </Card>
                  <Card className="rounded-[2rem] border-none shadow-lg bg-orange-500/5 p-6 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">{filter} Hustle</p>
                    <div className="flex items-center justify-between">
                      <h4 className="text-2xl font-black">{formatTime(stats.currentPeriodMins)}</h4>
                      <Clock className="h-8 w-8 text-orange-500/20" />
                    </div>
                  </Card>
                  <Card className="rounded-[2rem] border-none shadow-lg bg-indigo-500/5 p-6 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Global Rank</p>
                    <div className="flex items-center justify-between">
                      <h4 className="text-2xl font-black">Elite Student</h4>
                      <Trophy className="h-8 w-8 text-indigo-500/20" />
                    </div>
                  </Card>
               </div>

            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
