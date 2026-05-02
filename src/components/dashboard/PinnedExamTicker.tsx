'use client';

import { useMemo, useState, useEffect } from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, useDoc, useUser } from '@/firebase';
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, isAfter } from 'date-fns';
import { Timer, Zap } from 'lucide-react';
import Link from 'next/link';

export function PinnedExamTicker() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

  const examRef = useMemo(() => profile?.pinnedExamId ? doc(firestore, 'exams', profile.pinnedExamId) : null, [firestore, profile?.pinnedExamId]);
  const { data: exam, loading } = useDoc<any>(examRef as any);

  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!exam?.examDate) return;

    const examDate = new Date(exam.examDate.seconds * 1000);

    const updateTimer = () => {
      const now = new Date();
      if (isAfter(now, examDate)) {
        setTimeLeft('EXAM STARTED');
        return;
      }

      const d = differenceInDays(examDate, now);
      const h = differenceInHours(examDate, now) % 24;
      const m = differenceInMinutes(examDate, now) % 60;
      const s = differenceInSeconds(examDate, now) % 60;

      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [exam]);

  if (loading || !exam || !timeLeft) return null;

  return (
    <Link href="/exams" className="block w-full">
      <div className="w-full bg-primary/10 border border-primary/20 rounded-full py-1.5 px-4 mb-4 flex items-center justify-between hover:bg-primary/15 transition-colors group">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="bg-primary/20 p-1 rounded-full animate-pulse shrink-0">
            <Zap className="h-3 w-3 text-primary fill-current" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-primary truncate">
            {exam.title}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1">
             <Timer className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
             <span className="text-[11px] font-black font-mono text-foreground tracking-tighter">
                {timeLeft}
             </span>
          </div>
          <span className="text-[8px] font-black bg-red-600 text-white px-1.5 rounded-full">LIVE</span>
        </div>
      </div>
    </Link>
  );
}
