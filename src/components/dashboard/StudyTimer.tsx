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
import { Play, Pause, RotateCcw, Clock, ArrowRight, ListTodo, CheckCircle2, Target, Zap, Wifi } from 'lucide-react';
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

  const incompleteTasks = useMemo(() => {
    if (!rawTasks) return [];
    return [...rawTasks]
      .filter(t => !t.completed)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [rawTasks]);

  const activeTask = incompleteTasks[0] || null;
  const upcomingTasks = incompleteTasks.slice(1, 3);

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastLoggedMinuteRef = useRef<number>(0);
  const initializedFromCloud = useRef(false);

  // Constants for Circular Progress
  const radius = 90;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (activeTask && !isActive && !isBreak) {
      setTimeLeft(activeTask.duration * 60);
    }
  }, [activeTask, isActive, isBreak]);

  const totalSeconds = useMemo(() => {
    if (isBreak) return BREAK_MINUTES * 60;
    return (activeTask?.duration || 25) * 60;
  }, [isBreak, activeTask]);

  const progress = useMemo(() => {
    return ((totalSeconds - timeLeft) / totalSeconds) * 100;
  }, [timeLeft, totalSeconds]);

  const strokeDashoffset = useMemo(() => {
    return circumference - (progress / 100) * circumference;
  }, [progress, circumference]);

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
        const totalSessionSeconds = (cloudIsBreak ? BREAK_MINUTES : (activeTask?.duration || duration)) * 60;
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

  if (tasksLoading) return <Card className="w-full h-96 animate-pulse rounded-[2.5rem]" />;

  if (!activeTask && !isBreak) {
    return (
      <Card className="rounded-[2.5rem] border-none shadow-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white overflow-hidden group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-200" />
              <CardTitle className="font-headline uppercase text-white">Focus Roadmap</CardTitle>
            </div>
            <CardDescription className="text-blue-100/70">
              Deploy your sequence in the planner.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
          <div className="p-6 bg-white/10 rounded-full">
            <ListTodo className="h-10 w-10 text-white/40" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold font-headline">No Active Objectives</h3>
            <p className="text-blue-100/60 text-sm max-w-xs mx-auto">
              Ready to hustle? Build your roadmap to begin tracking.
            </p>
          </div>
          <Button onClick={() => router.push('/todo')} className="rounded-xl px-8 h-12 font-bold gap-2 bg-white text-blue-600 hover:bg-white/90">
            Build Roadmap <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[2.5rem] border-none shadow-2xl relative overflow-hidden transition-all bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-800 text-white">
      <div className="absolute top-0 right-0 p-12 opacity-5">
        <Zap className="h-48 w-48" />
      </div>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/10 pb-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-200" />
            <CardTitle className="font-headline uppercase text-white">{isBreak ? 'Rest Cycle' : 'Elite Focus'}</CardTitle>
          </div>
          <CardDescription className="text-blue-100/70">
            {isBreak ? 'Time to recharge.' : `Active: ${activeTask?.subjectName}`}
          </CardDescription>
        </div>
        {isActive && !isBreak && (
          <div className="flex items-center gap-1.5 bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30 animate-pulse">
            <Wifi className="h-3 w-3 text-red-400" />
            <span className="text-[9px] font-black uppercase text-red-400 tracking-widest">LIVE</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center gap-8 py-10 relative z-10">
        {!isBreak && activeTask && (
           <div className="text-center space-y-1 px-4">
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-white font-headline uppercase">{activeTask.chapterName}</h2>
              {activeTask.note && <p className="text-xs text-blue-100/50 italic">"{activeTask.note}"</p>}
           </div>
        )}

        <div className="relative h-64 w-64 flex items-center justify-center">
          {/* SVG Progress Ring */}
          <svg className="absolute inset-0 -rotate-90 transform" width="256" height="256">
            {/* Background Circle */}
            <circle
              className="text-white/10"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="128"
              cy="128"
            />
            {/* Progress Circle (Red) */}
            <circle
              className="text-red-500 transition-all duration-1000 ease-linear"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="128"
              cy="128"
            />
          </svg>
          
          <div className="flex flex-col items-center justify-center z-10">
            <span className={cn(
              "text-6xl font-black font-mono tracking-tighter tabular-nums text-white transition-all",
              isActive && "scale-105"
            )}>
              {String(minutesDisplay).padStart(2, '0')}:{String(secondsDisplay).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-1 text-blue-100/50 mt-1">
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
                "flex-1 h-14 text-base font-black rounded-2xl shadow-xl transition-transform active:scale-95",
                isBreak 
                  ? "bg-orange-500 hover:bg-orange-600 text-white" 
                  : "bg-white text-blue-600 hover:bg-blue-50"
              )} 
            >
              {isActive ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5 fill-current" />}
              {isActive ? 'Pause' : 'Engage'}
            </Button>
            <Button onClick={handleReset} variant="outline" size="icon" className="h-14 w-14 rounded-2xl bg-white/10 border-white/20 hover:bg-white/20 text-white transition-all">
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
          
          {!isBreak && activeTask && (
            <Button 
              variant="secondary" 
              className="h-12 rounded-xl font-bold text-xs uppercase tracking-widest bg-blue-400/20 text-blue-100 hover:bg-blue-400/30 border border-blue-400/20"
              onClick={markTaskDone}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Secure Objective
            </Button>
          )}

          {/* Upcoming Tasks Section */}
          {!isBreak && upcomingTasks.length > 0 && (
            <div className="w-full mt-6 space-y-3 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-100/40 px-1">
                <ListTodo className="h-3 w-3" />
                Upcoming Sequence
              </div>
              <div className="space-y-2">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 group/task transition-all hover:bg-white/10">
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="text-[11px] font-black text-white/90 leading-none truncate">{task.chapterName}</span>
                      <span className="text-[9px] font-bold text-blue-100/40 uppercase tracking-tighter truncate">{task.subjectName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-100/50 shrink-0 ml-2">
                       <Clock className="h-2.5 w-2.5" />
                       <span className="text-[10px] font-black">{task.duration}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
