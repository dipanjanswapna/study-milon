
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { logStudyTime } from '@/firebase/firestore/hierarchy';
import { updateUserProfile, type CurrentSession } from '@/firebase/firestore/users';
import { updateTaskStatus, type StudyTask } from '@/firebase/firestore/todo';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, BookOpenCheck, ShieldCheck, Wifi, Zap, Clock, ArrowRight, ListTodo } from 'lucide-react';
import { collection, query, where, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const BREAK_MINUTES = 5;
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

export function StudyTimer() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // Profile data for session recovery
  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

  // Fetch Today's Tasks
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const tasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('date', '==', todayStr),
      orderBy('order', 'asc')
    );
  }, [user, firestore, todayStr]);
  const { data: tasks, loading: tasksLoading } = useCollection<StudyTask>(tasksQuery);

  // Derive Current Active Task (First Incomplete)
  const activeTask = useMemo(() => {
    if (!tasks) return null;
    return tasks.find(t => !t.completed);
  }, [tasks]);

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  // Background Persistence Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastLoggedMinuteRef = useRef<number>(0);
  const initializedFromCloud = useRef(false);

  const handleReset = useCallback(async () => {
    if (user) {
      setIsActive(false);
      setIsBreak(false);
      audioRef.current?.pause();
      
      const duration = activeTask?.duration || 25;
      setTimeLeft(duration * 60);
      lastLoggedMinuteRef.current = 0;
      
      updateUserProfile(firestore, user.uid, { 
        isStudying: false,
        currentSession: {
          startTime: null,
          duration: duration,
          status: 'idle',
          subjectId: activeTask?.subjectId || null,
          chapterId: activeTask?.chapterId || null,
          isBreak: false
        } as any
      });
    }
  }, [activeTask, user, firestore]);

  const handleStart = async () => {
    if (!isActive && user && activeTask) {
      const startTime = Date.now();
      setIsActive(true);
      lastLoggedMinuteRef.current = 0;
      
      audioRef.current?.play().catch(() => {});
      
      const newSession: CurrentSession = {
        startTime,
        duration: activeTask.duration,
        status: 'active',
        subjectId: activeTask.subjectId,
        chapterId: activeTask.chapterId,
        isBreak: false
      };
      
      updateUserProfile(firestore, user.uid, { 
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
      updateUserProfile(firestore, user.uid, { 
        isStudying: false,
        "currentSession.status": "paused",
        "currentSession.startTime": null
      });
    }
  };

  const startBreak = useCallback(async () => {
    if (user && activeTask) {
      // Mark current task as COMPLETED automatically
      await updateTaskStatus(firestore, user.uid, activeTask.id, true);
      toast({ title: "Objective Secured!", description: `${activeTask.chapterName} marked as complete.` });

      setIsBreak(true);
      const breakSeconds = BREAK_MINUTES * 60;
      const startTime = Date.now();
      setTimeLeft(breakSeconds);
      setIsActive(true);
      lastLoggedMinuteRef.current = 0;
      
      updateUserProfile(firestore, user.uid, {
        isStudying: false,
        currentSession: {
          startTime,
          duration: activeTask.duration,
          status: 'active',
          subjectId: activeTask.subjectId,
          chapterId: activeTask.chapterId,
          isBreak: true
        } as any
      });
    }
  }, [user, activeTask, firestore, toast]);

  const handleMinuteLog = useCallback(async () => {
    if (!user || !activeTask || isBreak) return;
    try {
        await logStudyTime(firestore, user.uid, activeTask.subjectId, activeTask.chapterId, 1);
    } catch (error) { }
  }, [user, firestore, activeTask, isBreak]);

  // INITIALIZE BACKGROUND SERVICE
  useEffect(() => {
    audioRef.current = new Audio(SILENT_AUDIO_URI);
    audioRef.current.loop = true;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Elite Session Active',
        artist: 'Study Milon',
        artwork: [{ src: 'https://picsum.photos/seed/focus/512/512', sizes: '512x512', type: 'image/png' }]
      });
    }
  }, []);

  // SESSION RECOVERY
  useEffect(() => {
    if (profile?.currentSession && !initializedFromCloud.current) {
      const { startTime, duration, status, isBreak: cloudIsBreak } = profile.currentSession;
      
      if (status === 'active' && startTime) {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalSessionSeconds = (cloudIsBreak ? BREAK_MINUTES : duration) * 60;
        const calculatedTimeLeft = Math.max(0, totalSessionSeconds - elapsedSeconds);

        if (calculatedTimeLeft > 0) {
          setTimeLeft(calculatedTimeLeft);
          setIsBreak(cloudIsBreak);
          setIsActive(true);
          lastLoggedMinuteRef.current = Math.floor(elapsedSeconds / 60);
          audioRef.current?.play().catch(() => {});
        } else {
          handleReset();
        }
      } else if (activeTask) {
        setTimeLeft(activeTask.duration * 60);
      }
      initializedFromCloud.current = true;
    }
  }, [profile?.currentSession, activeTask, handleReset]);

  // ENGINE
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && profile?.currentSession?.startTime) {
      interval = setInterval(() => {
        const startTime = profile.currentSession!.startTime;
        const duration = isBreak ? BREAK_MINUTES : (activeTask?.duration || 25);
        const totalSessionSeconds = duration * 60;
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const newTimeLeft = Math.max(0, totalSessionSeconds - elapsedSeconds);
        
        setTimeLeft(newTimeLeft);

        if (!isBreak && activeTask) {
          const currentElapsedMinutes = Math.floor(elapsedSeconds / 60);
          if (currentElapsedMinutes > lastLoggedMinuteRef.current) {
            handleMinuteLog();
            lastLoggedMinuteRef.current = currentElapsedMinutes;
          }
        }

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
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, isBreak, activeTask, profile?.currentSession, user, firestore, handleReset, startBreak, handleMinuteLog]);

  const minutesDisplay = Math.floor(timeLeft / 60);
  const secondsDisplay = timeLeft % 60;
  const durationForMode = isBreak ? BREAK_MINUTES : (activeTask?.duration || 25);
  const progress = 100 - (timeLeft / (durationForMode * 60)) * 100;

  if (tasksLoading) return <Card className="w-full h-96 bg-[#0F1117] animate-pulse rounded-[2.5rem]" />;

  if (!activeTask && !isBreak) {
    return (
      <Card className="w-full shadow-2xl bg-[#0F1117] text-white border-none overflow-hidden rounded-[2.5rem]">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
          <div className="p-6 bg-primary/10 rounded-full">
            <ListTodo className="h-12 w-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight">No Active Roadmap</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Your focus session is empty. Add tasks to your study planner to begin the sequence.
            </p>
          </div>
          <Button onClick={() => router.push('/todo')} className="rounded-full px-8 h-12 font-bold gap-2">
            Build Roadmap <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-2xl bg-[#0F1117] text-white border-none overflow-hidden relative rounded-[2.5rem]">
      {isActive && (
        <div className={cn(
          "absolute inset-0 opacity-5 animate-pulse pointer-events-none",
          isBreak ? "bg-orange-500" : "bg-red-600"
        )} />
      )}

      <CardHeader className="bg-white/5 p-4 md:p-6 flex flex-row items-center justify-between relative z-10 border-b border-white/5">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl font-headline">
            {isBreak ? <Coffee className="h-5 w-5 text-orange-400" /> : <BookOpenCheck className="h-5 w-5 text-red-600" />}
            <span className="tracking-tight">{isBreak ? 'Rest Cycle' : 'Elite Focus'}</span>
          </CardTitle>
          {!isBreak && activeTask && (
            <p className="text-[10px] font-black text-primary uppercase tracking-widest px-1">
              Objective: {activeTask.subjectName}
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">
            {isActive && !isBreak && (
              <div className="flex items-center gap-1.5 bg-red-600/20 px-3 py-1 rounded-full border border-red-600/20 animate-pulse">
                <Wifi className="h-3 w-3 text-red-600" />
                <span className="text-[9px] font-black uppercase text-red-600 tracking-widest">LIVE SYNC</span>
              </div>
            )}
            {isBreak && (
               <div className="flex items-center gap-1.5 bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/20">
                  <Zap className="h-3 w-3 text-orange-400" />
                  <span className="text-[9px] font-black uppercase text-orange-400 tracking-widest">BREAK</span>
               </div>
            )}
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center gap-8 py-10 relative z-10">
        {!isBreak && activeTask && (
           <div className="text-center space-y-1">
              <h2 className="text-3xl font-black tracking-tighter text-white">{activeTask.chapterName}</h2>
              {activeTask.note && <p className="text-xs text-white/40 italic">"{activeTask.note}"</p>}
           </div>
        )}

        <div className="relative h-64 w-64 sm:h-72 sm:w-72">
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
            <span className="text-6xl md:text-7xl font-black font-mono tracking-tighter tabular-nums drop-shadow-2xl">
              {String(minutesDisplay).padStart(2, '0')}:{String(secondsDisplay).padStart(2, '0')}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full max-w-xs justify-center">
          <Button 
            onClick={isActive ? handlePause : handleStart} 
            size="lg" 
            className="flex-1 h-14 text-base font-black rounded-2xl shadow-xl shadow-red-600/10 active:scale-95 bg-red-600 hover:bg-red-700" 
          >
            {isActive ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5 fill-current" />}
            {isActive ? 'Pause' : 'Engage'}
          </Button>
          <Button onClick={handleReset} variant="ghost" size="icon" className="h-14 w-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <RotateCcw className="h-6 w-6" />
          </Button>
        </div>
      </CardContent>

      <div className="p-6 bg-white/[0.02] border-t border-white/5 relative z-10">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-primary/10 rounded-xl">
                  <Clock className="h-5 w-5 text-primary" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Active Cycle</p>
                  <p className="text-sm font-bold">{durationForMode} Minutes</p>
               </div>
            </div>
            <div className="text-right">
               <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Status</p>
               <p className={cn("text-sm font-bold uppercase", isActive ? "text-success" : "text-orange-500")}>
                  {isActive ? 'In Progress' : 'Idle'}
               </p>
            </div>
         </div>
      </div>
    </Card>
  );
}
