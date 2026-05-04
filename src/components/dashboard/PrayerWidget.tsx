'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Loader2,
  Sparkles,
  Zap
} from 'lucide-react';
import { format, parse, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/firebase/firestore/users';

type PrayerTimes = {
  Fajr?: string;
  Dhuhr?: string;
  Asr?: string;
  Maghrib?: string;
  Isha?: string;
  Pratahkal?: string;
  Madhyahna?: string;
  Sayankal?: string;
};

export function PrayerWidget() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [timings, setTimings] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextPrayer, setNextPrayer] = useState<string | null>(null);

  // Fetch User Religion
  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<UserProfile>(userRef as any);
  const religion = profile?.religion || 'Muslim';

  const calculateNextPrayer = useCallback((data: PrayerTimes) => {
    const now = new Date();
    const prayerNames = religion === 'Muslim' 
      ? ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] 
      : ['Pratahkal', 'Madhyahna', 'Sayankal'];
    
    let found = false;
    for (const name of prayerNames) {
      const timeStr = data[name as keyof PrayerTimes];
      if (!timeStr) continue;
      
      const prayerTime = parse(timeStr, 'HH:mm', now);
      if (isAfter(prayerTime, now)) {
        setNextPrayer(name);
        found = true;
        break;
      }
    }

    if (!found) {
      setNextPrayer(prayerNames[0]);
    }
  }, [religion]);

  useEffect(() => {
    async function fetchTimings() {
      const cacheKey = `timings_cache_${religion}`;
      const dateKey = `timings_date_${religion}`;
      const cached = localStorage.getItem(cacheKey);
      const cachedDate = localStorage.getItem(dateKey);
      const today = new Date().toDateString();

      if (cached && cachedDate === today) {
        const data = JSON.parse(cached);
        setTimings(data);
        calculateNextPrayer(data);
        setLoading(false);
        return;
      }

      try {
        let data: PrayerTimes = {};
        if (religion === 'Muslim') {
          const response = await fetch(
            'https://api.aladhan.com/v1/timingsByCity?city=Dhaka&country=Bangladesh&method=1'
          );
          const json = await response.json();
          data = {
            Fajr: json.data.timings.Fajr,
            Dhuhr: json.data.timings.Dhuhr,
            Asr: json.data.timings.Asr,
            Maghrib: json.data.timings.Maghrib,
            Isha: json.data.timings.Isha,
          };
        } else {
          const response = await fetch(
            'https://api.sunrise-sunset.org/json?lat=23.8103&lng=90.4125&formatted=0'
          );
          const json = await response.json();
          const sunrise = new Date(json.results.sunrise);
          const sunset = new Date(json.results.sunset);
          const noon = new Date(json.results.solar_noon);
          
          data = {
            Pratahkal: format(sunrise, 'HH:mm'),
            Madhyahna: format(noon, 'HH:mm'),
            Sayankal: format(sunset, 'HH:mm'),
          };
        }

        setTimings(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(dateKey, today);
        calculateNextPrayer(data);
      } catch (error) {
        console.error("Error fetching timings:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTimings();
  }, [religion, calculateNextPrayer]);

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
    Pratahkal: <Sunrise className="h-4 w-4" />,
    Madhyahna: <Sun className="h-4 w-4" />,
    Sayankal: <Sunset className="h-4 w-4" />,
  };

  if (loading) {
    return (
      <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
        <CardContent className="p-10 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Syncing Timings...</p>
        </CardContent>
      </Card>
    );
  }

  if (!timings) return null;

  return (
    <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between bg-secondary/10 border-b">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg",
            religion === 'Muslim' ? "bg-indigo-500/10 text-indigo-500" : "bg-orange-500/10 text-orange-500"
          )}>
             <Clock className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-tight">{religion === 'Muslim' ? 'Prayer Times' : 'Spiritual'}</CardTitle>
            <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">
              <MapPin className="h-2 w-2" /> Dhaka, BD
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn(
          "font-black text-[9px] uppercase border-none",
          religion === 'Muslim' ? "bg-indigo-500/10 text-indigo-500" : "bg-orange-500/10 text-orange-500"
        )}>
          {religion === 'Muslim' ? 'Muslim' : 'Hindu'}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-secondary/30">
          {(Object.keys(timings) as Array<keyof PrayerTimes>).map((name) => {
            const isNext = nextPrayer === name;
            const time24 = timings[name];
            if (!time24) return null;
            const time12 = format(parse(time24, 'HH:mm', new Date()), 'hh:mm a');

            return (
              <div 
                key={name} 
                className={cn(
                  "flex items-center justify-between p-4 transition-all",
                  isNext ? "bg-primary/[0.03] ring-1 ring-inset ring-primary/10" : ""
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg transition-all",
                    isNext 
                      ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110" 
                      : "bg-secondary/50 text-muted-foreground"
                  )}>
                    {prayerIcons[name]}
                  </div>
                  <div>
                    <p className={cn(
                      "text-xs font-black tracking-tight uppercase",
                      isNext ? "text-primary" : "text-foreground"
                    )}>
                      {name}
                    </p>
                    {isNext && (
                      <span className="text-[8px] font-black uppercase text-primary animate-pulse tracking-widest">Upcoming</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-black tracking-tighter tabular-nums",
                    isNext ? "text-primary" : "text-muted-foreground"
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
