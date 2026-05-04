'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser } from '@/firebase';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, Calendar as CalendarIcon, BookMarked, ArrowRight, Timer } from 'lucide-react';

export function WelcomeBanner() {
  const welcomeImage = PlaceHolderImages.find((p) => p.id === 'welcome-banner');
  const { user } = useUser();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="relative w-full h-48 md:h-64 lg:h-72 overflow-hidden rounded-xl shadow-xl border-none group">
      {welcomeImage && (
        <Image
          src={welcomeImage.imageUrl}
          alt={welcomeImage.description}
          fill
          className="object-cover transition-transform group-hover:scale-105 duration-1000"
          data-ai-hint={welcomeImage.imageHint}
          priority
        />
      )}
      
      {/* Dynamic Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent p-5 md:p-10 flex flex-col justify-center">
        <div className="flex flex-col gap-2 md:gap-4 max-w-2xl">
          
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
             {currentTime ? (
               <>
                 <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-lg px-2.5 py-1 rounded-full border border-white/20 text-[8px] md:text-[10px] font-black text-white uppercase tracking-widest transition-all hover:bg-white/20">
                    <CalendarIcon className="h-2.5 w-2.5 md:h-3 md:w-3 text-primary" />
                    {format(currentTime, 'MMM do')}
                 </div>
                 <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-lg px-2.5 py-1 rounded-full border border-white/20 text-[8px] md:text-[10px] font-black text-white uppercase tracking-widest transition-all hover:bg-white/20">
                    <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 text-primary" />
                    {format(currentTime, 'h:mm a')}
                 </div>
               </>
             ) : (
               <div className="h-5 w-20 bg-white/10 animate-pulse rounded-full" />
             )}
          </div>

          <div className="space-y-2 md:space-y-4">
            <h2 className="text-xl md:text-4xl lg:text-5xl font-black text-white tracking-tighter font-headline leading-tight drop-shadow-md">
              Welcome back
              {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!
            </h2>
            
            <div className="flex flex-wrap gap-2 md:gap-3">
              <Button asChild size="sm" className="rounded-lg bg-white text-black hover:bg-primary hover:text-white font-black px-4 md:px-5 h-8 md:h-9 text-[9px] md:text-xs shadow-xl transition-all group/btn border-none">
                <Link href="/resources">
                  <BookMarked className="mr-1.5 h-3.5 w-3.5 md:h-4 md:w-4" />
                  Resources
                  <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </Button>

              <Button asChild size="sm" variant="outline" className="rounded-lg bg-black/40 backdrop-blur-md text-white border-white/20 hover:bg-primary/20 hover:border-primary font-black px-4 md:px-5 h-8 md:h-9 text-[9px] md:text-xs shadow-xl transition-all group/btn">
                <Link href="/exams">
                  <Timer className="mr-1.5 h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  Exams
                  <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
