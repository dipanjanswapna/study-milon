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
  Wifi,
  Activity
} from 'lucide-react';
import { 
  format, 
  startOfDay, 
  isAfter, 
  subDays, 
  getISOWeek, 
  subSeconds, 
  eachDayOfInterval, 
  isSameMonth, 
  startOfMonth, 
  eachMonthOfInterval 
} from 'date-fns';
import { StudyActivityChart } from '@/components/dashboard/StudyActivityChart';
import { SubjectDistributionChart } from '@/components/dashboard/SubjectDistributionChart';

export default function PublicProfilePage() {
  const { userId } = useParams();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

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
    if (!sessions) return { chartData: [], subjectData: [], currentPeriodMins: 0, activeSubjects: [] };

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
        hourlyData[i] = { 
          date: format(dateObj, 'h a'), 
          hour: i 
        };
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
      const sevenDaysAgo = startOfDay(subDays(now, 6));
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
      const createdAt = profile?.createdAt?.toDate() || now;
      const startOfJoinMonth = startOfMonth(createdAt);
      const monthsInterval = eachMonthOfInterval({ start: startOfJoinMonth, end: now });

      const monthsAgg: Record<string, any> = {};
      monthsInterval.forEach(month => {
        const mKey = format(month, 'MMM yy');
        monthsAgg[mKey] = { date: mKey };
      });

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

      chartData = Object.values(monthsAgg);
      filteredSessions = sessions;
    }

    const currentPeriodMins = filteredSessions.reduce((acc, curr) => acc + curr.duration, 0);

    const subjectMinutes: Record<string, number> = {};
    for (const session of filteredSessions) {
      const sub = session.subject || 'Other';
      subjectMinutes[sub] = (subjectMinutes[sub] || 0) + session.duration;
    }
    const subjectData = Object.entries(subjectMinutes).map(([name, value]) => ({ name, value }));

    return { 
      chartData, 
      subjectData, 
      currentPeriodMins, 
      activeSubjects: Array.from(activeSubjectsSet) 
    };
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
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1.5 shadow-xl border-2 border-[#1A1C3D]">
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

            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
               <Card className="md:col-span-6 rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-xl font-black flex items-center gap-2">
                        <CalendarIcon className="h-6 w-6 text-primary" /> Consistency Tracker
                      </CardTitle>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                        {filter === 'daily' ? 'Hourly Session Mapping' : filter === 'yearly' ? 'Full Hustle History' : `Activity Overview for ${filter}`}
                      </p>
                    </div>
                    {filter === 'daily' && isLive && (
                      <div className="flex items-center gap-2 bg-red-600/10 px-3 py-1.5 rounded-full border border-red-600/20 animate-pulse">
                         <Activity className="h-3 w-3 text-red-600" />
                         <span className="text-[8px] font-black uppercase text-red-600 tracking-widest">Live Sync</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-4">
                    {sessionsLoading ? (
                      <Skeleton className="h-[380px] w-full" />
                    ) : (
                      <StudyActivityChart 
                        data={stats.chartData} 
                        showTargetLine={filter === 'daily' || filter === 'weekly'} 
                        targetValue={profile.daily_goal_minutes || 360}
                        scrollable={filter === 'daily' || filter === 'yearly'}
                        subjects={stats.activeSubjects}
                      />
                    )}
                  </CardContent>
               </Card>

               <Card className="md:col-span-6 rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                       <PieChart className="h-6 w-6 text-primary" /> Focus Areas
                    </CardTitle>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Subject-wise Distribution for {filter}</p>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    {sessionsLoading ? (
                      <Skeleton className="h-[350px] w-full" />
                    ) : (
                      <SubjectDistributionChart data={stats.subjectData} />
                    )}
                  </CardContent>
               </Card>

               {/* Summary Stats */}
               <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Global Status</p>
                    <div className="flex items-center justify-between">
                      <h4 className="text-2xl font-black">{isLive ? 'Studying Now' : 'Active Student'}</h4>
                      {isLive ? <Wifi className="h-8 w-8 text-red-600 animate-pulse" /> : <Trophy className="h-8 w-8 text-indigo-500/20" />}
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
