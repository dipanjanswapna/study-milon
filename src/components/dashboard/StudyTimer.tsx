
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { logStudyTime } from '@/firebase/firestore/hierarchy';
import { updateUserProfile, type CurrentSession } from '@/firebase/firestore/users';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, BookOpenCheck, Settings2, ShieldCheck, Wifi } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { collection, query, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const BREAK_MINUTES = 5;

export function StudyTimer() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Profile data for session recovery
  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

  const [workDuration, setWorkDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  // High-accuracy sync refs
  const lastLoggedMinuteRef = useRef<number>(0);
  const initializedFromCloud = useRef(false);

  // Fetch subjects for dropdowns
  const subjectsQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'subjects'), orderBy('createdAt', 'asc'));
  }, [user, firestore]);
  const { data: subjects, loading: subjectsLoading } = useCollection(subjectsQuery);

  const chaptersQuery = useMemo(() => {
    if (!user || !selectedSubject) return null;
    return query(collection(firestore, 'users', user.uid, 'subjects', selectedSubject, 'chapters'), orderBy('createdAt', 'asc'));
  }, [user, firestore, selectedSubject]);
  const { data: chapters, loading: chaptersLoading } = useCollection(chaptersQuery);

  // 1. Session Recovery (Root-Level Persistence)
  useEffect(() => {
    if (profile?.currentSession && !initializedFromCloud.current) {
      const { startTime, duration, status, subjectId, chapterId, isBreak: cloudIsBreak } = profile.currentSession;
      
      if (status === 'active' && startTime) {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const totalSessionSeconds = (cloudIsBreak ? BREAK_MINUTES : duration) * 60;
        const calculatedTimeLeft = Math.max(0, totalSessionSeconds - elapsedSeconds);

        if (calculatedTimeLeft > 0) {
          setTimeLeft(calculatedTimeLeft);
          setWorkDuration(duration);
          setSelectedSubject(subjectId);
          setSelectedChapter(chapterId);
          setIsBreak(cloudIsBreak);
          setIsActive(true);
          lastLoggedMinuteRef.current = Math.floor(elapsedSeconds / 60);
          toast({ title: "Session Resumed", description: "Your study timer has been restored from the cloud." });
        } else {
          // Session expired while user was away
          handleReset();
        }
      } else {
        setWorkDuration(duration || 25);
        setTimeLeft((duration || 25) * 60);
      }
      initializedFromCloud.current = true;
    }
  }, [profile?.currentSession, toast]);

  // 2. Search Params Handling
  useEffect(() => {
    const subId = searchParams.get('subjectId');
    const chapId = searchParams.get('chapterId');
    const durationParam = searchParams.get('duration');

    if (subId) setSelectedSubject(subId);
    if (chapId) setSelectedChapter(chapId);
    if (durationParam) {
      const d = parseInt(durationParam, 10);
      if (!isNaN(d) && d > 0) {
        setWorkDuration(d);
        if (!isActive) setTimeLeft(d * 60);
      }
    }
  }, [searchParams, isActive]);

  const updateCloudSession = useCallback(async (updates: Partial<CurrentSession>) => {
    if (!user) return;
    const session = {
      startTime: isActive ? (profile?.currentSession?.startTime || Date.now()) : null,
      duration: workDuration,
      status: isActive ? 'active' : 'idle',
      subjectId: selectedSubject,
      chapterId: selectedChapter,
      isBreak,
      ...updates
    };
    await updateUserProfile(firestore, user.uid, { currentSession: session as any, isStudying: session.status === 'active' && !session.isBreak });
  }, [user, firestore, isActive, workDuration, selectedSubject, selectedChapter, isBreak, profile?.currentSession]);

  const handleStart = async () => {
    if (!isActive && user && selectedSubject && selectedChapter) {
      const startTime = Date.now();
      setIsActive(true);
      lastLoggedMinuteRef.current = 0;
      
      const newSession: CurrentSession = {
        startTime,
        duration: workDuration,
        status: 'active',
        subjectId: selectedSubject,
        chapterId: selectedChapter,
        isBreak: false
      };
      
      await updateUserProfile(firestore, user.uid, { 
        currentSession: newSession as any, 
        isStudying: true,
        last_active_date: serverTimestamp()
      });
    }
  };

  const handlePause = async () => {
    if (user) {
      setIsActive(false);
      await updateCloudSession({ status: 'paused', startTime: null });
      await updateUserProfile(firestore, user.uid, { isStudying: false });
    }
  };

  const handleReset = useCallback(async () => {
    if (user) {
      setIsActive(false);
      setIsBreak(false);
      const initialSeconds = workDuration * 60;
      setTimeLeft(initialSeconds);
      lastLoggedMinuteRef.current = 0;
      await updateUserProfile(firestore, user.uid, { 
        isStudying: false,
        currentSession: {
          startTime: null,
          duration: workDuration,
          status: 'idle',
          subjectId: selectedSubject,
          chapterId: selectedChapter,
          isBreak: false
        } as any
      });
    }
  }, [workDuration, user, firestore, selectedSubject, selectedChapter]);

  const startBreak = useCallback(async () => {
    if (user) {
      setIsBreak(true);
      const breakSeconds = BREAK_MINUTES * 60;
      setTimeLeft(breakSeconds);
      setIsActive(true);
      lastLoggedMinuteRef.current = 0;
      
      await updateCloudSession({ 
        isBreak: true, 
        startTime: Date.now(), 
        status: 'active' 
      });
      
      toast({ title: "Time for a break!", description: `Take 5 minutes to recharge.` });
    }
  }, [user, updateCloudSession, toast]);

  const handleMinuteLog = useCallback(async () => {
    if (!user || !selectedSubject || !selectedChapter || isBreak) return;
    try {
        await logStudyTime(firestore, user.uid, selectedSubject, selectedChapter, 1);
    } catch (error) {
        // Silent catch for offline sync
    }
  }, [user, firestore, selectedSubject, selectedChapter, isBreak]);

  // 3. The Unstoppable Engine
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && profile?.currentSession?.startTime) {
      interval = setInterval(() => {
        const startTime = profile.currentSession!.startTime;
        const totalSessionSeconds = (isBreak ? BREAK_MINUTES : workDuration) * 60;
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const newTimeLeft = Math.max(0, totalSessionSeconds - elapsedSeconds);
        
        setTimeLeft(newTimeLeft);

        // Logging every minute passed
        if (!isBreak) {
          const currentElapsedMinutes = Math.floor(elapsedSeconds / 60);
          if (currentElapsedMinutes > lastLoggedMinuteRef.current) {
            handleMinuteLog();
            lastLoggedMinuteRef.current = currentElapsedMinutes;
          }
        }

        if (newTimeLeft === 0) {
          clearInterval(interval!);
          if (isBreak) {
            handleReset();
          } else {
            startBreak();
          }
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, isBreak, workDuration, profile?.currentSession, handleReset, startBreak, handleMinuteLog]);

  const minutesDisplay = Math.floor(timeLeft / 60);
  const secondsDisplay = timeLeft % 60;
  const totalSecondsForMode = (isBreak ? BREAK_MINUTES : workDuration) * 60;
  const progress = 100 - (timeLeft / totalSecondsForMode) * 100;
  
  const canStart = !!selectedSubject && !!selectedChapter;

  return (
    <Card className="w-full shadow-2xl bg-slate-900 text-white border-none overflow-hidden relative">
      <CardHeader className="bg-slate-800/50 pb-4 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-xl font-headline">
          {isBreak ? <Coffee className="text-orange-400" /> : <BookOpenCheck className="text-primary" />}
          <span>{isBreak ? 'Break' : 'Focus Session'}</span>
        </CardTitle>
        <div className="flex gap-2 items-center">
            {isActive && !isBreak && (
              <div className="flex items-center gap-1 bg-primary/20 px-2 py-1 rounded-full border border-primary/20 animate-pulse">
                <Wifi className="h-3 w-3 text-primary" />
                <span className="text-[9px] font-black uppercase text-primary tracking-tighter">Live Syncing</span>
              </div>
            )}
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center gap-8 py-10">
        <div className="relative h-56 w-56 md:h-64 md:w-64">
          <svg className="h-full w-full" viewBox="0 0 100 100">
            <circle className="stroke-current text-slate-700" strokeWidth="6" cx="50" cy="50" r="44" fill="transparent"/>
            <circle
              className={cn(
                "stroke-current transition-all duration-1000 ease-linear",
                isBreak ? "text-orange-400" : "text-primary"
              )}
              strokeWidth="6" cx="50" cy="50" r="44" fill="transparent"
              strokeDasharray="276.46"
              strokeDashoffset={`${276.46 - (276.46 * progress) / 100}`}
              strokeLinecap="round" transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl md:text-6xl font-bold font-mono tracking-tighter">
              {String(minutesDisplay).padStart(2, '0')}:{String(secondsDisplay).padStart(2, '0')}
            </span>
            {isActive && !isBreak && (
              <span className="text-[10px] font-black uppercase text-primary mt-2 flex items-center gap-1 animate-pulse">
                <Wifi className="h-3 w-3" /> UNSTOPPABLE
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={isActive ? handlePause : handleStart} 
            size="lg" 
            className="w-40 h-12 text-lg font-bold shadow-lg shadow-primary/20" 
            disabled={!canStart && !isActive}
          >
            {isActive ? <Pause className="mr-2" /> : <Play className="mr-2" />}
            {isActive ? 'Pause' : 'Start'}
          </Button>
          <Button onClick={handleReset} variant="ghost" size="icon" className="h-12 w-12 rounded-full hover:bg-slate-800">
            <RotateCcw className="h-6 w-6" />
          </Button>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start gap-6 p-6 md:p-8 bg-slate-800/30 border-t border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <div className="space-y-2">
                <Label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Subject</Label>
                <Select value={selectedSubject || ''} onValueChange={(value) => {setSelectedSubject(value); setSelectedChapter(null);}} disabled={isActive}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-11">
                        <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        {subjectsLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> : 
                            subjects?.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Chapter</Label>
                 <Select onValueChange={setSelectedChapter} value={selectedChapter || ''} disabled={!selectedSubject || isActive || chaptersLoading}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-11">
                        <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        {chaptersLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                            chapters?.map(chapter => <SelectItem key={chapter.id} value={chapter.id}>{chapter.name}</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="space-y-2 w-full">
          <div className="flex items-center justify-between">
            <Label className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> Work Duration (min)
            </Label>
            <span className="text-xs font-mono text-primary">{workDuration}m</span>
          </div>
          <Input type="number" value={workDuration}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val > 0) {
                setWorkDuration(val);
                if (!isActive) setTimeLeft(val * 60);
              }
            }}
            disabled={isActive} min="1"
            className="bg-slate-800 border-slate-700 text-white h-11"
          />
        </div>
      </CardFooter>
    </Card>
  );
}
