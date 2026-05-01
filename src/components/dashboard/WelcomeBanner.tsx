'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser } from '@/firebase';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, Calendar as CalendarIcon, BookMarked, ArrowRight } from 'lucide-react';

export function WelcomeBanner() {
  const welcomeImage = PlaceHolderImages.find((p) => p.id === 'welcome-banner');
  const { user } = useUser();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Set initial time on mount to avoid hydration mismatch
    setCurrentTime(new Date());
    
    // Update every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="relative w-full h-48 md:h-56 lg:h-64 overflow-hidden rounded-[2rem] shadow-2xl border-none">
      {welcomeImage && (
        <Image
          src={welcomeImage.imageUrl}
          alt={welcomeImage.description}
          fill
          className="object-cover transition-transform duration-1000 hover:scale-105"
          data-ai-hint={welcomeImage.imageHint}
          priority
        />
      )}
      
      {/* Dynamic Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/50 to-transparent p-6 md:p-10 flex flex-col justify-center">
        <div className="flex flex-col gap-2 md:gap-4 max-w-2xl">
          
          {/* Responsive Date and Time Badges - Smaller */}
          <div className="flex flex-wrap items-center gap-2">
             {currentTime ? (
               <>
                 <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-[9px] md:text-[10px] font-bold text-white uppercase tracking-wider">
                    <CalendarIcon className="h-3 w-3 text-primary" />
                    {format(currentTime, 'EEEE, MMM do')}
                 </div>
                 <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-[9px] md:text-[10px] font-bold text-white uppercase tracking-wider">
                    <Clock className="h-3 w-3 text-primary" />
                    {format(currentTime, 'h:mm a')}
                 </div>
               </>
             ) : (
               <div className="h-6 w-24 bg-white/10 animate-pulse rounded-full" />
             )}
          </div>

          <div className="space-y-3 md:space-y-4">
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-black text-white tracking-tighter font-headline leading-tight">
              Welcome back
              {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!
            </h2>
            
            <div className="flex flex-wrap gap-3">
              <Button asChild size="sm" className="rounded-full bg-white text-black hover:bg-white/90 font-black px-6 h-9 md:h-10 text-[10px] md:text-xs shadow-xl shadow-black/20 group">
                <Link href="/resources">
                  <BookMarked className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Resource Library
                  <ArrowRight className="ml-1.5 h-3 w-3 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
