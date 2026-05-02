import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ShieldAlert, Users2, Clock, Trophy } from 'lucide-react';

const features = [
  {
    icon: <ShieldAlert className="h-8 w-8 text-primary" />,
    title: 'Focus Shield',
    description:
      'Native-level blocker for Facebook Reels, YouTube Shorts, and Instagram. Stop mindless scrolling and reclaim your time.',
  },
  {
    icon: <Users2 className="h-8 w-8 text-primary" />,
    title: 'Elite Guilds',
    description:
      'Join specialized squads of 15 students. Share goals, sync through Discord, and compete for global ranking together.',
  },
  {
    icon: <Clock className="h-8 w-8 text-primary" />,
    title: 'Inclusive Routine',
    description:
      'Integrated real-time spiritual timings for Muslim and Hindu students to help you balance prayers and productivity.',
  },
  {
    icon: <Trophy className="h-8 w-8 text-primary" />,
    title: 'Academic Roadmap',
    description:
      'Log subjects and chapters, track revision counts, and visualize your progress toward the first million study minutes.',
  },
];

export function Features() {
  return (
    <section className="py-20 md:py-32 bg-secondary/50">
      <div className="container px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl font-black font-headline md:text-5xl tracking-tighter">
            Engineered for <span className="text-primary italic">Elite</span> Performance
          </h2>
          <p className="text-muted-foreground text-lg font-medium">
            Study Milon is more than a tracker—it's a complete study environment designed to take your ambition to the next level.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="rounded-[2rem] border-none shadow-xl bg-card hover:scale-105 transition-transform duration-300">
              <CardHeader className="p-8">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mb-6">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl font-black">{feature.title}</CardTitle>
                <CardDescription className="pt-2 text-sm leading-relaxed font-medium">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
