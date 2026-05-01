'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, query } from 'firebase/firestore';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, BookOpen, UserCircle, ArrowRight, Loader2 } from 'lucide-react';
import type { UserProfile } from '@/firebase/firestore/users';

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
        <p className="text-muted-foreground font-medium animate-pulse">Verifying academic status...</p>
      </div>
    );
  }

  if (!isProfileComplete || !isRoadmapComplete) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-[2rem] overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground text-center py-10">
            <div className="mx-auto bg-white/20 p-4 rounded-full w-fit mb-4">
              <BrainCircuit className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-black font-headline">Setup Required</CardTitle>
            <CardDescription className="text-primary-foreground/80 mt-2">
              Please complete your profile to unlock all features.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-4">
              <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isProfileComplete ? 'bg-success/10 border-success/30' : 'bg-secondary/50 border-dashed'}`}>
                <div className={`p-2 rounded-full ${isProfileComplete ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                  <UserCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${isProfileComplete ? 'text-success' : 'text-foreground'}`}>Academic Profile</p>
                  <p className="text-xs text-muted-foreground">{isProfileComplete ? 'Completed' : 'Set your category and batch'}</p>
                </div>
                {isProfileComplete && <div className="h-2 w-2 rounded-full bg-success" />}
              </div>

              <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isRoadmapComplete ? 'bg-success/10 border-success/30' : 'bg-secondary/50 border-dashed'}`}>
                <div className={`p-2 rounded-full ${isRoadmapComplete ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${isRoadmapComplete ? 'text-success' : 'text-foreground'}`}>Academic Roadmap</p>
                  <p className="text-xs text-muted-foreground">{isRoadmapComplete ? 'Completed' : 'Add at least one subject'}</p>
                </div>
                {isRoadmapComplete && <div className="h-2 w-2 rounded-full bg-success" />}
              </div>
            </div>

            <Button 
              className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20"
              onClick={() => router.push('/profile')}
            >
              Finish Setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
