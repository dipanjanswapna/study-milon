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
import { Button } from '@/components/ui/button';
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
      const matchBatch = matchBatchFilter(u, batchFilter);
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
    .slice(0, 100);
  }, [allRankings, categoryFilter, batchFilter, timeFilter]);

  function matchBatchFilter(u: any, filter: string) {
    if (filter === 'All') return true;
    return u.batch === filter;
  }

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
              <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
                <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 w-full md:w-auto">
                      <div className="bg-secondary/50 p-0.5 rounded-xl flex items-center w-full sm:w-auto">
                        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                            <SelectTrigger className="h-9 w-full sm:w-[160px] rounded-lg border-none bg-transparent font-bold text-xs">
                                <Filter className="h-3.5 w-3.5 mr-2 text-primary" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
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

                      <div className="bg-secondary/50 p-0.5 rounded-xl flex items-center w-full sm:w-auto">
                        <Select value={batchFilter} onValueChange={setBatchFilter}>
                            <SelectTrigger className="h-9 w-full sm:w-[110px] rounded-lg border-none bg-transparent font-bold text-xs">
                                <SelectValue placeholder="Batch" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="All">All Batches</SelectItem>
                                {YEARS.map(year => (
                                  <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                      </div>
                  </div>

                  <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full md:w-auto">
                    <TabsList className="grid grid-cols-4 bg-secondary/50 p-1 rounded-xl h-11 w-full md:min-w-[360px]">
                      <TabsTrigger value="daily" className="rounded-lg font-black text-[9px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Daily</TabsTrigger>
                      <TabsTrigger value="weekly" className="rounded-lg font-black text-[9px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Weekly</TabsTrigger>
                      <TabsTrigger value="monthly" className="rounded-lg font-black text-[9px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Monthly</TabsTrigger>
                      <TabsTrigger value="yearly" className="rounded-lg font-black text-[9px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Yearly</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Ranking Directory - COMPACT VERSION WITH SCROLL */}
            <div className="lg:col-span-12">
              <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
                <div className="p-4 md:p-6 border-b bg-secondary/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black flex items-center gap-2 tracking-tight">
                       <List className="h-4 w-4 text-primary" /> Contender Directory
                    </h3>
                    <p className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-0.5">Live from global data servers</p>
                  </div>
                  <Badge variant="outline" className="font-black text-[9px] uppercase tracking-widest border-primary/20 text-primary h-7 px-3">
                    {rankings.length} Tracked
                  </Badge>
                </div>
                
                <ScrollArea className="h-[500px]">
                  <div className="divide-y divide-secondary/30">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-1">
                               <Skeleton className="h-3 w-32" />
                               <Skeleton className="h-2 w-20" />
                            </div>
                          </div>
                          <Skeleton className="h-6 w-16 rounded-full" />
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
                              "flex items-center justify-between p-3 md:p-5 hover:bg-primary/[0.03] transition-all duration-300 group",
                              isMe && "bg-primary/[0.05] ring-1 ring-inset ring-primary/10"
                            )}
                          >
                            <div className="flex items-center gap-3 md:gap-6 min-w-0">
                              <span className={cn(
                                "w-6 text-center font-black text-sm italic transition-colors",
                                idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "text-muted-foreground/30 group-hover:text-primary"
                              )}>
                                 #{idx + 1}
                              </span>
                              
                              <div className="relative">
                                <Avatar className={cn(
                                  "h-10 w-10 md:h-12 md:w-12 border transition-transform group-hover:scale-105 duration-300",
                                  isMe ? "border-primary" : "border-background shadow-sm"
                                )}>
                                  <AvatarImage src={contender.photoURL || undefined} />
                                  <AvatarFallback className="font-black text-sm bg-secondary text-primary">{contender.displayName?.[0]}</AvatarFallback>
                                </Avatar>
                                {contender.isLive && (
                                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-red-600 rounded-full border-2 border-card flex items-center justify-center shadow-lg">
                                    <div className="h-1.5 w-1.5 bg-white rounded-full animate-ping" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                      <p className="font-bold text-sm md:text-base truncate group-hover:text-primary transition-colors tracking-tight">
                                        {contender.displayName}
                                      </p>
                                      {isMe && <Badge className="text-[7px] font-black bg-primary text-white h-3.5 tracking-widest border-none px-1.5">YOU</Badge>}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[8px] font-black uppercase text-muted-foreground">
                                          {contender.category || 'SSC'} {contender.batch || ''}
                                      </span>
                                      {userGuildName && (
                                        <div className="flex items-center gap-1 text-[8px] font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded-full">
                                           <Users2 className="h-2 w-2" /> {userGuildName}
                                        </div>
                                      )}
                                  </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 md:gap-6">
                              <div className="text-right shrink-0">
                                  <p className="font-black text-base md:text-xl text-primary leading-none tracking-tighter tabular-nums">
                                      {formatTime(contender.displayMinutes)}
                                  </p>
                                  <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                                    {timeFilter}
                                  </p>
                              </div>
                              <div className="hidden sm:flex h-7 w-7 rounded-full items-center justify-center bg-secondary/50 group-hover:bg-primary group-hover:text-white transition-all duration-300 group-hover:translate-x-0.5">
                                 <ArrowRight className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="py-16 text-center space-y-4">
                        <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-dashed border-primary/20">
                          <Clock className="h-6 w-6 text-primary/30" />
                        </div>
                        <h3 className="text-lg font-black tracking-tighter">No Rankings</h3>
                        <Button variant="outline" size="sm" className="rounded-lg px-6 h-9 font-black uppercase tracking-widest text-[9px]" asChild>
                          <Link href="/todo">Start Mission</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
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
          "rounded-[2rem] md:rounded-[3rem] border-2 backdrop-blur-xl flex flex-col items-center p-4 md:p-8 text-center transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl overflow-hidden",
          bgColor,
          isWinner ? "h-[280px] md:h-[380px] pt-8" : "h-[220px] md:h-[300px]"
        )}>
          {/* Animated Background Glow for Winner */}
          {isWinner && (
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-50 pointer-events-none" />
          )}
          
          <div className="relative mb-3 md:mb-6">
            <div className={cn(
              "absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce transition-transform duration-1000",
              !isWinner && "-top-6"
            )}>
               {icon}
            </div>
            <Avatar className={cn(
              "border-4 transition-all duration-700 group-hover/podium:rotate-3",
              isWinner ? "h-20 w-20 md:h-32 md:w-32 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.2)]" : "h-14 w-14 md:h-24 md:w-24 border-white/20"
            )}>
              <AvatarImage src={user.photoURL || undefined} />
              <AvatarFallback className="text-xl font-black bg-white/10 text-white">{user.displayName?.[0]}</AvatarFallback>
            </Avatar>
            
            {user.isLive && (
               <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-lg border border-red-400">LIVE</div>
            )}

            <div className={cn(
              "absolute -bottom-1 -right-1 rounded-full h-7 w-7 md:h-10 md:w-10 flex items-center justify-center font-black text-xs md:text-lg border-2 shadow-2xl z-10",
              rank === 1 ? "bg-yellow-400 border-white text-black" : rank === 2 ? "bg-slate-300 border-white text-black" : "bg-orange-400 border-white text-white"
            )}>
              #{rank}
            </div>
          </div>
          
          <div className="space-y-1 relative z-10">
            <h3 className={cn(
              "font-black tracking-tighter truncate max-w-[120px] md:max-w-[200px]",
              isWinner ? "text-lg md:text-2xl" : "text-sm md:text-lg"
            )}>
              {user.displayName}
            </h3>
            
            <div className="flex flex-col gap-1 items-center">
               <Badge className={cn(
                  "font-black uppercase text-[8px] md:text-xs tracking-widest px-3 h-6 md:h-8 border-none shadow-lg",
                  isWinner ? "bg-white text-primary" : "bg-white/10 text-white"
               )}>
                 {time}
               </Badge>
               <span className="text-[8px] font-black uppercase tracking-tighter text-white/40">{user.category} {user.batch}</span>
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}
