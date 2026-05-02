import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { DownloadSection } from '@/components/landing/DownloadSection';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SocialProof } from '@/components/landing/SocialProof';
import { Footer } from '@/components/landing/Footer';
import { RedirectIfLoggedIn } from '@/components/auth/RedirectIfLoggedIn';

export default function LandingPage() {
  return (
    <RedirectIfLoggedIn>
      <div className="flex flex-col min-h-screen bg-background">
        <Header />
        <main className="flex-grow">
          <Hero />
          <DownloadSection />
          <Features />
          <HowItWorks />
          <SocialProof />
        </main>
        <Footer />
      </div>
    </RedirectIfLoggedIn>
  );
}
