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
import { Play, Pause, Clock, ArrowRight, ListTodo, CheckCircle2, Target, Zap, Wifi, FastForward } from 'lucide-react';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const BREAK_MINUTES = 5;
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
const ALARM_AUDIO_PATH = "/WhatsApp Audio 2026-05-02 at 4.38.00 PM.mp3";
const HEARTBEAT_INTERVAL = 60; // Quota Protection: Sync every 60s

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

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const lastSyncTimestampRef = useRef<number>(0);
  const recoveryHandledRef = useRef(false);

  // Precision Sync: Updates total minutes and leaderboards
  const performSync = useCallback(async (secondsToSync: number) => {
    if (!user || !activeTask || isBreak || secondsToSync < 1) return;
    
    try {
      await logStudyTime(firestore, user.uid, activeTask.subjectId, activeTask.chapterId, secondsToSync);
      lastSyncTimestampRef.current = Date.now();
    } catch (e) {
      console.error("Critical Sync Failure:", e);
    }
  }, [user, activeTask, isBreak, firestore]);

  const handleStart = async () => {
    if (!isActive && user && (activeTask || isBreak)) {
      const now = Date.now();
      const sessionDuration = isBreak ? BREAK_MINUTES * 60 : (activeTask?.duration || 25) * 60;
      
      setIsActive(true);
      lastSyncTimestampRef.current = now;
      audioRef.current?.play().catch(() => {});
      
      const newSession: CurrentSession = {
        startTime: now,
        lastSyncTime: now,
        duration: isBreak ? timeLeft : sessionDuration, 
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
    } else if (!activeTask && !isBreak) {
      toast({ variant: 'destructive', title: "Roadmap Empty", description: "Build your roadmap before starting focus mode." });
    }
  };

  const handlePause = async () => {
    if (user && profile?.currentSession?.startTime) {
      const now = Date.now();
      const elapsedTotal = Math.floor((now - profile.currentSession.startTime) / 1000);
      const alreadySynced = Math.floor((lastSyncTimestampRef.current - profile.currentSession.startTime) / 1000);
      const remainder = Math.max(0, elapsedTotal - (alreadySynced > 0 ? alreadySynced : 0));
      
      setIsActive(false);
      audioRef.current?.pause();

      if (remainder > 0 && !isBreak) {
        await performSync(remainder);
      }

      updateUserProfile(firestore, user.uid, { 
        isStudying: false,
        "currentSession.status": "paused",
        "currentSession.startTime": null,
        "currentSession.lastSyncTime": null,
        "currentSession.duration": timeLeft 
      });
    }
  };

  const handleAutoFinish = useCallback(async (session: any) => {
    if (!user || recoveryHandledRef.current) return;
    recoveryHandledRef.current = true;
    
    const { duration, isBreak: cloudIsBreak, subjectId, chapterId, taskId } = session;
    
    // Quota Efficient: Final single write for the whole background session
    if (!cloudIsBreak && subjectId && chapterId) {
      await logStudyTime(firestore, user.uid, subjectId, chapterId, duration);
      if (taskId) await updateTaskStatus(firestore, user.uid, taskId, true);
    }
    
    setIsActive(false);
    setIsBreak(false);
    await updateUserProfile(firestore, user.uid, { 
      isStudying: false,
      "currentSession.status": "idle",
      "currentSession.startTime": null,
      "currentSession.taskId": null
    });
    
    toast({ title: "Roadmap Synced", description: "Background focus session verified and logged." });
  }, [user, firestore, toast]);

  // UNSTOPPABLE RECOVERY LOGIC
  useEffect(() => {
    if (profile?.currentSession && !recoveryHandledRef.current && user) {
      const { startTime, duration, status, isBreak: cloudIsBreak } = profile.currentSession;
      
      if (status === 'active' && startTime) {
        const now = Date.now();
        const expectedEndTime = startTime + (duration * 1000);
        
        if (now < expectedEndTime) {
          // Resume ongoing session perfectly
          const elapsed = Math.floor((now - startTime) / 1000);
          setTimeLeft(duration - elapsed);
          setIsBreak(cloudIsBreak);
          setIsActive(true);
          lastSyncTimestampRef.current = now;
          audioRef.current?.play().catch(() => {});
          recoveryHandledRef.current = true;
        } else {
          // AUTO-FINISH: Background session ended while app was closed
          handleAutoFinish(profile.currentSession);
        }
      } else if (status === 'paused') {
        setTimeLeft(duration);
        setIsBreak(cloudIsBreak);
        setIsActive(false);
        recoveryHandledRef.current = true;
      }
    }
  }, [profile, user, handleAutoFinish]);

  // ALARM & SILENT PLAYER INIT
  useEffect(() => {
    audioRef.current = new Audio(SILENT_AUDIO_URI);
    audioRef.current.loop = true;
    alarmRef.current = new Audio(ALARM_AUDIO_PATH);
  }, []);

  // TICKER & HEARTBEAT SYNC
  useEffect(() => {
    let ticker: NodeJS.Timeout | null = null;
    if (isActive && profile?.currentSession?.startTime) {
      ticker = setInterval(() => {
        const { startTime, duration } = profile.currentSession!;
        const now = Date.now();
        const elapsed = Math.floor((now - startTime!) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        
        setTimeLeft(remaining);

        // Quota Protector: Periodically sync to keep progress safe but minimize writes
        const elapsedSinceLastSync = Math.floor((now - lastSyncTimestampRef.current) / 1000);
        if (elapsedSinceLastSync >= HEARTBEAT_INTERVAL && !isBreak) {
          performSync(elapsedSinceLastSync);
        }

        if (remaining === 0) {
          clearInterval(ticker!);
          if (isBreak) {
            if (alarmRef.current) alarmRef.current.play().catch(() => {});
            setIsActive(false);
            setIsBreak(false);
            updateUserProfile(firestore, user!.uid, { "currentSession.status": "idle", isStudying: false });
          } else {
            // Auto-transition to break to maintain momentum
            const breakSecs = BREAK_MINUTES * 60;
            setTimeLeft(breakSecs);
            setIsBreak(true);
            setIsActive(true);
            lastSyncTimestampRef.current = Date.now();
            updateUserProfile(firestore, user!.uid, {
              isStudying: false,
              currentSession: {
                startTime: Date.now(),
                lastSyncTime: Date.now(),
                duration: breakSecs,
                status: 'active',
                isBreak: true
              } as any
            });
            if (alarmRef.current) alarmRef.current.play().catch(() => {});
          }
        }
      }, 1000);
    }
    return () => { if (ticker) clearInterval(ticker); };
  }, [isActive, isBreak, profile?.currentSession, user, firestore, performSync]);

  const progress = useMemo(() => {
    const originalTotal = isBreak ? BREAK_MINUTES * 60 : (activeTask?.duration || 25) * 60;
    return ((originalTotal - timeLeft) / originalTotal) * 100;
  }, [timeLeft, isBreak, activeTask]);

  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;

  if (tasksLoading) return <Card className="w-full h-80 animate-pulse rounded-xl" />;

  if (!activeTask && !isBreak) {
    return (
      <Card className="rounded-xl border-none shadow-xl bg-[#1A1C3D] text-white overflow-hidden group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="font-headline uppercase text-sm font-black tracking-tight">Focus Engine</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-5">
          <div className="p-5 bg-white/5 rounded-full">
            <ListTodo className="h-8 w-8 text-white/20" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black font-headline">Engine Locked</h3>
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest max-w-xs mx-auto">
              You must deploy an objective to the roadmap to engage focus mode.
            </p>
          </div>
          <Button onClick={() => router.push('/todo')} className="rounded-lg px-6 h-10 font-bold gap-2 bg-white text-indigo-900 hover:bg-white/90 shadow-lg text-xs">
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
                const elapsedTotal = Math.floor((now - profile.currentSession?.startTime) / 1000);
                const alreadySynced = Math.floor((lastSyncTimestampRef.current - profile.currentSession?.startTime) / 1000);
                const remainder = Math.max(0, elapsedTotal - (alreadySynced > 0 ? alreadySynced : 0));
                
                if (isActive && remainder > 0) await performSync(remainder);
                
                await updateTaskStatus(firestore, user!.uid, activeTask.id, true);
                toast({ title: "Objective Secured!", description: `${activeTask.chapterName} finished.` });
                
                setIsActive(false);
                updateUserProfile(firestore, user!.uid, { 
                  isStudying: false,
                  "currentSession.status": "idle",
                  "currentSession.startTime": null
                });
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
