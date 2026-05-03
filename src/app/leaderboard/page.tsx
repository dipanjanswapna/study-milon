'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
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
import { Trophy, Medal, Crown, Users2, ArrowRight, Zap, List, Filter } from 'lucide-react';
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
  
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Tick every 60 seconds to ensure resets at midnight happen live in the UI (Virtual Reset)
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
    
    // Friday start for Weekly (weekStartsOn: 5 means Friday)
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
      if (timeFilter === 'daily' && u.last_study_day !== todayStr) currentVal = 0;
      if (timeFilter === 'weekly' && u.last_study_week !== weekStr) currentVal = 0;
      if (timeFilter === 'monthly' && u.last_study_month !== monthStr) currentVal = 0;
      if (timeFilter === 'yearly' && u.last_study_year !== yearStr) currentVal = 0;

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
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
          
          {/* Hero Banner */}
          <Card className="rounded-xl border-none shadow-xl overflow-hidden bg-[#1A1C3D] text-white relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Trophy className="h-20 w-20 transition-transform group-hover:scale-110 duration-1000" />
            </div>
            <CardContent className="p-4 md:p-6 relative z-10 space-y-1">
              <div className="space-y-0.5 text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <div className="inline-flex items-center gap-1 bg-primary/20 backdrop-blur-lg px-2 py-0.5 rounded-full border border-white/10 text-[8px] font-black text-primary-foreground uppercase tracking-widest">
                     <Zap className="h-2 w-2 fill-current" />
                     Million Minute Quest
                  </div>
                </div>
                <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none">Hustle Standings</h1>
                <p className="text-white/60 font-medium max-w-xl text-[9px] md:text-xs">
                  Real-time global rankings. Push your limits and claim the top spot.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Podium Section */}
          <div className="w-full flex justify-center pt-4 pb-2 overflow-visible relative z-20">
            {loading ? (
              <div className="flex items-end justify-center gap-8">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-28 w-28 rounded-full" />
                <Skeleton className="h-20 w-20 rounded-full" />
              </div>
            ) : top3.length > 0 ? (
              <div className="flex items-end justify-center gap-4 md:gap-16 lg:gap-24 px-4 w-full overflow-visible">
                {top3[1] && <PodiumMember user={top3[1]} rank={2} time={formatTime(top3[1].displayMinutes)} />}
                {top3[0] && <PodiumMember user={top3[0]} rank={1} time={formatTime(top3[0].displayMinutes)} />}
                {top3[2] && <PodiumMember user={top3[2]} rank={3} time={formatTime(top3[2].displayMinutes)} />}
              </div>
            ) : (
              <div className="py-10 text-center text-muted-foreground italic text-xs">No active contenders for this period.</div>
            )}
          </div>

          {/* Filters */}
          <Card className="rounded-xl border-none shadow-sm bg-card overflow-hidden">
            <CardContent className="p-2 md:p-3 flex flex-col md:flex-row items-center justify-between gap-1 md:gap-3">
              <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="bg-secondary/50 p-0.5 rounded-lg flex items-center flex-1 md:flex-none">
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                        <SelectTrigger className="h-8 w-full sm:w-[140px] rounded-md border-none bg-transparent font-bold text-[9px]">
                            <Filter className="h-3 w-3 mr-1.5 text-primary shrink-0" />
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

                  <div className="bg-secondary/50 p-0.5 rounded-lg flex items-center flex-1 md:flex-none">
                    <Select value={batchFilter} onValueChange={setBatchFilter}>
                        <SelectTrigger className="h-8 w-full sm:w-[90px] rounded-md border-none bg-transparent font-bold text-[9px]">
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

              <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full md:w-auto mt-2 md:mt-0">
                <TabsList className="grid grid-cols-4 bg-secondary/50 p-1 rounded-xl h-9 w-full md:min-w-[300px]">
                  <TabsTrigger value="daily" className="rounded-lg font-black text-[8px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Daily</TabsTrigger>
                  <TabsTrigger value="weekly" className="rounded-lg font-black text-[8px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Weekly</TabsTrigger>
                  <TabsTrigger value="monthly" className="rounded-lg font-black text-[8px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Monthly</TabsTrigger>
                  <TabsTrigger value="yearly" className="rounded-lg font-black text-[8px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Yearly</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* List Section */}
          <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
            <div className="p-3 md:p-4 border-b bg-secondary/10 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black flex items-center gap-2 tracking-tight">
                   <List className="h-3.5 w-3.5 text-primary" /> Contender Directory
                </h3>
                <p className="text-[7px] font-black uppercase text-muted-foreground tracking-[0.2em] mt-0.5">Live from global data servers</p>
              </div>
              <Badge variant="outline" className="font-black text-[8px] uppercase tracking-widest border-primary/20 text-primary h-5 px-1.5">
                {rankings.length} Tracked
              </Badge>
            </div>
            
            <ScrollArea className="h-[450px]">
              <div className="divide-y divide-secondary/30">
                {!loading && rankings.map((contender: any, idx) => {
                  const userGuildName = contender.groupId ? groupMap[contender.groupId] : null;
                  const isMe = contender.uid === user?.uid;

                  return (
                    <Link key={contender.uid} href={`/profile/${contender.uid}`} className={cn("flex items-center justify-between p-3 md:p-4 hover:bg-primary/[0.03] transition-all group", isMe && "bg-primary/[0.05] ring-1 ring-inset ring-primary/10")}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("w-6 text-center font-black text-[10px] md:text-sm", idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "text-muted-foreground/30")}>#{idx + 1}</span>
                        <div className="relative">
                          <Avatar className={cn("h-8 w-8 md:h-9 md:w-9 border transition-transform group-hover:scale-105", isMe ? "border-primary" : "border-background shadow-sm")}>
                            <AvatarImage src={contender.photoURL || undefined} />
                            <AvatarFallback className="font-black text-[10px] bg-secondary text-primary">{contender.displayName?.[0]}</AvatarFallback>
                          </Avatar>
                          {contender.isLive && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-red-600 rounded-full border-2 border-card flex items-center justify-center">
                              <div className="h-1 w-1 bg-white rounded-full animate-ping" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                                <p className="font-bold text-[11px] md:text-sm truncate group-hover:text-primary transition-colors tracking-tight">{contender.displayName}</p>
                                {isMe && <Badge className="text-[6px] font-black bg-primary text-white h-3 tracking-widest border-none px-1">YOU</Badge>}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[7px] md:text-[8px] font-black uppercase text-muted-foreground">{contender.category || 'SSC'} {contender.batch || ''}</span>
                                {userGuildName && <div className="flex items-center gap-1 text-[7px] md:text-[8px] font-black text-primary bg-primary/5 px-1 py-0.5 rounded-full"><Users2 className="h-2 w-2" /> {userGuildName}</div>}
                            </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right shrink-0">
                            <p className="font-black text-xs md:text-base text-primary leading-none tracking-tighter tabular-nums">{formatTime(contender.displayMinutes)}</p>
                            <p className="text-[6px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">{timeFilter}</p>
                        </div>
                        <div className="hidden sm:flex h-6 w-6 rounded-full items-center justify-center bg-secondary/50 group-hover:bg-primary group-hover:text-white transition-all"><ArrowRight className="h-3 w-3" /></div>
                      </div>
                    </Link>
                  );
                })}
                {rankings.length === 0 && !loading && (
                   <div className="py-20 text-center space-y-4">
                        <div className="bg-secondary/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                            <Zap className="h-8 w-8 text-muted-foreground/30" />
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
          {isWinner && (
             <div className="absolute -top-10 md:-top-14 z-[50] animate-bounce pointer-events-none">
                <Crown className="h-10 w-10 md:h-14 md:w-14 text-yellow-400 fill-current drop-shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
             </div>
          )}
          <div className={cn(
            "relative rounded-full transition-all duration-500 group-hover:scale-110",
            isWinner 
              ? "h-20 w-20 md:h-28 md:w-28 border-[4px] border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.3)]" 
              : "h-16 w-16 md:h-20 md:w-20 border-[3px] " + (rank === 2 ? "border-slate-300" : "border-orange-400")
          )}>
             <Avatar className="h-full w-full">
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback className="text-xs md:text-lg font-black bg-secondary">{user.displayName?.[0]}</AvatarFallback>
             </Avatar>
             {user.isLive && <div className="absolute -top-1 -right-1 z-[60] bg-red-600 text-white text-[6px] md:text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg border border-red-400 animate-pulse">LIVE</div>}
             {!isWinner && (
               <div className={cn(
                 "absolute -bottom-1 -right-1 h-5 w-5 md:h-7 md:w-7 rounded-full flex items-center justify-center border-2 border-background shadow-lg",
                 rank === 2 ? "bg-slate-300" : "bg-orange-400"
               )}>
                 <Medal className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 text-white fill-current" />
               </div>
             )}
          </div>
       </div>
       <div className="mt-2 text-center space-y-0.5">
          <h3 className={cn("font-black tracking-tight truncate max-w-[70px] md:max-w-[100px]", isWinner ? "text-[10px] md:text-sm" : "text-[8px] md:text-xs")}>{user.displayName}</h3>
          <div className="flex flex-col items-center">
             {isWinner ? (
               <div className="bg-yellow-400 text-black px-1.5 md:px-2.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-black shadow-sm">{time}</div>
             ) : (
               <span className="text-primary font-black text-[8px] md:text-[10px]">{time}</span>
             )}
          </div>
       </div>
    </Link>
  );
}