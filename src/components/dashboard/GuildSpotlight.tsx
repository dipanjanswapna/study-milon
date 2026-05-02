'use client';

import { useMemo, useState, useEffect } from 'react';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users2, Flame, Trophy, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

export function GuildSpotlight() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Get user profile to find their guild
  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

  useEffect(() => {
    if (profile?.groupId) {
      const fetchGuildActivity = async () => {
        try {
          // Fetch all guild members (max 15 as per guild limit)
          const groupSnap = await getDocs(query(
            collection(firestore, 'users'), 
            where('groupId', '==', profile.groupId)
          ));
          
          const membersData = groupSnap.docs.map(d => ({
            ...d.data(),
            id: d.id
          }))
          .sort((a: any, b: any) => (b.daily_study_minutes || 0) - (a.daily_study_minutes || 0));

          setMembers(membersData);
        } catch (e) {
          console.error("Error fetching guild activity", e);
        } finally {
          setLoading(false);
        }
      };
      fetchGuildActivity();
    } else {
      setLoading(false);
    }
  }, [profile?.groupId, firestore]);

  if (loading) return <Skeleton className="h-64 rounded-[2rem] w-full" />;
  if (!profile?.groupId) return null;

  return (
    <Card className="rounded-[2rem] border-none shadow-xl bg-card overflow-hidden group">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl">
             <Users2 className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl font-black">Guild Activity</CardTitle>
        </div>
        <Link href={`/groups/${profile.groupId}`} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
          Full Dashboard <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] px-6 pb-6">
          {members.length > 0 ? (
            <div className="space-y-3 pt-1">
              {members.map((member, idx) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-2xl bg-secondary/20 hover:bg-secondary/40 transition-all border border-transparent hover:border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10 border-2 border-background">
                        <AvatarImage src={member.photoURL} />
                        <AvatarFallback className="font-bold">{member.displayName?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      {idx === 0 && (
                        <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 shadow-sm">
                          <Trophy className="h-3 w-3 text-white fill-current" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{member.displayName}</p>
                      <div className="flex items-center gap-1.5">
                         <Flame className="h-3 w-3 text-orange-500 fill-current" />
                         <span className="text-[10px] font-black uppercase text-muted-foreground">{member.daily_study_minutes || 0}m Today</span>
                      </div>
                    </div>
                  </div>
                  {member.daily_study_minutes > 120 && (
                     <Badge className="bg-orange-500/10 text-orange-500 border-none text-[9px] font-black uppercase tracking-tighter">On Fire</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground italic py-8">No guild activity recorded yet.</p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
