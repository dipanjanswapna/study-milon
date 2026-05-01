'use client';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser } from '@/firebase';

export function WelcomeBanner() {
  const welcomeImage = PlaceHolderImages.find((p) => p.id === 'welcome-banner');
  const { user } = useUser();

  return (
    <Card className="relative w-full h-40 md:h-56 lg:h-64 overflow-hidden rounded-2xl shadow-lg border-none">
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
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent p-6 md:p-10 flex flex-col justify-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight font-headline">
          Welcome back
          {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!
        </h2>
        <p className="text-base md:text-xl text-white/80 mt-2 max-w-md">
          Success is built one session at a time. Ready to dive back in?
        </p>
      </div>
    </Card>
  );
}
