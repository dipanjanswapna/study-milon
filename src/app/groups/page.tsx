
'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ProfileSetupGate } from '@/components/dashboard/ProfileSetupGate';
import { Header } from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Search, 
  Plus, 
  Loader2,
  Users2
} from 'lucide-react';
import { createGroup, sendJoinRequest, type StudyGroup } from '@/firebase/firestore/groups';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

export default function GroupsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // User's group info
  const userRef = useMemo(() => user ? doc(firestore, 'users', user.uid) : null, [user, firestore]);
  const { data: profile } = useDoc<any>(userRef as any);

  // REDIRECTION FIX: Move router logic to useEffect to prevent state update during render
  useEffect(() => {
    if (profile?.groupId) {
      router.replace(`/groups/${profile.groupId}`);
    }
  }, [profile?.groupId, router]);

  // Fetch all groups
  const groupsQuery = useMemo(() => {
    return query(collection(firestore, 'groups'), orderBy('createdAt', 'desc'));
  }, [firestore]);
  const { data: allGroups, loading: groupsLoading } = useCollection<StudyGroup>(groupsQuery);

  const filteredGroups = useMemo(() => {
    if (!allGroups) return [];
    return allGroups.filter(g => 
      g.name.toLowerCase().includes(search.toLowerCase()) || 
      g.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [allGroups, search]);

  // Create Group State
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('HSC');
  const [newBatch, setNewBatch] = useState('2026');
  const [newDiscord, setNewDiscord] = useState('');

  const handleCreate = async () => {
    if (!user || !newName || !newCat) return;
    setLoading(true);
    try {
      const gid = await createGroup(firestore, user.uid, {
        name: newName,
        description: newDesc,
        category: newCat,
        batch: newBatch,
        discordLink: newDiscord
      });
      setIsCreateOpen(false);
      router.push(`/groups/${gid}`);
      toast({ title: 'Study Guild Created!', description: 'Invite your friends to start studying together.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (group: StudyGroup) => {
    if (!user) return;
    try {
      await sendJoinRequest(firestore, group.id, {
        uid: user.uid,
        displayName: user.displayName || 'Student',
        photoURL: user.photoURL || ''
      });
      toast({ title: 'Request Sent', description: 'The guild leader will review your application.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  // If user already belongs to a group, show a loader while the redirection effect takes place
  if (profile?.groupId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
          <ProfileSetupGate>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter flex items-center justify-center md:justify-start gap-3">
                  <Users2 className="h-10 w-10 text-primary" />
                  Study Guilds
                </h1>
                <p className="text-muted-foreground text-sm font-medium">Join a small squad of 15 elite students for maximum focus.</p>
              </div>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-full shadow-lg shadow-primary/20 h-12 px-8 font-bold text-base">
                    <Plus className="mr-2 h-5 w-5" /> Start a Guild
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black">Create Your Guild</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Guild Name</Label>
                      <Input placeholder="e.g. HSC 26 Science Toppers" value={newName} onChange={e => setNewName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Goal / Description</Label>
                      <Input placeholder="What are we studying?" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={newCat} onValueChange={setNewCat}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SSC">SSC</SelectItem>
                            <SelectItem value="HSC">HSC</SelectItem>
                            <SelectItem value="Admission">Admission</SelectItem>
                            <SelectItem value="Job Prep">Job Prep</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Batch</Label>
                        <Input placeholder="2026" value={newBatch} onChange={e => setNewBatch(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Discord Server Link (Optional)</Label>
                      <Input placeholder="https://discord.gg/..." value={newDiscord} onChange={e => setNewDiscord(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreate} disabled={loading || !newName} className="w-full h-12 font-bold">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Launch Guild
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                className="pl-12 h-12 rounded-2xl bg-card border-none shadow-sm text-lg" 
                placeholder="Search by category or name..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupsLoading ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-[2rem]" />)
              ) : filteredGroups.length > 0 ? (
                filteredGroups.map((group) => (
                  <Card key={group.id} className="rounded-[2rem] overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all group">
                    <CardHeader className="bg-primary/5 pb-4">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-primary/10 text-primary border-none font-black text-[10px] uppercase px-2 mb-2">
                          {group.category} {group.batch}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {group.memberCount || 1}/{group.memberLimit || 15}
                        </div>
                      </div>
                      <CardTitle className="text-xl font-black group-hover:text-primary transition-colors">{group.name}</CardTitle>
                      <CardDescription className="line-clamp-2 min-h-[40px]">{group.description}</CardDescription>
                    </CardHeader>
                    <CardFooter className="pt-4 flex justify-between items-center">
                      <div className="flex -space-x-2">
                        {/* Member Avatars placeholder */}
                        <div className="w-8 h-8 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-[10px] font-bold">+</div>
                      </div>
                      <Button onClick={() => handleJoin(group)} variant="secondary" className="rounded-full px-6 font-bold">
                        Request to Join
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="bg-secondary/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                    <Users className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-xl font-bold">No Guilds Found</h3>
                  <p className="text-muted-foreground">Try searching for a different batch or start your own!</p>
                </div>
              )}
            </div>

          </ProfileSetupGate>
        </main>
      </div>
    </ProtectedRoute>
  );
}
