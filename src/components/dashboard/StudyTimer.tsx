'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { logStudyTime } from '@/firebase/firestore/hierarchy';
import { updateUserProfile } from '@/firebase/firestore/users';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, BookOpenCheck, Settings2, ShieldCheck, ShieldAlert, Wifi } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const BREAK_MINUTES = 5;

export function StudyTimer() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Fetch Focus Settings to show protection status
  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);
  const isFocusModeEnabled = useMemo(() => {
    if (!profile?.focusSettings) return false;
    const { blockFbReels, blockInstaReels, blockYoutubeShorts, restrictMessenger, restrictWhatsapp } = profile.focusSettings;
    return blockFbReels || blockInstaReels || blockYoutubeShorts || restrictMessenger || restrictWhatsapp;
  }, [profile?.focusSettings]);

  const [workDuration, setWorkDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  
  // High-accuracy background-safe refs
  const startTimeRef = useRef<number | null>(null);
  const baseSecondsRef = useRef<number>(workDuration * 60);
  const lastLoggedMinuteRef = useRef<number>(0);

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  
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

  const initializedFromParams = useRef(false);
  
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
        if (!isActive) {
          setTimeLeft(d * 60);
          baseSecondsRef.current = d * 60;
        }
        
        if (!initializedFromParams.current && subId && chapId) {
            handleStart();
            initializedFromParams.current = true;
            toast({
                title: "Session Started!",
                description: `Focused study for ${d} minutes.`,
            });
        }
      }
    }
  }, [searchParams, toast]);

  const handleStart = async () => {
    if (!isActive && user) {
      startTimeRef.current = Date.now();
      baseSecondsRef.current = timeLeft;
      lastLoggedMinuteRef.current = 0;
      setIsActive(true);
      if (!isBreak) {
        updateUserProfile(firestore, user.uid, { isStudying: true });
      }
    }
  };

  const handlePause = () => {
    if (user) {
      setIsActive(false);
      startTimeRef.current = null;
      updateUserProfile(firestore, user.uid, { isStudying: false });
    }
  };

  const reset = useCallback(() => {
    if (user) {
      setIsActive(false);
      setIsBreak(false);
      startTimeRef.current = null;
      const initialSeconds = workDuration * 60;
      setTimeLeft(initialSeconds);
      baseSecondsRef.current = initialSeconds;
      updateUserProfile(firestore, user.uid, { isStudying: false });
    }
  }, [workDuration, user, firestore]);

  const startBreak = useCallback(() => {
    if (user) {
      setIsBreak(true);
      const breakSeconds = BREAK_MINUTES * 60;
      setTimeLeft(breakSeconds);
      baseSecondsRef.current = breakSeconds;
      startTimeRef.current = Date.now();
      lastLoggedMinuteRef.current = 0;
      setIsActive(true);
      updateUserProfile(firestore, user.uid, { isStudying: false });
      toast({
          title: "Time for a break!",
          description: `Take 5 minutes to recharge.`
      })
    }
  }, [toast, user, firestore]);

  const handleMinuteLog = useCallback(async () => {
    if (!user || !selectedSubject || !selectedChapter) return;
    try {
        await logStudyTime(firestore, user.uid, selectedSubject, selectedChapter, 1);
    } catch (error) {
        // Silent catch for offline sync
    }
  }, [user, firestore, selectedSubject, selectedChapter]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        if (!startTimeRef.current) return;
        
        // Calculate EXACT elapsed time based on system clock
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const newTimeLeft = Math.max(0, baseSecondsRef.current - elapsedSeconds);
        
        setTimeLeft(newTimeLeft);

        if (!isBreak) {
          const currentElapsedMinutes = Math.floor(elapsedSeconds / 60);
          if (currentElapsedMinutes > lastLoggedMinuteRef.current) {
            handleMinuteLog();
            lastLoggedMinuteRef.current = currentElapsedMinutes;
          }
        }

        if (newTimeLeft === 0) {
          clearInterval(interval!);
          setIsActive(false);
          if (isBreak) {
            if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
              new Notification("Break's over!", { body: "Time to get back to the hustle." });
            }
            reset();
          } else {
            if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
              new Notification("Study session complete!", { body: "Take a well-deserved break." });
            }
            startBreak();
          }
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, isBreak, reset, startBreak, handleMinuteLog]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  const minutesDisplay = Math.floor(timeLeft / 60);
  const secondsDisplay = timeLeft % 60;
  const totalSecondsForMode = (isBreak ? BREAK_MINUTES : workDuration) * 60;
  const progress = 100 - (timeLeft / totalSecondsForMode) * 100;
  
  const canStart = !!selectedSubject && !!selectedChapter;

  return (
    <Card className="w-full shadow-2xl bg-slate-900 text-white border-none overflow-hidden">
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
            {isFocusModeEnabled && !isBreak && (
              <div className="flex items-center gap-1.5 bg-success/10 px-2 py-1 rounded-full border border-success/20">
                 <ShieldCheck className="h-3.5 w-3.5 text-success" />
                 <span className="text-[10px] font-black uppercase text-success tracking-tighter">Protected</span>
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
            {isActive && !isBreak && isFocusModeEnabled && (
              <span className="text-[9px] font-black uppercase text-primary mt-2 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Blocker Running
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={isActive ? handlePause : handleStart} 
            size="lg" 
            className="w-40 h-12 text-lg font-bold shadow-lg shadow-primary/20" 
            disabled={!canStart}
          >
            {isActive ? <Pause className="mr-2" /> : <Play className="mr-2" />}
            {isActive ? 'Pause' : 'Start'}
          </Button>
          <Button onClick={reset} variant="ghost" size="icon" className="h-12 w-12 rounded-full hover:bg-slate-800">
            <RotateCcw className="h-6 w-6" />
            <span className="sr-only">Reset</span>
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
                if (!isActive) {
                  setTimeLeft(val * 60);
                  baseSecondsRef.current = val * 60;
                }
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
