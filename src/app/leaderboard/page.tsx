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
import { Trophy, Medal, Crown, Zap, Filter, Loader2, RefreshCw, Wifi, Flame, Layout } from 'lucide-react';
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

  // RTDB: Fetch rankings
  useEffect(() => {
    setLoading(true);
    let path = `leaderboards/${timeFilter}`;
    const now = new Date();

    if (timeFilter === 'daily') {
      path = `leaderboards/daily/${format(now, 'yyyy-MM-dd')}`;
    } else if (timeFilter === 'weekly') {
      const weekStart = startOfWeek(now, { weekStartsOn: 5 }); 
      path = `leaderboards/weekly/Friday_${format(weekStart, 'yyyy-MM-dd')}`;
    } else if (timeFilter === 'monthly') {
      path = `leaderboards/monthly/${format(now, 'yyyy-MM')}`;
    } else if (timeFilter === 'yearly') {
      path = `leaderboards/yearly/${format(now, 'yyyy')}`;
    }

    const leaderboardRef = ref(database, path);
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
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-10">
        <Header />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          <ProfileSetupGate>
            
            {/* Elite Hero Banner - Same as Study Planner */}
            <Card className="rounded-[2rem] border-none shadow-2xl overflow-hidden bg-[#1A1C3D] text-white relative group">
              <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12 transition-transform group-hover:rotate-45 duration-1000">
                <Layout className="h-32 w-32" />
              </div>
              <CardContent className="p-8 md:p-12 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="space-y-3 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-lg px-3 py-1 rounded-full border border-white/10 text-[10px] font-black text-primary-foreground uppercase tracking-[0.2em]">
                       <Zap className="h-3 w-3 fill-current" />
                       Hustle Standings
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">Global Contenders</h1>
                    <p className="text-white/60 font-medium text-sm md:text-base max-w-lg">
                      Synchronize your effort with the elite community. Rankings reset automatically based on the selected cycle.
                    </p>
                  </div>
                  <div className="flex flex-col items-center md:items-end gap-3">
                     <div className="bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-inner flex items-center gap-4">
                        <div className="text-center">
                           <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">Sync Status</p>
                           <div className="flex items-center gap-1.5 mt-1 justify-center">
                              <RefreshCw className={cn("h-3 w-3 text-primary", loading && "animate-spin")} />
                              <span className="text-[10px] font-black uppercase">{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           </div>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                           <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">Live Feed</p>
                           <div className="flex items-center gap-1 mt-1 justify-center">
                              <Wifi className="h-2.5 w-2.5 text-red-500 animate-pulse" />
                              <span className="text-[10px] font-black text-red-500 uppercase">ACTIVE</span>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compact Podium Section */}
            <div className="w-full flex justify-center py-4 relative z-20 overflow-hidden">
              {loading && rankings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mapping Contenders...</p>
                </div>
              ) : top3.length > 0 ? (
                <div className="flex items-end justify-center gap-2 sm:gap-8 md:gap-12 px-2 w-full max-w-4xl">
                  {top3[1] && <PodiumMember user={top3[1]} rank={2} time={formatTime(top3[1].minutes)} />}
                  {top3[0] && <PodiumMember user={top3[0]} rank={1} time={formatTime(top3[0].minutes)} />}
                  {top3[2] && <PodiumMember user={top3[2]} rank={3} time={formatTime(top3[2].minutes)} />}
                </div>
              ) : (
                <div className="py-12 text-center space-y-4 bg-secondary/5 rounded-[2rem] border-2 border-dashed w-full max-w-lg mx-auto">
                   <Zap className="h-8 w-8 mx-auto text-muted-foreground/20" />
                   <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-[0.2em]">Waiting for deep focus sessions...</p>
                </div>
              )}
            </div>

            {/* Nav & Filters - Desktop Header Style */}
            <div className="flex flex-col xl:flex-row items-center justify-between gap-6 px-1">
               <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full xl:w-auto">
                  <TabsList className="grid grid-cols-4 bg-secondary/50 p-1 rounded-2xl h-12 w-full sm:w-[480px]">
                    <TabsTrigger value="daily" className="rounded-xl font-black text-[10px] uppercase tracking-widest">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="rounded-xl font-black text-[10px] uppercase tracking-widest">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-xl font-black text-[10px] uppercase tracking-widest">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="rounded-xl font-black text-[10px] uppercase tracking-widest">Yearly</TabsTrigger>
                  </TabsList>
               </Tabs>

               <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-center xl:justify-end">
                  <div className="bg-secondary/50 p-1 rounded-2xl flex items-center w-[160px]">
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-none bg-transparent font-black uppercase text-[10px] tracking-widest">
                        <Filter className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
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
                  <div className="bg-secondary/50 p-1 rounded-2xl flex items-center w-[120px]">
                    <Select value={batchFilter} onValueChange={setBatchFilter}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-none bg-transparent font-black text-[10px] tracking-widest">
                        <SelectValue placeholder="Batch" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        <SelectItem value="All">All Batches</SelectItem>
                        {YEARS.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
               </div>
            </div>

            {/* Rankings List - Table Style matching Todo's Active Queue */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl bg-card overflow-hidden">
              <div className="p-6 border-b bg-secondary/10 flex items-center justify-between px-8">
                <div className="space-y-1">
                   <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-tight">
                     <Medal className="h-4 w-4 text-primary" /> Rankings Queue
                   </h3>
                   <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Sorted by active study minutes</p>
                </div>
                <Badge variant="outline" className="font-black text-[10px] uppercase tracking-[0.2em] border-primary/20 text-primary h-8 px-4 rounded-full bg-white">
                  {filteredRankings.length} Active
                </Badge>
              </div>
              
              <ScrollArea className="h-[600px]">
                <div className="divide-y divide-secondary/30">
                  {filteredRankings.map((contender: any, idx) => {
                    const isMe = contender.uid === user?.uid;
                    return (
                      <Link 
                        key={contender.uid} 
                        href={`/profile/${contender.uid}`} 
                        className={cn(
                          "flex items-center justify-between p-5 sm:p-6 px-6 sm:px-10 transition-all group border-l-4 border-transparent", 
                          isMe ? "bg-primary/[0.05] border-l-primary" : "hover:bg-primary/[0.02]"
                        )}
                      >
                        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                          <span className={cn(
                            "w-8 text-center font-black text-base sm:text-xl italic", 
                            idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "text-muted-foreground/20"
                          )}>
                            {idx < 9 ? `0${idx + 1}` : idx + 1}
                          </span>
                          <div className="relative shrink-0">
                             <Avatar className="h-12 w-12 sm:h-14 sm:w-14 border-2 border-background shadow-lg transition-transform group-hover:scale-105">
                                <AvatarImage src={contender.photoURL || undefined} className="object-cover" />
                                <AvatarFallback className="font-black text-sm bg-secondary">{contender.displayName?.[0]}</AvatarFallback>
                             </Avatar>
                             {contender.isLive && (
                               <div className="absolute -top-1 -right-1 bg-red-600 h-3.5 w-3.5 rounded-full border-2 border-white animate-pulse" />
                             )}
                          </div>
                          <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-black text-sm sm:text-base truncate tracking-tight group-hover:text-primary transition-colors uppercase leading-none">{contender.displayName}</p>
                                {contender.currentStreak > 0 && (
                                  <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-none font-black text-[9px] px-1.5 h-4 flex items-center gap-0.5">
                                    <Flame className="h-2.5 w-2.5 fill-current" /> {contender.currentStreak}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-1.5 text-primary">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">{contender.category} {contender.batch}</span>
                                  </div>
                                  {contender.isLive && (
                                    <span className="text-[8px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-sm">LIVE</span>
                                  )}
                              </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-black text-lg sm:text-2xl text-primary leading-none tabular-nums tracking-tighter">
                               {formatTime(contender.minutes)}
                            </p>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mt-1.5">Focus Log</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>

            {/* My Rank Sticky - Redesigned to match Todo Add Dialog style */}
            {filteredRankings.some(u => u.uid === user?.uid) === false && myProfile && (
              <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[92%] max-w-4xl z-50 animate-in slide-in-from-bottom-10 duration-700">
                 <Card className="rounded-[1.5rem] bg-[#1A1C3D] text-white shadow-2xl border-none p-4 flex items-center justify-between px-8 ring-1 ring-white/10 backdrop-blur-xl bg-opacity-95">
                    <div className="flex items-center gap-4">
                       <div className="relative">
                          <Avatar className="h-10 w-10 border-2 border-primary/40">
                             <AvatarImage src={myProfile.photoURL} />
                             <AvatarFallback className="text-primary font-black bg-white">{myProfile.displayName?.[0]}</AvatarFallback>
                          </Avatar>
                       </div>
                       <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Personal Standing</p>
                          <p className="font-black text-sm uppercase tracking-tight">Outside Top 100</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black uppercase tracking-widest text-primary">
                         Current {timeFilter}
                       </p>
                       <p className="font-black text-xl tracking-tighter tabular-nums">
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
    <div className="flex flex-col items-center group relative flex-1">
       {isWinner && (
         <div className="absolute -top-12 flex flex-col items-center animate-bounce">
            <Crown className="h-8 w-8 text-yellow-400 fill-current drop-shadow-lg" />
            <div className="h-3 w-0.5 bg-yellow-400 rounded-full opacity-50" />
         </div>
       )}
       
       <Link href={`/profile/${user.uid}`} className="relative">
          <div className={cn(
            "relative rounded-full transition-all duration-700 group-hover:scale-110", 
            isWinner ? "h-20 w-20 sm:h-32 sm:w-32 border-[4px] sm:border-[6px]" : "h-16 w-16 sm:h-24 sm:w-24 border-[3px] sm:border-[4px]",
            rankColors[rank as keyof typeof rankColors]
          )}>
             <div className="absolute inset-0 rounded-full bg-white/5 backdrop-blur-sm" />
             <Avatar className="h-full w-full">
                <AvatarImage src={user.photoURL || undefined} className="object-cover" />
                <AvatarFallback className={cn("font-black bg-secondary", isWinner ? "text-xl sm:text-2xl" : "text-sm sm:text-lg")}>{user.displayName?.[0]}</AvatarFallback>
             </Avatar>
             
             <div className={cn(
               "absolute -bottom-2 left-1/2 -translate-x-1/2 h-5 px-2.5 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-black shadow-lg uppercase tracking-widest",
               rank === 1 ? "bg-yellow-400 text-yellow-900" : rank === 2 ? "bg-slate-300 text-slate-700" : "bg-orange-400 text-white"
             )}>
               R{rank}
             </div>
             
             {user.isLive && (
               <div className="absolute top-1 right-1 bg-red-600 text-white text-[6px] sm:text-[7px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-lg ring-2 ring-white">LIVE</div>
             )}
          </div>
       </Link>
       
       <div className="mt-4 text-center space-y-1 w-full max-w-[90px] sm:max-w-[140px]">
          <h3 className="font-black tracking-tight truncate text-[10px] sm:text-sm group-hover:text-primary transition-colors uppercase leading-none">{user.displayName}</h3>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/5 rounded-full">
            <Zap className="h-2.5 w-2.5 text-primary fill-current" />
            <span className="text-primary font-black text-[9px] sm:text-xs tracking-tighter">{time}</span>
          </div>
       </div>
    </div>
  );
}
