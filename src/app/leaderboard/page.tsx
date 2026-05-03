'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Crown, Clock, Users2, ArrowRight, Wifi, Sparkles, Filter, List, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, isAfter, subSeconds } from 'date-fns';
import Link from 'next/link';

type TimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CategoryFilter = 'All' | 'SSC' | 'HSC' | 'Admission 1st' | 'Admission 2nd' | 'Job Prep' | 'University';

const YEARS = Array.from({ length: 18 }, (_, i) => (2023 + i).toString());

export default function LeaderboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('daily');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [batchFilter, setBatchFilter] = useState<string>('All');
  const [groupMap, setGroupMap] = useState<Record<string, string>>({});

  // Fetch groups to map group IDs to names
  useEffect(() => {
    const fetchGroups = async () => {
      const snap = await getDocs(collection(firestore, 'groups'));
      const mapping: Record<string, string> = {};
      snap.forEach(doc => {
        mapping[doc.id] = doc.data().name;
      });
      setGroupMap(mapping);
    };
    fetchGroups();
  }, [firestore]);

  const getSortField = (filter: TimeFilter) => {
    switch (filter) {
      case 'daily': return 'daily_study_minutes';
      case 'weekly': return 'weekly_study_minutes';
      case 'monthly': return 'monthly_study_minutes';
      case 'yearly': return 'yearly_study_minutes';
      default: return 'daily_study_minutes';
    }
  };

  const leaderboardQuery = useMemo(() => {
    const field = getSortField(timeFilter);
    return query(
      collection(firestore, 'users'),
      orderBy(field, 'desc'),
      limit(100)
    );
  }, [firestore, timeFilter]);

  const { data: allRankings, loading } = useCollection<any>(leaderboardQuery);

  const rankings = useMemo(() => {
    if (!allRankings) return [];
    
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const weekStart = startOfWeek(now, { weekStartsOn: 5 }); // Friday start
    const weekStr = `Friday_${format(weekStart, 'yyyy-MM-dd')}`;
    const monthStr = format(now, 'yyyy-MM');
    const yearStr = format(now, 'yyyy');

    return allRankings.filter(u => {
      const matchCategory = categoryFilter === 'All' || u.category === categoryFilter;
      const matchBatch = batchFilter === 'All' || u.batch === batchFilter;
      return matchCategory && matchBatch;
    }).map(u => {
      let currentVal = u[getSortField(timeFilter)] || 0;
      
      // Reset validation based on time period
      if (timeFilter === 'daily' && u.last_study_day !== todayStr) currentVal = 0;
      if (timeFilter === 'weekly' && u.last_study_week !== weekStr) currentVal = 0;
      if (timeFilter === 'monthly' && u.last_study_month !== monthStr) currentVal = 0;
      if (timeFilter === 'yearly' && u.last_study_year !== yearStr) currentVal = 0;

      // Real-time Live Status
      let isLive = u.isStudying === true;
      if (u.last_active_date) {
         const lastActive = u.last_active_date.toDate();
         const twoMinsAgo = subSeconds(new Date(), 120);
         isLive = isLive && isAfter(lastActive, twoMinsAgo);
      }

      return { ...u, displayMinutes: currentVal, isLive };
    })
    .sort((a, b) => b.displayMinutes - a.displayMinutes)
    .slice(0, 50);
  }, [allRankings, categoryFilter, batchFilter, timeFilter]);

  const top3 = rankings?.slice(0, 3) || [];

  const formatTime = (minutes: number = 0) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
          
          {/* Dashboard-Style Hero Banner */}
          <Card className="rounded-[2.5rem] md:rounded-[3rem] border-none shadow-2xl overflow-hidden bg-[#1A1C3D] text-white relative group">
            <div className="absolute top-0 right-0 p-12 opacity-5">
              <Trophy className="h-48 w-48 transition-transform group-hover:scale-110 duration-1000" />
            </div>
            <CardContent className="p-6 md:p-12 relative z-10 space-y-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-4 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <div className="inline-flex items-center gap-1.5 bg-primary/20 backdrop-blur-lg px-3 py-1 rounded-full border border-primary/30 text-[10px] font-black text-primary-foreground uppercase tracking-widest">
                       <Zap className="h-3 w-3 fill-current" />
                       Million Minute Quest
                    </div>
                    <div className="inline-flex items-center gap-1.5 bg-red-600/20 backdrop-blur-lg px-3 py-1 rounded-full border border-red-600/30 text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">
                       <Wifi className="h-3 w-3" />
                       Live Sync Active
                    </div>
                  </div>
                  <h1 className="text-4xl md:text-7xl font-black tracking-tighter leading-none">Hustle Standings</h1>
                  <p className="text-white/60 font-medium max-w-xl text-sm md:text-lg">
                    Real-time global rankings. Push your limits and claim the top spot in the first million study minutes.
                  </p>
                </div>

                <div className="hidden lg:flex items-center gap-4 bg-white/5 p-6 rounded-[2rem] border border-white/10 backdrop-blur-md">
                   <div className="p-4 bg-primary/20 rounded-full">
                      <TrendingUp className="h-8 w-8 text-primary" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Global Competition</p>
                      <h4 className="text-2xl font-black">{rankings.length}+ Students Active</h4>
                   </div>
                </div>
              </div>

              {/* Podium Section (Top 3) */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                   <Skeleton className="h-48 rounded-[2rem] bg-white/5" />
                   <Skeleton className="h-64 rounded-[2rem] bg-white/5" />
                   <Skeleton className="h-48 rounded-[2rem] bg-white/5" />
                </div>
              ) : top3.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 items-end pt-4 max-w-5xl mx-auto">
                  
                  {/* 2nd Place */}
                  {top3[1] && (
                    <div className="order-2 md:order-1 animate-in fade-in slide-in-from-left duration-700">
                      <PodiumCard 
                        user={top3[1]} 
                        rank={2} 
                        time={formatTime(top3[1].displayMinutes)} 
                        icon={<Medal className="h-6 w-6 text-slate-300" />}
                        bgColor="bg-slate-500/10 border-slate-500/20"
                      />
                    </div>
                  )}

                  {/* 1st Place - Center & Larger */}
                  {top3[0] && (
                    <div className="order-1 md:order-2 scale-100 md:scale-110 z-20 animate-in fade-in zoom-in duration-1000">
                      <PodiumCard 
                        user={top3[0]} 
                        rank={1} 
                        time={formatTime(top3[0].displayMinutes)} 
                        icon={<Crown className="h-10 w-10 text-yellow-400 fill-current drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />}
                        isWinner
                        bgColor="bg-primary/20 border-primary/40 shadow-[0_0_30px_rgba(59,130,246,0.2)]"
                      />
                    </div>
                  )}

                  {/* 3rd Place */}
                  {top3[2] && (
                    <div className="order-3 animate-in fade-in slide-in-from-right duration-700">
                      <PodiumCard 
                        user={top3[2]} 
                        rank={3} 
                        time={formatTime(top3[2].displayMinutes)} 
                        icon={<Medal className="h-6 w-6 text-orange-400" />}
                        bgColor="bg-orange-500/10 border-orange-500/20"
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Filtering Engine - Dashboard Style */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12">
              <Card className="rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
                <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 w-full md:w-auto">
                      <div className="bg-secondary/50 p-1 rounded-2xl flex items-center w-full sm:w-auto">
                        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                            <SelectTrigger className="h-11 w-full sm:w-[180px] rounded-xl border-none bg-transparent font-bold">
                                <Filter className="h-4 w-4 mr-2 text-primary" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                <SelectItem value="All">All Categories</SelectItem>
                                <SelectItem value="SSC">SSC</SelectItem>
                                <SelectItem value="HSC">HSC</SelectItem>
                                <SelectItem value="Admission 1st">Admission 1st</SelectItem>
                                <SelectItem value="Admission 2nd">Admission 2nd</SelectItem>
                                <SelectItem value="Job Prep">Job Prep</SelectItem>
                                <SelectItem value="University">University</SelectItem>
                            </SelectContent>
                        </Select>
                      </div>

                      <div className="bg-secondary/50 p-1 rounded-2xl flex items-center w-full sm:w-auto">
                        <Select value={batchFilter} onValueChange={setBatchFilter}>
                            <SelectTrigger className="h-11 w-full sm:w-[120px] rounded-xl border-none bg-transparent font-bold">
                                <SelectValue placeholder="Batch" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                                <SelectItem value="All">All Batches</SelectItem>
                                {YEARS.map(year => (
                                  <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                      </div>
                  </div>

                  <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full md:w-auto">
                    <TabsList className="grid grid-cols-4 bg-secondary/50 p-1.5 rounded-[1.25rem] h-14 w-full md:min-w-[400px]">
                      <TabsTrigger value="daily" className="rounded-xl font-black text-[10px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Daily</TabsTrigger>
                      <TabsTrigger value="weekly" className="rounded-xl font-black text-[10px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Weekly</TabsTrigger>
                      <TabsTrigger value="monthly" className="rounded-xl font-black text-[10px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Monthly</TabsTrigger>
                      <TabsTrigger value="yearly" className="rounded-xl font-black text-[10px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Yearly</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Ranking Directory */}
            <div className="lg:col-span-12">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                <div className="p-6 md:p-8 border-b bg-secondary/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-2 tracking-tight">
                       <List className="h-5 w-5 text-primary" /> Contender Directory
                    </h3>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-1">Live from global data servers</p>
                  </div>
                  <Badge variant="outline" className="font-black text-[10px] uppercase tracking-widest border-primary/20 text-primary h-8 px-4">
                    {rankings.length} Students Tracked
                  </Badge>
                </div>
                
                <div className="divide-y divide-secondary/30">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="p-8 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-6 w-6 rounded-full" />
                          <Skeleton className="h-14 w-14 rounded-full" />
                          <div className="space-y-2">
                             <Skeleton className="h-4 w-48" />
                             <Skeleton className="h-3 w-32" />
                          </div>
                        </div>
                        <Skeleton className="h-8 w-24 rounded-full" />
                      </div>
                    ))
                  ) : rankings.length > 0 ? (
                    rankings.map((contender: any, idx) => {
                      const userGuildName = contender.groupId ? groupMap[contender.groupId] : null;
                      const isMe = contender.uid === user?.uid;

                      return (
                        <Link 
                          key={contender.uid} 
                          href={`/profile/${contender.uid}`}
                          className={cn(
                            "flex items-center justify-between p-5 md:p-8 hover:bg-primary/[0.03] transition-all duration-300 group",
                            isMe && "bg-primary/[0.05] ring-1 ring-inset ring-primary/10"
                          )}
                        >
                          <div className="flex items-center gap-4 md:gap-8 min-w-0">
                            <span className={cn(
                              "w-8 text-center font-black text-xl italic transition-colors",
                              idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "text-muted-foreground/30 group-hover:text-primary"
                            )}>
                               #{idx + 1}
                            </span>
                            
                            <div className="relative">
                              <Avatar className={cn(
                                "h-14 w-14 md:h-16 md:w-16 border-2 transition-transform group-hover:scale-110 duration-500",
                                isMe ? "border-primary" : "border-background shadow-lg"
                              )}>
                                <AvatarImage src={contender.photoURL || undefined} />
                                <AvatarFallback className="font-black text-lg bg-secondary text-primary">{contender.displayName?.[0]}</AvatarFallback>
                              </Avatar>
                              {contender.isLive && (
                                <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-red-600 rounded-full border-2 border-card flex items-center justify-center shadow-lg">
                                  <div className="h-2 w-2 bg-white rounded-full animate-ping" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <p className="font-black text-lg md:text-xl truncate group-hover:text-primary transition-colors tracking-tighter">
                                      {contender.displayName}
                                    </p>
                                    {isMe && <Badge className="text-[8px] font-black bg-primary text-white h-4 tracking-widest border-none px-2">YOU</Badge>}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className="text-[9px] h-5 font-black uppercase tracking-widest bg-secondary/80 text-foreground border-none">
                                        {contender.category || 'SSC'} {contender.batch || ''}
                                    </Badge>
                                    {userGuildName && (
                                      <Badge variant="outline" className="text-[9px] h-5 uppercase tracking-widest flex items-center gap-1.5 border-primary/20 text-primary bg-primary/5 font-black">
                                         <Users2 className="h-3 w-3" /> {userGuildName}
                                      </Badge>
                                    )}
                                </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 md:gap-8">
                            <div className="text-right shrink-0 space-y-1">
                                <p className="font-black text-2xl md:text-3xl text-primary leading-none tracking-tighter tabular-nums">
                                    {formatTime(contender.displayMinutes)}
                                </p>
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                                  {timeFilter} Log
                                </p>
                            </div>
                            <div className="hidden sm:flex h-10 w-10 rounded-full items-center justify-center bg-secondary/50 group-hover:bg-primary group-hover:text-white transition-all duration-500 group-hover:translate-x-1 shadow-inner">
                               <ArrowRight className="h-5 w-5" />
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  ) : (
                    <div className="py-24 text-center space-y-6">
                      <div className="bg-primary/5 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-primary/20 animate-pulse">
                        <Clock className="h-10 w-10 text-primary/30" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black tracking-tighter">No Rankings Recorded</h3>
                        <p className="text-muted-foreground text-sm max-w-xs mx-auto font-medium">
                          The leaderboards are waiting for a champion. Launch your first session to claim the #1 spot!
                        </p>
                      </div>
                      <Button className="rounded-2xl px-10 h-14 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20" asChild>
                        <Link href="/todo">Initiate Mission</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

interface PodiumCardProps {
  user: any;
  rank: number;
  time: string;
  icon: React.ReactNode;
  isWinner?: boolean;
  bgColor: string;
}

function PodiumCard({ 
  user, 
  rank, 
  time, 
  icon, 
  isWinner = false,
  bgColor
}: PodiumCardProps) {
  return (
    <div className="group/podium relative">
      <Link href={`/profile/${user.uid}`}>
        <Card className={cn(
          "rounded-[2.5rem] md:rounded-[3rem] border-2 backdrop-blur-xl flex flex-col items-center p-6 md:p-8 text-center transition-all duration-500 hover:scale-[1.05] hover:shadow-2xl overflow-hidden",
          bgColor,
          isWinner ? "h-[320px] md:h-[380px] pt-10" : "h-[260px] md:h-[300px]"
        )}>
          {/* Animated Background Glow for Winner */}
          {isWinner && (
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-50 pointer-events-none" />
          )}
          
          <div className="relative mb-4 md:mb-6">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce transition-transform duration-1000">
               {icon}
            </div>
            <Avatar className={cn(
              "border-4 transition-all duration-700 group-hover/podium:rotate-6",
              isWinner ? "h-24 w-24 md:h-32 md:w-32 border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.3)]" : "h-16 w-16 md:h-24 md:w-24 border-white/20"
            )}>
              <AvatarImage src={user.photoURL || undefined} />
              <AvatarFallback className="text-2xl font-black bg-white/10 text-white">{user.displayName?.[0]}</AvatarFallback>
            </Avatar>
            
            {user.isLive && (
               <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-lg border border-red-400">LIVE</div>
            )}

            <div className={cn(
              "absolute -bottom-2 -right-2 rounded-full h-8 w-8 md:h-10 md:w-10 flex items-center justify-center font-black text-sm md:text-lg border-2 shadow-2xl z-10",
              rank === 1 ? "bg-yellow-400 border-white text-black" : rank === 2 ? "bg-slate-300 border-white text-black" : "bg-orange-400 border-white text-white"
            )}>
              #{rank}
            </div>
          </div>
          
          <div className="space-y-2 relative z-10">
            <h3 className={cn(
              "font-black tracking-tighter truncate max-w-[140px] md:max-w-[200px]",
              isWinner ? "text-xl md:text-2xl" : "text-base md:text-lg"
            )}>
              {user.displayName}
            </h3>
            
            <div className="flex flex-col gap-1 items-center">
               <Badge className={cn(
                  "font-black uppercase text-[10px] md:text-xs tracking-widest px-4 h-7 md:h-8 border-none shadow-lg",
                  isWinner ? "bg-white text-primary" : "bg-white/10 text-white"
               )}>
                 {time}
               </Badge>
               <span className="text-[9px] font-black uppercase tracking-tighter text-white/50">{user.category} {user.batch}</span>
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}

