'use client';

import { useMemo, useState, useEffect } from 'react';
import { collection, query, orderBy, doc, getDocs, where } from 'firebase/firestore';
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
  Users2,
  ExternalLink,
  MessageSquare,
  CheckCircle2
} from 'lucide-react';
import { createGroup, sendJoinRequest, type StudyGroup } from '@/firebase/firestore/groups';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function GroupsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
  // Track requests for the current session to update UI immediately
  const [requestedGuildIds, setRequestedGuildIds] = useState<Set<string>>(new Set());
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

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
    if (!user || !newName || !newCat || !newDiscord) {
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Guild Name and Discord Link are mandatory.' });
      return;
    }
    setCreateLoading(true);
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
      setCreateLoading(false);
    }
  };

  const handleJoin = async (group: StudyGroup) => {
    if (!user || requestedGuildIds.has(group.id)) return;
    
    setLoadingMap(prev => ({ ...prev, [group.id]: true }));
    try {
      await sendJoinRequest(firestore, group.id, {
        uid: user.uid,
        displayName: user.displayName || 'Student',
        photoURL: user.photoURL || ''
      });
      
      setRequestedGuildIds(prev => new Set(prev).add(group.id));
      toast({ 
        title: 'Request Sent', 
        description: `Your application to join ${group.name} is now pending leader review.` 
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoadingMap(prev => ({ ...prev, [group.id]: false }));
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
                <DialogContent className="max-w-xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                  <div className="grid md:grid-cols-5 h-full">
                    {/* Roadmap Sidebar */}
                    <div className="md:col-span-2 bg-[#1A1C3D] text-white p-6 space-y-6">
                       <div className="space-y-2">
                          <h3 className="text-lg font-black flex items-center gap-2">
                             <MessageSquare className="h-5 w-5 text-primary" />
                             Setup Roadmap
                          </h3>
                          <p className="text-xs text-white/50 font-medium">Follow these steps to ensure your guild is elite.</p>
                       </div>
                       
                       <div className="space-y-6">
                          <div className="flex gap-3">
                             <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black shrink-0">01</div>
                             <p className="text-[11px] font-bold text-white/80">Go to Discord and create a new server for your study group.</p>
                          </div>
                          <div className="flex gap-3">
                             <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black shrink-0">02</div>
                             <p className="text-[11px] font-bold text-white/80">Create a voice channel named 'Focus Zone' and a text channel 'Study Logs'.</p>
                          </div>
                          <div className="flex gap-3">
                             <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black shrink-0">03</div>
                             <p className="text-[11px] font-bold text-white/80">Generate a 'Never Expire' invite link for your server.</p>
                          </div>
                          <div className="flex gap-3">
                             <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black shrink-0">04</div>
                             <p className="text-[11px] font-bold text-white/80">Paste the link in the form to the right to launch your guild.</p>
                          </div>
                       </div>

                       <div className="pt-6 border-t border-white/10">
                          <Button variant="ghost" className="w-full text-white/40 hover:text-white text-xs font-bold" asChild>
                             <a href="https://discord.com" target="_blank">
                                <ExternalLink className="mr-2 h-3 w-3" /> Visit Discord
                             </a>
                          </Button>
                       </div>
                    </div>

                    {/* Form Area */}
                    <div className="md:col-span-3 p-8 bg-card">
                       <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Guild Basics</DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[500px] pr-2 mt-4">
                        <div className="space-y-4 pb-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Guild Name *</Label>
                            <Input placeholder="e.g. HSC 26 Science Toppers" value={newName} onChange={e => setNewName(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Goal / Description</Label>
                            <Input placeholder="What are we studying?" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
                              <Select value={newCat} onValueChange={setNewCat}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="SSC">SSC</SelectItem>
                                  <SelectItem value="HSC">HSC</SelectItem>
                                  <SelectItem value="Admission">Admission</SelectItem>
                                  <SelectItem value="Job Prep">Job Prep</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Batch</Label>
                              <Input placeholder="2026" value={newBatch} onChange={e => setNewBatch(e.target.value)} />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Discord Server Link *</Label>
                               <span className="text-[9px] font-bold text-muted-foreground italic">Mandatory</span>
                            </div>
                            <Input placeholder="https://discord.gg/..." value={newDiscord} onChange={e => setNewDiscord(e.target.value)} />
                            <p className="text-[9px] text-muted-foreground leading-relaxed mt-1">This link will be used for group voice study and resource sharing.</p>
                          </div>
                        </div>
                      </ScrollArea>
                      <DialogFooter className="mt-4">
                        <Button onClick={handleCreate} disabled={createLoading || !newName || !newDiscord} className="w-full h-12 font-black rounded-xl shadow-xl shadow-primary/20">
                          {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Launch Study Guild
                        </Button>
                      </DialogFooter>
                    </div>
                  </div>
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
                filteredGroups.map((group) => {
                  const isRequested = requestedGuildIds.has(group.id);
                  const isButtonLoading = loadingMap[group.id];

                  return (
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
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                              <MessageSquare className="h-4 w-4" />
                           </div>
                           <span className="text-[10px] font-bold text-muted-foreground">Discord Enabled</span>
                        </div>
                        <Button 
                          onClick={() => handleJoin(group)} 
                          variant={isRequested ? "secondary" : "default"} 
                          className={cn(
                            "rounded-full px-6 font-bold transition-all",
                            isRequested && "bg-success/10 text-success hover:bg-success/20 border-none"
                          )}
                          disabled={isRequested || isButtonLoading}
                        >
                          {isButtonLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isRequested ? (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Requested
                            </>
                          ) : (
                            'Request to Join'
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })
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