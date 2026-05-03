
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
import { Play, Pause, Clock, ArrowRight, ListTodo, CheckCircle2, Target, Zap, Wifi } from 'lucide-react';
import { collection, query, where, doc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const BREAK_MINUTES = 5;
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
const ALARM_AUDIO_PATH = "/WhatsApp Audio 2026-05-02 at 4.38.00 PM.mp3";
const SYNC_INTERVAL_SECONDS = 10; 

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
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  
  const lastSyncTimestampRef = useRef<number>(0);
  const initializedFromCloud = useRef(false);

  // Sync timeLeft with activeTask ONLY if idle
  useEffect(() => {
    if (activeTask && !isActive && !isBreak && profile?.currentSession?.status === 'idle') {
      setTimeLeft(activeTask.duration * 60);
    }
  }, [activeTask, isActive, isBreak, profile?.currentSession?.status]);

  const progress = useMemo(() => {
    const originalTotal = isBreak ? BREAK_MINUTES * 60 : (activeTask?.duration || 25) * 60;
    return ((originalTotal - timeLeft) / originalTotal) * 100;
  }, [timeLeft, isBreak, activeTask]);

  const dailyStudyProgress = useMemo(() => {
    if (!profile) return 0;
    let currentSeconds = (profile.daily_study_minutes || 0) * 60 + (profile.partial_study_seconds || 0);
    
    if (isActive && !isBreak && profile.currentSession?.startTime) {
      const now = Date.now();
      const sessionElapsed = Math.floor((now - profile.currentSession.startTime) / 1000);
      const sessionSyncedSoFar = Math.floor((lastSyncTimestampRef.current - profile.currentSession.startTime) / 1000);
      const uncommittedSeconds = Math.max(0, sessionElapsed - (sessionSyncedSoFar > 0 ? sessionSyncedSoFar : 0));
      currentSeconds += uncommittedSeconds;
    }

    const goalSeconds = (profile.daily_goal_minutes || 360) * 60;
    return Math.min(100, (currentSeconds / goalSeconds) * 100);
  }, [profile, isActive, isBreak, timeLeft]); 

  const performSync = useCallback(async (secondsToSync: number) => {
    if (!user || !activeTask || isBreak || secondsToSync <= 0) return;
    try {
      await logStudyTime(firestore, user.uid, activeTask.subjectId, activeTask.chapterId, secondsToSync);
      // Also update the lastSyncTime in the session profile to keep DB in sync
      updateUserProfile(firestore, user.uid, { 
        "currentSession.lastSyncTime": Date.now() 
      });
    } catch (e) {
      console.error("Precision sync failed:", e);
    }
  }, [user, activeTask, isBreak, firestore]);

  const handleStart = async () => {
    if (!isActive && user && activeTask) {
      const now = Date.now();
      setIsActive(true);
      lastSyncTimestampRef.current = now;
      audioRef.current?.play().catch(() => {});
      
      const newSession: CurrentSession = {
        startTime: now,
        lastSyncTime: now,
        duration: timeLeft, 
        status: 'active',
        subjectId: activeTask.subjectId,
        chapterId: activeTask.chapterId,
        isBreak: isBreak
      };
      
      updateUserProfile(firestore, user.uid, { 
        currentSession: newSession as any, 
        isStudying: !isBreak,
        last_active_date: serverTimestamp()
      });
    }
  };

  const handlePause = async () => {
    if (user && profile?.currentSession?.startTime) {
      const now = Date.now();
      const totalElapsedThisRun = Math.floor((now - profile.currentSession.startTime) / 1000);
      const alreadySyncedThisRun = Math.floor((lastSyncTimestampRef.current - profile.currentSession.startTime) / 1000);
      const remainingToSync = Math.max(0, totalElapsedThisRun - (alreadySyncedThisRun > 0 ? alreadySyncedThisRun : 0));
      
      setIsActive(false);
      audioRef.current?.pause();

      if (remainingToSync > 0) {
        await performSync(remainingToSync);
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

  const markTaskDone = async () => {
    if (user && activeTask) {
       if (isActive && profile?.currentSession?.startTime) {
         const now = Date.now();
         const totalElapsed = Math.floor((now - profile.currentSession.startTime) / 1000);
         const alreadySynced = Math.floor((lastSyncTimestampRef.current - profile.currentSession.startTime) / 1000);
         const remaining = Math.max(0, totalElapsed - (alreadySynced > 0 ? alreadySynced : 0));
         if (remaining > 0) await performSync(remaining);
       }
       
       await updateTaskStatus(firestore, user.uid, activeTask.id, true);
       toast({ title: "Objective Secured!", description: `${activeTask.chapterName} has been completed.` });
       
       setIsActive(false);
       setIsBreak(false);
       updateUserProfile(firestore, user.uid, { 
         isStudying: false,
         "currentSession.status": "idle",
         "currentSession.startTime": null,
         "currentSession.lastSyncTime": null
       });
    }
  };

  const startBreak = useCallback(async () => {
    if (user && activeTask) {
      if (profile?.currentSession?.startTime) {
        const now = Date.now();
        const totalElapsed = Math.floor((now - profile.currentSession.startTime) / 1000);
        const alreadySynced = Math.floor((lastSyncTimestampRef.current - profile.currentSession.startTime) / 1000);
        const remaining = Math.max(0, totalElapsed - (alreadySynced > 0 ? alreadySynced : 0));
        if (remaining > 0) await performSync(remaining);
      }

      await updateTaskStatus(firestore, user.uid, activeTask.id, true);
      const breakSeconds = BREAK_MINUTES * 60;
      const now = Date.now();
      setTimeLeft(breakSeconds);
      setIsBreak(true);
      setIsActive(true);
      lastSyncTimestampRef.current = now;
      
      updateUserProfile(firestore, user.uid, {
        isStudying: false,
        currentSession: {
          startTime: now,
          lastSyncTime: now,
          duration: breakSeconds,
          status: 'active',
          subjectId: activeTask.subjectId,
          chapterId: activeTask.chapterId,
          isBreak: true
        } as any
      });
      if (alarmRef.current) alarmRef.current.play().catch(() => {});
    }
  }, [user, activeTask, firestore, profile, performSync]);

  // RECONCILER: The heart of the "Screen Off / Refresh" fix
  useEffect(() => {
    if (profile?.currentSession && !initializedFromCloud.current) {
      const { startTime, lastSyncTime, duration, status, isBreak: cloudIsBreak } = profile.currentSession;
      
      if (status === 'active' && startTime) {
        const now = Date.now();
        const elapsedSinceStart = Math.floor((now - startTime) / 1000);
        
        // 1. Calculate how many seconds passed while the tab was closed/inactive
        const effectiveLastSync = lastSyncTime || startTime;
        const totalElapsedSinceLastSync = Math.floor((now - effectiveLastSync) / 1000);
        
        // 2. Determine if the session is still within its allotted time
        if (elapsedSinceStart < duration) {
          // Still running!
          setTimeLeft(duration - elapsedSinceStart);
          setIsBreak(cloudIsBreak);
          setIsActive(true);
          
          // CRITICAL: Catch up the DB totals for the time missed while away
          if (totalElapsedSinceLastSync > 0 && !cloudIsBreak) {
            logStudyTime(firestore, user!.uid, profile.currentSession.subjectId, profile.currentSession.chapterId, totalElapsedSinceLastSync);
          }
          
          lastSyncTimestampRef.current = now;
          updateUserProfile(firestore, user!.uid, { "currentSession.lastSyncTime": now });
          audioRef.current?.play().catch(() => {});
        } else {
          // Finished while away! 
          // Sync only the remaining part of the session
          const totalUnsyncedSessionTime = Math.max(0, Math.floor((startTime + duration * 1000 - effectiveLastSync) / 1000));
          if (totalUnsyncedSessionTime > 0 && !cloudIsBreak) {
            logStudyTime(firestore, user!.uid, profile.currentSession.subjectId, profile.currentSession.chapterId, totalUnsyncedSessionTime);
          }
          
          // Reset to idle
          setIsActive(false);
          setIsBreak(false);
          updateUserProfile(firestore, user!.uid, { 
            isStudying: false,
            "currentSession.status": "idle",
            "currentSession.startTime": null,
            "currentSession.lastSyncTime": null
          });
        }
      } else if (status === 'paused') {
        setTimeLeft(duration);
        setIsBreak(cloudIsBreak);
        setIsActive(false);
      }
      initializedFromCloud.current = true;
    }
  }, [profile, firestore, user]);

  useEffect(() => {
    audioRef.current = new Audio(SILENT_AUDIO_URI);
    audioRef.current.loop = true;
    alarmRef.current = new Audio(ALARM_AUDIO_PATH);
  }, []);

  // Precise Heartbeat
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && profile?.currentSession?.startTime) {
      interval = setInterval(() => {
        const startTime = profile.currentSession!.startTime!;
        const totalDuration = profile.currentSession!.duration;
        const now = Date.now();
        
        const elapsedSinceStart = Math.floor((now - startTime) / 1000);
        const newTimeLeft = Math.max(0, totalDuration - elapsedSinceStart);
        setTimeLeft(newTimeLeft);

        const elapsedSinceLastSync = Math.floor((now - lastSyncTimestampRef.current) / 1000);
        if (elapsedSinceLastSync >= SYNC_INTERVAL_SECONDS && !isBreak) {
          performSync(elapsedSinceLastSync);
          lastSyncTimestampRef.current = now;
        }

        if (newTimeLeft === 0) {
          clearInterval(interval!);
          if (isBreak) {
            if (alarmRef.current) alarmRef.current.play().catch(() => {});
            setIsActive(false);
            setIsBreak(false);
            updateUserProfile(firestore, user!.uid, { "currentSession.status": "idle", isStudying: false });
          } else {
            startBreak();
          }
        }
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, isBreak, activeTask, profile?.currentSession, user, firestore, startBreak, performSync]);

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
        <div className="space-y-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-200" />
            <CardTitle className="font-headline uppercase text-white">{isBreak ? 'Rest Cycle' : 'Elite Focus'}</CardTitle>
          </div>
          <CardDescription className="text-blue-100/80 truncate font-bold text-[11px] uppercase tracking-wide">
            {isBreak ? 'Time to recharge.' : `Active: ${activeTask?.subjectName} | ${activeTask?.chapterName}`}
          </CardDescription>
        </div>
        {isActive && !isBreak && (
          <div className="flex items-center gap-1.5 bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30 animate-pulse shrink-0">
            <Wifi className="h-3 w-3 text-red-400" />
            <span className="text-[9px] font-black uppercase text-red-400 tracking-widest">LIVE</span>
          </div>
        )}
      </CardHeader>

      <div className="px-6 md:px-8 pt-4 relative z-10">
        <div className="flex justify-between items-center mb-1.5 text-[9px] font-black uppercase tracking-widest text-blue-100/60">
           <span>Daily Study Goal Status</span>
           <span className="flex items-center gap-1">
              <span className={cn(isActive && !isBreak && "animate-pulse text-blue-300")}>
                {Math.round(dailyStudyProgress)}%
              </span>
              <span>Secured</span>
           </span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden shadow-inner">
           <div 
             className={cn(
               "h-full bg-blue-300 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(147,197,253,0.5)]",
               isActive && !isBreak && "animate-pulse"
             )} 
             style={{ width: `${dailyStudyProgress}%` }}
           />
        </div>
      </div>
      
      <CardContent className="flex flex-col items-center justify-center gap-8 py-10 relative z-10">
        <div className="relative h-[280px] w-[280px] flex items-center justify-center scale-90 md:scale-100">
           <div className="absolute inset-0 rounded-full bg-[#1e1e1e] shadow-[0_0_40px_rgba(0,0,0,0.5)] border-4 border-[#333333]" />
           
           <svg className="absolute inset-0" viewBox="0 0 300 300">
              <g transform="translate(150, 150)">
                 {Array.from({ length: 180 }).map((_, i) => (
                    <line
                       key={i}
                       x1="0"
                       y1="-135"
                       x2="0"
                       y2={i % 10 === 0 ? "-125" : "-130"}
                       stroke={i % 10 === 0 ? "#ffffff" : "#666666"}
                       strokeWidth={i % 10 === 0 ? "1.5" : "1"}
                       transform={`rotate(${i * 2})`}
                    />
                 ))}
              </g>

              <g transform="translate(150, 150) rotate(-90)">
                 {progress > 0 && (
                   <path
                      d={describeArc(0, 0, 130, 0, progress * 3.6)}
                      fill="#8866FF"
                      fillOpacity="0.4"
                      className="transition-all duration-1000 ease-linear"
                   />
                 )}
              </g>

              <g transform="translate(150, 150)">
                 <circle
                    cx={130 * Math.cos(((progress * 3.6 - 90) * Math.PI) / 180)}
                    cy={130 * Math.sin(((progress * 3.6 - 90) * Math.PI) / 180)}
                    r="8"
                    fill="#8866FF"
                    className="transition-all duration-1000 ease-linear shadow-lg"
                 />
              </g>
           </svg>

           <div className="flex flex-col items-center justify-center z-10">
            <span className={cn(
              "text-5xl font-black font-mono tracking-tighter tabular-nums text-white transition-all",
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

          {!isBreak && upcomingTasks.length > 0 && (
            <div className="w-full mt-6 space-y-3 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-100/40 px-1">
                <ListTodo className="h-3 w-3" />
                Upcoming Sequence
              </div>
              <div className="space-y-2">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 transition-all hover:bg-white/10">
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

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  const d = [
    "M", x, y,
    "L", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "L", x, y,
    "Z"
  ].join(" ");
  return d;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}
