
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { logStudyTime } from '@/firebase/firestore/hierarchy';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, BookOpenCheck, Settings2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { collection, query, orderBy } from 'firebase/firestore';

const BREAK_MINUTES = 5;

export function StudyTimer() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [workDuration, setWorkDuration] = useState(25);
  const [minutes, setMinutes] = useState(workDuration);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

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

  // Deep linking from To-Do List
  useEffect(() => {
    const subId = searchParams.get('subjectId');
    const chapId = searchParams.get('chapterId');
    if (subId) setSelectedSubject(subId);
    if (chapId) setSelectedChapter(chapId);
  }, [searchParams]);

  const reset = useCallback(() => {
    setIsActive(false);
    setIsBreak(false);
    setMinutes(workDuration);
    setSeconds(0);
  }, [workDuration]);

  const startBreak = useCallback(() => {
    setIsActive(true);
    setIsBreak(true);
    setMinutes(BREAK_MINUTES);
    setSeconds(0);
    toast({
        title: "Time for a break!",
        description: `Take 5 minutes to recharge.`
    })
  }, [toast]);

  const handleMinuteLog = useCallback(async () => {
    if (!user || !selectedSubject || !selectedChapter) return;
    try {
        await logStudyTime(firestore, user.uid, selectedSubject, selectedChapter, 1);
    } catch (error) {
        console.error("Failed to log study time:", error);
    }
  }, [user, firestore, selectedSubject, selectedChapter]);

  useEffect(() => {
    reset();
  }, [workDuration, reset]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && minutes * 60 + seconds > 0) {
      interval = setInterval(() => {
        if (seconds === 0) {
          if (minutes > 0) {
            setMinutes((m) => m - 1);
            setSeconds(59);
            if (!isBreak) {
                handleMinuteLog();
            }
          }
        } else {
          setSeconds((s) => s - 1);
        }
      }, 1000);
    } 
    
    if (isActive && minutes === 0 && seconds === 0) {
        if (isBreak) {
            if (Notification.permission === "granted") new Notification("Break's over! Time to get back.");
            reset();
        } else {
            if (Notification.permission === "granted") new Notification("Study session complete!");
            startBreak();
        }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds, minutes, isBreak, reset, startBreak, handleMinuteLog]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  const totalSeconds = (isBreak ? BREAK_MINUTES : workDuration) * 60;
  const remainingSeconds = minutes * 60 + seconds;
  const progress = totalSeconds > 0 ? 100 - (remainingSeconds / totalSeconds) * 100 : 0;
  
  const canStart = !!selectedSubject && !!selectedChapter;

  return (
    <Card className="w-full shadow-2xl bg-slate-900 text-white border-none overflow-hidden">
      <CardHeader className="bg-slate-800/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-headline">
          {isBreak ? <Coffee className="text-orange-400" /> : <BookOpenCheck className="text-primary" />}
          <span>{isBreak ? 'Break' : 'Focus'}</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center gap-8 py-10">
        <div className="relative h-56 w-56 md:h-64 md:w-64">
          <svg className="h-full w-full" viewBox="0 0 100 100">
            <circle className="stroke-current text-slate-700" strokeWidth="6" cx="50" cy="50" r="44" fill="transparent"/>
            <circle
              className="stroke-current text-primary transition-all duration-1000 ease-linear"
              strokeWidth="6" cx="50" cy="50" r="44" fill="transparent"
              strokeDasharray="276.46"
              strokeDashoffset={`calc(276.46 - (276.46 * ${progress}) / 100)`}
              strokeLinecap="round" transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl md:text-6xl font-bold font-mono tracking-tighter">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => setIsActive(!isActive)} 
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
                <Label htmlFor="subject" className="text-slate-400 text-xs font-bold uppercase tracking-widest">Select Subject</Label>
                <Select value={selectedSubject || ''} onValueChange={(value) => {setSelectedSubject(value); setSelectedChapter(null);}} disabled={isActive}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-11">
                        <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        {subjectsLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> : 
                            subjects?.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="chapter" className="text-slate-400 text-xs font-bold uppercase tracking-widest">Select Chapter</Label>
                 <Select onValueChange={setSelectedChapter} value={selectedChapter || ''} disabled={!selectedSubject || isActive || chaptersLoading}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-11">
                        <SelectValue placeholder="Chapter" />
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
            <Label htmlFor="duration" className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> Duration (min)
            </Label>
            <span className="text-xs font-mono text-primary">{workDuration}m</span>
          </div>
          <Input id="duration" type="number" value={workDuration}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val > 0) setWorkDuration(val);
            }}
            disabled={isActive} min="1"
            className="bg-slate-800 border-slate-700 text-white h-11"
          />
        </div>
      </CardFooter>
    </Card>
  );
}
