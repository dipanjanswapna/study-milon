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
  List,
  Layers,
  Flame
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

  // Ranking Calculation Logic (Simplified for profile view)
  useEffect(() => {
    if (!profile) return;
    const calculateRanks = async () => {
      const periods = ['daily', 'weekly', 'monthly', 'yearly'] as const;
      const newRanks: any = { daily: null, weekly: null, monthly: null, yearly: null };
      for (const p of periods) {
        const val = profile[`${p}_study_minutes`] || 0;
        if (val > 0) newRanks[p] = "Secured";
      }
      setRanks(newRanks);
    };
    calculateRanks();
  }, [profile, userId]);

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
      chartData = Object.values(monthsAgg).slice(-12);
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
    { label: "Daily Rank", value: ranks.daily, icon: <Star className="h-3 w-3 text-yellow-400" />, color: "from-yellow-400/20" },
    { label: "Weekly Rank", value: ranks.weekly, icon: <Medal className="h-3 w-3 text-slate-300" />, color: "from-slate-400/20" },
    { label: "Monthly Rank", value: ranks.monthly, icon: <Award className="h-3 w-3 text-orange-400" />, color: "from-orange-500/20" },
    { label: "Yearly Rank", value: ranks.yearly, icon: <Crown className="h-3 w-3 text-indigo-400" />, color: "from-indigo-500/20" },
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
            <CardContent className="p-5 md:p-8 relative z-10">
              <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-10">
                
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-4 lg:min-w-[280px]">
                  <div className="relative">
                    <Avatar className="h-24 w-24 md:h-28 md:w-28 border-4 border-white/10 shadow-2xl relative">
                      <AvatarImage src={profile.photoURL || undefined} />
                      <AvatarFallback className="text-2xl font-black bg-white/5">{profile.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    {isLive && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-xl border border-[#1A1C3D]">
                        <Wifi className="h-2 w-2" /> LIVE
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                      <Badge className="bg-primary/20 text-primary-foreground border-none font-black text-[9px] uppercase px-2 h-5">
                        {profile.category} {profile.batch}
                      </Badge>
                      {guild && (
                        <Badge variant="outline" className="border-white/10 text-white/70 font-black text-[9px] uppercase h-5 flex items-center gap-1 bg-white/5">
                          <Users2 className="h-2 w-2 text-primary" /> {guild.name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-center lg:justify-start gap-2">
                       <h1 className="text-xl md:text-3xl font-black tracking-tighter leading-tight uppercase">{profile.displayName}</h1>
                       {profile.currentStreak > 0 && (
                          <Badge className="bg-orange-600 text-white border-none font-black text-[10px] px-2 h-5 flex items-center gap-1">
                             <Flame className="h-3 w-3 fill-current" /> {profile.currentStreak}
                          </Badge>
                       )}
                    </div>
                    <div className="flex flex-col space-y-1 text-[10px] font-medium text-white/40">
                      <div className="flex items-center justify-center lg:justify-start gap-1.5">
                        <Mail className="h-3 w-3 text-primary" /> {profile.email}
                      </div>
                      {profile.institution && (
                        <div className="flex items-center justify-center lg:justify-start gap-1.5">
                          <School className="h-3 w-3 text-primary" /> {profile.institution}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {activeRanks.length > 0 ? activeRanks.map((r, i) => (
                        <RankCard key={i} label={r.label} value={r.value!} icon={r.icon} color={r.color} />
                      )) : (
                        <div className="col-span-2 md:col-span-4 bg-white/5 rounded-xl p-6 border border-dashed border-white/10 text-center">
                           <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">No Global Rankings secured</p>
                        </div>
                      )}

                      <div className="col-span-2 md:col-span-4 bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between backdrop-blur-sm">
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-primary">Lifetime Hustle</p>
                          <h3 className="text-xl md:text-2xl font-black tracking-tighter">{( (profile.total_study_minutes || 0) / 60).toFixed(1)} <span className="text-[10px] font-bold text-white/30 uppercase">Hours</span></h3>
                        </div>
                        <div className="hidden sm:block text-right">
                           <div className="bg-primary/20 px-3 py-1 rounded-full text-[8px] font-black uppercase text-primary border border-primary/20">
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
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
               <div className="flex items-center gap-2">
                  <div className="bg-primary p-1.5 rounded-lg shadow-md">
                    <BarChart className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black tracking-tighter uppercase leading-none">Hustle Analytics</h2>
                    <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Consistency & Focus</p>
                  </div>
               </div>
               <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full sm:w-auto">
                  <TabsList className="grid grid-cols-4 bg-secondary/50 h-10 p-1 rounded-xl">
                    <TabsTrigger value="daily" className="rounded-lg font-black text-[9px] uppercase tracking-wider">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="rounded-lg font-black text-[9px] uppercase tracking-wider">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-lg font-black text-[9px] uppercase tracking-wider">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="rounded-lg font-black text-[9px] uppercase tracking-wider">Yearly</TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
               <Card className="lg:col-span-12 rounded-xl border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 bg-secondary/10 border-b">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-[10px] font-black flex items-center gap-2 tracking-tight uppercase">
                        <CalendarIcon className="h-3 w-3 text-primary" /> Session Mapping
                      </CardTitle>
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                         {filter === 'daily' ? 'Hourly Breakdown' : filter === 'weekly' ? 'Daily Progression' : filter === 'monthly' ? 'Weekly Output' : 'Monthly Performance'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1 h-6">
                        <Layers className="h-2.5 w-2.5" /> Stacked
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6">
                    {sessionsLoading ? (
                      <Skeleton className="h-[300px] w-full rounded-xl" />
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

               <Card className="lg:col-span-7 rounded-xl border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="bg-secondary/10 border-b pb-4">
                    <CardTitle className="text-[10px] font-black flex items-center gap-2 tracking-tight uppercase">
                       <PieChart className="h-3 w-3 text-primary" /> Focus Areas
                    </CardTitle>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Subject Distribution</p>
                  </CardHeader>
                  <CardContent className="p-6 md:p-8">
                    {sessionsLoading ? (
                      <Skeleton className="h-[250px] w-full rounded-xl" />
                    ) : (
                      <SubjectDistributionChart data={stats.subjectData} />
                    )}
                  </CardContent>
               </Card>

               <div className="lg:col-span-5 space-y-4">
                  <StatSummaryCard label="Daily Target" value={formatTime(profile.daily_goal_minutes)} icon={<Target className="h-4 w-4" />} color="primary" />
                  <StatSummaryCard label={`${filter} Hustle`} value={formatTime(stats.currentPeriodMins)} icon={<Clock className="h-4 w-4" />} color="orange" />
                  <StatSummaryCard label="Current Streak" value={`${profile.currentStreak || 0} Days`} icon={<Flame className="h-4 w-4 animate-pulse" />} color="indigo" />
               </div>
            </div>
          </div>

          {/* Calendar Analytics Section */}
          <div className="space-y-4 pt-4">
             <div className="flex items-center gap-2 px-1">
                <div className="bg-indigo-600 p-1.5 rounded-lg shadow-md">
                   <CalendarIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                   <h2 className="text-sm font-black tracking-tighter uppercase leading-none">Day-wise Logs</h2>
                   <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Historical focus data</p>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Calendar Card */}
                <Card className="lg:col-span-7 xl:col-span-8 bg-[#1A1C3D] border-none shadow-xl rounded-xl p-5 md:p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-primary/20 rounded-lg">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                      </div>
                      <h2 className="text-sm font-black text-white tracking-tighter uppercase">
                        {format(currentMonth, 'MMMM yyyy')}
                      </h2>
                    </div>
                    <div className="flex gap-1.5 bg-white/5 p-1 rounded-lg">
                      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subDays(startOfMonth(currentMonth), 1))} className="text-white hover:bg-white/10 h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addDays(endOfMonth(currentMonth), 1))} className="text-white hover:bg-white/10 h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 mb-2 text-center">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                      <div key={idx} className="text-[8px] font-black uppercase tracking-widest text-white/30">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-1.5">
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
                                "relative h-10 sm:h-14 flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer border-2",
                                !isCurrentMonth ? "opacity-5 pointer-events-none" : "",
                                isSelected 
                                  ? "bg-primary border-primary text-white shadow-lg scale-105 z-10" 
                                  : "bg-white/5 border-transparent text-white/70 hover:border-white/10"
                              )}
                              onClick={() => setSelectedDate(cloneDay)}
                            >
                              <span className={cn("text-xs sm:text-base font-black", isSelected ? "text-white" : "text-white/80")}>
                                {format(day, 'd')}
                              </span>
                              {hasData && !isSelected && (
                                <div className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_5px_rgba(59,130,246,0.8)]" />
                              )}
                            </div>
                          );
                          day = addDays(day, 1);
                        }
                        rows.push(<div className="grid grid-cols-7 gap-1.5 sm:gap-2" key={day.toString()}>{days}</div>);
                        days = [];
                      }
                      return rows;
                    })()}
                  </div>
                </Card>

                {/* Day Summary Card */}
                <Card className="lg:col-span-5 xl:col-span-4 rounded-xl border-none shadow-xl bg-card overflow-hidden h-full min-h-[450px] flex flex-col">
                  <CardHeader className="bg-secondary/10 border-b pb-4 p-6">
                     <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                           <CardTitle className="text-base font-black tracking-tight">{format(selectedDate, 'MMMM do')}</CardTitle>
                           <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Session Log</p>
                        </div>
                        <div className="bg-primary/10 p-2 rounded-lg">
                           <Activity className="h-4 w-4 text-primary" />
                        </div>
                     </div>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 flex flex-col">
                    <ScrollArea className="flex-1">
                       <div className="p-6 space-y-4">
                          {selectedDaySubjectAgg.length > 0 ? (
                             <>
                                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 text-center space-y-1">
                                   <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary">Daily Hustle</p>
                                   <h3 className="text-2xl font-black tracking-tighter">{formatTime(totalSelectedMins)}</h3>
                                </div>

                                <div className="space-y-2">
                                   {selectedDaySubjectAgg.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 transition-colors group">
                                         <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                               <BookOpen className="h-4 w-4 text-primary" />
                                            </div>
                                            <span className="font-bold text-xs tracking-tight">{item.name}</span>
                                         </div>
                                         <Badge variant="secondary" className="font-black text-[9px] h-6 px-2 rounded-md bg-white border-none shadow-sm">
                                            {formatTime(item.mins)}
                                         </Badge>
                                      </div>
                                   ))}
                                </div>
                             </>
                          ) : (
                             <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
                                <Zap className="h-6 w-6 text-muted-foreground/20" />
                                <h4 className="text-[10px] font-black uppercase text-muted-foreground/40">No Hustle Logged</h4>
                             </div>
                          )}
                       </div>
                    </ScrollArea>
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
      "bg-gradient-to-br from-white/10 to-transparent p-3 rounded-xl border border-white/10 flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-white/15 group/rank shadow-lg",
      color
    )}>
       <div className="p-1.5 bg-white/10 rounded-lg group-hover/rank:scale-110 transition-transform">
          {icon}
       </div>
       <div className="text-center">
          <p className="text-[7px] font-black uppercase tracking-widest text-white/30 mb-0.5">{label}</p>
          <p className="text-base font-black tracking-tighter leading-none">{value}</p>
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
    <Card className={cn("rounded-xl border-none shadow-lg p-4 space-y-3 ring-1 ring-inset", colorMap[color])}>
      <div className="flex items-center justify-between">
          <p className="text-[8px] font-black uppercase tracking-[0.2em]">{label}</p>
          <div className="p-1.5 bg-background/50 rounded-lg shadow-sm">
             {icon}
          </div>
      </div>
      <h4 className="text-xl font-black tracking-tighter text-foreground">{value}</h4>
    </Card>
  );
}
