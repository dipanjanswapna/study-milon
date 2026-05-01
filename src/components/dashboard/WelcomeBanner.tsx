'use client';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser } from '@/firebase';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock, Calendar as CalendarIcon } from 'lucide-react';

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
    <Card className="relative w-full h-52 md:h-64 lg:h-72 overflow-hidden rounded-[2rem] shadow-2xl border-none">
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
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent p-6 md:p-10 flex flex-col justify-center">
        <div className="flex flex-col gap-4 md:gap-6">
          
          {/* Responsive Date and Time Badges */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
             {currentTime ? (
               <>
                 <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-[10px] md:text-xs lg:text-sm font-bold text-white uppercase tracking-wider">
                    <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                    {format(currentTime, 'EEEE, MMM do')}
                 </div>
                 <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-[10px] md:text-xs lg:text-sm font-bold text-white uppercase tracking-wider">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {format(currentTime, 'h:mm a')}
                 </div>
               </>
             ) : (
               <div className="h-8 w-32 bg-white/10 animate-pulse rounded-full" />
             )}
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter font-headline leading-none">
              Welcome back
              {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!
            </h2>
          </div>
        </div>
      </div>
    </Card>
  );
}
