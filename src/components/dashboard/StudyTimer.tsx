'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
  BookOpenCheck,
} from 'lucide-react';

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;

export function StudyTimer() {
  const [minutes, setMinutes] = useState(WORK_MINUTES);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);

  const toggle = () => {
    setIsActive(!isActive);
  };

  const reset = useCallback(() => {
    setIsActive(false);
    setIsBreak(false);
    setMinutes(WORK_MINUTES);
    setSeconds(0);
  }, []);

  const startBreak = useCallback(() => {
    setIsActive(true);
    setIsBreak(true);
    setMinutes(BREAK_MINUTES);
    setSeconds(0);
  }, []);

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
  }, [isActive, seconds, minutes, isBreak, reset, startBreak]);

  useEffect(() => {
    if (
      'Notification' in window &&
      Notification.permission !== 'granted' &&
      Notification.permission !== 'denied'
    ) {
      Notification.requestPermission();
    }
  }, []);

  const totalSeconds = (isBreak ? BREAK_MINUTES : WORK_MINUTES) * 60;
  const remainingSeconds = minutes * 60 + seconds;
  const progress =
    totalSeconds > 0 ? 100 - (remainingSeconds / totalSeconds) * 100 : 0;

  return (
    <Card className="w-full shadow-lg">
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
    </Card>
  );
}
