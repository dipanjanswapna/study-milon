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
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, BookOpenCheck, Wifi, Zap, Clock, ArrowRight, ListTodo, CheckCircle2, Target } from 'lucide-react';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const BREAK_MINUTES = 5;
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";

export function StudyTimer() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const tasksQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'tasks'),
      where('date', '==', todayStr)
    );
  }, [user, firestore, todayStr]);
  const { data: rawTasks, loading: tasksLoading } = useCollection<StudyTask>(tasksQuery);

  const activeTask = useMemo(() => {
    if (!rawTasks) return null;
    return [...rawTasks]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .find(t => !t.completed);
  }, [rawTasks]);

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastLoggedMinuteRef = useRef<number>(0);
  const initializedFromCloud = useRef(false);

  useEffect(() => {
    if (activeTask && !isActive && !isBreak) {
      setTimeLeft(activeTask.duration * 60);
    }
  }, [activeTask, isActive, isBreak]);

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

  const markTaskDone = async () => {
    if (user && activeTask) {
       await updateTaskStatus(firestore, user.uid, activeTask.id, true);
       toast({ title: "Objective Secured!", description: `${activeTask.chapterName} has been completed.` });
       handleReset();
    }
  };

  const startBreak = useCallback(async () => {
    if (user && activeTask) {
      await updateTaskStatus(firestore, user.uid, activeTask.id, true);
      toast({ title: "Objective Secured!", description: `${activeTask.chapterName} is complete.` });

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
  }, [user, activeTask, firestore, toast, handleReset]);

  const handleMinuteLog = useCallback(async () => {
    if (!user || !activeTask || isBreak) return;
    try {
        await logStudyTime(firestore, user.uid, activeTask.subjectId, activeTask.chapterId, 1);
    } catch (error) { }
  }, [user, firestore, activeTask, isBreak]);

  useEffect(() => {
    audioRef.current = new Audio(SILENT_AUDIO_URI);
    audioRef.current.loop = true;
  }, []);

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
      }
      initializedFromCloud.current = true;
    }
  }, [profile?.currentSession, activeTask, handleReset]);

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

  if (tasksLoading) return <Card className="w-full h-96 animate-pulse rounded-[2rem]" />;

  if (!activeTask && !isBreak) {
    return (
      <Card className="shadow-sm border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="font-headline uppercase">Focus Roadmap</CardTitle>
            </div>
            <CardDescription>
              Your academic focus sequence for today.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
          <div className="p-6 bg-primary/5 rounded-full">
            <ListTodo className="h-10 w-10 text-primary/40" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold font-headline">No Active Objectives</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Your focus roadmap is empty. Build your sequence in the planner to begin tracking.
            </p>
          </div>
          <Button onClick={() => router.push('/todo')} className="rounded-xl px-8 h-12 font-bold gap-2">
            Build Roadmap <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border relative overflow-hidden transition-all">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="font-headline uppercase">{isBreak ? 'Rest Cycle' : 'Elite Focus'}</CardTitle>
          </div>
          <CardDescription>
            {isBreak ? 'Time to recharge for the next objective.' : `Active: ${activeTask?.subjectName}`}
          </CardDescription>
        </div>
        {isActive && !isBreak && (
          <div className="flex items-center gap-1.5 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 animate-pulse">
            <Wifi className="h-3 w-3 text-red-500" />
            <span className="text-[9px] font-black uppercase text-red-500 tracking-widest">LIVE</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center gap-8 py-10">
        {!isBreak && activeTask && (
           <div className="text-center space-y-1 px-4">
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground font-headline uppercase">{activeTask.chapterName}</h2>
              {activeTask.note && <p className="text-xs text-muted-foreground italic">"{activeTask.note}"</p>}
           </div>
        )}

        <div className="relative h-56 w-56 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn(
              "w-full h-full rounded-full border-8 transition-colors duration-1000",
              isBreak ? "border-orange-500/10" : "border-primary/5"
            )} />
          </div>
          
          <div className="flex flex-col items-center justify-center z-10">
            <span className="text-6xl font-black font-mono tracking-tighter tabular-nums text-foreground">
              {String(minutesDisplay).padStart(2, '0')}:{String(secondsDisplay).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-1 text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] font-black uppercase tracking-widest">{isBreak ? 'Resting' : 'Focusing'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          <div className="flex items-center gap-3">
            <Button 
              onClick={isActive ? handlePause : handleStart} 
              size="lg" 
              className={cn(
                "flex-1 h-14 text-base font-black rounded-2xl shadow-lg transition-transform active:scale-95",
                isBreak ? "bg-orange-500 hover:bg-orange-600" : "bg-primary hover:bg-primary/90"
              )} 
            >
              {isActive ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5 fill-current" />}
              {isActive ? 'Pause' : 'Engage'}
            </Button>
            <Button onClick={handleReset} variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-muted-foreground/20 hover:bg-secondary transition-all">
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
          
          {!isBreak && activeTask && (
            <Button 
              variant="secondary" 
              className="h-12 rounded-xl font-bold text-xs uppercase tracking-widest"
              onClick={markTaskDone}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Secure Objective
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}