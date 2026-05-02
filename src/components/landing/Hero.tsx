import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Sparkles, ArrowRight } from 'lucide-react';

export function Hero() {
  const heroImage = PlaceHolderImages.find(
    (p) => p.id === 'hero-dashboard-preview'
  );

  return (
    <section className="container grid lg:grid-cols-2 gap-12 items-center py-20 md:py-32 px-4 md:px-6">
      <div className="flex flex-col items-center text-center lg:items-start lg:text-left gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest border border-primary/20">
          <Sparkles className="h-3 w-3" />
          The Million Minute Quest
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight font-headline md:text-5xl lg:text-7xl text-foreground leading-tight">
          Track Your Hustle to the First <span className="text-primary italic">Million</span> Minutes.
        </h1>
        <p className="text-lg text-muted-foreground md:text-xl max-w-xl">
          Join the elite community of students tracking their way to success. Set goals, join guilds, and conquer your distractions with Study Milon.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Button size="lg" asChild className="rounded-full h-14 px-8 font-bold text-lg shadow-xl shadow-primary/20">
            <Link href="/signup">Start Your Hustle Free</Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="rounded-full h-14 px-8 font-bold text-lg">
            <Link href="/login">Continue Session <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      </div>
      <div className="relative h-80 w-full lg:h-[500px] rounded-[2.5rem] shadow-2xl overflow-hidden border-8 border-background ring-1 ring-border">
        {heroImage && (
          <Image
            src={heroImage.imageUrl}
            alt={heroImage.description}
            fill
            className="object-cover"
            data-ai-hint={heroImage.imageHint}
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent"></div>
      </div>
    </section>
  );
}
