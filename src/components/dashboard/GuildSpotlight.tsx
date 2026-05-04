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

  if (loading) return <Skeleton className="h-64 rounded-xl w-full" />;
  if (!profile?.groupId) return null;

  return (
    <Card className="rounded-xl border-none shadow-xl bg-card overflow-hidden group">
      <CardHeader className="pb-3 flex flex-row items-center justify-between bg-secondary/10 border-b">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
             <Users2 className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-sm font-black uppercase tracking-tight">Guild Activity</CardTitle>
        </div>
        <Link href={`/groups/${profile.groupId}`} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1 uppercase tracking-widest">
          Dashboard <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[280px]">
          {members.length > 0 ? (
            <div className="divide-y divide-secondary/30">
              {members.map((member, idx) => (
                <div key={member.id} className="flex items-center justify-between p-4 hover:bg-primary/[0.02] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-9 w-9 border-2 border-background">
                        <AvatarImage src={member.photoURL} />
                        <AvatarFallback className="font-black text-xs">{member.displayName?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      {idx === 0 && (
                        <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 shadow-sm">
                          <Trophy className="h-2.5 w-2.5 text-white fill-current" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate max-w-[120px]">{member.displayName}</p>
                      <div className="flex items-center gap-1">
                         <Flame className="h-2.5 w-2.5 text-orange-500 fill-current" />
                         <span className="text-[9px] font-black uppercase text-muted-foreground">{member.daily_study_minutes || 0}m</span>
                      </div>
                    </div>
                  </div>
                  {member.daily_study_minutes > 120 && (
                     <Badge className="bg-orange-500/10 text-orange-500 border-none text-[8px] font-black uppercase tracking-tighter h-5">On Fire</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground italic py-12">No activity recorded</p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
