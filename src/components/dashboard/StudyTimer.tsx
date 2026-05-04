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
import { Play, Pause, ArrowRight, ListTodo, CheckCircle2, Target, Zap, Wifi, FastForward } from 'lucide-react';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useCollection } from '@/firebase';

const BREAK_MINUTES = 5;
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
const ALARM_AUDIO_PATH = "/WhatsApp Audio 2026-05-02 at 4.38.00 PM.mp3";

// QUOTA PROTECTION LIMITS
const RTDB_HEARTBEAT_INTERVAL = 60; // Update RTDB every 60s (Low cost, high speed)

export function StudyTimer() {
  const { user } = useUser();
  const firestore = useFirestore();
  const database = useDatabase();
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

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const lastRTDBSyncRef = useRef<number>(0);

  // RTDB Update: Optimized for high-frequency live leaderboard
  const updateRTDBLiveStats = useCallback(async (isStudying: boolean, currentMinutes: number) => {
    if (!user || !profile) return;
    
    const rtdbRef = ref(database, `leaderboards/daily/${user.uid}`);
    const updatePayload: any = {
      isLive: isStudying,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      category: profile.category,
      batch: profile.batch,
      minutes: currentMinutes,
      lastActive: Date.now()
    };

    update(rtdbRef, updatePayload);
  }, [user, profile, database]);

  // ANCHOR LOGIC: Persist through refresh/app closure
  useEffect(() => {
    if (profile?.currentSession?.status === 'active' && profile.currentSession.startTime) {
      const elapsed = Math.floor((Date.now() - profile.currentSession.startTime) / 1000);
      const remaining = Math.max(0, profile.currentSession.duration - elapsed);
      
      if (remaining > 0) {
        setIsActive(true);
        setIsBreak(profile.currentSession.isBreak);
        setTimeLeft(remaining);
      } else {
        // If it finished while we were away, handle auto-complete
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
  }, [profile?.currentSession, activeTask]);

  const handleStart = async () => {
    if (!user || (!activeTask && !isBreak)) {
      if (!isBreak) toast({ variant: 'destructive', title: "Roadmap Empty", description: "Please add a task first." });
      return;
    }

    const now = Date.now();
    const sessionDuration = isBreak ? (BREAK_MINUTES * 60) : (activeTask?.duration || 25) * 60;
    
    setIsActive(true);
    audioRef.current?.play().catch(() => {});
    
    // FIRESTORE BATCH: Only 1 write to start the anchor
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

    updateRTDBLiveStats(!isBreak, profile?.daily_study_minutes || 0);
  };

  const handlePause = async () => {
    if (!user || !profile?.currentSession?.startTime) return;
    
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - profile.currentSession.startTime) / 1000);
    
    setIsActive(false);
    audioRef.current?.pause();

    // FIRESTORE BATCH: Final sync on pause
    if (elapsedSeconds > 0 && !isBreak) {
      await logStudyTime(firestore, user.uid, profile.currentSession.subjectId, profile.currentSession.chapterId, elapsedSeconds);
    }

    updateUserProfile(firestore, user.uid, { 
      isStudying: false,
      "currentSession.status": "paused",
      "currentSession.startTime": null,
      "currentSession.duration": timeLeft 
    });

    updateRTDBLiveStats(false, (profile?.daily_study_minutes || 0) + Math.floor(elapsedSeconds / 60));
  };

  // TICKER & HEARTBEAT
  useEffect(() => {
    let ticker: NodeJS.Timeout | null = null;
    if (isActive && profile?.currentSession?.startTime) {
      ticker = setInterval(() => {
        const { startTime, duration } = profile.currentSession!;
        const now = Date.now();
        const elapsed = Math.floor((now - startTime!) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        
        setTimeLeft(remaining);

        // RTDB Heartbeat: High frequency live ranking without Firestore cost
        if (elapsed > 0 && elapsed % RTDB_HEARTBEAT_INTERVAL === 0 && elapsed !== lastRTDBSyncRef.current) {
           lastRTDBSyncRef.current = elapsed;
           const currentTotalMins = (profile?.daily_study_minutes || 0) + Math.floor(elapsed / 60);
           updateRTDBLiveStats(!isBreak, currentTotalMins);
        }

        if (remaining <= 0) {
          clearInterval(ticker!);
          handleSessionComplete();
        }
      }, 1000);
    }
    return () => { if (ticker) clearInterval(ticker); };
  }, [isActive, isBreak, profile?.currentSession, updateRTDBLiveStats]);

  const handleSessionComplete = async () => {
    if (!user || !profile?.currentSession) return;
    const { subjectId, chapterId, taskId, isBreak: cloudIsBreak, duration } = profile.currentSession;

    // FIRESTORE BATCH: Final log
    if (!cloudIsBreak && subjectId && chapterId) {
       await logStudyTime(firestore, user.uid, subjectId, chapterId, duration);
       if (taskId) await updateTaskStatus(firestore, user.uid, taskId, true);
    }

    if (alarmRef.current) alarmRef.current.play().catch(() => {});
    
    setIsActive(false);
    setIsBreak(false);
    updateUserProfile(firestore, user.uid, { 
      "currentSession.status": "idle", 
      "currentSession.startTime": null,
      isStudying: false 
    });
    
    updateRTDBLiveStats(false, (profile?.daily_study_minutes || 0) + Math.floor(duration / 60));
    toast({ title: isBreak ? "Rest Over!" : "Session Complete!", description: "Hustle points secured." });
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

  if (tasksLoading) return <Card className="w-full h-80 animate-pulse rounded-xl" />;

  if (!activeTask && !isBreak) {
    return (
      <Card className="rounded-xl border-none shadow-xl bg-[#1A1C3D] text-white overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="font-headline uppercase text-sm font-black tracking-tight">Focus Engine</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-5">
          <div className="p-5 bg-white/5 rounded-full">
            <ListTodo className="h-8 w-8 text-white/20" />
          </div>
          <h3 className="text-lg font-black">Engine Locked</h3>
          <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest max-w-xs mx-auto">
            Deployment of an objective is mandatory to engage focus mode.
          </p>
          <Button onClick={() => router.push('/todo')} className="rounded-xl px-6 h-10 font-bold gap-2 bg-white text-indigo-900 shadow-lg text-xs">
            Build Roadmap <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-none shadow-2xl relative overflow-hidden transition-all bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-800 text-white">
      <div className="absolute top-0 right-0 p-10 opacity-5">
        <Zap className="h-40 w-40" />
      </div>

      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/10 pb-3 relative z-10">
        <div className="space-y-0.5 overflow-hidden">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-200" />
            <CardTitle className="font-headline uppercase text-xs font-black tracking-widest">{isBreak ? 'Rest Cycle' : 'Elite Focus'}</CardTitle>
          </div>
          <CardDescription className="text-blue-100/70 truncate font-bold text-[9px] uppercase tracking-wide">
            {isBreak ? 'Deep Recharge...' : `Strict: ${activeTask?.subjectName}`}
          </CardDescription>
        </div>
        {isActive && !isBreak && (
          <div className="flex items-center gap-1 bg-red-500/20 px-2.5 py-1 rounded-full border border-red-500/30 animate-pulse shrink-0">
            <Wifi className="h-2.5 w-2.5 text-red-400" />
            <span className="text-[8px] font-black uppercase text-red-400 tracking-widest">LIVE SYNC</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col items-center justify-center gap-6 py-8 relative z-10">
        <div className="relative h-[220px] w-[220px] flex items-center justify-center">
           <div className="absolute inset-0 rounded-full bg-[#1A1C3D] shadow-inner border-[1px] border-white/10" />
           <svg className="absolute inset-0" viewBox="0 0 300 300">
              <g transform="translate(150, 150) rotate(-90)">
                 <circle cx="0" cy="0" r="110" fill="none" stroke="#222" strokeWidth="6" />
                 {progress > 0 && (
                   <circle
                      cx="0"
                      cy="0"
                      r="110"
                      fill="none"
                      stroke="#8866FF"
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 110}
                      strokeDashoffset={2 * Math.PI * 110 * (1 - progress / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-linear"
                   />
                 )}
              </g>
           </svg>
           <div className="flex flex-col items-center justify-center z-10">
            <span className="text-4xl font-black font-mono tracking-tighter tabular-nums text-white">
              {String(min).padStart(2, '0')}:{String(sec).padStart(2, '0')}
            </span>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-100/40 mt-1">{isBreak ? 'Resting' : 'Focusing'}</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 w-full max-w-[240px]">
          <div className="flex items-center gap-2">
            <Button 
              onClick={isActive ? handlePause : handleStart} 
              className={cn(
                "flex-1 h-11 text-xs font-black rounded-xl shadow-lg active:scale-95 transition-all",
                isBreak ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-white text-indigo-900 hover:bg-blue-50"
              )} 
            >
              {isActive ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4 fill-current" />}
              {isActive ? 'Pause' : 'Engage'}
            </Button>
            
            {isBreak && (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-11 w-11 rounded-xl bg-white/5 border-white/10 text-white"
                onClick={() => {
                  setIsActive(false);
                  setIsBreak(false);
                  updateUserProfile(firestore, user!.uid, { "currentSession.status": "idle", isStudying: false });
                  updateRTDBLiveStats(false, profile?.daily_study_minutes || 0);
                }}
              >
                <FastForward className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {!isBreak && activeTask && (
            <Button 
              variant="secondary" 
              className="w-full h-10 rounded-xl font-black text-[9px] uppercase tracking-widest bg-white/10 text-white hover:bg-white/20 border border-white/10"
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
                updateRTDBLiveStats(false, (profile?.daily_study_minutes || 0) + Math.floor(elapsedSeconds / 60));
                toast({ title: "Task Secured!", description: "Objective complete." });
              }}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Secure Task
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
