'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { logStudyTime } from '@/firebase/firestore/hierarchy';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, BookOpenCheck, Loader2 } from 'lucide-react';
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
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  const totalSeconds = (isBreak ? BREAK_MINUTES : workDuration) * 60;
  const remainingSeconds = minutes * 60 + seconds;
  const progress = totalSeconds > 0 ? 100 - (remainingSeconds / totalSeconds) * 100 : 0;
  
  const canStart = !!selectedSubject && !!selectedChapter;

  return (
    <Card className="w-full shadow-lg bg-slate-900 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isBreak ? <Coffee /> : <BookOpenCheck />}
          <span>{isBreak ? 'Break Time' : 'Study Session'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
        <div className="relative h-64 w-64">
          <svg className="h-full w-full" viewBox="0 0 100 100">
            <circle className="stroke-current text-slate-700" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"/>
            <circle
              className="stroke-current text-primary transition-all duration-1000 ease-linear"
              strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"
              strokeDasharray="251.2"
              strokeDashoffset={`calc(251.2 - (251.2 * ${progress}) / 100)`}
              strokeLinecap="round" transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold font-mono">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={() => setIsActive(!isActive)} size="lg" className="w-32" disabled={!canStart}>
            {isActive ? <Pause className="mr-2" /> : <Play className="mr-2" />}
            {isActive ? 'Pause' : 'Start'}
          </Button>
          <Button onClick={reset} variant="outline" size="icon">
            <RotateCcw />
            <span className="sr-only">Reset</span>
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-4 pt-4 border-t border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Select onValueChange={(value) => {setSelectedSubject(value); setSelectedChapter(null);}} disabled={isActive}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                        <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                        {subjectsLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> : 
                            subjects?.map(subject => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="chapter">Chapter</Label>
                 <Select onValueChange={setSelectedChapter} value={selectedChapter || ''} disabled={!selectedSubject || isActive || chaptersLoading}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                        <SelectValue placeholder="Select a chapter" />
                    </SelectTrigger>
                    <SelectContent>
                        {chaptersLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                            chapters?.map(chapter => <SelectItem key={chapter.id} value={chapter.id}>{chapter.name}</SelectItem>)
                        }
                    </SelectContent>
                </Select>
            </div>
        </div>
        <div className="grid w-full max-w-xs items-center gap-1.5 mt-4">
          <Label htmlFor="duration">Study Duration (minutes)</Label>
          <Input id="duration" type="number" value={workDuration}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val > 0) setWorkDuration(val);
            }}
            disabled={isActive} min="1"
            className="bg-slate-800 border-slate-600 text-white"
          />
          <CardDescription className="text-slate-400">
            Set your focus time for one session.
          </CardDescription>
        </div>
      </CardFooter>
    </Card>
  );
}
