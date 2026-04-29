'use client';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser } from '@/firebase';

export function WelcomeBanner() {
  const welcomeImage = PlaceHolderImages.find((p) => p.id === 'welcome-banner');
  const { user } = useUser();

  return (
    <Card className="relative w-full h-48 md:h-56 overflow-hidden rounded-xl shadow-lg">
      {welcomeImage && (
        <Image
          src={welcomeImage.imageUrl}
          alt={welcomeImage.description}
          fill
          className="object-cover"
          data-ai-hint={welcomeImage.imageHint}
          priority
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/20 p-6 md:p-8 flex flex-col justify-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white">
          Welcome back
          {user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!
        </h2>
        <p className="text-lg text-white/80 mt-2">
          Ready to start your focus session?
        </p>
      </div>
    </Card>
  );
}
