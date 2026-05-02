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
import { Play, Pause, RotateCcw, Coffee, BookOpenCheck, Settings2, ShieldCheck, Wifi, Zap } from 'lucide-react';
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
const SYNC_INTERVAL_MS = 60000; // 1 minute

// 1 second of silent audio to keep the browser process alive on mobile
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

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

  // Background Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // SETUP MEDIA SESSION & AUDIO
  useEffect(() => {
    audioRef.current = new Audio(SILENT_AUDIO_URI);
    audioRef.current.loop = true;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Focus Session Active',
        artist: 'Study Milon',
        album: 'Academic Hustle',
        artwork: [
          { src: '/Screenshot 2026-05-02 103540.png', sizes: '512x512', type: 'image/png' }
        ]
      });
    }
  }, []);

  // 1. Session Recovery (The "Unstoppable" Logic)
  useEffect(() => {
    if (profile?.currentSession && !initializedFromCloud.current) {
      const { startTime, duration, status, subjectId, chapterId, isBreak: cloudIsBreak } = profile.currentSession;
      
      if (status === 'active' && startTime) {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
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
          
          // Resume audio hack
          audioRef.current?.play().catch(() => {});
          
          toast({ 
            title: "Hustle Resumed!", 
            description: "Your session was restored from the cloud timestamp." 
          });
        } else {
          // Session expired while user was away - auto reset
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

  const handleStart = async () => {
    if (!isActive && user && selectedSubject && selectedChapter) {
      const startTime = Date.now();
      setIsActive(true);
      lastLoggedMinuteRef.current = 0;
      
      // Start background persistence
      audioRef.current?.play().catch(() => {});
      
      const newSession: CurrentSession = {
        startTime,
        duration: workDuration,
        status: 'active',
        subjectId: selectedSubject,
        chapterId: selectedChapter,
        isBreak: false
      };
      
      // Atomic write to Firestore
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
      audioRef.current?.pause();
      
      await updateUserProfile(firestore, user.uid, { 
        isStudying: false,
        "currentSession.status": "paused",
        "currentSession.startTime": null
      });
    }
  };

  const handleReset = useCallback(async () => {
    if (user) {
      setIsActive(false);
      setIsBreak(false);
      audioRef.current?.pause();
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
      const startTime = Date.now();
      setTimeLeft(breakSeconds);
      setIsActive(true);
      lastLoggedMinuteRef.current = 0;
      
      await updateUserProfile(firestore, user.uid, {
        isStudying: false, // Don't count break time as study on leaderboard
        currentSession: {
          startTime,
          duration: workDuration,
          status: 'active',
          subjectId: selectedSubject,
          chapterId: selectedChapter,
          isBreak: true
        } as any
      });
      
      toast({ title: "Rest Mode Active", description: `Take 5 minutes to recharge your focus.` });
    }
  }, [user, workDuration, selectedSubject, selectedChapter, firestore, toast]);

  const handleMinuteLog = useCallback(async () => {
    if (!user || !selectedSubject || !selectedChapter || isBreak) return;
    try {
        await logStudyTime(firestore, user.uid, selectedSubject, selectedChapter, 1);
    } catch (error) {
        // Silent catch for offline capability
    }
  }, [user, firestore, selectedSubject, selectedChapter, isBreak]);

  // 3. THE UNSTOPPABLE ENGINE (Timestamp Validation)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && profile?.currentSession?.startTime) {
      interval = setInterval(() => {
        const startTime = profile.currentSession!.startTime;
        const totalSessionSeconds = (isBreak ? BREAK_MINUTES : workDuration) * 60;
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const newTimeLeft = Math.max(0, totalSessionSeconds - elapsedSeconds);
        
        setTimeLeft(newTimeLeft);

        // Logging every minute passed based on actual timestamp difference
        if (!isBreak) {
          const currentElapsedMinutes = Math.floor(elapsedSeconds / 60);
          if (currentElapsedMinutes > lastLoggedMinuteRef.current) {
            handleMinuteLog();
            lastLoggedMinuteRef.current = currentElapsedMinutes;
          }
        }

        // Live status heart-beat for Leaderboard
        if (elapsedSeconds % 30 === 0 && !isBreak) {
          updateUserProfile(firestore, user!.uid, { last_active_date: serverTimestamp() });
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
  }, [isActive, isBreak, workDuration, profile?.currentSession, user, firestore, handleReset, startBreak, handleMinuteLog]);

  const minutesDisplay = Math.floor(timeLeft / 60);
  const secondsDisplay = timeLeft % 60;
  const totalSecondsForMode = (isBreak ? BREAK_MINUTES : workDuration) * 60;
  const progress = 100 - (timeLeft / totalSecondsForMode) * 100;
  
  const canStart = !!selectedSubject && !!selectedChapter;

  return (
    <Card className="w-full shadow-2xl bg-slate-900 text-white border-none overflow-hidden relative">
      {/* Background Pulse Effect when active */}
      {isActive && (
        <div className={cn(
          "absolute inset-0 opacity-10 animate-pulse pointer-events-none",
          isBreak ? "bg-orange-500" : "bg-primary"
        )} />
      )}

      <CardHeader className="bg-slate-800/50 pb-4 flex flex-row items-center justify-between relative z-10">
        <CardTitle className="flex items-center gap-2 text-xl font-headline">
          {isBreak ? <Coffee className="text-orange-400" /> : <BookOpenCheck className="text-primary" />}
          <span className="tracking-tight">{isBreak ? 'Break Time' : 'Focus Session'}</span>
        </CardTitle>
        <div className="flex gap-2 items-center">
            {isActive && !isBreak && (
              <div className="flex items-center gap-1.5 bg-primary/20 px-3 py-1 rounded-full border border-primary/20 animate-pulse shadow-lg shadow-primary/10">
                <Wifi className="h-3 w-3 text-primary" />
                <span className="text-[9px] font-black uppercase text-primary tracking-widest">LIVE SYNCING</span>
              </div>
            )}
            {isBreak && (
               <div className="flex items-center gap-1.5 bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/20 shadow-lg">
                  <Zap className="h-3 w-3 text-orange-400" />
                  <span className="text-[9px] font-black uppercase text-orange-400 tracking-widest">RESTING</span>
               </div>
            )}
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center gap-8 py-10 relative z-10">
        <div className="relative h-60 w-60 md:h-72 md:w-72">
          {/* Circular Progress SVG */}
          <svg className="h-full w-full" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <circle className="stroke-current text-slate-800" strokeWidth="6" cx="50" cy="50" r="44" fill="transparent"/>
            <circle
              className={cn(
                "stroke-current transition-all duration-1000 ease-linear",
                isBreak ? "text-orange-400" : ""
              )}
              style={!isBreak ? { stroke: 'url(#timerGradient)' } : {}}
              strokeWidth="6" cx="50" cy="50" r="44" fill="transparent"
              strokeDasharray="276.46"
              strokeDashoffset={`${276.46 - (276.46 * progress) / 100}`}
              strokeLinecap="round" transform="rotate(-90 50 50)"
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl md:text-7xl font-black font-mono tracking-tighter tabular-nums drop-shadow-xl">
              {String(minutesDisplay).padStart(2, '0')}:{String(secondsDisplay).padStart(2, '0')}
            </span>
            {isActive && !isBreak && (
              <span className="text-[10px] font-black uppercase text-primary mt-4 flex items-center gap-2 tracking-[0.2em] bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                <ShieldCheck className="h-3 w-3" /> UNSTOPPABLE
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <Button 
            onClick={isActive ? handlePause : handleStart} 
            size="lg" 
            className="w-44 h-14 text-xl font-black rounded-2xl shadow-2xl shadow-primary/20 transition-all active:scale-95" 
            disabled={!canStart && !isActive}
          >
            {isActive ? <Pause className="mr-2 h-6 w-6" /> : <Play className="mr-2 h-6 w-6 fill-current" />}
            {isActive ? 'Pause' : 'Start Focus'}
          </Button>
          <Button onClick={handleReset} variant="ghost" size="icon" className="h-14 w-14 rounded-2xl bg-white/5 hover:bg-slate-800 text-white/40 hover:text-white transition-all">
            <RotateCcw className="h-7 w-7" />
          </Button>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start gap-6 p-6 md:p-10 bg-slate-800/40 border-t border-slate-700/50 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
            <div className="space-y-2">
                <Label className="text-slate-400 text-[10px] font-black uppercase tracking-widest px-1">Subject</Label>
                <Select value={selectedSubject || ''} onValueChange={(value) => {setSelectedSubject(value); setSelectedChapter(null);}} disabled={isActive}>
                    <SelectTrigger className="bg-slate-800/80 border-slate-700 text-white h-12 rounded-xl focus:ring-primary/50">
                        <SelectValue placeholder="Choose Subject" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                        {subjectsLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> : 
                            subjects?.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label className="text-slate-400 text-[10px] font-black uppercase tracking-widest px-1">Chapter</Label>
                 <Select onValueChange={setSelectedChapter} value={selectedChapter || ''} disabled={!selectedSubject || isActive || chaptersLoading}>
                    <SelectTrigger className="bg-slate-800/80 border-slate-700 text-white h-12 rounded-xl focus:ring-primary/50">
                        <SelectValue placeholder="Choose Chapter" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white rounded-xl">
                        {chaptersLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                            chapters?.map(chapter => <SelectItem key={chapter.id} value={chapter.id}>{chapter.name}</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="space-y-3 w-full pt-2">
          <div className="flex items-center justify-between px-1">
            <Label className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" /> Session Duration
            </Label>
            <span className="text-xs font-black font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{workDuration} Minutes</span>
          </div>
          <Input 
            type="range" 
            min="5" 
            max="120" 
            step="5"
            value={workDuration}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setWorkDuration(val);
              if (!isActive) setTimeLeft(val * 60);
            }}
            disabled={isActive}
            className="w-full accent-primary bg-slate-700 h-2 rounded-full"
          />
        </div>
      </CardFooter>

      {/* Media session info for user */}
      <div className="p-3 bg-primary/5 border-t border-white/5 text-center">
         <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.3em]">
            Root-Level Architecture • Unix Timestamp Verified • Study Milon
         </p>
      </div>
    </Card>
  );
}
