'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, query } from 'firebase/firestore';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, BookOpen, UserCircle, ArrowRight, Loader2, CheckCircle2, Zap } from 'lucide-react';
import type { UserProfile } from '@/firebase/firestore/users';
import { cn } from '@/lib/utils';

interface ProfileSetupGateProps {
  children: React.ReactNode;
}

export function ProfileSetupGate({ children }: ProfileSetupGateProps) {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  // Fetch Profile
  const userRef = useMemo(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userRef as any);

  // Fetch Subjects (Roadmap)
  const subjectsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'subjects'));
  }, [user, firestore]);
  const { data: subjects, loading: subjectsLoading } = useCollection(subjectsQuery);

  const isLoading = authLoading || profileLoading || subjectsLoading;

  const isProfileComplete = !!profile?.category && !!profile?.batch;
  const isRoadmapComplete = subjects && subjects.length > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Syncing Academic Status...</p>
      </div>
    );
  }

  if (!isProfileComplete || !isRoadmapComplete) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-card transition-all">
          <CardHeader className="bg-[#1A1C3D] text-white text-center py-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12">
              <BrainCircuit className="h-32 w-32" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="mx-auto bg-primary/20 backdrop-blur-lg p-4 rounded-3xl w-fit shadow-xl border border-white/10">
                <BrainCircuit className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-3xl font-black tracking-tighter uppercase">Setup Required</CardTitle>
                <CardDescription className="text-white/60 font-medium text-sm">
                  Complete your academic sequence to unlock the full potential of Study Milon.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-8 space-y-8">
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Initialization Checklist</p>
              
              <div className={cn(
                "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-500",
                isProfileComplete 
                  ? "bg-primary/[0.03] border-primary/20 shadow-sm" 
                  : "bg-secondary/20 border-dashed border-muted-foreground/20"
              )}>
                <div className={cn(
                  "p-3 rounded-xl transition-colors",
                  isProfileComplete ? "bg-primary text-white" : "bg-muted text-muted-foreground/40"
                )}>
                  <UserCircle className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("font-black text-sm uppercase tracking-tight", isProfileComplete ? "text-primary" : "text-muted-foreground")}>
                      Academic Profile
                    </p>
                    {isProfileComplete && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    {isProfileComplete ? 'Identity Secured' : 'Set your category and batch'}
                  </p>
                </div>
              </div>

              <div className={cn(
                "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-500",
                isRoadmapComplete 
                  ? "bg-primary/[0.03] border-primary/20 shadow-sm" 
                  : "bg-secondary/20 border-dashed border-muted-foreground/20"
              )}>
                <div className={cn(
                  "p-3 rounded-xl transition-colors",
                  isRoadmapComplete ? "bg-primary text-white" : "bg-muted text-muted-foreground/40"
                )}>
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2">
                    <p className={cn("font-black text-sm uppercase tracking-tight", isRoadmapComplete ? "text-primary" : "text-muted-foreground")}>
                      Academic Roadmap
                    </p>
                    {isRoadmapComplete && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground truncate">
                    {isRoadmapComplete ? 'Syllabus Mapping Done' : 'Add at least one subject'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Button 
                className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest shadow-xl shadow-primary/20 group hover:scale-[1.02] active:scale-95 transition-all"
                onClick={() => router.push('/profile')}
              >
                Finish Setup
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              
              <div className="flex items-center justify-center gap-2 text-muted-foreground/40">
                <Zap className="h-3 w-3 fill-current" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">The Million Minute Quest</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
