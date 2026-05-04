'use client';

import { useMemo, useState, useEffect } from 'react';
import { ref, onValue, query as rtdbQuery, orderByChild, limitToLast } from 'firebase/database';
import { useDatabase, useUser, useFirestore } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfileSetupGate } from '@/components/dashboard/ProfileSetupGate';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Crown, Zap, Filter, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek } from 'date-fns';
import Link from 'next/link';

type TimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CategoryFilter = 'All' | 'SSC' | 'HSC' | 'Admission 1st' | 'Admission 2nd' | 'Job Prep' | 'University';

const YEARS = Array.from({ length: 18 }, (_, i) => (2023 + i).toString());

export default function LeaderboardPage() {
  const { user } = useUser();
  const database = useDatabase();
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('daily');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [batchFilter, setBatchFilter] = useState<string>('All');
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const leaderboardRef = ref(database, `leaderboards/${timeFilter}`);
    const topRankingsQuery = rtdbQuery(leaderboardRef, orderByChild('minutes'), limitToLast(100));

    const unsubscribe = onValue(topRankingsQuery, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const sortedData = Object.entries(data)
          .map(([uid, val]: [string, any]) => ({
            uid,
            ...val
          }))
          .sort((a, b) => b.minutes - a.minutes);
        
        setRankings(sortedData);
      } else {
        setRankings([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [database, timeFilter]);

  const filteredRankings = useMemo(() => {
    return rankings.filter(u => {
      const matchCategory = categoryFilter === 'All' || u.category === categoryFilter;
      const matchBatch = batchFilter === 'All' || u.batch === batchFilter;
      return matchCategory && matchBatch;
    });
  }, [rankings, categoryFilter, batchFilter]);

  const top3 = filteredRankings.slice(0, 3);

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
                     Real-time Quota Optimized STANDINGS
                  </div>
                  <h1 className="text-lg md:text-xl font-black tracking-tighter leading-none">Global Contenders</h1>
                  <p className="text-white/60 font-medium text-[9px] md:text-xs">Live updates powered by Realtime Database.</p>
                </div>
              </CardContent>
            </Card>

            <div className="w-full flex justify-center pt-8 pb-4 relative z-20">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : top3.length > 0 ? (
                <div className="flex items-end justify-center gap-4 md:gap-16 lg:gap-24 px-4 w-full">
                  {top3[1] && <PodiumMember user={top3[1]} rank={2} time={formatTime(top3[1].minutes)} />}
                  {top3[0] && <PodiumMember user={top3[0]} rank={1} time={formatTime(top3[0].minutes)} />}
                  {top3[2] && <PodiumMember user={top3[2]} rank={3} time={formatTime(top3[2].minutes)} />}
                </div>
              ) : <div className="py-10 text-center text-muted-foreground italic text-xs">Waiting for contenders to sync...</div>}
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
                        <SelectItem value="SSC">SSC</SelectItem>
                        <SelectItem value="HSC">HSC</SelectItem>
                        <SelectItem value="Admission 1st">Admission 1st</SelectItem>
                        <SelectItem value="Admission 2nd">Admission 2nd</SelectItem>
                        <SelectItem value="Job Prep">Job Prep</SelectItem>
                        <SelectItem value="University">University</SelectItem>
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
                <h3 className="text-xs font-black flex items-center gap-2">Hustle Rankings</h3>
                <Badge variant="outline" className="font-black text-[8px] uppercase tracking-widest border-primary/20 text-primary h-5 px-1.5">{filteredRankings.length} Syncing</Badge>
              </div>
              <ScrollArea className="h-[450px]">
                <div className="divide-y divide-secondary/30">
                  {filteredRankings.map((contender: any, idx) => {
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
                                  {contender.isLive && <span className="text-[6px] font-black bg-red-600 text-white px-1 rounded-full animate-pulse">LIVE</span>}
                              </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-black text-xs md:text-base text-primary leading-none tabular-nums">{formatTime(contender.minutes)}</p>
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
          {user.isLive && <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[6px] md:text-[8px] font-black px-1.5 rounded-full animate-pulse shadow-lg">LIVE</div>}
       </div>
       <div className="mt-2 text-center space-y-0.5">
          <h3 className="font-black tracking-tight truncate max-w-[70px] text-[10px] md:text-sm">{user.displayName}</h3>
          <span className="text-primary font-black text-[8px] md:text-[10px]">{time}</span>
       </div>
    </Link>
  );
}
