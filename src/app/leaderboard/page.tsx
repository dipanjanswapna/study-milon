'use client';

import { useMemo, useState } from 'react';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
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
import { Trophy, Medal, Crown, Star, Loader2, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

type TimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CategoryFilter = 'All' | 'SSC' | 'HSC' | 'Admission' | 'Job Prep';

export default function LeaderboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('monthly');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [batchFilter, setBatchFilter] = useState<string>('All');

  const leaderboardQuery = useMemo(() => {
    let q = query(
      collection(firestore, 'users'),
      orderBy('points', 'desc'),
      limit(50)
    );

    if (categoryFilter !== 'All') {
      q = query(q, where('category', '==', categoryFilter));
    }
    
    if (batchFilter !== 'All' && batchFilter.trim() !== '') {
        q = query(q, where('batch', '==', batchFilter));
    }

    return q;
  }, [firestore, categoryFilter, batchFilter]);

  const { data: rankings, loading } = useCollection(leaderboardQuery);

  const top3 = rankings?.slice(0, 3) || [];
  const others = rankings?.slice(3) || [];

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Crown className="h-6 w-6 text-yellow-500 fill-yellow-500" />;
      case 1: return <Medal className="h-6 w-6 text-slate-400 fill-slate-400" />;
      case 2: return <Medal className="h-6 w-6 text-amber-600 fill-amber-600" />;
      default: return null;
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
          
          {/* Filtering Section */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
                <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
                    <Trophy className="h-8 w-8 text-primary" />
                    Global Leaderboard
                </h1>
                <p className="text-muted-foreground text-sm font-medium">Rankings updated in real-time based on activity.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-xl border">
                    <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
                    <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                        <SelectTrigger className="w-[120px] h-9 border-none bg-transparent focus:ring-0">
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
                    <TabsList className="bg-secondary/50 h-11 p-1 rounded-xl">
                        <TabsTrigger value="daily" className="rounded-lg font-bold px-4">Daily</TabsTrigger>
                        <TabsTrigger value="weekly" className="rounded-lg font-bold px-4">Weekly</TabsTrigger>
                        <TabsTrigger value="monthly" className="rounded-lg font-bold px-4">Monthly</TabsTrigger>
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
              
              {/* Top 3 Podium */}
              <div className="grid grid-cols-3 items-end gap-2 md:gap-6 px-2 md:px-10 pt-10">
                {/* 2nd Place */}
                {top3[1] && (
                  <div className="flex flex-col items-center gap-3 pb-4">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-slate-300 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                        <Avatar className="h-20 w-20 md:h-28 md:w-28 border-4 border-slate-300 shadow-xl relative">
                            <AvatarImage src={top3[1].photoURL} />
                            <AvatarFallback>{getInitials(top3[1].displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 bg-slate-200 rounded-full p-2 border-2 border-slate-400 shadow-lg">
                            <Medal className="h-5 w-5 text-slate-500" />
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="font-black text-sm md:text-base truncate max-w-[100px]">{top3[1].displayName}</p>
                        <Badge variant="secondary" className="font-bold text-[10px] uppercase">{top3[1].points} pts</Badge>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {top3[0] && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative group scale-110 -mt-10">
                        <div className="absolute -inset-2 bg-yellow-400 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-pulse" />
                        <Avatar className="h-24 w-24 md:h-36 md:w-36 border-4 border-yellow-400 shadow-2xl relative">
                            <AvatarImage src={top3[0].photoURL} />
                            <AvatarFallback>{getInitials(top3[0].displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                            <Crown className="h-10 w-10 text-yellow-500 fill-yellow-500 drop-shadow-lg" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-yellow-400 rounded-full p-2.5 border-2 border-yellow-600 shadow-lg">
                            <Trophy className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="font-black text-lg md:text-xl truncate max-w-[120px]">{top3[0].displayName}</p>
                        <Badge className="font-black text-xs uppercase bg-yellow-500 hover:bg-yellow-600 px-3">{top3[0].points} pts</Badge>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {top3[2] && (
                  <div className="flex flex-col items-center gap-3 pb-4">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-amber-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                        <Avatar className="h-20 w-20 md:h-28 md:w-28 border-4 border-amber-600 shadow-xl relative">
                            <AvatarImage src={top3[2].photoURL} />
                            <AvatarFallback>{getInitials(top3[2].displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 bg-amber-500 rounded-full p-2 border-2 border-amber-700 shadow-lg">
                            <Medal className="h-5 w-5 text-amber-900" />
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="font-black text-sm md:text-base truncate max-w-[100px]">{top3[2].displayName}</p>
                        <Badge variant="secondary" className="font-bold text-[10px] uppercase">{top3[2].points} pts</Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Ranking List */}
              <div className="bg-card rounded-[2rem] shadow-xl overflow-hidden border">
                <div className="p-6 bg-secondary/30 border-b flex justify-between items-center">
                    <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">The Contenders</h3>
                    <div className="text-[10px] font-bold text-muted-foreground">Showing top 50 users</div>
                </div>
                <ScrollArea className="h-[500px]">
                    <div className="divide-y">
                        {rankings.map((contender, idx) => (
                            <div 
                                key={contender.uid} 
                                className={cn(
                                    "flex items-center justify-between p-4 hover:bg-secondary/20 transition-all",
                                    contender.uid === user?.uid ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-8 text-center font-black text-lg text-muted-foreground">
                                        {idx + 1}.
                                    </div>
                                    <Avatar className="h-12 w-12 border">
                                        <AvatarImage src={contender.photoURL} />
                                        <AvatarFallback>{getInitials(contender.displayName)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm">{contender.displayName}</p>
                                            {idx < 10 && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                            {contender.uid === user?.uid && (
                                                <Badge variant="outline" className="text-[9px] h-4 font-black bg-primary/10 text-primary border-primary/20">YOU</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[9px] font-bold tracking-tighter uppercase px-1.5 h-4">
                                                {contender.category || 'SSC'} {contender.batch || ''}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                {contender.total_study_minutes || 0} mins studied
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-lg tracking-tighter text-primary">{contender.points.toLocaleString()}</p>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Points</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
              </div>

            </div>
          ) : (
            <div className="text-center py-20 bg-secondary/20 rounded-[2rem] border-2 border-dashed">
                <Trophy className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-bold">No rankings available yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">Start studying and completing chapters to earn points and appear on the leaderboard!</p>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
