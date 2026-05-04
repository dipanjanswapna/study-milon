'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useDatabase } from '@/firebase';
import { logStudyTime } from '@/firebase/firestore/hierarchy';
import { updateUserProfile, type CurrentSession } from '@/firebase/firestore/users';
import { updateTaskStatus, type StudyTask } from '@/firebase/firestore/todo';
import { ref, update } from 'firebase/database';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, ArrowRight, ListTodo, CheckCircle2, Target, Zap, Wifi, FastForward, Clock } from 'lucide-react';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format, startOfWeek } from 'date-fns';
import { useCollection } from '@/firebase';

const BREAK_MINUTES = 5;
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
const ALARM_AUDIO_PATH = "/WhatsApp Audio 2026-05-02 at 4.38.00 PM.mp3";
const RTDB_HEARTBEAT_INTERVAL = 60; // Sync every 60s for quota efficiency

export function StudyTimer() {
  const { user } = useUser();
  const firestore = useFirestore();
  const database = useDatabase();
  const { toast } = useToast();
  const router = useRouter();

  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
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

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessionDate, setSessionDate] = useState<string>(todayStr);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const lastRTDBSyncRef = useRef<number>(0);

  // RTDB Live Sync: Multi-Period Paths with Auto-Reset Logic
  const updateRTDBLiveStats = useCallback(async (isStudying: boolean, studyMins: { daily: number, weekly: number, monthly: number, yearly: number }) => {
    if (!user || !profile) return;
    
    const now = new Date();
    const currentDateStr = format(now, 'yyyy-MM-dd');
    const monthStr = format(now, 'yyyy-MM');
    const yearStr = format(now, 'yyyy');
    
    // Friday-to-Thursday logic
    const weekStart = startOfWeek(now, { weekStartsOn: 5 }); 
    const weekStr = `Friday_${format(weekStart, 'yyyy-MM-dd')}`;
    
    const baseData = {
      isLive: isStudying,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      category: profile.category,
      batch: profile.batch,
      lastActive: Date.now()
    };

    const paths = {
      [`leaderboards/daily/${currentDateStr}/${user.uid}`]: { ...baseData, minutes: studyMins.daily },
      [`leaderboards/weekly/${weekStr}/${user.uid}`]: { ...baseData, minutes: studyMins.weekly },
      [`leaderboards/monthly/${monthStr}/${user.uid}`]: { ...baseData, minutes: studyMins.monthly },
      [`leaderboards/yearly/${yearStr}/${user.uid}`]: { ...baseData, minutes: studyMins.yearly },
    };

    update(ref(database), paths);
  }, [user, profile, database]);

  // Persistent Unix Timestamp Logic
  useEffect(() => {
    if (profile?.currentSession?.status === 'active' && profile.currentSession.startTime) {
      const now = Date.now();
      const elapsed = Math.floor((now - profile.currentSession.startTime) / 1000);
      const remaining = Math.max(0, profile.currentSession.duration - elapsed);
      
      if (remaining > 0) {
        setIsActive(true);
        setIsBreak(profile.currentSession.isBreak);
        setTimeLeft(remaining);
        setSessionDate(profile.last_study_day || todayStr);
      } else {
        handleSessionComplete();
      }
    } else if (profile?.currentSession?.status === 'paused') {
      setIsActive(false);
      setTimeLeft(profile.currentSession.duration);
      setIsBreak(profile.currentSession.isBreak);
    } else {
      if (activeTask && !isActive && !isBreak) {
        setTimeLeft(activeTask.duration * 60);
      }
    }
  }, [profile?.currentSession, activeTask, todayStr]);

  const handleStart = async () => {
    if (!user || (!activeTask && !isBreak)) {
      if (!isBreak) toast({ variant: 'destructive', title: "Roadmap Empty", description: "Please add a task to begin focus." });
      return;
    }

    const now = Date.now();
    setIsActive(true);
    audioRef.current?.play().catch(() => {});
    
    const newSession: Partial<CurrentSession> = {
      startTime: now,
      lastSyncTime: now,
      duration: timeLeft, 
      status: 'active',
      taskId: isBreak ? null : activeTask!.id,
      subjectId: isBreak ? null : activeTask!.subjectId,
      chapterId: isBreak ? null : activeTask!.chapterId,
      isBreak: isBreak
    };
    
    updateUserProfile(firestore, user.uid, { 
      currentSession: newSession as any, 
      isStudying: !isBreak,
      last_active_date: serverTimestamp()
    });

    updateRTDBLiveStats(!isBreak, {
      daily: profile?.daily_study_minutes || 0,
      weekly: profile?.weekly_study_minutes || 0,
      monthly: profile?.monthly_study_minutes || 0,
      yearly: profile?.yearly_study_minutes || 0
    });
  };

  const handlePause = async () => {
    if (!user || !profile?.currentSession?.startTime) return;
    
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - profile.currentSession.startTime) / 1000);
    const elapsedMins = Math.floor(elapsedSeconds / 60);
    
    setIsActive(false);
    audioRef.current?.pause();

    if (elapsedSeconds > 0 && !isBreak) {
      await logStudyTime(firestore, user.uid, profile.currentSession.subjectId, profile.currentSession.chapterId, elapsedSeconds);
    }

    updateUserProfile(firestore, user.uid, { 
      isStudying: false,
      "currentSession.status": "paused",
      "currentSession.startTime": null,
      "currentSession.duration": timeLeft 
    });

    updateRTDBLiveStats(false, {
      daily: (profile?.daily_study_minutes || 0) + elapsedMins,
      weekly: (profile?.weekly_study_minutes || 0) + elapsedMins,
      monthly: (profile?.monthly_study_minutes || 0) + elapsedMins,
      yearly: (profile?.yearly_study_minutes || 0) + elapsedMins
    });
  };

  // Main Ticker Interval
  useEffect(() => {
    let ticker: NodeJS.Timeout | null = null;
    if (isActive && profile?.currentSession?.startTime) {
      ticker = setInterval(() => {
        const { startTime, duration } = profile.currentSession!;
        const now = Date.now();
        const elapsed = Math.floor((now - startTime!) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        
        setTimeLeft(remaining);

        // Period Reset Detection
        const currentTodayStr = format(new Date(), 'yyyy-MM-dd');
        if (currentTodayStr !== sessionDate) {
          clearInterval(ticker!);
          handleMidnightReset(elapsed);
          return;
        }

        // Heartbeat Sync
        if (elapsed > 0 && elapsed % RTDB_HEARTBEAT_INTERVAL === 0 && elapsed !== lastRTDBSyncRef.current) {
           lastRTDBSyncRef.current = elapsed;
           const currentMins = Math.floor(elapsed / 60);
           updateRTDBLiveStats(!isBreak, {
             daily: (profile?.daily_study_minutes || 0) + currentMins,
             weekly: (profile?.weekly_study_minutes || 0) + currentMins,
             monthly: (profile?.monthly_study_minutes || 0) + currentMins,
             yearly: (profile?.yearly_study_minutes || 0) + currentMins
           });
        }

        if (remaining <= 0) {
          clearInterval(ticker!);
          handleSessionComplete();
        }
      }, 1000);
    }
    return () => { if (ticker) clearInterval(ticker); };
  }, [isActive, isBreak, profile?.currentSession, updateRTDBLiveStats, sessionDate]);

  const handleMidnightReset = async (elapsedSeconds: number) => {
    if (!user || !profile?.currentSession) return;
    
    if (!isBreak && elapsedSeconds > 0) {
      await logStudyTime(firestore, user.uid, profile.currentSession.subjectId, profile.currentSession.chapterId, elapsedSeconds);
    }

    updateUserProfile(firestore, user.uid, { 
      "currentSession.status": "idle",
      "currentSession.startTime": null,
      isStudying: false,
      last_study_day: format(new Date(), 'yyyy-MM-dd')
    });
    
    setIsActive(false);
    toast({ 
      title: "Period Handover", 
      description: "Leaderboards are transitioning to the next cycle. Your progress is secured.",
      duration: 5000
    });
    
    setTimeout(() => window.location.reload(), 2000);
  };

  const handleSessionComplete = async () => {
    if (!user || !profile?.currentSession) return;
    const { subjectId, chapterId, taskId, isBreak: cloudIsBreak, duration } = profile.currentSession;

    if (!cloudIsBreak && subjectId && chapterId) {
       await logStudyTime(firestore, user.uid, subjectId, chapterId, duration);
       if (taskId) await updateTaskStatus(firestore, user.uid, taskId, true);
    }

    if (alarmRef.current) {
      alarmRef.current.currentTime = 0;
      alarmRef.current.play().catch(() => {});
    }
    
    setIsActive(false);
    setIsBreak(false);
    updateUserProfile(firestore, user.uid, { 
      "currentSession.status": "idle", 
      "currentSession.startTime": null,
      isStudying: false 
    });
    
    const finalElapsedMins = Math.floor(duration / 60);
    updateRTDBLiveStats(false, {
      daily: (profile?.daily_study_minutes || 0) + finalElapsedMins,
      weekly: (profile?.weekly_study_minutes || 0) + finalElapsedMins,
      monthly: (profile?.monthly_study_minutes || 0) + finalElapsedMins,
      yearly: (profile?.yearly_study_minutes || 0) + finalElapsedMins
    });
    
    toast({ 
      title: isBreak ? "Break Over!" : "Session Complete!", 
      description: isBreak ? "Time to resume focus." : "Objective secured and marked as Done.",
    });
  };

  useEffect(() => {
    audioRef.current = new Audio(SILENT_AUDIO_URI);
    audioRef.current.loop = true;
    alarmRef.current = new Audio(ALARM_AUDIO_PATH);
  }, []);

  const progress = useMemo(() => {
    const originalTotal = isBreak ? (BREAK_MINUTES * 60) : (activeTask?.duration || 25) * 60;
    return ((originalTotal - timeLeft) / originalTotal) * 100;
  }, [timeLeft, isBreak, activeTask]);

  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;

  if (tasksLoading) return <Card className="w-full h-80 animate-pulse rounded-xl bg-secondary/20" />;

  if (!activeTask && !isBreak) {
    return (
      <Card className="rounded-xl border-none shadow-xl bg-[#1A1C3D] text-white overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/10 pb-6 p-8">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-xl">
               <Target className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="font-headline uppercase text-sm font-black tracking-widest">Focus Engine</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
          <div className="p-6 bg-white/5 rounded-full ring-1 ring-white/10">
            <ListTodo className="h-10 w-10 text-white/20" />
          </div>
          <div className="space-y-2">
             <h3 className="text-xl font-black tracking-tight">Standby Mode</h3>
             <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
               Your roadmap for today is empty. Add a study objective to initialize the focus sequence.
             </p>
          </div>
          <Button onClick={() => router.push('/todo')} className="rounded-xl px-8 h-12 font-black gap-2 bg-white text-indigo-900 shadow-xl text-xs hover:scale-105 transition-all active:scale-95 group">
            Build Roadmap <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-none shadow-2xl relative overflow-hidden transition-all bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-800 text-white group/timer">
      <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12 transition-transform group-hover/timer:rotate-45 duration-1000">
        <Zap className="h-48 w-48" />
      </div>
      <div className="absolute -bottom-10 -left-10 h-40 w-40 bg-white/5 rounded-full blur-3xl" />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/10 pb-4 p-6 md:p-8 relative z-10">
        <div className="space-y-1 overflow-hidden flex-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/10 rounded-lg">
               <Clock className="h-4 w-4 text-blue-200" />
            </div>
            <CardTitle className="font-headline uppercase text-[10px] font-black tracking-[0.2em] text-blue-100/60">
               {isBreak ? 'Rest Cycle' : 'Elite Focus'}
            </CardTitle>
          </div>
          <CardDescription className="text-white font-black text-xs md:text-sm truncate pr-4">
            {isBreak ? 'Deep Recharge' : activeTask?.chapterName}
          </CardDescription>
        </div>
        {isActive && !isBreak && (
          <div className="flex items-center gap-1.5 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/30 animate-pulse shrink-0">
            <Wifi className="h-3 w-3 text-red-400" />
            <span className="text-[9px] font-black uppercase text-red-400 tracking-widest">Live</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col items-center justify-center gap-8 py-10 md:py-14 relative z-10">
        <div className="relative h-[240px] w-[240px] md:h-[280px] md:w-[280px] flex items-center justify-center">
           <div className="absolute inset-0 rounded-full bg-[#1A1C3D]/40 backdrop-blur-md shadow-2xl border-4 border-white/5" />
           <svg className="absolute inset-0" viewBox="0 0 300 300">
              <g transform="translate(150, 150) rotate(-90)">
                 <circle cx="0" cy="0" r="125" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                 {progress > 0 && (
                   <circle
                      cx="0"
                      cy="0"
                      r="125"
                      fill="none"
                      stroke={isBreak ? "#F97316" : "#8866FF"}
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 125}
                      strokeDashoffset={2 * Math.PI * 125 * (1 - progress / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(136,102,255,0.5)]"
                   />
                 )}
              </g>
           </svg>
           <div className="flex flex-col items-center justify-center z-10">
            <span className="text-5xl md:text-7xl font-black font-mono tracking-tighter tabular-nums text-white drop-shadow-lg">
              {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-2 mt-2">
               <div className={cn("h-1.5 w-1.5 rounded-full", isBreak ? "bg-orange-400" : "bg-primary animate-pulse")} />
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">{isBreak ? 'Deep Rest' : 'Hustle'}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          <div className="flex items-center gap-3">
            <Button 
              onClick={isActive ? handlePause : handleStart} 
              className={cn(
                "flex-1 h-14 text-sm font-black rounded-xl shadow-2xl active:scale-95 transition-all border-none",
                isBreak ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-white text-indigo-900 hover:bg-blue-50"
              )} 
            >
              {isActive ? <Pause className="mr-2 h-5 w-5 fill-current" /> : <Play className="mr-2 h-5 w-5 fill-current" />}
              {isActive ? 'PAUSE' : 'DEPLOY'}
            </Button>
            
            {isBreak && (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-14 w-14 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10"
                onClick={() => {
                  setIsActive(false);
                  setIsBreak(false);
                  updateUserProfile(firestore, user!.uid, { "currentSession.status": "idle", isStudying: false });
                }}
              >
                <FastForward className="h-5 w-5" />
              </Button>
            )}
          </div>
          
          {!isBreak && activeTask && (
            <Button 
              variant="secondary" 
              className="w-full h-12 rounded-xl font-black text-[10px] uppercase tracking-widest bg-white/10 text-white hover:bg-white/20 border border-white/10 transition-all active:scale-95"
              onClick={async () => {
                const now = Date.now();
                const elapsedSeconds = Math.floor((now - (profile.currentSession?.startTime || now)) / 1000);
                
                if (isActive && elapsedSeconds > 0) {
                   await logStudyTime(firestore, user!.uid, activeTask.subjectId, activeTask.chapterId, elapsedSeconds);
                }
                
                await updateTaskStatus(firestore, user!.uid, activeTask.id, true);
                
                setIsActive(false);
                updateUserProfile(firestore, user!.uid, { 
                  isStudying: false,
                  "currentSession.status": "idle",
                  "currentSession.startTime": null
                });
                
                const currentTotalMins = (profile?.daily_study_minutes || 0) + Math.floor(elapsedSeconds / 60);
                updateRTDBLiveStats(false, {
                  daily: (profile?.daily_study_minutes || 0) + Math.floor(elapsedSeconds / 60),
                  weekly: (profile?.weekly_study_minutes || 0) + Math.floor(elapsedSeconds / 60),
                  monthly: (profile?.monthly_study_minutes || 0) + Math.floor(elapsedSeconds / 60),
                  yearly: (profile?.yearly_study_minutes || 0) + Math.floor(elapsedSeconds / 60)
                });
                toast({ title: "Objective Secured!", description: "Progress synced to global rankings." });
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Finalize Objective
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
