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
import { Trophy, Medal, Crown, Clock, Users2, ArrowRight, Wifi, Sparkles, Filter, List } from 'lucide-react';
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
      <div className="min-h-screen bg-card text-card-foreground">
        <Header />
        <main className="p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Header Section (Matching Profile Style) */}
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="p-0 pb-6 flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl font-bold tracking-tight">Hustle Standings</CardTitle>
                  </div>
                  <CardDescription className="text-sm font-medium">
                    Global student rankings based on academic study hours.
                  </CardDescription>
                </div>
                <div className="hidden sm:flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                   <Wifi className="h-3.5 w-3.5 text-primary animate-pulse" />
                   <span className="text-[10px] font-black uppercase text-primary tracking-widest">Live Sync</span>
                </div>
              </CardHeader>
            </Card>

            {/* Filter Section Card */}
            <Card className="rounded-2xl border shadow-sm">
              <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                        <SelectTrigger className="h-10 w-full md:w-[180px] rounded-xl">
                            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Categories</SelectItem>
                            <SelectItem value="SSC">SSC</SelectItem>
                            <SelectItem value="HSC">HSC</SelectItem>
                            <SelectItem value="Admission 1st">Admission 1st</SelectItem>
                            <SelectItem value="Admission 2nd">Admission 2nd</SelectItem>
                            <SelectItem value="Job Prep">Job Prep</SelectItem>
                            <SelectItem value="University">University</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={batchFilter} onValueChange={setBatchFilter}>
                        <SelectTrigger className="h-10 w-full md:w-[120px] rounded-xl">
                            <SelectValue placeholder="Batch" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Batches</SelectItem>
                            {YEARS.map(year => (
                              <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full md:w-auto">
                  <TabsList className="grid grid-cols-4 bg-secondary/50 p-1 rounded-xl h-11 w-full md:min-w-[320px]">
                    <TabsTrigger value="daily" className="rounded-lg font-bold text-xs">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="rounded-lg font-bold text-xs">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="rounded-lg font-bold text-xs">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="rounded-lg font-bold text-xs">Yearly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {loading ? (
              <div className="space-y-6">
                 <div className="grid grid-cols-3 gap-6"><Skeleton className="h-40 rounded-2xl"/><Skeleton className="h-48 rounded-2xl"/><Skeleton className="h-40 rounded-2xl"/></div>
                 <Skeleton className="h-24 w-full rounded-2xl" />
                 <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : rankings && rankings.length > 0 ? (
              <div className="space-y-8">
                
                {/* Structured Podium (Matching Profile/Dashboard Style) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 2nd Place */}
                  {top3[1] && (
                    <div className="order-2 md:order-1">
                      <PodiumCard user={top3[1]} rank={2} color="bg-slate-100 text-slate-600" icon={<Medal className="h-5 w-5" />} time={formatTime(top3[1].displayMinutes)} />
                    </div>
                  )}
                  {/* 1st Place */}
                  {top3[0] && (
                    <div className="order-1 md:order-2 scale-105">
                      <PodiumCard user={top3[0]} rank={1} color="bg-yellow-100 text-yellow-600" icon={<Crown className="h-6 w-6" />} time={formatTime(top3[0].displayMinutes)} isWinner />
                    </div>
                  )}
                  {/* 3rd Place */}
                  {top3[2] && (
                    <div className="order-3">
                      <PodiumCard user={top3[2]} rank={3} color="bg-orange-100 text-orange-600" icon={<Medal className="h-5 w-5" />} time={formatTime(top3[2].displayMinutes)} />
                    </div>
                  )}
                </div>

                {/* Main Directory List */}
                <Card className="rounded-[1.5rem] border shadow-sm overflow-hidden">
                  <div className="p-5 border-b bg-secondary/10 flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                       <List className="h-4 w-4" /> Hustle Directory
                    </h3>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter">
                      {rankings.length} Students Tracked
                    </Badge>
                  </div>
                  
                  <div className="divide-y">
                    {rankings.map((contender: any, idx) => {
                      const userGuildName = contender.groupId ? groupMap[contender.groupId] : null;
                      const isMe = contender.uid === user?.uid;

                      return (
                        <Link 
                          key={contender.uid} 
                          href={`/profile/${contender.uid}`}
                          className={cn(
                            "flex items-center justify-between p-4 md:p-6 hover:bg-secondary/20 transition-all group",
                            isMe && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="w-6 text-center font-bold text-sm text-muted-foreground/40 italic">
                               {idx + 1}
                            </span>
                            <div className="relative">
                              <Avatar className="h-10 w-10 md:h-12 md:w-12 border">
                                <AvatarImage src={contender.photoURL || undefined} />
                                <AvatarFallback className="font-bold text-xs">{contender.displayName?.[0]}</AvatarFallback>
                              </Avatar>
                              {contender.isLive && (
                                <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-red-600 rounded-full border-2 border-background flex items-center justify-center">
                                  <div className="h-1.5 w-1.5 bg-white rounded-full animate-ping" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="font-bold text-sm md:text-base truncate group-hover:text-primary transition-colors tracking-tight">{contender.displayName}</p>
                                    {isMe && <Badge className="text-[7px] font-black bg-primary h-3.5 border-none">YOU</Badge>}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary" className="text-[8px] h-4 font-bold uppercase tracking-tight">
                                        {contender.category || 'SSC'} {contender.batch || ''}
                                    </Badge>
                                    {userGuildName && (
                                      <Badge variant="outline" className="text-[8px] h-4 uppercase tracking-tight flex items-center gap-1 border-primary/20 text-primary">
                                         <Users2 className="h-2 w-2" /> {userGuildName}
                                      </Badge>
                                    )}
                                </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right shrink-0">
                                <p className="font-bold text-lg md:text-xl text-primary leading-none">
                                    {formatTime(contender.displayMinutes)}
                                </p>
                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mt-1">
                                  {timeFilter} Total
                                </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="rounded-3xl border-2 border-dashed bg-secondary/5 py-24 text-center">
                <CardContent className="space-y-4">
                  <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-8 w-8 text-primary/30" />
                  </div>
                  <h3 className="text-xl font-bold">No Rankings Available</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">Start your session now to claim the first spot in this category!</p>
                  <Button className="rounded-xl px-8 h-11 font-bold" asChild>
                    <Link href="/todo">Launch Mission</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function PodiumCard({ 
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
    <Card className={cn(
      "rounded-[1.5rem] border shadow-sm transition-all hover:border-primary/30",
      isWinner ? "border-primary/40 bg-primary/[0.02]" : "bg-card"
    )}>
      <Link href={`/profile/${user.uid}`} className="p-5 flex flex-col items-center text-center gap-3">
        <div className="relative">
          <Avatar className={cn(
            "border-2 transition-all",
            isWinner ? "h-16 w-16 border-yellow-400" : "h-14 w-14 border-border"
          )}>
            <AvatarImage src={user.photoURL || undefined} />
            <AvatarFallback className="font-bold">{user.displayName?.[0]}</AvatarFallback>
          </Avatar>
          <div className={cn(
            "absolute -bottom-1 -right-1 rounded-full p-1 border-2 shadow-sm z-10",
            rank === 1 ? "bg-yellow-400 border-white text-white" : "bg-card border-border"
          )}>
            {icon}
          </div>
          {user.isLive && (
             <span className="absolute -top-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full animate-pulse border-2 border-background">LIVE</span>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="font-bold text-sm truncate max-w-[140px] tracking-tight">{user.displayName}</p>
          <Badge className={cn(
            "font-black uppercase text-[10px] tracking-widest px-3 h-6 border-none",
            rank === 1 ? "bg-primary text-white" : "bg-secondary text-foreground"
          )}>
            {time}
          </Badge>
          <div className="flex items-center justify-center gap-1 mt-1 opacity-50">
             <span className="text-[8px] font-black uppercase tracking-tighter">{user.category} {user.batch}</span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
