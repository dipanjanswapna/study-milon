'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { addStudySession } from '@/firebase/firestore/studySessions';
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
import { Play, Pause, RotateCcw, Coffee, BookOpenCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UserProfile } from '@/firebase/firestore/users';
import { doc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';

const BREAK_MINUTES = 5;

export function StudyTimer() {
  const [workDuration, setWorkDuration] = useState(25);
  const [subject, setSubject] = useState('');
  const [minutes, setMinutes] = useState(workDuration);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemo(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userDocRef);

  const toggle = () => {
    if (!subject && !isActive && !isBreak) {
      toast({
        variant: 'destructive',
        title: 'Subject Required',
        description: 'Please select a subject before starting the timer.',
      });
      return;
    }
    setIsActive(!isActive);
  };

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
  }, []);

  const handleSessionEnd = useCallback(async () => {
    if (user && subject) {
      try {
        await addStudySession(firestore, user.uid, {
          duration: workDuration,
          subject,
        });
        toast({
          title: 'Session Logged!',
          description: `Logged ${workDuration} minutes for ${subject}.`,
        });
      } catch (e: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: e.message || 'Could not log session.',
        });
      }
    }
  }, [user, firestore, workDuration, subject, toast]);

  useEffect(() => {
    if (!isActive) {
      setMinutes(workDuration);
      setSeconds(0);
    }
  }, [workDuration, isActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            if (Notification.permission === 'granted') {
              new Notification(isBreak ? "Break's over!" : 'Time for a break!');
            }
            if (isBreak) {
              reset();
            } else {
              handleSessionEnd();
              startBreak();
            }
          } else {
            setMinutes((m) => m - 1);
            setSeconds(59);
          }
        } else {
          setSeconds((s) => s - 1);
        }
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    isActive,
    seconds,
    minutes,
    isBreak,
    reset,
    startBreak,
    handleSessionEnd,
  ]);

  useEffect(() => {
    if (
      'Notification' in window &&
      Notification.permission !== 'granted' &&
      Notification.permission !== 'denied'
    ) {
      Notification.requestPermission();
    }
  }, []);

  const totalSeconds = (isBreak ? BREAK_MINUTES : workDuration) * 60;
  const remainingSeconds = minutes * 60 + seconds;
  const progress =
    totalSeconds > 0 ? 100 - (remainingSeconds / totalSeconds) * 100 : 0;

  return (
    <Card className="w-full shadow-lg dark">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isBreak ? <Coffee /> : <BookOpenCheck />}
          <span>{isBreak ? 'Break Time' : 'Study Session'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-8 py-8">
        <div className="relative h-64 w-64">
          <svg className="h-full w-full" viewBox="0 0 100 100">
            <circle
              className="stroke-current text-muted"
              strokeWidth="8"
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
            />
            <circle
              className="stroke-current text-primary transition-all duration-1000 ease-linear"
              strokeWidth="8"
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              strokeDasharray="251.2"
              strokeDashoffset={`calc(251.2 - (251.2 * ${progress}) / 100)`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold font-mono text-foreground">
              {String(minutes).padStart(2, '0')}:
              {String(seconds).padStart(2, '0')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={toggle} size="lg" className="w-32">
            {isActive ? (
              <Pause className="mr-2" />
            ) : (
              <Play className="mr-2" />
            )}
            {isActive ? 'Pause' : 'Start'}
          </Button>
          <Button onClick={reset} variant="outline" size="icon">
            <RotateCcw />
            <span className="sr-only">Reset</span>
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-4 pt-4 border-t">
        <div className="grid w-full max-w-xs items-center gap-1.5">
          <Label htmlFor="subject">Subject</Label>
          {profileLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              onValueChange={setSubject}
              defaultValue={subject}
              disabled={isActive}
            >
              <SelectTrigger id="subject">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {profile?.subjects && profile.subjects.length > 0 ? (
                  profile.subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    No subjects added yet. Please add subjects on your profile
                    page.
                  </div>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="grid w-full max-w-xs items-center gap-1.5">
          <Label htmlFor="duration">Study Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            value={workDuration}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val > 0) setWorkDuration(val);
            }}
            disabled={isActive}
            min="1"
          />
          <CardDescription>
            Set your focus time. The timer updates when reset or on page load.
          </CardDescription>
        </div>
      </CardFooter>
    </Card>
  );
}
