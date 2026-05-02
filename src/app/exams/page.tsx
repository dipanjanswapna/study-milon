'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Timer, Calendar, Zap } from 'lucide-react';
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, isAfter } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function ExamsPage() {
  const firestore = useFirestore();
  const examsQuery = useMemo(() => query(collection(firestore, 'exams'), orderBy('examDate', 'asc')), [firestore]);
  const { data: exams, loading } = useCollection<any>(examsQuery);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-3">
                <Timer className="h-10 w-10 text-primary" />
                Exam Countdown
              </h1>
              <p className="text-muted-foreground text-sm font-medium">Synchronize your hustle with the academic clock.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-[2.5rem]" />)
            ) : exams && exams.length > 0 ? (
              exams.map((exam) => (
                <ExamCountdownCard key={exam.id} exam={exam} />
              ))
            ) : (
              <div className="col-span-full py-20 text-center space-y-4 bg-secondary/20 rounded-[2.5rem] border-2 border-dashed">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <h3 className="text-xl font-bold">No Exams Scheduled</h3>
                <p className="text-muted-foreground">Check back later for upcoming academic schedules.</p>
              </div>
            )}
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary/5 p-8 flex flex-col md:flex-row items-center gap-6">
             <div className="p-4 bg-primary/10 rounded-full shrink-0">
                <Zap className="h-10 w-10 text-primary" />
             </div>
             <div className="text-center md:text-left space-y-2">
                <h4 className="text-xl font-black tracking-tight">The Final Stretch</h4>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                   যখন পরীক্ষার ঘড়ি টিকটিক করতে শুরু করে, তখন প্রতিটি minute মূল্যবান। আপনার পড়াশোনার প্ল্যানটি এই তারিখগুলোর সাথে সামঞ্জস্যপূর্ণ করুন।
                </p>
             </div>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function ExamCountdownCard({ exam }: { exam: any }) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  
  // We compute the target date inside the effect or memoize it properly 
  // to avoid creating a new Date object on every render of the card.
  const examSeconds = exam.examDate?.seconds;

  useEffect(() => {
    if (!examSeconds) return;

    const examDate = new Date(examSeconds * 1000);

    const updateTimer = () => {
      const now = new Date();
      if (isAfter(now, examDate)) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }

      const d = differenceInDays(examDate, now);
      const h = differenceInHours(examDate, now) % 24;
      const m = differenceInMinutes(examDate, now) % 60;
      const s = differenceInSeconds(examDate, now) % 60;

      // Only update if at least one value changed (to avoid unnecessary re-renders)
      setTimeLeft((prev) => {
        if (prev && prev.d === d && prev.h === h && prev.m === m && prev.s === s) {
          return prev;
        }
        return { d, h, m, s };
      });
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [examSeconds]);

  if (!examSeconds || !timeLeft) return null;

  const displayDate = new Date(examSeconds * 1000);

  return (
    <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden group hover:scale-[1.02] transition-all">
      <CardHeader className="bg-secondary/30 pb-4">
        <div className="flex justify-between items-start mb-2">
           <Badge className="bg-primary text-white border-none font-black text-[10px] uppercase px-3">
              {exam.category}
           </Badge>
           <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase">
              <Calendar className="h-3 w-3" />
              {displayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
           </div>
        </div>
        <CardTitle className="text-2xl font-black group-hover:text-primary transition-colors">{exam.title}</CardTitle>
        <CardDescription className="line-clamp-2 min-h-[32px] font-medium">{exam.description}</CardDescription>
      </CardHeader>
      <CardContent className="p-6 md:p-8 pt-6 bg-card">
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          <CountdownUnit value={timeLeft.d} label="Days" />
          <CountdownUnit value={timeLeft.h} label="Hours" />
          <CountdownUnit value={timeLeft.m} label="Mins" />
          <CountdownUnit value={timeLeft.s} label="Secs" />
        </div>
      </CardContent>
    </Card>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
       <div className="w-full aspect-square bg-slate-900 rounded-2xl flex items-center justify-center shadow-inner relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-10" />
          <span className="text-2xl md:text-4xl font-black text-white font-mono tracking-tighter">
            {String(value).padStart(2, '0')}
          </span>
       </div>
       <span className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground mt-2 tracking-widest">{label}</span>
    </div>
  );
}