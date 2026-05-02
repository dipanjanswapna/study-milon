'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Apple, Smartphone, Monitor, ShieldCheck, Download, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DownloadSection() {
  const platforms = [
    {
      name: 'iPhone / iOS',
      icon: <Apple className="h-8 w-8" />,
      description: 'Optimized for Safari & Home Screen',
      tag: 'App Store Style',
      color: 'bg-slate-900',
    },
    {
      name: 'Android App',
      icon: <Smartphone className="h-8 w-8 text-primary" />,
      description: 'Full Focus Shield Protection',
      tag: 'Play Store Style',
      color: 'bg-primary/10',
    },
    {
      name: 'Windows Desktop',
      icon: <Monitor className="h-8 w-8" />,
      description: 'System-level Distraction Blocking',
      tag: 'Direct Executable',
      color: 'bg-indigo-600',
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="container px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center text-center gap-4 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-[0.2em] border border-primary/20">
            <Download className="h-3.5 w-3.5" />
            Cross-Platform Focus
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter font-headline">
            Hustle on <span className="text-primary italic">Every</span> Device.
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl font-medium">
            Install Study Milon as a native app on your phone or desktop. Sync your progress, block distractions, and stay in the zone everywhere.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {platforms.map((platform) => (
            <Card 
              key={platform.name} 
              className="group rounded-[2.5rem] border-none shadow-2xl bg-card hover:scale-[1.03] transition-all duration-500 overflow-hidden"
            >
              <CardContent className="p-10 flex flex-col items-center text-center gap-6">
                <div className={cn(
                  "w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-xl transition-transform group-hover:rotate-6",
                  platform.color === 'bg-primary/10' ? 'bg-primary text-white' : platform.color
                )}>
                  {platform.icon}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black tracking-tight">{platform.name}</h3>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    {platform.description}
                  </p>
                </div>

                <div className="pt-4 w-full">
                  <Button className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 group-hover:bg-primary group-hover:text-white transition-colors">
                    Install Now
                  </Button>
                </div>

                <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase opacity-50">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Safe
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-20 p-8 md:p-12 rounded-[3rem] bg-[#1A1C3D] text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12 transition-transform group-hover:rotate-45 duration-700">
            <Sparkles className="h-40 w-40" />
          </div>
          
          <div className="space-y-4 relative z-10 max-w-xl text-center md:text-left">
            <h4 className="text-3xl md:text-4xl font-black tracking-tighter">Native App Bridge Active</h4>
            <p className="text-white/60 font-medium text-base md:text-lg">
              Download our companion app for Windows or Android to enable <span className="text-primary font-bold">System-Level Blocking</span> for Facebook Reels, YouTube Shorts, and Instagram.
            </p>
          </div>

          <div className="shrink-0 relative z-10">
            <Button variant="secondary" size="lg" className="rounded-2xl h-16 px-10 font-black text-base shadow-xl hover:scale-105 transition-transform bg-white text-black">
              Get App Bridge
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
