'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
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
  Star
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
  startOfWeek
} from 'date-fns';
import { StudyActivityChart } from '@/components/dashboard/StudyActivityChart';
import { SubjectDistributionChart } from '@/components/dashboard/SubjectDistributionChart';
import { cn } from '@/lib/utils';

export default function PublicProfilePage() {
  const { userId } = useParams();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [ranks, setRanks] = useState({ daily: '-', weekly: '-', monthly: '-', yearly: '-' });

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
      const periods = ['daily', 'weekly', 'monthly', 'yearly'];
      const newRanks: any = {};

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
          
          // Virtual Reset Check for ranking accuracy
          if (p === 'daily' && data.last_study_day !== todayStr) val = 0;
          if (p === 'weekly' && data.last_study_week !== weekStr) val = 0;
          if (p === 'monthly' && data.last_study_month !== monthStr) val = 0;
          if (p === 'yearly' && data.last_study_year !== yearStr) val = 0;
          
          return { uid: d.id, val };
        }).sort((a, b) => b.val - a.val);

        const rankIndex = sortedUsers.findIndex(u => u.uid === userId);
        newRanks[p] = rankIndex !== -1 ? `#${rankIndex + 1}` : '100+';
      }
      setRanks(newRanks);
    };

    calculateRanks();
  }, [profile, firestore, userId]);

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
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          {/* Hero Profile Card */}
          <Card className="rounded-[2rem] border-none shadow-2xl overflow-hidden bg-[#1A1C3D] text-white relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Trophy className="h-48 w-48 transition-transform group-hover:scale-110 duration-1000" />
            </div>
            <CardContent className="p-6 md:p-10 relative z-10">
              <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 lg:gap-12">
                
                {/* Left Side: Avatar & Basic Info */}
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-5">
                  <div className="relative">
                    <div className="absolute -inset-1.5 bg-gradient-to-tr from-primary to-indigo-400 rounded-full blur opacity-40 animate-pulse" />
                    <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-white/10 shadow-2xl relative">
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

                {/* Right Side: Global Rankings Grid */}
                <div className="flex-1 w-full max-w-2xl">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 h-full content-center">
                      <RankCard 
                        label="Daily Rank" 
                        value={ranks.daily} 
                        icon={<Star className="h-4 w-4 text-yellow-400" />} 
                        color="from-yellow-400/20"
                      />
                      <RankCard 
                        label="Weekly Rank" 
                        value={ranks.weekly} 
                        icon={<Medal className="h-4 w-4 text-slate-300" />} 
                        color="from-slate-400/20"
                      />
                      <RankCard 
                        label="Monthly Rank" 
                        value={ranks.monthly} 
                        icon={<Award className="h-4 w-4 text-orange-400" />} 
                        color="from-orange-500/20"
                      />
                      <RankCard 
                        label="Yearly Rank" 
                        value={ranks.yearly} 
                        icon={<Crown className="h-4 w-4 text-indigo-400" />} 
                        color="from-indigo-500/20"
                      />

                      <div className="col-span-2 md:col-span-4 mt-2 bg-white/5 rounded-2xl p-4 md:p-6 border border-white/10 flex items-center justify-between shadow-inner backdrop-blur-sm">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Lifetime Hustle</p>
                          <h3 className="text-2xl md:text-3xl font-black tracking-tighter leading-none">{(profile.total_study_minutes / 60).toFixed(1)} <span className="text-sm font-bold text-white/40">Hours</span></h3>
                        </div>
                        <div className="text-right">
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

          {/* Analytics Section */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
               <div className="flex items-center gap-3">
                  <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                    <BarChart className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tighter uppercase leading-none">Hustle Analytics</h2>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Deep insights into performance</p>
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
               
               {/* Consistency Tracker */}
               <Card className="lg:col-span-12 rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-3 bg-secondary/10 border-b">
                    <div>
                      <CardTitle className="text-sm font-black flex items-center gap-2 tracking-tight uppercase">
                        <CalendarIcon className="h-4 w-4 text-primary" /> Session Mapping
                      </CardTitle>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        Activity distribution for {filter}
                      </p>
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

               {/* Focus Areas Chart */}
               <Card className="lg:col-span-7 rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
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

               {/* Quick Stats Summary */}
               <div className="lg:col-span-5 space-y-6">
                  <StatSummaryCard 
                    label="Daily Target" 
                    value={formatTime(profile.daily_goal_minutes)} 
                    icon={<Target className="h-5 w-5" />} 
                    color="primary"
                  />
                  <StatSummaryCard 
                    label={`${filter} Hustle`} 
                    value={formatTime(stats.currentPeriodMins)} 
                    icon={<Clock className="h-5 w-5" />} 
                    color="orange"
                  />
                  <StatSummaryCard 
                    label="Academic Status" 
                    value={isLive ? 'Studying' : 'Active'} 
                    icon={isLive ? <Wifi className="h-5 w-5 animate-pulse" /> : <Trophy className="h-5 w-5" />} 
                    color="indigo"
                  />
               </div>

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
    <Card className={cn("rounded-2xl border-none shadow-lg p-6 space-y-4 ring-1 ring-inset", colorMap[color])}>
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
