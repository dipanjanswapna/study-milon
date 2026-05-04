'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfileSetupGate } from '@/components/dashboard/ProfileSetupGate';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchGroups = async () => {
      const snap = await getDocs(collection(firestore, 'groups'));
      const mapping: Record<string, string> = {};
      snap.forEach(doc => { mapping[doc.id] = doc.data().name; });
      setGroupMap(mapping);
    };
    fetchGroups();
  }, [firestore]);

  const leaderboardQuery = useMemo(() => {
    const field = timeFilter === 'daily' ? 'daily_study_minutes' : 
                  timeFilter === 'weekly' ? 'weekly_study_minutes' :
                  timeFilter === 'monthly' ? 'monthly_study_minutes' : 'yearly_study_minutes';
    return query(collection(firestore, 'users'), orderBy(field, 'desc'), limit(100));
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
      let currentVal = timeFilter === 'daily' ? u.daily_study_minutes :
                       timeFilter === 'weekly' ? u.weekly_study_minutes :
                       timeFilter === 'monthly' ? u.monthly_study_minutes : u.yearly_study_minutes;
      currentVal = currentVal || 0;
      
      if (timeFilter === 'daily' && u.last_study_day !== todayStr) currentVal = 0;
      if (timeFilter === 'weekly' && u.last_study_week !== weekStr) currentVal = 0;
      if (timeFilter === 'monthly' && u.last_study_month !== monthStr) currentVal = 0;
      if (timeFilter === 'yearly' && u.last_study_year !== yearStr) currentVal = 0;

      let isLive = u.isStudying === true;
      if (u.last_active_date) {
         const lastActive = u.last_active_date.toDate();
         isLive = isLive && isAfter(lastActive, subSeconds(new Date(), 120));
      }
      return { ...u, displayMinutes: currentVal, isLive };
    }).sort((a, b) => b.displayMinutes - a.displayMinutes).slice(0, 100);
  }, [allRankings, categoryFilter, batchFilter, timeFilter, tick]);

  const top3 = rankings?.slice(0, 3) || [];

  const formatTime = (minutes: number = 0) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}H ${m}M` : `${m}M`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
          <ProfileSetupGate>
            <Card className="rounded-xl border-none shadow-xl overflow-hidden bg-[#1A1C3D] text-white relative group">
              <CardContent className="p-4 md:p-6 relative z-10 space-y-1">
                <div className="space-y-0.5 text-center md:text-left">
                  <div className="inline-flex items-center gap-1 bg-primary/20 backdrop-blur-lg px-2 py-0.5 rounded-full border border-white/10 text-[8px] font-black text-primary-foreground uppercase tracking-widest">
                     <Zap className="h-2 w-2 fill-current" />
                     Million Minute Quest
                  </div>
                  <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none">Hustle Standings</h1>
                  <p className="text-white/60 font-medium text-[9px] md:text-xs">Real-time global rankings.</p>
                </div>
              </CardContent>
            </Card>

            <div className="w-full flex justify-center pt-8 pb-4 relative z-20">
              {loading ? (
                <div className="flex items-end justify-center gap-8">
                  <Skeleton className="h-20 w-20 rounded-full" /><Skeleton className="h-28 w-28 rounded-full" /><Skeleton className="h-20 w-20 rounded-full" />
                </div>
              ) : top3.length > 0 ? (
                <div className="flex items-end justify-center gap-4 md:gap-16 lg:gap-24 px-4 w-full">
                  {top3[1] && <PodiumMember user={top3[1]} rank={2} time={formatTime(top3[1].displayMinutes)} />}
                  {top3[0] && <PodiumMember user={top3[0]} rank={1} time={formatTime(top3[0].displayMinutes)} />}
                  {top3[2] && <PodiumMember user={top3[2]} rank={3} time={formatTime(top3[2].displayMinutes)} />}
                </div>
              ) : <div className="py-10 text-center text-muted-foreground italic text-xs">No active contenders.</div>}
            </div>

            <Card className="rounded-xl border-none shadow-sm bg-card overflow-hidden mt-4">
              <CardContent className="p-2 md:p-3 flex flex-col md:flex-row items-center justify-between gap-1 md:gap-3">
                <div className="flex items-center gap-2 w-full">
                  <div className="bg-secondary/50 p-0.5 rounded-lg flex items-center flex-1">
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                      <SelectTrigger className="h-8 w-full rounded-md border-none bg-transparent font-bold text-[9px]">
                        <Filter className="h-3 w-3 mr-1.5 text-primary shrink-0" /><SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="All">All Categories</SelectItem>
                        <SelectItem value="SSC">SSC</SelectItem><SelectItem value="HSC">HSC</SelectItem>
                        <SelectItem value="Admission 1st">Admission 1st</SelectItem><SelectItem value="Admission 2nd">Admission 2nd</SelectItem>
                        <SelectItem value="Job Prep">Job Prep</SelectItem><SelectItem value="University">University</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-secondary/50 p-0.5 rounded-lg flex items-center flex-1">
                    <Select value={batchFilter} onValueChange={setBatchFilter}>
                      <SelectTrigger className="h-8 w-full rounded-md border-none bg-transparent font-bold text-[9px]"><SelectValue placeholder="Batch" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="All">All Batches</SelectItem>
                        {YEARS.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full mt-2 md:mt-0">
                  <TabsList className="grid grid-cols-4 bg-secondary/50 p-1 rounded-xl h-9 w-full">
                    <TabsTrigger value="daily" className="rounded-lg font-black text-[8px] uppercase tracking-wider">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="rounded-lg font-black text-[8px] uppercase tracking-wider">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-lg font-black text-[8px] uppercase tracking-wider">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="rounded-lg font-black text-[8px] uppercase tracking-wider">Yearly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden mt-4">
              <div className="p-3 border-b bg-secondary/10 flex items-center justify-between">
                <h3 className="text-xs font-black flex items-center gap-2">Contender Directory</h3>
                <Badge variant="outline" className="font-black text-[8px] uppercase tracking-widest border-primary/20 text-primary h-5 px-1.5">{rankings.length} Tracked</Badge>
              </div>
              <ScrollArea className="h-[450px]">
                <div className="divide-y divide-secondary/30">
                  {!loading && rankings.map((contender: any, idx) => {
                    const userGuildName = contender.groupId ? groupMap[contender.groupId] : null;
                    const isMe = contender.uid === user?.uid;
                    return (
                      <Link key={contender.uid} href={`/profile/${contender.uid}`} className={cn("flex items-center justify-between p-3 md:p-4 hover:bg-primary/[0.03] transition-all group", isMe && "bg-primary/[0.05] ring-1 ring-inset ring-primary/10")}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={cn("w-6 text-center font-black text-[10px]", idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "text-muted-foreground/30")}>#{idx + 1}</span>
                          <Avatar className="h-8 w-8 md:h-9 md:w-9 border">
                            <AvatarImage src={contender.photoURL || undefined} />
                            <AvatarFallback className="font-black text-[10px]">{contender.displayName?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                              <p className="font-bold text-[11px] md:text-sm truncate tracking-tight">{contender.displayName}</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[7px] md:text-[8px] font-black uppercase text-muted-foreground">{contender.category} {contender.batch}</span>
                                  {userGuildName && <span className="text-[7px] text-primary bg-primary/5 px-1 rounded-full">{userGuildName}</span>}
                              </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-black text-xs md:text-base text-primary leading-none tabular-nums">{formatTime(contender.displayMinutes)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          </ProfileSetupGate>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function PodiumMember({ user, rank, time }: { user: any; rank: number; time: string }) {
  const isWinner = rank === 1;
  return (
    <Link href={`/profile/${user.uid}`} className="flex flex-col items-center group relative">
       {isWinner && <Crown className="absolute -top-10 h-10 w-10 text-yellow-400 fill-current animate-bounce" />}
       <div className={cn("relative rounded-full transition-all duration-500 group-hover:scale-110", isWinner ? "h-20 w-20 md:h-28 md:w-28 border-[4px] border-yellow-400 shadow-xl" : "h-16 w-16 md:h-20 md:w-20 border-[3px] " + (rank === 2 ? "border-slate-300" : "border-orange-400"))}>
          <Avatar className="h-full w-full">
             <AvatarImage src={user.photoURL || undefined} />
             <AvatarFallback className="text-xs md:text-lg font-black bg-secondary">{user.displayName?.[0]}</AvatarFallback>
          </Avatar>
          {user.isLive && <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[6px] md:text-[8px] font-black px-1.5 rounded-full animate-pulse">LIVE</div>}
       </div>
       <div className="mt-2 text-center space-y-0.5">
          <h3 className="font-black tracking-tight truncate max-w-[70px] text-[10px] md:text-sm">{user.displayName}</h3>
          <span className="text-primary font-black text-[8px] md:text-[10px]">{time}</span>
       </div>
    </Link>
  );
}