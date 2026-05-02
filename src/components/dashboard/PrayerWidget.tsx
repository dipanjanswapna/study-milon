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
          // Hindu timings based on Sunrise-Sunset for Dhaka
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
      <Card className="rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
        <CardContent className="p-10 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Syncing Timings...</p>
        </CardContent>
      </Card>
    );
  }

  if (!timings) return null;

  return (
    <Card className="rounded-[2rem] border-none shadow-xl bg-card overflow-hidden">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-2 rounded-xl",
            religion === 'Muslim' ? "bg-indigo-500/10 text-indigo-500" : "bg-orange-500/10 text-orange-500"
          )}>
             <Clock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-black">{religion === 'Muslim' ? 'Prayer Times' : 'Spiritual Timings'}</CardTitle>
            <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
              <MapPin className="h-2.5 w-2.5" /> Dhaka, BD
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn(
          "font-black text-[10px] uppercase",
          religion === 'Muslim' ? "border-indigo-500/20 text-indigo-500" : "border-orange-500/20 text-orange-500"
        )}>
          {religion === 'Muslim' ? 'IFB Method' : 'Astro Method'}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {(Object.keys(timings) as Array<keyof PrayerTimes>).map((name) => {
            const isNext = nextPrayer === name;
            const time24 = timings[name];
            if (!time24) return null;
            const time12 = format(parse(time24, 'HH:mm', new Date()), 'hh:mm a');

            return (
              <div 
                key={name} 
                className={cn(
                  "flex items-center justify-between p-4 px-6 transition-all",
                  isNext ? (religion === 'Muslim' ? "bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/10" : "bg-orange-500/5 ring-1 ring-inset ring-orange-500/10") : ""
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2 rounded-full",
                    isNext 
                      ? (religion === 'Muslim' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-110" : "bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-110") 
                      : "bg-secondary/50 text-muted-foreground"
                  )}>
                    {prayerIcons[name]}
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm font-black tracking-tight",
                      isNext ? (religion === 'Muslim' ? "text-indigo-600" : "text-orange-600") : "text-foreground"
                    )}>
                      {name}
                    </p>
                    {isNext && (
                      <span className={cn(
                        "text-[9px] font-black uppercase animate-pulse",
                        religion === 'Muslim' ? "text-indigo-400" : "text-orange-400"
                      )}>Upcoming</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-base font-black tracking-tighter",
                    isNext ? (religion === 'Muslim' ? "text-indigo-600" : "text-orange-600") : "text-muted-foreground"
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
