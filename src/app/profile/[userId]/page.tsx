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
  Activity,
  ChevronLeft
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
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!profile) return <div className="p-20 text-center">Student not found.</div>;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
          
          {/* Hero Profile Card */}
          <Card className="rounded-xl border-none shadow-xl overflow-hidden bg-[#1A1C3D] text-white relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Trophy className="h-32 w-32 transition-transform group-hover:scale-110 duration-1000" />
            </div>
            <CardContent className="p-4 md:p-8 relative z-10">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative">
                  <Avatar className="h-20 w-20 md:h-28 md:w-28 border-4 border-white/10 shadow-2xl">
                    <AvatarImage src={profile.photoURL || undefined} />
                    <AvatarFallback className="text-2xl font-black bg-white/10">{profile.displayName?.[0]}</AvatarFallback>
                  </Avatar>
                  {isLive && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-xl border-2 border-[#1A1C3D]">
                      <Wifi className="h-2 w-2" /> LIVE
                    </div>
                  )}
                </div>
                
                <div className="flex-1 text-center md:text-left space-y-3">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <Badge className="bg-primary/20 text-primary-foreground border-none font-black text-[9px] uppercase px-2">
                      {profile.category} {profile.batch}
                    </Badge>
                    {guild && (
                      <Badge variant="outline" className="border-white/20 text-white font-black text-[9px] uppercase px-2 flex items-center gap-1">
                        <Users2 className="h-2.5 w-2.5" /> {guild.name}
                      </Badge>
                    )}
                  </div>
                  
                  <h1 className="text-xl md:text-4xl font-black tracking-tighter leading-none">{profile.displayName}</h1>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3 text-[10px] md:text-xs font-medium text-white/60">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-primary" /> {profile.email}
                    </div>
                    {profile.institution && (
                      <div className="flex items-center gap-1.5">
                        <School className="h-3 w-3 text-primary" /> {profile.institution}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 md:p-6 border border-white/10 text-center min-w-[120px] shadow-inner backdrop-blur-sm">
                  <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Total Hustle</p>
                  <h3 className="text-xl md:text-2xl font-black tracking-tighter">{(profile.total_study_minutes / 60).toFixed(1)}h</h3>
                  <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Since {profile.createdAt ? format(profile.createdAt.toDate(), 'MMM yyyy') : 'Joining'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analytics Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
               <div className="flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-black tracking-tighter uppercase leading-none">Hustle Insights</h2>
               </div>
               <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full sm:w-auto">
                  <TabsList className="grid grid-cols-4 bg-secondary/50 h-9 p-1 rounded-xl">
                    <TabsTrigger value="daily" className="rounded-lg font-black text-[9px] uppercase tracking-wider">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="rounded-lg font-black text-[9px] uppercase tracking-wider">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-lg font-black text-[9px] uppercase tracking-wider">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="rounded-lg font-black text-[9px] uppercase tracking-wider">Yearly</TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
               
               {/* Consistency Tracker */}
               <Card className="lg:col-span-12 rounded-xl border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 bg-secondary/10 border-b">
                    <div>
                      <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight uppercase">
                        <CalendarIcon className="h-4 w-4 text-primary" /> Consistency Tracker
                      </CardTitle>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        {filter === 'daily' ? 'Hourly Mapping' : `Activity for ${filter}`}
                      </p>
                    </div>
                    {filter === 'daily' && isLive && (
                      <div className="flex items-center gap-1.5 bg-red-600/10 px-2 py-1 rounded-full border border-red-600/20 animate-pulse">
                         <Activity className="h-2.5 w-2.5 text-red-600" />
                         <span className="text-[7px] font-black uppercase text-red-600 tracking-widest">Live</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 pt-6">
                    {sessionsLoading ? (
                      <Skeleton className="h-[300px] w-full" />
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

               {/* Focus Areas Chart */}
               <Card className="lg:col-span-7 rounded-xl border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="bg-secondary/10 border-b pb-3">
                    <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight uppercase">
                       <PieChart className="h-4 w-4 text-primary" /> Focus Areas
                    </CardTitle>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Subject-wise Distribution</p>
                  </CardHeader>
                  <CardContent className="p-6">
                    {sessionsLoading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      <SubjectDistributionChart data={stats.subjectData} />
                    )}
                  </CardContent>
               </Card>

               {/* Quick Stats Summary */}
               <div className="lg:col-span-5 space-y-4">
                  <Card className="rounded-xl border-none shadow-lg bg-primary/[0.03] ring-1 ring-inset ring-primary/10 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary">Daily Goal</p>
                        <Target className="h-4 w-4 text-primary/30" />
                    </div>
                    <h4 className="text-2xl font-black tracking-tighter">{formatTime(profile.daily_goal_minutes)}</h4>
                  </Card>
                  
                  <Card className="rounded-xl border-none shadow-lg bg-orange-500/[0.03] ring-1 ring-inset ring-orange-500/10 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-widest text-orange-500">{filter} Hustle</p>
                        <Clock className="h-4 w-4 text-orange-500/30" />
                    </div>
                    <h4 className="text-2xl font-black tracking-tighter">{formatTime(stats.currentPeriodMins)}</h4>
                  </Card>
                  
                  <Card className="rounded-xl border-none shadow-lg bg-indigo-500/[0.03] ring-1 ring-inset ring-indigo-500/10 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Academic Status</p>
                        {isLive ? <Wifi className="h-4 w-4 text-red-600 animate-pulse" /> : <Trophy className="h-4 w-4 text-indigo-500/30" />}
                    </div>
                    <h4 className="text-2xl font-black tracking-tighter">{isLive ? 'Studying Now' : 'Active Student'}</h4>
                  </Card>
               </div>

            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
