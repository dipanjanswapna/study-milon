import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function Hero() {
  const heroImage = PlaceHolderImages.find(
    (p) => p.id === 'hero-dashboard-preview'
  );

  return (
    <section className="container grid lg:grid-cols-2 gap-12 items-center py-20 md:py-32">
      <div className="flex flex-col items-start gap-6">
        <h1 className="text-4xl font-extrabold tracking-tight font-headline md:text-5xl lg:text-6xl text-foreground">
          Track Your Hustle to the First Million Minutes.
        </h1>
        <p className="text-lg text-muted-foreground md:text-xl">
          A platform for students to track their studies, set goals, and see
          tangible progress. Turn your study hours into a success story.
        </p>
        <Button size="lg" asChild>
          <Link href="/signup">Get Started for Free</Link>
        </Button>
      </div>
      <div className="relative h-80 w-full lg:h-[400px] rounded-xl shadow-lg overflow-hidden">
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
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent"></div>
      </div>
    </section>
  );
}
