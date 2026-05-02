import { UserPlus, BookOpen, Flame } from 'lucide-react';

const steps = [
  {
    icon: <UserPlus className="h-10 w-10 text-primary" />,
    title: '1. Claim Your Identity',
    description:
      'Set up your student profile, choose your academic category, and set your daily hustle goal.',
  },
  {
    icon: <BookOpen className="h-10 w-10 text-primary" />,
    title: '2. Build Your Roadmap',
    description:
      'Input your subjects and chapters. Create a visual roadmap of your entire syllabus.',
  },
  {
    icon: <Flame className="h-10 w-10 text-primary" />,
    title: '3. Join a Squad',
    description:
      'Apply to an elite Study Guild or start your own. Synchronize your hustle and climb the leaderboard.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-32">
      <div className="container px-4 md:px-6">
        <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
          <h2 className="text-3xl font-black font-headline md:text-5xl tracking-tighter text-foreground">
            The Path to <span className="text-primary">Mastery</span>
          </h2>
          <p className="text-muted-foreground text-lg font-medium">
            Deploy your study strategy in three high-impact steps.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center relative">
          <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2 hidden md:block">
            <svg
              className="w-full h-full text-primary/20"
              preserveAspectRatio="none"
              viewBox="0 0 100 1"
            >
              <line
                x1="0"
                y1="0"
                x2="100"
                y2="0"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="8 8"
              />
            </svg>
          </div>
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center relative bg-background px-4">
              <div className="mb-6 bg-secondary h-20 w-20 flex items-center justify-center rounded-3xl shadow-lg shadow-black/5 ring-1 ring-border">
                {step.icon}
              </div>
              <h3 className="text-xl font-black mb-3 font-headline uppercase tracking-tight">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed font-medium">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
