'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Sunrise, 
  Sun, 
  CloudSun, 
  Sunset, 
  Moon, 
  Clock, 
  MapPin,
  Loader2
} from 'lucide-react';
import { format, parse, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';

type PrayerTimes = {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
};

export function PrayerWidget() {
  const [timings, setTimings] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextPrayer, setNextPrayer] = useState<string | null>(null);

  const calculateNextPrayer = useCallback((data: PrayerTimes) => {
    const now = new Date();
    const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
    
    let found = false;
    for (const name of prayerNames) {
      const prayerTime = parse(data[name], 'HH:mm', now);
      if (isAfter(prayerTime, now)) {
        setNextPrayer(name);
        found = true;
        break;
      }
    }

    if (!found) {
      setNextPrayer('Fajr');
    }
  }, []);

  // Effect 1: Initial Fetch and Cache Logic
  useEffect(() => {
    async function fetchPrayerTimes() {
      const cached = localStorage.getItem('prayer_times_cache');
      const cachedDate = localStorage.getItem('prayer_times_date');
      const today = new Date().toDateString();

      if (cached && cachedDate === today) {
        const data = JSON.parse(cached);
        setTimings(data);
        calculateNextPrayer(data);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          'https://api.aladhan.com/v1/timingsByCity?city=Dhaka&country=Bangladesh&method=1'
        );
        const json = await response.json();
        const data = {
          Fajr: json.data.timings.Fajr,
          Dhuhr: json.data.timings.Dhuhr,
          Asr: json.data.timings.Asr,
          Maghrib: json.data.timings.Maghrib,
          Isha: json.data.timings.Isha,
        };

        setTimings(data);
        localStorage.setItem('prayer_times_cache', JSON.stringify(data));
        localStorage.setItem('prayer_times_date', today);
        calculateNextPrayer(data);
      } catch (error) {
        console.error("Error fetching prayer times:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPrayerTimes();
  }, [calculateNextPrayer]);

  // Effect 2: Refresh next prayer calculation every minute
  useEffect(() => {
    if (!timings) return;

    const interval = setInterval(() => {
      calculateNextPrayer(timings);
    }, 60000);

    return () => clearInterval(interval);
  }, [timings, calculateNextPrayer]);

  const prayerIcons: Record<string, React.ReactNode> = {
    Fajr: <Sunrise className="h-4 w-4" />,
    Dhuhr: <Sun className="h-4 w-4" />,
    Asr: <CloudSun className="h-4 w-4" />,
    Maghrib: <Sunset className="h-4 w-4" />,
    Isha: <Moon className="h-4 w-4" />,
  };

  if (loading) {
    return (
      <Card className="rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
        <CardContent className="p-10 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Syncing Prayer Times...</p>
        </CardContent>
      </Card>
    );
  }

  if (!timings) return null;

  return (
    <Card className="rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/10 rounded-xl">
             <Clock className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <CardTitle className="text-xl font-black">Prayer Times</CardTitle>
            <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
              <MapPin className="h-2.5 w-2.5" /> Dhaka, BD
            </div>
          </div>
        </div>
        <Badge variant="outline" className="border-indigo-500/20 text-indigo-500 font-black text-[10px] uppercase">
          IFB Method
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {(Object.keys(timings) as Array<keyof PrayerTimes>).map((name) => {
            const isNext = nextPrayer === name;
            const time24 = timings[name];
            const time12 = format(parse(time24, 'HH:mm', new Date()), 'hh:mm a');

            return (
              <div 
                key={name} 
                className={cn(
                  "flex items-center justify-between p-4 px-6 transition-all",
                  isNext ? "bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/10" : ""
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2 rounded-full",
                    isNext ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-110" : "bg-secondary/50 text-muted-foreground"
                  )}>
                    {prayerIcons[name]}
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm font-black tracking-tight",
                      isNext ? "text-indigo-600" : "text-foreground"
                    )}>
                      {name}
                    </p>
                    {isNext && (
                      <span className="text-[9px] font-black uppercase text-indigo-400 animate-pulse">Upcoming</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-base font-black tracking-tighter",
                    isNext ? "text-indigo-600" : "text-muted-foreground"
                  )}>
                    {time12}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
