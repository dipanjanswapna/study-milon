'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
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
  Medal,
  Award,
  Crown,
  Star,
  ChevronLeft,
  ChevronRight,
  Zap,
  BookOpen,
  List
} from 'lucide-react';
import { 
  format, 
  startOfDay, 
  isAfter, 
  subDays, 
  subSeconds, 
  eachDayOfInterval, 
  isSameMonth, 
  startOfMonth, 
  eachMonthOfInterval,
  startOfWeek,
  endOfMonth,
  endOfWeek,
  addDays,
  isSameDay
} from 'date-fns';
import { StudyActivityChart } from '@/components/dashboard/StudyActivityChart';
import { SubjectDistributionChart } from '@/components/dashboard/SubjectDistributionChart';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function PublicProfilePage() {
  const { userId } = useParams();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [ranks, setRanks] = useState<{ daily: string | null; weekly: string | null; monthly: string | null; yearly: string | null }>({ 
    daily: null, 
    weekly: null, 
    monthly: null, 
    yearly: null 
  });

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

  // Ranking Calculation Logic
  useEffect(() => {
    if (!profile) return;

    const calculateRanks = async () => {
      const periods = ['daily', 'weekly', 'monthly', 'yearly'] as const;
      const newRanks: any = { daily: null, weekly: null, monthly: null, yearly: null };

      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const weekStart = startOfWeek(now, { weekStartsOn: 5 });
      const weekStr = `Friday_${format(weekStart, 'yyyy-MM-dd')}`;
      const monthStr = format(now, 'yyyy-MM');
      const yearStr = format(now, 'yyyy');

      for (const p of periods) {
        const field = `${p}_study_minutes`;
        const q = query(collection(firestore, 'users'), orderBy(field, 'desc'), limit(100));
        const snap = await getDocs(q);
        
        const sortedUsers = snap.docs.map(d => {
          const data = d.data();
          let val = data[field] || 0;
          
          if (p === 'daily' && data.last_study_day !== todayStr) val = 0;
          if (p === 'weekly' && data.last_study_week !== weekStr) val = 0;
          if (p === 'monthly' && data.last_study_month !== monthStr) val = 0;
          if (p === 'yearly' && data.last_study_year !== yearStr) val = 0;
          
          return { uid: d.id, val };
        }).sort((a, b) => b.val - a.val);

        const rankIndex = sortedUsers.findIndex(u => u.uid === userId && u.val > 0);
        newRanks[p] = rankIndex !== -1 ? `#${rankIndex + 1}` : null;
      }
      setRanks(newRanks);
    };

    calculateRanks();
  }, [profile, firestore, userId]);

  // Fetch Guild Info
  const guildRef = useMemo(() => profile?.groupId ? doc(firestore, 'groups', profile.groupId) : null, [firestore, profile?.groupId]);
  const { data: guild } = useDoc<any>(guildRef as any);

  // Fetch All Study Sessions
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

  const activeRanks = [
    { label: "Daily Rank", value: ranks.daily, icon: <Star className="h-4 w-4 text-yellow-400" />, color: "from-yellow-400/20" },
    { label: "Weekly Rank", value: ranks.weekly, icon: <Medal className="h-4 w-4 text-slate-300" />, color: "from-slate-400/20" },
    { label: "Monthly Rank", value: ranks.monthly, icon: <Award className="h-4 w-4 text-orange-400" />, color: "from-orange-500/20" },
    { label: "Yearly Rank", value: ranks.yearly, icon: <Crown className="h-4 w-4 text-indigo-400" />, color: "from-indigo-500/20" },
  ].filter(r => r.value !== null);

  // Calendar Helper Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const selectedDaySessions = useMemo(() => {
    if (!sessions) return [];
    const dStr = format(selectedDate, 'yyyy-MM-dd');
    return sessions.filter(s => s.date === dStr);
  }, [sessions, selectedDate]);

  const selectedDaySubjectAgg = useMemo(() => {
    const agg: Record<string, number> = {};
    selectedDaySessions.forEach(s => {
      const sub = s.subject || 'Unknown';
      agg[sub] = (agg[sub] || 0) + s.duration;
    });
    return Object.entries(agg).map(([name, mins]) => ({ name, mins }));
  }, [selectedDaySessions]);

  const totalSelectedMins = selectedDaySubjectAgg.reduce((acc, curr) => acc + curr.mins, 0);

  if (profileLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-48 rounded-[2.5rem]" />
          <Skeleton className="h-96 rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  if (!profile) return <div className="p-20 text-center">Student not found.</div>;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
          
          {/* Hero Profile Card */}
          <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-[#1A1C3D] text-white relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Trophy className="h-48 w-48 transition-transform group-hover:scale-110 duration-1000" />
            </div>
            <CardContent className="p-6 md:p-10 relative z-10">
              <div className="flex flex-col lg:flex-row items-center lg:items-center gap-8 lg:gap-12">
                
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-5 lg:min-w-[300px]">
                  <div className="relative">
                    <div className="absolute -inset-1.5 bg-gradient-to-tr from-primary to-indigo-400 rounded-full blur opacity-40 animate-pulse" />
                    <Avatar className="h-28 w-24 md:h-32 md:w-32 border-4 border-white/10 shadow-2xl relative">
                      <AvatarImage src={profile.photoURL || undefined} />
                      <AvatarFallback className="text-3xl font-black bg-white/5">{profile.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    {isLive && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-full animate-pulse flex items-center gap-1.5 shadow-xl border-2 border-[#1A1C3D]">
                        <Wifi className="h-3 w-3" /> LIVE
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                      <Badge className="bg-primary/20 text-primary-foreground border-none font-black text-[10px] uppercase px-2.5 h-6">
                        {profile.category} {profile.batch}
                      </Badge>
                      {guild && (
                        <Badge variant="outline" className="border-white/20 text-white font-black text-[10px] uppercase px-2.5 h-6 flex items-center gap-1.5 bg-white/5">
                          <Users2 className="h-3 w-3 text-primary" /> {guild.name}
                        </Badge>
                      )}
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black tracking-tighter leading-tight">{profile.displayName}</h1>
                    <div className="flex flex-col space-y-1.5 text-xs font-medium text-white/50">
                      <div className="flex items-center justify-center lg:justify-start gap-2">
                        <Mail className="h-3.5 w-3.5 text-primary" /> {profile.email}
                      </div>
                      {profile.institution && (
                        <div className="flex items-center justify-center lg:justify-start gap-2">
                          <School className="h-3.5 w-3.5 text-primary" /> {profile.institution}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 h-full content-center">
                      {activeRanks.length > 0 ? activeRanks.map((r, i) => (
                        <RankCard key={i} label={r.label} value={r.value!} icon={r.icon} color={r.color} />
                      )) : (
                        <div className="col-span-2 md:col-span-4 bg-white/5 rounded-2xl p-6 border border-dashed border-white/20 text-center">
                           <p className="text-sm font-bold text-white/40 uppercase tracking-widest">No Global Rankings Secured Yet</p>
                        </div>
                      )}

                      <div className="col-span-2 md:col-span-4 mt-2 bg-white/5 rounded-2xl p-4 md:p-6 border border-white/10 flex items-center justify-between shadow-inner backdrop-blur-sm">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Lifetime Hustle</p>
                          <h3 className="text-2xl md:text-3xl font-black tracking-tighter leading-none">{( (profile.total_study_minutes || 0) / 60).toFixed(1)} <span className="text-sm font-bold text-white/40">Hours</span></h3>
                        </div>
                        <div className="hidden sm:block text-right">
                           <div className="bg-primary/20 px-3 py-1 rounded-full text-[10px] font-black uppercase text-primary border border-primary/20">
                              Joined {profile.createdAt ? format(profile.createdAt.toDate(), 'MMM yyyy') : 'Recently'}
                           </div>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hustle Analytics */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
               <div className="flex items-center gap-3">
                  <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                    <BarChart className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tighter uppercase leading-none">Hustle Analytics</h2>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Activity Mapping & Focus</p>
                  </div>
               </div>
               <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full sm:w-auto">
                  <TabsList className="grid grid-cols-4 bg-secondary/50 h-10 p-1.5 rounded-xl border">
                    <TabsTrigger value="daily" className="rounded-lg font-black text-[10px] uppercase tracking-wider">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="rounded-lg font-black text-[10px] uppercase tracking-wider">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-lg font-black text-[10px] uppercase tracking-wider">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="rounded-lg font-black text-[10px] uppercase tracking-wider">Yearly</TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
               <Card className="lg:col-span-12 rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 bg-secondary/10 border-b">
                    <div>
                      <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight uppercase">
                        <CalendarIcon className="h-4 w-4 text-primary" /> Session Mapping
                      </CardTitle>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Activity distribution for {filter}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 md:p-8">
                    {sessionsLoading ? (
                      <Skeleton className="h-[350px] w-full rounded-2xl" />
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

               <Card className="lg:col-span-7 rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="bg-secondary/10 border-b pb-4">
                    <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight uppercase">
                       <PieChart className="h-4 w-4 text-primary" /> Subject Focus
                    </CardTitle>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Time distribution per subject</p>
                  </CardHeader>
                  <CardContent className="p-6 md:p-10">
                    {sessionsLoading ? (
                      <Skeleton className="h-[300px] w-full rounded-2xl" />
                    ) : (
                      <SubjectDistributionChart data={stats.subjectData} />
                    )}
                  </CardContent>
               </Card>

               <div className="lg:col-span-5 space-y-6">
                  <StatSummaryCard label="Daily Target" value={formatTime(profile.daily_goal_minutes)} icon={<Target className="h-5 w-5" />} color="primary" />
                  <StatSummaryCard label={`${filter} Hustle`} value={formatTime(stats.currentPeriodMins)} icon={<Clock className="h-5 w-5" />} color="orange" />
                  <StatSummaryCard label="Academic Status" value={isLive ? 'Studying' : 'Active'} icon={isLive ? <Wifi className="h-5 w-5 animate-pulse" /> : <Trophy className="h-5 w-5" />} color="indigo" />
               </div>
            </div>
          </div>

          {/* Calendar Analytics Section */}
          <div className="space-y-6 pt-4">
             <div className="flex items-center gap-3 px-1">
                <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
                   <CalendarIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                   <h2 className="text-lg font-black tracking-tighter uppercase leading-none">Calendar Analytics</h2>
                   <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Day-wise Historical Deep Dive</p>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Calendar Card */}
                <Card className="lg:col-span-7 xl:col-span-8 bg-[#1A1C3D] border-none shadow-2xl rounded-[2.5rem] p-6 md:p-8">
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-xl">
                        <CalendarIcon className="h-6 w-6 text-primary" />
                      </div>
                      <h2 className="text-lg md:text-xl font-black text-white tracking-tighter uppercase">
                        {format(currentMonth, 'MMMM yyyy')}
                      </h2>
                    </div>
                    <div className="flex gap-2 bg-white/5 p-1.5 rounded-xl">
                      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subDays(startOfMonth(currentMonth), 1))} className="text-white hover:bg-white/10 h-10 w-10">
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addDays(endOfMonth(currentMonth), 1))} className="text-white hover:bg-white/10 h-10 w-10">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 mb-4 text-center">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                      <div key={idx} className="text-[9px] font-black uppercase tracking-widest text-white/30">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-2">
                    {(() => {
                      const rows = [];
                      let days = [];
                      let day = startDate;
                      while (day <= endDate) {
                        for (let i = 0; i < 7; i++) {
                          const formattedDate = format(day, 'yyyy-MM-dd');
                          const isCurrentMonth = isSameMonth(day, monthStart);
                          const isSelected = isSameDay(day, selectedDate);
                          const hasData = sessions?.some(s => s.date === formattedDate);
                          const cloneDay = day;
                          days.push(
                            <div
                              key={day.toString()}
                              className={cn(
                                "relative h-12 sm:h-20 flex flex-col items-center justify-center rounded-[1.2rem] transition-all cursor-pointer border-2",
                                !isCurrentMonth ? "opacity-5 pointer-events-none" : "",
                                isSelected 
                                  ? "bg-primary border-primary text-white shadow-2xl scale-105 z-10" 
                                  : "bg-white/5 border-transparent text-white/70 hover:border-white/20"
                              )}
                              onClick={() => setSelectedDate(cloneDay)}
                            >
                              <span className={cn("text-xs sm:text-xl font-black", isSelected ? "text-white" : "text-white/80")}>
                                {format(day, 'd')}
                              </span>
                              {hasData && !isSelected && (
                                <div className="absolute bottom-2 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                              )}
                            </div>
                          );
                          day = addDays(day, 1);
                        }
                        rows.push(<div className="grid grid-cols-7 gap-2 sm:gap-3" key={day.toString()}>{days}</div>);
                        days = [];
                      }
                      return rows;
                    })()}
                  </div>
                </Card>

                {/* Day Summary Card */}
                <Card className="lg:col-span-5 xl:col-span-4 rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden h-full min-h-[500px] flex flex-col">
                  <CardHeader className="bg-secondary/10 border-b pb-6 p-8">
                     <div className="flex items-center justify-between">
                        <div className="space-y-1">
                           <CardTitle className="text-xl font-black tracking-tight">{format(selectedDate, 'MMMM do')}</CardTitle>
                           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Session Breakdown</p>
                        </div>
                        <div className="bg-primary/10 p-3 rounded-2xl">
                           <Activity className="h-6 w-6 text-primary" />
                        </div>
                     </div>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 flex flex-col">
                    <ScrollArea className="flex-1">
                       <div className="p-8 space-y-6">
                          {selectedDaySubjectAgg.length > 0 ? (
                             <>
                                <div className="bg-primary/5 rounded-[2rem] p-6 border border-primary/10 text-center space-y-2">
                                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Total Daily Hustle</p>
                                   <h3 className="text-4xl font-black tracking-tighter">{formatTime(totalSelectedMins)}</h3>
                                </div>

                                <div className="space-y-4">
                                   <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                                      <List className="h-3 w-3" /> Subject List
                                   </div>
                                   <div className="space-y-3">
                                      {selectedDaySubjectAgg.map((item, idx) => (
                                         <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-secondary/20 hover:bg-secondary/30 transition-colors border border-transparent hover:border-primary/10 group">
                                            <div className="flex items-center gap-4">
                                               <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                                  <BookOpen className="h-5 w-5 text-primary" />
                                               </div>
                                               <span className="font-bold text-sm tracking-tight">{item.name}</span>
                                            </div>
                                            <Badge variant="secondary" className="font-black text-[11px] h-8 px-3 rounded-lg bg-white border-none shadow-sm">
                                               {formatTime(item.mins)}
                                            </Badge>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             </>
                          ) : (
                             <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
                                   <Zap className="h-8 w-8 text-muted-foreground/30" />
                                </div>
                                <div className="space-y-1">
                                   <h4 className="font-black tracking-tighter uppercase text-muted-foreground">No Hustle Logged</h4>
                                   <p className="text-[10px] font-medium text-muted-foreground/60 max-w-[150px]">No study sessions recorded for this specific date.</p>
                                </div>
                             </div>
                          )}
                       </div>
                    </ScrollArea>
                    <div className="p-8 pt-0 border-t bg-secondary/5 mt-auto">
                       <div className="flex items-center gap-3 pt-6">
                          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live Sync Status: Secure</p>
                       </div>
                    </div>
                  </CardContent>
                </Card>
             </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function RankCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={cn(
      "bg-gradient-to-br from-white/10 to-transparent p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-2 transition-all hover:bg-white/15 group/rank shadow-lg",
      color
    )}>
       <div className="p-2 bg-white/10 rounded-xl group-hover/rank:scale-110 transition-transform">
          {icon}
       </div>
       <div className="text-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">{label}</p>
          <p className="text-xl md:text-2xl font-black tracking-tighter leading-none">{value}</p>
       </div>
    </div>
  );
}

function StatSummaryCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: 'primary' | 'orange' | 'indigo' }) {
  const colorMap = {
    primary: "bg-primary/[0.03] ring-primary/10 text-primary",
    orange: "bg-orange-500/[0.03] ring-orange-500/10 text-orange-500",
    indigo: "bg-indigo-500/[0.03] ring-indigo-500/10 text-indigo-500"
  };

  return (
    <Card className={cn("rounded-[2rem] border-none shadow-lg p-6 space-y-4 ring-1 ring-inset", colorMap[color])}>
      <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</p>
          <div className="p-2 bg-background/50 rounded-lg shadow-sm">
             {icon}
          </div>
      </div>
      <h4 className="text-3xl font-black tracking-tighter text-foreground">{value}</h4>
    </Card>
  );
}
