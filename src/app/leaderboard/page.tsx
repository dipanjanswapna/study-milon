'use client';

import { useMemo, useState, useEffect } from 'react';
import { ref, onValue, query as rtdbQuery, orderByChild, limitToLast } from 'firebase/database';
import { useDatabase, useUser, useFirestore, useDoc } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfileSetupGate } from '@/components/dashboard/ProfileSetupGate';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Medal, Crown, Zap, Filter, Loader2, RefreshCw, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek } from 'date-fns';
import Link from 'next/link';
import { doc } from 'firebase/firestore';

type TimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CategoryFilter = 'All' | 'SSC' | 'HSC' | 'Admission 1st' | 'Admission 2nd' | 'Job Prep' | 'University';

const YEARS = Array.from({ length: 18 }, (_, i) => (2023 + i).toString());

export default function LeaderboardPage() {
  const { user } = useUser();
  const database = useDatabase();
  const firestore = useFirestore();
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('daily');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [batchFilter, setBatchFilter] = useState<string>('All');
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch my profile for highlight
  const myRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: myProfile } = useDoc<any>(myRef as any);

  // RTDB: Fetch rankings with Date-Based paths for Automatic Resets
  useEffect(() => {
    setLoading(true);
    
    let path = `leaderboards/${timeFilter}`;
    const now = new Date();

    // Reset Logic Implementation
    if (timeFilter === 'daily') {
      // 12 AM Reset: Date specific path
      path = `leaderboards/daily/${format(now, 'yyyy-MM-dd')}`;
    } else if (timeFilter === 'weekly') {
      // Friday-to-Thursday Reset: Anchor to previous Friday
      const weekStart = startOfWeek(now, { weekStartsOn: 5 }); 
      path = `leaderboards/weekly/Friday_${format(weekStart, 'yyyy-MM-dd')}`;
    } else if (timeFilter === 'monthly') {
      // 1st of Month Reset: Month specific path
      path = `leaderboards/monthly/${format(now, 'yyyy-MM')}`;
    } else if (timeFilter === 'yearly') {
      path = `leaderboards/yearly/${format(now, 'yyyy')}`;
    }

    const leaderboardRef = ref(database, path);
    // Sort by minutes. RTDB gives ascending, so we handle reverse in state
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
      setLastUpdated(new Date());
    }, (error) => {
      console.error("RTDB Leaderboard Error:", error);
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
            
            {/* Header Card */}
            <Card className="rounded-xl border-none shadow-xl overflow-hidden bg-[#1A1C3D] text-white relative group">
              <CardContent className="p-6 md:p-10 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="space-y-2 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-lg px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-primary-foreground uppercase tracking-[0.2em]">
                       <Zap className="h-3 w-3 fill-current" />
                       Hustle Standings
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none">Global Contenders</h1>
                    <p className="text-white/60 font-medium text-xs md:text-sm max-w-md">
                      {timeFilter === 'daily' && "Resets every night at 12:00 AM."}
                      {timeFilter === 'weekly' && "Resets every Friday morning."}
                      {timeFilter === 'monthly' && "Resets on the 1st of every month."}
                      {timeFilter === 'yearly' && "Annual hustle performance."}
                    </p>
                  </div>
                  <div className="flex flex-col items-center md:items-end gap-2">
                    <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10 shadow-inner">
                       <RefreshCw className={cn("h-4 w-4 text-primary", loading && "animate-spin")} />
                       <span className="text-[10px] font-black text-white/40 uppercase tracking-widest tabular-nums">
                          Last Sync: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20">
                       <Wifi className="h-2.5 w-2.5 text-red-500 animate-pulse" />
                       <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Live Updates Active</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Podium Section */}
            <div className="w-full flex justify-center py-10 relative z-20 overflow-hidden">
              {loading && rankings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mapping Contenders...</p>
                </div>
              ) : top3.length > 0 ? (
                <div className="flex items-end justify-center gap-4 md:gap-16 lg:gap-24 px-4 w-full max-w-4xl">
                  {top3[1] && <PodiumMember user={top3[1]} rank={2} time={formatTime(top3[1].minutes)} />}
                  {top3[0] && <PodiumMember user={top3[0]} rank={1} time={formatTime(top3[0].minutes)} />}
                  {top3[2] && <PodiumMember user={top3[2]} rank={3} time={formatTime(top3[2].minutes)} />}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4 bg-secondary/5 rounded-xl border-2 border-dashed w-full max-w-lg mx-auto">
                   <Zap className="h-10 w-10 mx-auto text-muted-foreground/20" />
                   <p className="text-xs font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Waiting for today's hustle to begin...</p>
                </div>
              )}
            </div>

            {/* Filters Navigation */}
            <Card className="rounded-xl border-none shadow-sm bg-card overflow-hidden">
              <CardContent className="p-3 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="bg-secondary/50 p-1 rounded-xl flex items-center flex-1 md:w-48">
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                      <SelectTrigger className="h-9 w-full rounded-lg border-none bg-transparent font-black uppercase text-[10px] tracking-widest">
                        <Filter className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
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
                  <div className="bg-secondary/50 p-1 rounded-xl flex items-center flex-1 md:w-32">
                    <Select value={batchFilter} onValueChange={setBatchFilter}>
                      <SelectTrigger className="h-9 w-full rounded-lg border-none bg-transparent font-black text-[10px] tracking-widest">
                        <SelectValue placeholder="Batch" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="All">All Batches</SelectItem>
                        {YEARS.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full md:w-[400px]">
                  <TabsList className="grid grid-cols-4 bg-secondary/50 p-1 rounded-xl h-11 w-full">
                    <TabsTrigger value="daily" className="rounded-lg font-black text-[10px] uppercase tracking-widest">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="rounded-lg font-black text-[10px] uppercase tracking-widest">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-lg font-black text-[10px] uppercase tracking-widest">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="rounded-lg font-black text-[10px] uppercase tracking-widest">Yearly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* Rankings List */}
            <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
              <div className="p-5 border-b bg-secondary/10 flex items-center justify-between px-8">
                <div className="space-y-0.5">
                   <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                     <Medal className="h-4 w-4 text-primary" /> Rankings Queue
                   </h3>
                   <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Based on active focus time</p>
                </div>
                <Badge variant="outline" className="font-black text-[10px] uppercase tracking-[0.2em] border-primary/20 text-primary h-7 px-4 rounded-full bg-primary/5">
                  {filteredRankings.length} Contenders
                </Badge>
              </div>
              <ScrollArea className="h-[550px]">
                <div className="divide-y divide-secondary/30">
                  {filteredRankings.map((contender: any, idx) => {
                    const isMe = contender.uid === user?.uid;
                    return (
                      <Link 
                        key={contender.uid} 
                        href={`/profile/${contender.uid}`} 
                        className={cn(
                          "flex items-center justify-between p-4 md:p-6 px-6 md:px-10 hover:bg-primary/[0.03] transition-all group relative", 
                          isMe && "bg-primary/[0.05] ring-1 ring-inset ring-primary/10"
                        )}
                      >
                        <div className="flex items-center gap-5 min-w-0">
                          <span className={cn(
                            "w-8 text-center font-black text-lg italic", 
                            idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "text-muted-foreground/20"
                          )}>
                            {idx < 9 ? `0${idx + 1}` : idx + 1}
                          </span>
                          <div className="relative">
                             <Avatar className="h-12 w-12 md:h-14 md:w-14 border-2 border-background shadow-lg group-hover:scale-110 transition-transform">
                                <AvatarImage src={contender.photoURL || undefined} />
                                <AvatarFallback className="font-black text-sm bg-secondary">{contender.displayName?.[0]}</AvatarFallback>
                             </Avatar>
                             {contender.isLive && (
                               <div className="absolute -top-1 -right-1 bg-red-600 h-3.5 w-3.5 rounded-full border-2 border-white animate-pulse" />
                             )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                              <p className="font-black text-sm md:text-base truncate tracking-tight group-hover:text-primary transition-colors">{contender.displayName}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary" className="text-[8px] font-black uppercase h-4 px-1.5 bg-primary/5 text-primary border-none">
                                    {contender.category} {contender.batch}
                                  </Badge>
                                  {contender.isLive && (
                                    <span className="text-[7px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-md">LIVE</span>
                                  )}
                              </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-black text-base md:text-2xl text-primary leading-none tabular-nums tracking-tighter">
                               {formatTime(contender.minutes)}
                            </p>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Focus Log</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>

            {/* My Rank Sticky */}
            {filteredRankings.some(u => u.uid === user?.uid) === false && myProfile && (
              <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[95%] max-w-4xl z-50 animate-in slide-in-from-bottom-10 duration-700">
                 <Card className="rounded-xl bg-primary text-white shadow-2xl border-none p-4 flex items-center justify-between px-8">
                    <div className="flex items-center gap-4">
                       <Avatar className="h-10 w-10 border-2 border-white/20">
                          <AvatarImage src={myProfile.photoURL} />
                          <AvatarFallback className="text-primary font-black bg-white">{myProfile.displayName?.[0]}</AvatarFallback>
                       </Avatar>
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Your Position</p>
                          <p className="font-black text-sm">Not in Top 100</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                         {timeFilter === 'daily' ? "Today's Hustle" : 
                          timeFilter === 'weekly' ? "Weekly Hustle" : 
                          timeFilter === 'monthly' ? "Monthly Hustle" : "Yearly Hustle"}
                       </p>
                       <p className="font-black text-xl tracking-tighter">
                         {formatTime(
                           timeFilter === 'daily' ? myProfile.daily_study_minutes :
                           timeFilter === 'weekly' ? myProfile.weekly_study_minutes :
                           timeFilter === 'monthly' ? myProfile.monthly_study_minutes :
                           myProfile.yearly_study_minutes
                         )}
                       </p>
                    </div>
                 </Card>
              </div>
            )}

          </ProfileSetupGate>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function PodiumMember({ user, rank, time }: { user: any; rank: number; time: string }) {
  const isWinner = rank === 1;
  const rankColors = {
    1: "border-yellow-400 shadow-yellow-500/20",
    2: "border-slate-300 shadow-slate-400/20",
    3: "border-orange-400 shadow-orange-500/20"
  };

  return (
    <Link href={`/profile/${user.uid}`} className="flex flex-col items-center group relative flex-1">
       {isWinner && (
         <div className="absolute -top-16 flex flex-col items-center animate-bounce">
            <Crown className="h-12 w-12 text-yellow-400 fill-current drop-shadow-lg" />
            <div className="h-4 w-1 bg-yellow-400 rounded-full opacity-50" />
         </div>
       )}
       
       <div className={cn(
         "relative rounded-full transition-all duration-700 group-hover:scale-110", 
         isWinner ? "h-28 w-28 md:h-40 md:w-40 border-[6px]" : "h-20 w-20 md:h-28 md:w-28 border-[4px]",
         rankColors[rank as keyof typeof rankColors]
       )}>
          <div className="absolute inset-0 rounded-full bg-white/5 backdrop-blur-sm" />
          <Avatar className="h-full w-full">
             <AvatarImage src={user.photoURL || undefined} className="object-cover" />
             <AvatarFallback className={cn("font-black bg-secondary", isWinner ? "text-2xl" : "text-lg")}>{user.displayName?.[0]}</AvatarFallback>
          </Avatar>
          
          <div className={cn(
            "absolute -bottom-2 left-1/2 -translate-x-1/2 h-6 px-3 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg",
            rank === 1 ? "bg-yellow-400 text-yellow-900" : rank === 2 ? "bg-slate-300 text-slate-700" : "bg-orange-400 text-white"
          )}>
            RANK {rank}
          </div>
          
          {user.isLive && (
            <div className="absolute top-2 right-2 bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-lg ring-2 ring-white">LIVE</div>
          )}
       </div>
       
       <div className="mt-6 text-center space-y-1 w-full max-w-[120px]">
          <h3 className="font-black tracking-tight truncate text-xs md:text-base group-hover:text-primary transition-colors uppercase">{user.displayName}</h3>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/5 rounded-full">
            <Zap className="h-3 w-3 text-primary fill-current" />
            <span className="text-primary font-black text-[10px] md:text-sm tracking-tighter">{time}</span>
          </div>
          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{user.category} {user.batch}</p>
       </div>
    </Link>
  );
}
