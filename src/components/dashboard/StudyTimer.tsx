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
import { Play, Pause, RotateCcw, Coffee, BookOpenCheck, Settings2, ShieldCheck, Wifi, Zap, Clock } from 'lucide-react';
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

// 1 second of silent audio to keep the browser process alive on mobile devices
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

export function StudyTimer() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Profile data for session recovery from cloud
  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

  const [workDuration, setWorkDuration] = useState(25); // in minutes
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  // Input states for Hours:Minutes selection
  const [inputHours, setInputHours] = useState('0');
  const [inputMinutes, setInputMinutes] = useState('25');

  // Background Persistence Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastLoggedMinuteRef = useRef<number>(0);
  const initializedFromCloud = useRef(false);

  // Fetch subjects for selection
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

  // INITIALIZE BACKGROUND SERVICE
  useEffect(() => {
    // Setup silent audio for background persistence
    audioRef.current = new Audio(SILENT_AUDIO_URI);
    audioRef.current.loop = true;

    // Media Session API - keeps the notification visible and process alive on mobile
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Focus Session Active',
        artist: 'Study Milon',
        album: 'The Million Minute Quest',
        artwork: [
          { src: 'https://picsum.photos/seed/focus/512/512', sizes: '512x512', type: 'image/png' }
        ]
      });
    }
  }, []);

  // 1. SESSION RECOVERY (THE UNSTOPPABLE LOGIC)
  useEffect(() => {
    if (profile?.currentSession && !initializedFromCloud.current) {
      const { startTime, duration, status, subjectId, chapterId, isBreak: cloudIsBreak } = profile.currentSession;
      
      if (status === 'active' && startTime) {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalSessionSeconds = (cloudIsBreak ? BREAK_MINUTES : duration) * 60;
        const calculatedTimeLeft = Math.max(0, totalSessionSeconds - elapsedSeconds);

        if (calculatedTimeLeft > 0) {
          // Resume active session
          setTimeLeft(calculatedTimeLeft);
          setWorkDuration(duration);
          setInputHours(Math.floor(duration / 60).toString());
          setInputMinutes((duration % 60).toString());
          setSelectedSubject(subjectId);
          setSelectedChapter(chapterId);
          setIsBreak(cloudIsBreak);
          setIsActive(true);
          lastLoggedMinuteRef.current = Math.floor(elapsedSeconds / 60);
          
          audioRef.current?.play().catch(() => {});
          
          toast({ 
            title: "Hustle Recovered", 
            description: "Synchronized with your global study clock." 
          });
        } else {
          // Session expired while user was away
          handleReset();
        }
      } else if (duration) {
        // Just restore preference
        setWorkDuration(duration);
        setTimeLeft(duration * 60);
        setInputHours(Math.floor(duration / 60).toString());
        setInputMinutes((duration % 60).toString());
      }
      initializedFromCloud.current = true;
    }
  }, [profile?.currentSession]);

  // 2. SEARCH PARAM HANDLING (FROM PLANNER)
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
        setInputHours(Math.floor(d / 60).toString());
        setInputMinutes((d % 60).toString());
        if (!isActive) setTimeLeft(d * 60);
      }
    }
  }, [searchParams, isActive]);

  const handleStart = async () => {
    if (!isActive && user && selectedSubject && selectedChapter) {
      const startTime = Date.now();
      setIsActive(true);
      lastLoggedMinuteRef.current = 0;
      
      // Keep mobile browser awake
      audioRef.current?.play().catch(() => {});
      
      const newSession: CurrentSession = {
        startTime,
        duration: workDuration,
        status: 'active',
        subjectId: selectedSubject,
        chapterId: selectedChapter,
        isBreak: false
      };
      
      // Atomic cloud update
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
        isStudying: false,
        currentSession: {
          startTime,
          duration: workDuration,
          status: 'active',
          subjectId: selectedSubject,
          chapterId: selectedChapter,
          isBreak: true
        } as any
      });
      
      toast({ title: "Rest Cycle Started", description: "Take 5 minutes to recharge." });
    }
  }, [user, workDuration, selectedSubject, selectedChapter, firestore, toast]);

  const handleMinuteLog = useCallback(async () => {
    if (!user || !selectedSubject || !selectedChapter || isBreak) return;
    try {
        await logStudyTime(firestore, user.uid, selectedSubject, selectedChapter, 1);
    } catch (error) {
        // Offline capability ensures this syncs when back online
    }
  }, [user, firestore, selectedSubject, selectedChapter, isBreak]);

  // 3. THE UNSTOPPABLE CLOCK ENGINE
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

        // Atomic 1-minute logger
        if (!isBreak) {
          const currentElapsedMinutes = Math.floor(elapsedSeconds / 60);
          if (currentElapsedMinutes > lastLoggedMinuteRef.current) {
            handleMinuteLog();
            lastLoggedMinuteRef.current = currentElapsedMinutes;
          }
        }

        // Live status heartbeat
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

  const handleDurationChange = (h: string, m: string) => {
    const hours = parseInt(h, 10) || 0;
    const mins = parseInt(m, 10) || 0;
    const total = (hours * 60) + mins;
    
    if (total >= 1) {
      setWorkDuration(total);
      if (!isActive) setTimeLeft(total * 60);
    }
    
    setInputHours(h);
    setInputMinutes(m);
  };

  const minutesDisplay = Math.floor(timeLeft / 60);
  const secondsDisplay = timeLeft % 60;
  const totalSecondsForMode = (isBreak ? BREAK_MINUTES : workDuration) * 60;
  const progress = 100 - (timeLeft / totalSecondsForMode) * 100;
  
  const canStart = !!selectedSubject && !!selectedChapter;

  return (
    <Card className="w-full shadow-2xl bg-[#0F1117] text-white border-none overflow-hidden relative">
      {isActive && (
        <div className={cn(
          "absolute inset-0 opacity-5 animate-pulse pointer-events-none",
          isBreak ? "bg-orange-500" : "bg-red-600"
        )} />
      )}

      <CardHeader className="bg-white/5 pb-4 flex flex-row items-center justify-between relative z-10">
        <CardTitle className="flex items-center gap-2 text-xl font-headline">
          {isBreak ? <Coffee className="text-orange-400" /> : <BookOpenCheck className="text-red-600" />}
          <span className="tracking-tight">{isBreak ? 'Rest Cycle' : 'Focus Session'}</span>
        </CardTitle>
        <div className="flex gap-2 items-center">
            {isActive && !isBreak && (
              <div className="flex items-center gap-1.5 bg-red-600/20 px-3 py-1 rounded-full border border-red-600/20 animate-pulse shadow-lg">
                <Wifi className="h-3 w-3 text-red-600" />
                <span className="text-[9px] font-black uppercase text-red-600 tracking-widest">LIVE SYNCING</span>
              </div>
            )}
            {isBreak && (
               <div className="flex items-center gap-1.5 bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/20 shadow-lg">
                  <Zap className="h-3 w-3 text-orange-400" />
                  <span className="text-[9px] font-black uppercase text-orange-400 tracking-widest">BREAK ACTIVE</span>
               </div>
            )}
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center gap-8 py-10 relative z-10">
        {/* Circular Progress Engine */}
        <div className="relative h-64 w-64 md:h-80 md:w-80">
          <svg className="h-full w-full" viewBox="0 0 100 100">
            <circle className="stroke-current text-white/5" strokeWidth="6" cx="50" cy="50" r="44" fill="transparent"/>
            <circle
              className={cn(
                "stroke-current transition-all duration-1000 ease-linear",
                isBreak ? "text-orange-400" : "text-red-600"
              )}
              strokeWidth="6" cx="50" cy="50" r="44" fill="transparent"
              strokeDasharray="276.46"
              strokeDashoffset={`${276.46 - (276.46 * progress) / 100}`}
              strokeLinecap="round" transform="rotate(-90 50 50)"
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl md:text-8xl font-black font-mono tracking-tighter tabular-nums drop-shadow-2xl">
              {String(minutesDisplay).padStart(2, '0')}:{String(secondsDisplay).padStart(2, '0')}
            </span>
            {isActive && !isBreak && (
              <span className="text-[10px] font-black uppercase text-red-600 mt-4 flex items-center gap-2 tracking-[0.3em] bg-red-600/10 px-4 py-1 rounded-full border border-red-600/20">
                <ShieldCheck className="h-3 w-3" /> UNSTOPPABLE
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={isActive ? handlePause : handleStart} 
            size="lg" 
            className="w-40 h-12 text-sm font-bold rounded-xl shadow-lg shadow-red-600/10 transition-all active:scale-95 bg-red-600 hover:bg-red-700" 
            disabled={!canStart && !isActive}
          >
            {isActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
            {isActive ? 'Pause' : 'Start Focus'}
          </Button>
          <Button onClick={handleReset} variant="ghost" size="icon" className="h-12 w-12 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <RotateCcw className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start gap-6 p-6 md:p-10 bg-white/[0.02] border-t border-white/5 relative z-10">
        {/* Academic Context Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
            <div className="space-y-2">
                <Label className="text-white/40 text-[10px] font-black uppercase tracking-widest px-1">Active Subject</Label>
                <Select value={selectedSubject || ''} onValueChange={(value) => {setSelectedSubject(value); setSelectedChapter(null);}} disabled={isActive}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-14 rounded-2xl focus:ring-red-600/50">
                        <SelectValue placeholder="Select Subject" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1C23] border-white/10 text-white rounded-2xl">
                        {subjectsLoading ? <SelectItem value="loading" disabled>Syncing Roadmap...</SelectItem> : 
                            subjects?.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label className="text-white/40 text-[10px] font-black uppercase tracking-widest px-1">Specific Chapter</Label>
                 <Select onValueChange={setSelectedChapter} value={selectedChapter || ''} disabled={!selectedSubject || isActive || chaptersLoading}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-14 rounded-2xl focus:ring-red-600/50">
                        <SelectValue placeholder="Select Chapter" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1C23] border-white/10 text-white rounded-2xl">
                        {chaptersLoading ? <SelectItem value="loading" disabled>Loading Syllabus...</SelectItem> :
                            chapters?.map(chapter => <SelectItem key={chapter.id} value={chapter.id}>{chapter.name}</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>
        </div>

        {/* Custom Duration Inputs */}
        <div className="space-y-4 w-full pt-4">
          <div className="flex items-center justify-between px-1">
            <Label className="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-red-600" /> Session Duration
            </Label>
            <div className="flex items-center gap-2 bg-red-600/10 px-3 py-1 rounded-full border border-red-600/10">
               <Clock className="h-3 w-3 text-red-600" />
               <span className="text-xs font-black font-mono text-red-600">
                 {Math.floor(workDuration / 60)}h {workDuration % 60}m
               </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="relative">
                <Input 
                  type="number" 
                  min="0" 
                  max="12" 
                  value={inputHours} 
                  onChange={(e) => handleDurationChange(e.target.value, inputMinutes)}
                  disabled={isActive}
                  className="bg-white/5 border-white/10 text-white h-14 rounded-2xl pr-12 text-lg font-bold"
                />
                <span className="absolute right-4 top-4.5 text-[9px] font-black text-white/20 uppercase">HRS</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="relative">
                <Input 
                  type="number" 
                  min="0" 
                  max="59" 
                  value={inputMinutes} 
                  onChange={(e) => handleDurationChange(inputHours, e.target.value)}
                  disabled={isActive}
                  className="bg-white/5 border-white/10 text-white h-14 rounded-2xl pr-12 text-lg font-bold"
                />
                <span className="absolute right-4 top-4.5 text-[9px] font-black text-white/20 uppercase">MIN</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-white/20 font-bold px-1 text-center italic">
            "You manually reset the session, but the cloud remembers your hustle."
          </p>
        </div>
      </CardFooter>

      <div className="p-4 bg-white/[0.01] border-t border-white/5 text-center">
         <p className="text-[7px] font-black text-white/10 uppercase tracking-[0.4em]">
            ROOT SYSTEM ACTIVE • ENCRYPTED CLOCK • STUDY MILON PROTOCOL
         </p>
      </div>
    </Card>
  );
}
