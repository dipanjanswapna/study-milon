'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardHeader,
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
import { Trophy, Medal, Crown, Clock, Users2, ArrowRight, Wifi, Sparkles } from 'lucide-react';
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
      
      // Virtual reset logic: Check if the saved keys match current time periods
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

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2);
  };

  const formatTime = (minutes: number = 0) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground pb-20 md:pb-10">
        <Header />
        <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-3">
                    <Trophy className="h-10 w-10 text-primary" />
                    Hustle Leaderboard
                </h1>
                <p className="text-muted-foreground text-sm font-medium uppercase tracking-[0.2em] flex items-center justify-center md:justify-start gap-2">
                   <Sparkles className="h-4 w-4 text-primary" />
                   Live Global Standings
                </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-2xl border w-full sm:w-auto">
                        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                            <SelectTrigger className="w-full sm:w-[150px] h-10 border-none bg-transparent focus:ring-0 font-bold">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
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

                    <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-2xl border w-full sm:w-auto">
                        <Select value={batchFilter} onValueChange={setBatchFilter}>
                            <SelectTrigger className="w-full sm:w-[110px] h-10 border-none bg-transparent focus:ring-0 font-bold">
                                <SelectValue placeholder="Batch" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="All">All Batches</SelectItem>
                                {YEARS.map(year => (
                                  <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full sm:w-auto">
                    <TabsList className="bg-secondary/50 h-12 p-1 rounded-2xl w-full grid grid-cols-4 sm:flex">
                        <TabsTrigger value="daily" className="rounded-xl font-black px-2 sm:px-5 text-[10px] sm:text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Daily</TabsTrigger>
                        <TabsTrigger value="weekly" className="rounded-xl font-black px-2 sm:px-5 text-[10px] sm:text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Weekly</TabsTrigger>
                        <TabsTrigger value="monthly" className="rounded-xl font-black px-2 sm:px-5 text-[10px] sm:text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Monthly</TabsTrigger>
                        <TabsTrigger value="yearly" className="rounded-xl font-black px-2 sm:px-5 text-[10px] sm:text-xs uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white">Yearly</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
          </div>

          {loading ? (
             <div className="space-y-4">
                <Skeleton className="h-[300px] w-full rounded-[3rem]" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
             </div>
          ) : rankings && rankings.length > 0 ? (
            <div className="space-y-12">
              
              {/* Podium */}
              <div className="grid grid-cols-3 items-end gap-3 md:gap-12 px-0 md:px-12 pt-16 md:pt-20">
                {/* 2nd Place */}
                <div className="flex flex-col items-center gap-4 pb-4 order-1">
                    {top3[1] && (
                    <>
                        <Link href={`/profile/${top3[1].uid}`} className="relative group block transition-all hover:scale-105 active:scale-95">
                            <div className="absolute -inset-2 bg-slate-300 rounded-full blur opacity-25" />
                            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-36 md:w-36 border-4 border-slate-300 shadow-2xl relative">
                                <AvatarImage src={top3[1].photoURL || undefined} />
                                <AvatarFallback className="text-xl font-black">{getInitials(top3[1].displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-2 -right-2 bg-slate-200 rounded-full p-2 md:p-3 border-2 border-slate-400 shadow-xl">
                                <Medal className="h-5 w-5 md:h-7 md:w-7 text-slate-500" />
                            </div>
                            {top3[1].isLive && (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-full animate-bounce shadow-xl z-20 border-2 border-background">LIVE</div>
                            )}
                        </Link>
                        <div className="text-center px-1 space-y-1">
                            <p className="font-black text-[11px] md:text-lg truncate max-w-[90px] md:max-w-[150px] leading-tight">{top3[1].displayName}</p>
                            <Badge className="font-black text-[9px] md:text-xs uppercase bg-slate-400 text-white border-none py-0.5">
                                {formatTime(top3[1].displayMinutes)}
                            </Badge>
                        </div>
                    </>
                    )}
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center gap-4 md:gap-8 order-2">
                    {top3[0] && (
                    <>
                        <Link href={`/profile/${top3[0].uid}`} className="relative group scale-110 md:scale-125 -mt-12 md:-mt-20 block transition-all hover:scale-[1.3] active:scale-110">
                            <div className="absolute -inset-3 bg-yellow-400 rounded-full blur opacity-40 animate-pulse" />
                            <Avatar className="h-24 w-24 sm:h-28 sm:w-28 md:h-44 md:w-44 border-4 border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.3)] relative">
                                <AvatarImage src={top3[0].photoURL || undefined} />
                                <AvatarFallback className="text-2xl font-black">{getInitials(top3[0].displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -top-8 md:-top-14 left-1/2 -translate-x-1/2">
                                <Crown className="h-10 w-10 md:h-16 md:w-16 text-yellow-500 fill-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                            </div>
                            {top3[0].isLive && (
                              <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-pulse shadow-2xl z-20 border-2 border-background">LIVE</div>
                            )}
                        </Link>
                        <div className="text-center px-1 space-y-2">
                            <p className="font-black text-sm md:text-2xl truncate max-w-[110px] md:max-w-[200px] leading-tight">{top3[0].displayName}</p>
                            <Badge className="font-black text-[10px] md:text-lg uppercase bg-yellow-500 hover:bg-yellow-600 px-3 md:px-6 py-1 md:py-1.5 shadow-lg shadow-yellow-500/20">
                                {formatTime(top3[0].displayMinutes)}
                            </Badge>
                        </div>
                    </>
                    )}
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center gap-4 pb-4 order-3">
                    {top3[2] && (
                    <>
                        <Link href={`/profile/${top3[2].uid}`} className="relative group block transition-all hover:scale-105 active:scale-95">
                            <div className="absolute -inset-2 bg-amber-600 rounded-full blur opacity-25" />
                            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-36 md:w-36 border-4 border-amber-600 shadow-2xl relative">
                                <AvatarImage src={top3[2].photoURL || undefined} />
                                <AvatarFallback className="text-xl font-black">{getInitials(top3[2].displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-2 -right-2 bg-amber-500 rounded-full p-2 md:p-3 border-2 border-amber-700 shadow-xl">
                                <Medal className="h-5 w-5 md:h-7 md:w-7 text-amber-900" />
                            </div>
                            {top3[2].isLive && (
                              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black px-3 py-1 rounded-full animate-bounce shadow-xl z-20 border-2 border-background">LIVE</div>
                            )}
                        </Link>
                        <div className="text-center px-1 space-y-1">
                            <p className="font-black text-[11px] md:text-lg truncate max-w-[90px] md:max-w-[150px] leading-tight">{top3[2].displayName}</p>
                            <Badge className="font-black text-[9px] md:text-xs uppercase bg-amber-700 text-white border-none py-0.5">
                                {formatTime(top3[2].displayMinutes)}
                            </Badge>
                        </div>
                    </>
                    )}
                </div>
              </div>

              {/* Ranking List */}
              <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-card/80 backdrop-blur-xl border border-primary/5">
                <div className="p-5 md:p-8 bg-primary text-white flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-xs md:text-sm uppercase tracking-[0.2em]">The Hustle Squad</h3>
                      <p className="text-[10px] text-white/60 font-bold uppercase mt-1">Ranking for the current {timeFilter} period</p>
                    </div>
                    <div className="text-[10px] font-black text-white/80 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                        <Wifi className="h-3.5 w-3.5 text-red-400 animate-pulse" /> Live Tracker Active
                    </div>
                </div>
                <ScrollArea className="h-[500px] md:h-[700px]">
                    <div className="divide-y divide-primary/5">
                        {rankings.map((contender: any, idx) => {
                            const currentMinutes = contender.displayMinutes || 0;
                            const userGuildName = contender.groupId ? groupMap[contender.groupId] : null;

                            return (
                                <Link 
                                    key={contender.uid} 
                                    href={`/profile/${contender.uid}`}
                                    className={cn(
                                        "flex items-center justify-between p-4 md:p-6 hover:bg-primary/5 transition-all group",
                                        contender.uid === user?.uid ? "bg-primary/10 ring-2 ring-inset ring-primary/20" : ""
                                    )}
                                >
                                    <div className="flex items-center gap-4 md:gap-8 min-w-0">
                                        <div className="w-8 md:w-12 text-center font-black text-sm md:text-2xl text-muted-foreground/30 font-mono italic">
                                            {(idx + 1).toString().padStart(2, '0')}
                                        </div>
                                        <div className="relative">
                                            <Avatar className="h-12 w-12 md:h-16 md:w-16 border-2 border-background shadow-lg transition-transform group-hover:scale-110">
                                                <AvatarImage src={contender.photoURL || undefined} />
                                                <AvatarFallback className="font-black">{getInitials(contender.displayName)}</AvatarFallback>
                                            </Avatar>
                                            {contender.isLive && (
                                                <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-red-600 rounded-full border-2 border-background flex items-center justify-center shadow-lg">
                                                    <div className="h-2 w-2 bg-white rounded-full animate-ping" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-black text-base md:text-xl truncate group-hover:text-primary transition-colors tracking-tight">{contender.displayName}</p>
                                                {contender.uid === user?.uid && (
                                                    <Badge className="text-[8px] md:text-[9px] h-4 font-black bg-primary text-white border-none px-2">YOU</Badge>
                                                )}
                                                {contender.isLive && (
                                                    <span className="text-[7px] md:text-[8px] font-black text-red-600 uppercase tracking-widest bg-red-600/10 px-2 py-0.5 rounded-full border border-red-600/20 animate-pulse">Studying</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline" className="text-[9px] md:text-[10px] font-black tracking-tighter uppercase px-2 h-5 md:h-6 border-primary/20 bg-primary/5 text-primary">
                                                    {contender.category || 'SSC'} {contender.batch || ''}
                                                </Badge>
                                                {userGuildName && (
                                                  <Badge className="text-[9px] md:text-[10px] font-black uppercase tracking-tighter px-2 h-5 md:h-6 bg-indigo-500 text-white flex items-center gap-1 border-none">
                                                     <Users2 className="h-2.5 w-2.5" /> {userGuildName}
                                                  </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right shrink-0">
                                            <p className="font-black text-lg md:text-3xl tracking-tighter text-primary leading-none">
                                                {formatTime(currentMinutes)}
                                            </p>
                                            <p className="text-[9px] md:text-[11px] font-black text-muted-foreground uppercase tracking-widest mt-1 opacity-50">
                                              {timeFilter === 'yearly' ? 'Season' : timeFilter} Total
                                            </p>
                                        </div>
                                        <div className="p-2 bg-secondary/50 rounded-full opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0 hidden sm:block">
                                          <ArrowRight className="h-5 w-5 text-primary" />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </ScrollArea>
              </Card>
            </div>
          ) : (
            <div className="text-center py-32 bg-secondary/20 rounded-[3rem] border-4 border-dashed border-primary/10">
                <div className="bg-primary/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-12 w-12 text-primary/30" />
                </div>
                <h3 className="text-3xl font-black tracking-tighter">Waiting for the hustle...</h3>
                <p className="text-muted-foreground max-w-md mx-auto mt-3 font-medium">No records found for this category in the {timeFilter} period. Start your session now to claim the throne!</p>
                <Button className="mt-8 rounded-2xl h-14 px-10 font-black text-lg shadow-xl shadow-primary/20" asChild>
                  <Link href="/todo">Launch Session</Link>
                </Button>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
