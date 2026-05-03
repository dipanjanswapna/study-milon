'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
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
import { Trophy, Medal, Crown, Clock, Users2, ArrowRight, Wifi, Zap, TrendingUp, Filter, List } from 'lucide-react';
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
  
  // Tick state to force UI refresh at exactly 12:00 AM (Virtual Reset)
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Check every 60 seconds to see if the day has rolled over
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

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
    const weekStart = startOfWeek(now, { weekStartsOn: 5 }); 
    const weekStr = `Friday_${format(weekStart, 'yyyy-MM-dd')}`;
    const monthStr = format(now, 'yyyy-MM');
    const yearStr = format(now, 'yyyy');

    return allRankings.filter(u => {
      const matchCategory = categoryFilter === 'All' || u.category === categoryFilter;
      const matchBatch = batchFilter === 'All' || u.batch === batchFilter;
      return matchCategory && matchBatch;
    }).map(u => {
      let currentVal = u[getSortField(timeFilter)] || 0;
      
      // --- VIRTUAL RESET LOGIC ---
      // If the day has rolled over but the user hasn't studied yet (physical reset not triggered),
      // we manually set their score to 0 on the UI.
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
  }, [allRankings, categoryFilter, batchFilter, timeFilter, tick]);

  const top3 = rankings?.slice(0, 3) || [];

  const formatTime = (minutes: number = 0) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}H ${m}M`;
    return `${m}M`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-2">
          
          {/* Dashboard-Style Hero Banner */}
          <Card className="rounded-xl border-none shadow-2xl overflow-hidden bg-[#1A1C3D] text-white relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Trophy className="h-20 w-20 transition-transform group-hover:scale-110 duration-1000" />
            </div>
            <CardContent className="p-5 md:p-8 relative z-10 space-y-1">
              <div className="flex flex-col md:flex-row items-center justify-between gap-2">
                <div className="space-y-0.5 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <div className="inline-flex items-center gap-1.5 bg-primary/20 backdrop-blur-lg px-2 py-0.5 rounded-full border border-primary/30 text-[8px] font-black text-primary-foreground uppercase tracking-widest">
                       <Zap className="h-2 w-2 fill-current" />
                       Million Minute Quest
                    </div>
                  </div>
                  <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none">Hustle Standings</h1>
                  <p className="text-white/60 font-medium max-w-xl text-[9px] md:text-xs">
                    Real-time global rankings. Push your limits and claim the top spot.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Podium Section (1st, 2nd, 3rd) */}
          <div className="w-full flex justify-center pt-20 pb-2 overflow-visible relative z-20">
            {loading ? (
              <div className="flex items-end justify-center gap-8 md:gap-20">
                <Skeleton className="h-24 w-24 rounded-full" />
                <Skeleton className="h-32 w-32 rounded-full" />
                <Skeleton className="h-24 w-24 rounded-full" />
              </div>
            ) : top3.length > 0 ? (
              <div className="flex items-end justify-center gap-4 md:gap-16 lg:gap-24 px-4 w-full overflow-visible pb-0">
                
                {/* 2nd Place */}
                {top3[1] && (
                  <PodiumMember 
                    user={top3[1]} 
                    rank={2} 
                    time={formatTime(top3[1].displayMinutes)} 
                  />
                )}

                {/* 1st Place (The Winner) */}
                {top3[0] && (
                  <PodiumMember 
                    user={top3[0]} 
                    rank={1} 
                    time={formatTime(top3[0].displayMinutes)} 
                  />
                )}

                {/* 3rd Place */}
                {top3[2] && (
                  <PodiumMember 
                    user={top3[2]} 
                    rank={3} 
                    time={formatTime(top3[2].displayMinutes)} 
                  />
                )}
              </div>
            ) : null}
          </div>

          {/* Filtering Engine */}
          <div className="grid grid-cols-1 gap-3">
            <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
              <CardContent className="p-2 md:p-3 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex flex-row items-center justify-center md:justify-start gap-2 w-full md:w-auto">
                    <div className="bg-secondary/50 p-0.5 rounded-xl flex items-center flex-1 sm:flex-initial">
                      <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                          <SelectTrigger className="h-9 w-full sm:w-[150px] rounded-lg border-none bg-transparent font-bold text-[10px]">
                              <Filter className="h-3 w-3 mr-1.5 text-primary" />
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

                    <div className="bg-secondary/50 p-0.5 rounded-xl flex items-center flex-1 sm:flex-initial">
                      <Select value={batchFilter} onValueChange={setBatchFilter}>
                          <SelectTrigger className="h-9 w-full sm:w-[100px] rounded-lg border-none bg-transparent font-bold text-[10px]">
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
                  <TabsList className="grid grid-cols-4 bg-secondary/50 p-1 rounded-xl h-10 w-full md:min-w-[320px]">
                    <TabsTrigger value="daily" className="rounded-lg font-black text-[8px] md:text-[9px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="rounded-lg font-black text-[8px] md:text-[9px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-lg font-black text-[8px] md:text-[9px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="rounded-lg font-black text-[8px] md:text-[9px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Yearly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* Ranking Directory with Internal Scroll */}
            <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
              <div className="p-3 md:p-4 border-b bg-secondary/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black flex items-center gap-2 tracking-tight">
                     <List className="h-4 w-4 text-primary" /> Contender Directory
                  </h3>
                  <p className="text-[7px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-0.5">Live from global data servers</p>
                </div>
                <Badge variant="outline" className="font-black text-[8px] uppercase tracking-widest border-primary/20 text-primary h-6 px-2">
                  {rankings.length} Tracked
                </Badge>
              </div>
              
              <ScrollArea className="h-[450px]">
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
                            "flex items-center justify-between p-3 md:p-4 hover:bg-primary/[0.03] transition-all duration-300 group",
                            isMe && "bg-primary/[0.05] ring-1 ring-inset ring-primary/10"
                          )}
                        >
                          <div className="flex items-center gap-3 md:gap-5 min-w-0">
                            <span className={cn(
                              "w-6 text-center font-black text-xs md:text-sm italic transition-colors",
                              idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "text-muted-foreground/30 group-hover:text-primary"
                            )}>
                               #{idx + 1}
                            </span>
                            
                            <div className="relative">
                              <Avatar className={cn(
                                "h-8 w-8 md:h-10 md:w-10 border transition-transform group-hover:scale-105 duration-300",
                                isMe ? "border-primary" : "border-background shadow-sm"
                              )}>
                                <AvatarImage src={contender.photoURL || undefined} />
                                <AvatarFallback className="font-black text-xs bg-secondary text-primary">{contender.displayName?.[0]}</AvatarFallback>
                              </Avatar>
                              {contender.isLive && (
                                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-red-600 rounded-full border-2 border-card flex items-center justify-center shadow-lg">
                                  <div className="h-1 w-1 bg-white rounded-full animate-ping" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <p className="font-bold text-[11px] md:text-sm truncate group-hover:text-primary transition-colors tracking-tight">
                                      {contender.displayName}
                                    </p>
                                    {isMe && <Badge className="text-[6px] font-black bg-primary text-white h-3 tracking-widest border-none px-1">YOU</Badge>}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[7px] md:text-[8px] font-black uppercase text-muted-foreground">
                                        {contender.category || 'SSC'} {contender.batch || ''}
                                    </span>
                                    {userGuildName && (
                                      <div className="flex items-center gap-1 text-[7px] md:text-[8px] font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded-full">
                                         <Users2 className="h-2 w-2" /> {userGuildName}
                                      </div>
                                    )}
                                </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 md:gap-5">
                            <div className="text-right shrink-0">
                                <p className="font-black text-sm md:text-lg text-primary leading-none tracking-tighter tabular-nums">
                                    {formatTime(contender.displayMinutes)}
                                </p>
                                <p className="text-[6px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                                  {timeFilter}
                                </p>
                            </div>
                            <div className="hidden sm:flex h-6 w-6 rounded-full items-center justify-center bg-secondary/50 group-hover:bg-primary group-hover:text-white transition-all duration-300 group-hover:translate-x-0.5">
                               <ArrowRight className="h-3 w-3" />
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
        </main>
      </div>
    </ProtectedRoute>
  );
}

function PodiumMember({ user, rank, time }: { user: any; rank: number; time: string }) {
  const isWinner = rank === 1;
  
  return (
    <Link href={`/profile/${user.uid}`} className="flex flex-col items-center group overflow-visible relative">
       <div className="relative flex flex-col items-center overflow-visible">
          {/* Winner Crown & Badge */}
          {isWinner && (
             <>
               <div className="absolute -top-9 md:-top-14 z-[50] animate-bounce pointer-events-none">
                  <Crown className="h-8 w-8 md:h-12 md:w-12 text-yellow-400 fill-current drop-shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
               </div>
               {user.isLive && (
                  <div className="absolute top-0 right-0 z-[60] bg-red-600 text-white text-[7px] md:text-[9px] font-black px-1.5 md:px-2 py-0.5 rounded-full shadow-lg border border-red-400 animate-pulse">
                    LIVE
                  </div>
               )}
             </>
          )}
          
          {/* Avatar with Ring */}
          <div className={cn(
             "relative rounded-full transition-transform duration-500 group-hover:scale-105 overflow-visible",
             isWinner 
              ? "h-20 w-20 md:h-32 md:w-32 border-[4px] border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.4)]" 
              : rank === 2 
                ? "h-16 w-16 md:h-24 md:w-24 border-[3px] border-slate-400" 
                : "h-16 w-16 md:h-24 md:w-24 border-[3px] border-orange-500"
          )}>
             <Avatar className="h-full w-full">
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback className="text-sm md:text-lg font-black bg-secondary">{user.displayName?.[0]}</AvatarFallback>
             </Avatar>
             
             {/* Medal Badge for 2nd & 3rd */}
             {!isWinner && (
                <div className={cn(
                   "absolute -bottom-1 -right-1 h-6 w-6 md:h-8 md:w-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg",
                   rank === 2 ? "bg-slate-400" : "bg-orange-500"
                )}>
                   <Medal className="h-3 w-3 md:h-4 md:w-4 text-white fill-current" />
                </div>
             )}
          </div>
       </div>

       {/* Member Info */}
       <div className="mt-2 text-center space-y-0.5">
          <h3 className={cn(
             "font-black tracking-tight truncate max-w-[80px] md:max-w-[120px]",
             isWinner ? "text-xs md:text-lg" : "text-[10px] md:text-sm"
          )}>
             {user.displayName}
          </h3>
          
          <div className="flex flex-col items-center gap-1">
             {isWinner ? (
                <div className="bg-yellow-400 text-black px-2 md:px-3 py-0.5 rounded-full text-[7px] md:text-xs font-black shadow-md">
                   {time}
                </div>
             ) : (
                <span className="text-primary font-black text-[8px] md:text-xs">{time}</span>
             )}
          </div>
       </div>
    </Link>
  );
}
