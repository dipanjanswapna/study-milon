'use client';

import { useMemo, useState } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Trophy, Medal, Crown, Star, Filter, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type TimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CategoryFilter = 'All' | 'SSC' | 'HSC' | 'Admission' | 'Job Prep';

export default function LeaderboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('daily');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [batchFilter, setBatchFilter] = useState<string>('All');

  // Fetch top 100 based on total study minutes to avoid index errors with multiple orderBys
  // We'll handle the 'daily' sort and specific filters on the client side for maximum reliability
  const leaderboardQuery = useMemo(() => {
    return query(
      collection(firestore, 'users'),
      orderBy('total_study_minutes', 'desc'),
      limit(100)
    );
  }, [firestore]);

  const { data: allRankings, loading } = useCollection(leaderboardQuery);

  // Apply filters and specific time-sort client-side
  const rankings = useMemo(() => {
    if (!allRankings) return [];
    
    let filtered = allRankings.filter(u => {
      const matchCategory = categoryFilter === 'All' || u.category === categoryFilter;
      const matchBatch = batchFilter === 'All' || u.batch === batchFilter;
      return matchCategory && matchBatch;
    });

    // If daily is selected, sort the current set by daily minutes
    if (timeFilter === 'daily') {
      filtered = [...filtered].sort((a, b) => (b.daily_study_minutes || 0) - (a.daily_study_minutes || 0));
    }

    return filtered.slice(0, 50); // Show top 50 within the filtered set
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
          
          {/* Header & Filtering Section */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-2">
                    <Trophy className="h-8 w-8 text-primary" />
                    Hustle Leaderboard
                </h1>
                <p className="text-muted-foreground text-sm font-medium">Ranked by actual study hours. No points, just focus.</p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-xl border w-full sm:w-auto">
                    <Filter className="h-4 w-4 ml-2 text-muted-foreground hidden sm:block" />
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                        <SelectTrigger className="w-full sm:w-[130px] h-9 border-none bg-transparent focus:ring-0">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Categories</SelectItem>
                            <SelectItem value="SSC">SSC</SelectItem>
                            <SelectItem value="HSC">HSC</SelectItem>
                            <SelectItem value="Admission">Admission</SelectItem>
                            <SelectItem value="Job Prep">Job Prep</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)} className="w-full sm:w-auto">
                    <TabsList className="bg-secondary/50 h-11 p-1 rounded-xl w-full grid grid-cols-4 sm:flex">
                        <TabsTrigger value="daily" className="rounded-lg font-bold px-2 sm:px-4 text-xs sm:text-sm">Daily</TabsTrigger>
                        <TabsTrigger value="weekly" className="rounded-lg font-bold px-2 sm:px-4 text-xs sm:text-sm">Weekly</TabsTrigger>
                        <TabsTrigger value="monthly" className="rounded-lg font-bold px-2 sm:px-4 text-xs sm:text-sm">Monthly</TabsTrigger>
                        <TabsTrigger value="yearly" className="rounded-lg font-bold px-2 sm:px-4 text-xs sm:text-sm">Yearly</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
          </div>

          {loading ? (
             <div className="space-y-4">
                <Skeleton className="h-64 w-full rounded-[2rem]" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
             </div>
          ) : rankings && rankings.length > 0 ? (
            <div className="space-y-10">
              
              {/* Top 3 Podium - Responsive Grid */}
              <div className="grid grid-cols-3 items-end gap-2 md:gap-8 px-0 md:px-10 pt-12 md:pt-16">
                {/* 2nd Place */}
                <div className="flex flex-col items-center gap-2 md:gap-4 pb-2 md:pb-4 order-1">
                    {top3[1] && (
                    <>
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-slate-300 rounded-full blur opacity-25" />
                            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 md:h-28 md:w-28 border-4 border-slate-300 shadow-xl relative">
                                <AvatarImage src={top3[1].photoURL} />
                                <AvatarFallback>{getInitials(top3[1].displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 bg-slate-200 rounded-full p-1.5 md:p-2 border-2 border-slate-400 shadow-lg">
                                <Medal className="h-4 w-4 md:h-5 md:w-5 text-slate-500" />
                            </div>
                        </div>
                        <div className="text-center px-1">
                            <p className="font-black text-[10px] md:text-base truncate max-w-[80px] md:max-w-[120px]">{top3[1].displayName}</p>
                            <p className="text-primary font-black text-[10px] md:text-xs uppercase">
                                {formatTime(timeFilter === 'daily' ? top3[1].daily_study_minutes : top3[1].total_study_minutes)}
                            </p>
                        </div>
                    </>
                    )}
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center gap-3 md:gap-6 order-2">
                    {top3[0] && (
                    <>
                        <div className="relative group scale-110 md:scale-125 -mt-10 md:-mt-16">
                            <div className="absolute -inset-2 bg-yellow-400 rounded-full blur opacity-40 animate-pulse" />
                            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 md:h-36 md:w-36 border-4 border-yellow-400 shadow-2xl relative">
                                <AvatarImage src={top3[0].photoURL} />
                                <AvatarFallback>{getInitials(top3[0].displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -top-6 md:-top-10 left-1/2 -translate-x-1/2">
                                <Crown className="h-8 w-8 md:h-12 md:w-12 text-yellow-500 fill-yellow-500 drop-shadow-lg" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-yellow-400 rounded-full p-2 md:p-3 border-2 border-yellow-600 shadow-lg">
                                <Trophy className="h-5 w-5 md:h-7 md:w-7 text-white" />
                            </div>
                        </div>
                        <div className="text-center px-1">
                            <p className="font-black text-xs md:text-xl truncate max-w-[100px] md:max-w-[150px]">{top3[0].displayName}</p>
                            <Badge className="font-black text-[10px] md:text-sm uppercase bg-yellow-500 hover:bg-yellow-600 px-2 md:px-4 py-0 md:py-1">
                                {formatTime(timeFilter === 'daily' ? top3[0].daily_study_minutes : top3[0].total_study_minutes)}
                            </Badge>
                        </div>
                    </>
                    )}
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center gap-2 md:gap-4 pb-2 md:pb-4 order-3">
                    {top3[2] && (
                    <>
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-amber-600 rounded-full blur opacity-25" />
                            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 md:h-28 md:w-28 border-4 border-amber-600 shadow-xl relative">
                                <AvatarImage src={top3[2].photoURL} />
                                <AvatarFallback>{getInitials(top3[2].displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 bg-amber-500 rounded-full p-1.5 md:p-2 border-2 border-amber-700 shadow-lg">
                                <Medal className="h-4 w-4 md:h-5 md:w-5 text-amber-900" />
                            </div>
                        </div>
                        <div className="text-center px-1">
                            <p className="font-black text-[10px] md:text-base truncate max-w-[80px] md:max-w-[120px]">{top3[2].displayName}</p>
                            <p className="text-primary font-black text-[10px] md:text-xs uppercase">
                                {formatTime(timeFilter === 'daily' ? top3[2].daily_study_minutes : top3[2].total_study_minutes)}
                            </p>
                        </div>
                    </>
                    )}
                </div>
              </div>

              {/* Ranking List */}
              <div className="bg-card rounded-[2rem] shadow-xl overflow-hidden border">
                <div className="p-4 md:p-6 bg-secondary/30 border-b flex justify-between items-center">
                    <h3 className="font-black text-[10px] md:text-sm uppercase tracking-widest text-muted-foreground">The Contenders</h3>
                    <div className="text-[9px] md:text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Updated Live
                    </div>
                </div>
                <ScrollArea className="h-[400px] md:h-[600px]">
                    <div className="divide-y">
                        {rankings.map((contender: any, idx) => {
                            const currentMinutes = timeFilter === 'daily' ? contender.daily_study_minutes : contender.total_study_minutes;
                            return (
                                <div 
                                    key={contender.uid} 
                                    className={cn(
                                        "flex items-center justify-between p-3 md:p-5 hover:bg-secondary/20 transition-all",
                                        contender.uid === user?.uid ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                                    )}
                                >
                                    <div className="flex items-center gap-3 md:gap-6 min-w-0">
                                        <div className="w-6 md:w-10 text-center font-black text-sm md:text-xl text-muted-foreground/60 italic">
                                            {idx + 1}
                                        </div>
                                        <div className="relative">
                                            <Avatar className="h-10 w-10 md:h-14 md:w-14 border-2 border-background shadow-sm">
                                                <AvatarImage src={contender.photoURL} />
                                                <AvatarFallback>{getInitials(contender.displayName)}</AvatarFallback>
                                            </Avatar>
                                            {idx < 10 && (
                                                <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-md">
                                                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-sm md:text-lg truncate">{contender.displayName}</p>
                                                {contender.uid === user?.uid && (
                                                    <Badge variant="outline" className="text-[8px] md:text-[9px] h-4 font-black bg-primary/10 text-primary border-primary/20 px-1.5">YOU</Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary" className="text-[8px] md:text-[10px] font-bold tracking-tighter uppercase px-1.5 h-4 md:h-5">
                                                    {contender.category || 'SSC'} {contender.batch || ''}
                                                </Badge>
                                                <span className="text-[9px] md:text-[11px] text-muted-foreground font-medium hidden sm:inline">
                                                    Consistency: High 🔥
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-sm md:text-2xl tracking-tighter text-primary">
                                            {formatTime(currentMinutes)}
                                        </p>
                                        <p className="text-[8px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Studied</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
              </div>

              {/* Motivation Banner */}
              <Card className="bg-primary/5 border-primary/20 rounded-[2rem] overflow-hidden">
                <CardContent className="p-6 md:p-10 flex flex-col md:flex-row items-center gap-6">
                    <div className="p-4 bg-primary/10 rounded-full shrink-0">
                        <Trophy className="h-10 w-10 text-primary" />
                    </div>
                    <div className="text-center md:text-left space-y-2">
                        <h4 className="text-xl md:text-2xl font-black tracking-tight">Focus on the Hustle</h4>
                        <p className="text-muted-foreground font-medium max-w-2xl">
                            যখন আপনি দেখবেন আপনার ব্যাচের অন্য কেউ আপনার চেয়ে ২ ঘণ্টা বেশি পড়ছে, তখন আপনার নিজের মধ্যে আরও পড়ার আগ্রহ তৈরি হবে। এটাই আসল সাফল্য।
                        </p>
                    </div>
                </CardContent>
              </Card>

            </div>
          ) : (
            <div className="text-center py-24 bg-secondary/20 rounded-[2rem] border-2 border-dashed">
                <Clock className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-2xl font-black">No hustle recorded yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mt-2">Start your first study session to climb the global rankings!</p>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
