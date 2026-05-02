
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { updateUserProfile, type FocusSettings } from '@/firebase/firestore/users';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Header } from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldAlert, 
  Settings2, 
  Facebook, 
  Instagram, 
  Youtube, 
  MessageSquare, 
  Phone, 
  ChevronLeft,
  AlertTriangle,
  Loader2,
  Info,
  Smartphone,
  Lock,
  Zap,
  Music,
  BookOpen,
  Monitor,
  Apple
} from 'lucide-react';
import Link from 'next/link';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Define a bridge interface for native communication (Android/iOS WebView/Windows)
declare global {
  interface Window {
    StudyMilonBridge?: {
      toggleBlocker: (app: string, enabled: boolean) => void;
      checkPermissions: () => Promise<boolean>;
      requestPermissions: () => void;
      setStrictMode: (enabled: boolean) => void;
      getPackageName?: (app: string) => string;
    };
  }
}

export default function FocusSettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [settings, setFocusSettings] = useState<FocusSettings>({
    blockFbReels: false,
    blockInstaReels: false,
    blockYoutubeShorts: false,
    restrictMessenger: false,
    restrictWhatsapp: false,
    blockSpotify: false,
    blockWattpad: false,
    strictMode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [pendingApp, setPendingApp] = useState<keyof FocusSettings | null>(null);

  useEffect(() => {
    if (!user) return;
    const userRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.focusSettings) {
          setFocusSettings(data.focusSettings);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, firestore]);

  const handleToggle = async (app: keyof FocusSettings, val: boolean) => {
    if (val) {
      // Logic for Native Bridge or Web-based Simulation
      if (window.StudyMilonBridge) {
        const hasPerms = await window.StudyMilonBridge.checkPermissions();
        if (!hasPerms) {
          setPendingApp(app);
          setIsPermissionDialogOpen(true);
          return;
        }
      } else {
        // PWA Simulation mode
        setPendingApp(app);
        setIsPermissionDialogOpen(true);
        return;
      }
    }

    await updateSettings({ ...settings, [app]: val });
    
    // Notify native bridge if exists
    if (window.StudyMilonBridge) {
      window.StudyMilonBridge.toggleBlocker(app, val);
    }
  };

  const handleToggleStrictMode = async (val: boolean) => {
    await updateSettings({ ...settings, strictMode: val });
    if (window.StudyMilonBridge) {
      window.StudyMilonBridge.setStrictMode(val);
    }
  };

  const updateSettings = async (newSettings: FocusSettings) => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserProfile(firestore, user.uid, { focusSettings: newSettings });
      setFocusSettings(newSettings);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to update', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const grantPermission = async () => {
    if (window.StudyMilonBridge) {
      window.StudyMilonBridge.requestPermissions();
    }
    
    if (pendingApp) {
      await updateSettings({ ...settings, [pendingApp]: true });
      setIsPermissionDialogOpen(false);
      setPendingApp(null);
      toast({
        title: "Blocker Activated",
        description: "Focus Shield permissions granted. System-level blocking is now active for this app.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Loading Focus Hub...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 pb-20">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild className="rounded-full">
                  <Link href="/profile">
                    <ChevronLeft className="h-6 w-6" />
                  </Link>
              </Button>
              <div>
                  <h1 className="text-3xl font-black tracking-tighter">Focus Mode</h1>
                  <p className="text-sm text-muted-foreground font-medium">Cross-Platform Distraction Blocker</p>
              </div>
            </div>
            <div className="flex gap-2">
               <div className="bg-secondary/50 p-2 rounded-lg" title="Android Support">
                 <Smartphone className="h-4 w-4 text-muted-foreground" />
               </div>
               <div className="bg-secondary/50 p-2 rounded-lg" title="iPhone Support">
                 <Apple className="h-4 w-4 text-muted-foreground" />
               </div>
               <div className="bg-secondary/50 p-2 rounded-lg" title="Windows Support">
                 <Monitor className="h-4 w-4 text-muted-foreground" />
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             
             {/* Main Blocker Controls */}
             <div className="lg:col-span-7 space-y-6">
                <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden">
                   <CardHeader className="bg-primary/5 pb-6">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-primary/10 rounded-xl">
                            <ShieldAlert className="h-5 w-5 text-primary" />
                         </div>
                         <div>
                            <CardTitle className="text-xl font-black">App Focus Shield</CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-wider">Restrict high-dopamine apps</CardDescription>
                         </div>
                      </div>
                   </CardHeader>
                   <CardContent className="p-0">
                      <div className="divide-y">
                         <BlockItem 
                            icon={<Facebook className="h-4 w-4" />} 
                            label="Facebook Reels" 
                            description="Automatically covers Reels section with Focus Screen."
                            checked={settings.blockFbReels}
                            onChange={(val) => handleToggle('blockFbReels', val)}
                         />
                         <BlockItem 
                            icon={<Instagram className="h-4 w-4" />} 
                            label="Instagram Reels" 
                            description="Prevent mindless scrolling during study sessions."
                            checked={settings.blockInstaReels}
                            onChange={(val) => handleToggle('blockInstaReels', val)}
                         />
                         <BlockItem 
                            icon={<Youtube className="h-4 w-4" />} 
                            label="YouTube Shorts" 
                            description="Keep your video learning focused on long-form content."
                            checked={settings.blockYoutubeShorts}
                            onChange={(val) => handleToggle('blockYoutubeShorts', val)}
                         />
                         <BlockItem 
                            icon={<Music className="h-4 w-4" />} 
                            label="Spotify" 
                            description="Block Spotify (com.spotify.music) to maintain silence."
                            checked={settings.blockSpotify}
                            onChange={(val) => handleToggle('blockSpotify', val)}
                         />
                         <BlockItem 
                            icon={<BookOpen className="h-4 w-4" />} 
                            label="Wattpad" 
                            description="Restrict Wattpad (com.wattpad.android) access."
                            checked={settings.blockWattpad}
                            onChange={(val) => handleToggle('blockWattpad', val)}
                         />
                         <BlockItem 
                            icon={<MessageSquare className="h-4 w-4" />} 
                            label="Messenger Access" 
                            description="Restrict chats while the study timer is running."
                            checked={settings.restrictMessenger}
                            onChange={(val) => handleToggle('restrictMessenger', val)}
                         />
                         <BlockItem 
                            icon={<Phone className="h-4 w-4" />} 
                            label="WhatsApp Access" 
                            description="Mute and hide notifications from study-unrelated groups."
                            checked={settings.restrictWhatsapp}
                            onChange={(val) => handleToggle('restrictWhatsapp', val)}
                         />
                      </div>
                   </CardContent>
                   <CardFooter className="bg-secondary/30 p-4 border-t flex items-start gap-3">
                      <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-[10px] font-medium leading-relaxed text-muted-foreground">
                        Note: Full system-level app blocking works on <strong>iPhone, Android, and Windows</strong> when using the Study Milon native app bridge.
                      </p>
                   </CardFooter>
                </Card>

                {/* Additional Settings */}
                <Card className="rounded-[2rem] border-none shadow-xl">
                   <CardHeader>
                      <CardTitle className="text-lg font-black flex items-center gap-2">
                         <Settings2 className="h-5 w-5 text-primary" />
                         Advanced Rules
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-2xl">
                         <div className="flex gap-3 items-center">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                               <Lock className="h-4 w-4 text-orange-500" />
                            </div>
                            <div>
                               <p className="text-sm font-bold">Strict Mode</p>
                               <p className="text-[10px] text-muted-foreground">Cannot disable blocker while timer is running.</p>
                            </div>
                         </div>
                         <Switch checked={settings.strictMode} onCheckedChange={handleToggleStrictMode} />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-2xl group opacity-50 cursor-not-allowed">
                         <div className="flex gap-3 items-center">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                               <Zap className="h-4 w-4 text-indigo-500" />
                            </div>
                            <div>
                               <p className="text-sm font-bold">Smart Rewards</p>
                               <p className="text-[10px] text-muted-foreground">Earn 2x Leaderboard points for Strict Mode sessions.</p>
                            </div>
                         </div>
                         <Switch disabled />
                      </div>
                   </CardContent>
                </Card>
             </div>

             {/* Focus Screen Preview */}
             <div className="lg:col-span-5">
                <div className="sticky top-20 space-y-6">
                   <Card className="rounded-[2rem] border-none shadow-2xl bg-[#1A1C3D] text-white overflow-hidden aspect-[9/16] max-w-[300px] mx-auto relative group">
                      <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-black/80" />
                      
                      <div className="relative h-full flex flex-col items-center justify-center p-8 text-center space-y-8">
                         <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center animate-pulse">
                            <ShieldAlert className="h-10 w-10 text-primary" />
                         </div>
                         
                         <div className="space-y-4">
                            <h3 className="text-2xl font-black tracking-tighter">STOP SCROLLING</h3>
                            <p className="text-xs font-bold leading-relaxed text-white/60 uppercase tracking-widest">
                               পড়াশোনার সময় বিনোদন বন্ধ! চলুন Study Milon-এ ফিরি।
                            </p>
                         </div>
                         
                         <div className="pt-8">
                            <Button className="rounded-full px-8 font-black uppercase text-[10px] tracking-widest bg-white text-black hover:bg-white/90">
                               Go Back to Study
                            </Button>
                         </div>
                      </div>

                      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-1.5 bg-white/20 rounded-full" />
                      
                      <div className="absolute bottom-4 left-4 right-4 text-[8px] font-black text-white/20 text-center uppercase tracking-[0.2em]">
                         Omni-Blocker Preview
                      </div>
                   </Card>
                   
                   <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-2xl max-w-[300px] mx-auto">
                      <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
                      <p className="text-[10px] font-bold leading-tight">
                         The Focus Screen appears automatically across iPhone, Android, and Windows when distraction apps are detected.
                      </p>
                   </div>
                </div>
             </div>

          </div>
        </main>

        <AlertDialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
           <AlertDialogContent className="rounded-[2.5rem] border-none max-w-sm">
              <AlertDialogHeader>
                 <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2">
                    <AlertTriangle className="h-8 w-8 text-primary" />
                 </div>
                 <AlertDialogTitle className="text-2xl font-black text-center">Permission Required</AlertDialogTitle>
                 <AlertDialogDescription className="text-center font-medium">
                    এই ফিচারটি কাজ করার জন্য ফোনের <strong>'Usage Access'</strong> এবং <strong>'Overlay'</strong> পারমিশন প্রয়োজন। এটি iPhone, Android এবং Windows-এ কাজ করবে।
                 </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-2 mt-4">
                 <AlertDialogAction onClick={grantPermission} className="w-full h-12 rounded-xl font-bold">Grant Permission</AlertDialogAction>
                 <AlertDialogCancel onClick={() => setIsPermissionDialogOpen(false)} className="w-full h-12 rounded-xl font-bold">Maybe Later</AlertDialogCancel>
              </AlertDialogFooter>
           </AlertDialogContent>
        </AlertDialog>

      </div>
    </ProtectedRoute>
  );
}

function BlockItem({ 
   icon, 
   label, 
   description, 
   checked, 
   onChange 
}: { 
   icon: React.ReactNode; 
   label: string; 
   description: string; 
   checked: boolean; 
   onChange: (val: boolean) => void;
}) {
   return (
      <div className="flex items-center justify-between p-6 hover:bg-secondary/10 transition-colors">
         <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
               {icon}
            </div>
            <div className="space-y-0.5">
               <p className="text-sm font-black">{label}</p>
               <p className="text-[10px] font-medium text-muted-foreground leading-tight max-w-[200px]">{description}</p>
            </div>
         </div>
         <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-primary" />
      </div>
   );
}
