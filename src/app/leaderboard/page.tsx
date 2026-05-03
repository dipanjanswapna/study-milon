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
import { Trophy, Medal, Crown, Clock, Users2, ArrowRight, Wifi, Sparkles, Filter } from 'lucide-react';
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
      
      // Verification logic for resets
      if (timeFilter === 'daily' && u.last_study_day !== todayStr) currentVal = 0;
      if (timeFilter === 'weekly' && u.last_study_week !== weekStr) currentVal = 0;
      if (timeFilter === 'monthly' && u.last_study_month !== monthStr) currentVal = 0;
      if (timeFilter === 'yearly' && u.last_study_year !== yearStr) currentVal = 0;

      // Live Status
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
      <div className="min-h-screen bg-background text-foreground pb-24 md:pb-12">
        <Header />
        <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-10">
          
          {/* Page Title & Desktop Filters */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center lg:text-left space-y-2">
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter flex items-center justify-center lg:justify-start gap-4 text-foreground">
                    <Trophy className="h-10 w-10 md:h-14 md:w-14 text-primary shrink-0" />
                    Hustle Standings
                </h1>
                <p className="text-muted-foreground text-xs md:text-sm font-black uppercase tracking-[0.3em] flex items-center justify-center lg:justify-start gap-2">
                   <Sparkles className="h-4 w-4 text-primary" />
                   Competitive Academic Excellence
                </p>
            </div>
            
            {/* Filter Section */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto bg-card border rounded-2xl p-1.5 shadow-sm">
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                        <SelectTrigger className="h-9 border-none bg-transparent focus:ring-0 font-bold text-xs">
                            <Filter className="h-3.5 w-3.5 mr-2 text-primary" />
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                            <SelectItem value="All">All Categories</SelectItem>
                            <SelectItem value="SSC">SSC</SelectItem>
                            <SelectItem value="HSC">HSC</SelectItem>
                            <SelectItem value="Admission 1st">Admission 1st</SelectItem>
                            <SelectItem value="Admission 2nd">Admission 2nd</SelectItem>
                            <SelectItem value="Job Prep">Job Prep</SelectItem>
                            <SelectItem value="University">University</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="h-4 w-px bg-border mx-1" />

                    <Select value={batchFilter} onValueChange={setBatchFilter}>
                        <SelectTrigger className="h-9 border-none bg-transparent focus:ring-0 font-bold text-xs w-[100px]">
                            <SelectValue placeholder="Batch" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                            <SelectItem value="All">All Batches</SelectItem>
                            {YEARS.map(year => (
                              <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full sm:w-auto">
                    <TabsList className="bg-card border h-12 p-1 rounded-2xl w-full grid grid-cols-4 sm:flex shadow-sm">
                        <TabsTrigger value="daily" className="rounded-xl font-black px-2 sm:px-5 text-[10px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Daily</TabsTrigger>
                        <TabsTrigger value="weekly" className="rounded-xl font-black px-2 sm:px-5 text-[10px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Weekly</TabsTrigger>
                        <TabsTrigger value="monthly" className="rounded-xl font-black px-2 sm:px-5 text-[10px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Monthly</TabsTrigger>
                        <TabsTrigger value="yearly" className="rounded-xl font-black px-2 sm:px-5 text-[10px] uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">Yearly</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
          </div>

          {loading ? (
             <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6 h-64"><Skeleton className="rounded-[3rem]"/><Skeleton className="rounded-[3rem] h-80 -mt-8"/><Skeleton className="rounded-[3rem]"/></div>
                <Skeleton className="h-24 w-full rounded-3xl" />
                <Skeleton className="h-24 w-full rounded-3xl" />
             </div>
          ) : rankings && rankings.length > 0 ? (
            <div className="space-y-16">
              
              {/* Responsive Podium */}
              <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-4 lg:gap-12 pt-20 px-4">
                
                {/* 2nd Place */}
                {top3[1] && (
                  <div className="flex flex-col items-center gap-4 w-full md:w-auto order-2 md:order-1">
                      <PodiumMember 
                        user={top3[1]} 
                        rank={2} 
                        color="bg-slate-300" 
                        icon={<Medal className="h-6 w-6 text-slate-600" />}
                        time={formatTime(top3[1].displayMinutes)}
                      />
                  </div>
                )}

                {/* 1st Place */}
                {top3[0] && (
                  <div className="flex flex-col items-center gap-6 w-full md:w-auto order-1 md:order-2 -mt-16 md:-mt-24 scale-110 lg:scale-125 z-10">
                      <PodiumMember 
                        user={top3[0]} 
                        rank={1} 
                        color="bg-yellow-400" 
                        icon={<Crown className="h-8 w-8 text-yellow-700 fill-current" />}
                        time={formatTime(top3[0].displayMinutes)}
                        isWinner
                      />
                  </div>
                )}

                {/* 3rd Place */}
                {top3[2] && (
                  <div className="flex flex-col items-center gap-4 w-full md:w-auto order-3">
                      <PodiumMember 
                        user={top3[2]} 
                        rank={3} 
                        color="bg-orange-400" 
                        icon={<Medal className="h-6 w-6 text-orange-700" />}
                        time={formatTime(top3[2].displayMinutes)}
                      />
                  </div>
                )}
              </div>

              {/* Main List */}
              <Card className="rounded-[2.5rem] border-none shadow-2xl bg-card overflow-hidden">
                <div className="p-6 md:p-8 bg-secondary/50 flex flex-col sm:flex-row justify-between items-center gap-4 border-b">
                    <div className="text-center sm:text-left">
                      <h3 className="font-black text-sm uppercase tracking-[0.2em] text-foreground">Global Ranking</h3>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Hustle Data: {timeFilter} cycle</p>
                    </div>
                    <div className="text-[10px] font-black text-primary flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
                        <Wifi className="h-3.5 w-3.5 animate-pulse" /> Live Tracker Active
                    </div>
                </div>
                
                <ScrollArea className="h-[600px] md:h-[700px]">
                    <div className="divide-y divide-border">
                        {rankings.map((contender: any, idx) => {
                            const userGuildName = contender.groupId ? groupMap[contender.groupId] : null;
                            const isMe = contender.uid === user?.uid;

                            return (
                                <Link 
                                    key={contender.uid} 
                                    href={`/profile/${contender.uid}`}
                                    className={cn(
                                        "flex items-center justify-between p-5 md:p-8 hover:bg-secondary/40 transition-all group",
                                        isMe && "bg-primary/[0.03] ring-1 ring-inset ring-primary/20"
                                    )}
                                >
                                    <div className="flex items-center gap-4 md:gap-8 min-w-0">
                                        <div className="w-8 md:w-10 text-center font-black text-base md:text-2xl text-muted-foreground/30 font-mono italic">
                                            {(idx + 1).toString().padStart(2, '0')}
                                        </div>
                                        <div className="relative">
                                            <Avatar className="h-12 w-12 md:h-16 md:w-16 border-2 border-background shadow-md transition-transform group-hover:scale-105">
                                                <AvatarImage src={contender.photoURL || undefined} />
                                                <AvatarFallback className="font-black text-xs">{contender.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            {contender.isLive && (
                                                <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-red-600 rounded-full border-2 border-card flex items-center justify-center shadow-lg">
                                                    <div className="h-2 w-2 bg-white rounded-full animate-ping" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex items-center flex-wrap gap-2">
                                                <p className="font-black text-base md:text-xl truncate group-hover:text-primary transition-colors tracking-tight">{contender.displayName}</p>
                                                {isMe && (
                                                    <Badge className="text-[8px] font-black bg-primary text-white border-none h-4">YOU</Badge>
                                                )}
                                                {contender.isLive && (
                                                    <span className="text-[7px] font-black text-red-600 uppercase tracking-widest bg-red-100 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">Studying</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary" className="text-[9px] font-black tracking-tight uppercase px-2 bg-secondary text-muted-foreground border-none">
                                                    {contender.category || 'SSC'} {contender.batch || ''}
                                                </Badge>
                                                {userGuildName && (
                                                  <Badge className="text-[9px] font-black uppercase tracking-tight px-2 bg-indigo-500/10 text-indigo-600 flex items-center gap-1 border-none">
                                                     <Users2 className="h-2.5 w-2.5" /> {userGuildName}
                                                  </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right shrink-0">
                                            <p className="font-black text-xl md:text-3xl tracking-tighter text-primary leading-none">
                                                {formatTime(contender.displayMinutes)}
                                            </p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">
                                              {timeFilter === 'yearly' ? 'Season' : timeFilter} Total
                                            </p>
                                        </div>
                                        <div className="p-2 bg-secondary/50 rounded-full opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 hidden sm:block">
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
            <div className="text-center py-32 bg-secondary/20 rounded-[3rem] border-4 border-dashed border-border/50">
                <div className="bg-primary/5 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Clock className="h-12 w-12 text-primary/30" />
                </div>
                <h3 className="text-3xl font-black tracking-tighter">Roadmap to Throne Empty</h3>
                <p className="text-muted-foreground max-w-md mx-auto mt-3 font-medium">Be the first to claim the throne in this category! Start your session now to log your hustle.</p>
                <Button className="mt-8 rounded-2xl h-14 px-10 font-black text-lg shadow-lg shadow-primary/20" asChild>
                  <Link href="/todo">Launch Mission</Link>
                </Button>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

function PodiumMember({ 
  user, 
  rank, 
  color, 
  icon, 
  time, 
  isWinner = false 
}: { 
  user: any; 
  rank: number; 
  color: string; 
  icon: React.ReactNode; 
  time: string;
  isWinner?: boolean;
}) {
  return (
    <Link href={`/profile/${user.uid}`} className={cn(
      "relative group block transition-all hover:scale-105 active:scale-95 w-full md:w-auto",
      isWinner ? "md:min-w-[220px]" : "md:min-w-[180px]"
    )}>
      <div className="flex flex-col items-center">
        <div className="relative mb-6">
            <div className={cn("absolute -inset-4 rounded-full blur-2xl opacity-10", color)} />
            <Avatar className={cn(
              "border-4 shadow-2xl relative transition-all group-hover:border-primary",
              isWinner ? "h-28 w-28 lg:h-44 lg:w-44 border-yellow-400" : "h-24 w-24 lg:h-36 lg:w-36 border-border"
            )}>
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback className="text-2xl font-black">{user.displayName?.[0]}</AvatarFallback>
            </Avatar>
            <div className={cn(
              "absolute -bottom-2 -right-2 rounded-full p-2 md:p-3 border-2 shadow-xl z-20 bg-card",
              isWinner ? "border-yellow-500" : "border-border"
            )}>
                {icon}
            </div>
            {user.isLive && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce shadow-2xl z-20 border-2 border-background">LIVE</div>
            )}
        </div>
        
        <div className="text-center px-1 space-y-2 w-full">
            <p className={cn(
              "font-black truncate max-w-[200px] mx-auto leading-tight",
              isWinner ? "text-lg lg:text-2xl" : "text-base lg:text-lg"
            )}>{user.displayName}</p>
            <Badge className={cn(
              "font-black uppercase shadow-sm px-4 py-1",
              isWinner ? "bg-yellow-500 text-white text-base lg:text-lg" : "bg-secondary text-foreground text-xs lg:text-sm"
            )}>
                {time}
            </Badge>
            <div className="flex items-center justify-center gap-1.5 opacity-60">
               <Badge variant="outline" className="text-[8px] font-black tracking-widest">{user.category} {user.batch}</Badge>
            </div>
        </div>
      </div>
    </Link>
  );
}
