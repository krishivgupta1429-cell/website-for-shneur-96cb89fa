import { useEffect, useState } from "react";
import FloatingParticles from "@/components/FloatingParticles";
import RaffleForm from "@/components/RaffleForm";
import { usePerformanceLogger } from "@/hooks/use-performance-logger";
const Index = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Performance logging (dev only)
  usePerformanceLogger();
  useEffect(() => {
    // Check if mobile (≤768px)
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    checkMobile();
    mediaQuery.addEventListener('change', handleReducedMotionChange);

    // Debounced resize handler with requestAnimationFrame batching
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        requestAnimationFrame(checkMobile);
      }, 100);
    };
    window.addEventListener('resize', handleResize, {
      passive: true
    });

    // Debounced scroll handler (16ms = 60fps)
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Scroll handling logic if needed
      }, 16);
    };
    window.addEventListener('scroll', handleScroll, {
      passive: true
    });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      mediaQuery.removeEventListener('change', handleReducedMotionChange);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);
  return <div className="min-h-screen relative overflow-hidden">
      {/* Rich Dark Gradient Background with Animated Shimmer */}
      <div className="fixed inset-0 bg-shimmer -z-20" />
      
      {/* Additional depth layers - candle light gradients radiating from center */}
      <div className="fixed inset-0 -z-10">
        {/* Central glow behind menorah area - static on mobile, animated on desktop */}
        {isMobile ? <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-amber/15 via-gold/8 to-transparent opacity-50 mobile-glow-static" /> : <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-amber/20 via-gold/10 to-transparent blur-3xl opacity-60 ${!prefersReducedMotion ? 'animate-gentle-pulse' : ''}`} />}
        {/* Secondary warm glows - reduced on mobile */}
        {isMobile ? <>
            <div className="absolute top-1/3 left-1/4 w-[500px] h-[400px] bg-gradient-radial from-amber/10 via-transparent to-transparent opacity-25 mobile-glow-static" />
            <div className="absolute top-1/3 right-1/4 w-[500px] h-[400px] bg-gradient-radial from-gold/10 via-transparent to-transparent opacity-25 mobile-glow-static" />
          </> : <>
            <div className="absolute top-1/3 left-1/4 w-[500px] h-[400px] bg-gradient-radial from-amber/15 via-transparent to-transparent blur-3xl opacity-40" />
            <div className="absolute top-1/3 right-1/4 w-[500px] h-[400px] bg-gradient-radial from-gold/15 via-transparent to-transparent blur-3xl opacity-40" />
          </>}
        {/* Edge amber warmth */}
        <div className="absolute bottom-0 left-0 right-0 h-[400px] bg-gradient-to-t from-amber/10 via-transparent to-transparent" />
      </div>
      
      {/* Floating Particles - hidden on mobile */}
      {!isMobile && <FloatingParticles />}

      {/* Content */}
      <div className="relative z-10 container max-w-2xl mx-auto px-4 py-12 md:py-16">
        {/* Combined Banner + Form Card */}
        <div className="relative animate-fade-in animation-delay-200">
          {/* Multiple glow layers behind card for depth - simplified on mobile */}
          {isMobile ? <div className="absolute -inset-4 bg-gradient-to-br from-gold/20 via-amber/15 to-gold/15 rounded-3xl opacity-30 mobile-glow-static" /> : <>
              <div className={`absolute -inset-6 bg-gradient-to-br from-gold/30 via-amber/20 to-gold/20 rounded-3xl blur-3xl opacity-40 ${!prefersReducedMotion ? 'animate-gentle-pulse' : ''}`} />
              <div className="absolute -inset-4 bg-gradient-to-br from-gold/20 via-amber/15 to-transparent rounded-3xl blur-2xl opacity-30" />
            </>}
          
          {/* Banner Image with rounded top corners */}
          <div className="relative">
            <img src="/menorah-at-the-falls-banner.jpg" alt="Menorah at the Falls" className="w-full h-auto object-cover rounded-t-3xl" />
          </div>
          
          {/* Date/Time Line */}
          <p className="text-center text-2xl font-medium text-gold py-4 bg-gradient-to-b from-black/20 to-transparent">
            Sunday, December 14 · 5:00 PM
          </p>
          
          {/* Event Highlights Section */}
          <div className="py-8 px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
              {/* Fire Show */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-amber-400/60 via-gold/40 to-amber-500/60 blur-md opacity-70" />
                  <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.4)] overflow-hidden">
                    <img src="/Fire-Show.jpg" alt="Fire Show" className="w-full h-full object-cover" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.3)] mb-1">
                  Fire Show
                </h3>
                <p className="text-sm text-amber-100/80">
                  A thrilling fire performance to kick off the night.
                </p>
              </div>
              
              {/* Giant Menorah Lighting */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-amber-400/60 via-gold/40 to-amber-500/60 blur-md opacity-70" />
                  <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.4)] overflow-hidden">
                    <img src="/Giant-Menorah-Lighting.jpg" alt="Giant Menorah Lighting" className="w-full h-full object-cover" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.3)] mb-1">
                  Giant Menorah Lighting
                </h3>
                <p className="text-sm text-amber-100/80">
                  Watch the giant menorah light up Riverside Park!
                </p>
              </div>
              
              {/* Fire Truck Gelt Drop */}
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-amber-400/60 via-gold/40 to-amber-500/60 blur-md opacity-70" />
                  <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.4)] overflow-hidden">
                    <img src="/Fire-Truck-Gelt-Drop.jpg" alt="Fire Truck Gelt Drop" className="w-full h-full object-cover" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.3)] mb-1">
                  Fire Truck Gelt Drop
                </h3>
                <p className="text-sm text-amber-100/80">
                  Chanukah treats dropped from a real fire truck!
                </p>
              </div>
            </div>
          </div>
          
          {/* Event Schedule Section */}
          <div className="py-6">
            {/* Section Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl md:text-2xl font-semibold text-gold drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]">
                ✨ Event Schedule ✨
              </h2>
              <p className="text-sm md:text-base font-medium text-amber-100/80 mt-3 mb-2">
                All are welcome to attend the Menorah lighting at Riverside Park. The Chanukah party at Chabad is full.
              </p>
            </div>
            
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Block 1: Riverside Park */}
              <div className="relative group">
                {/* Subtle glow on hover */}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-400/20 via-gold/10 to-amber-500/20 rounded-xl blur-sm opacity-60 group-hover:opacity-80 transition-opacity" />
                
                <div className="relative bg-gradient-to-br from-black/50 via-black/40 to-black/50 backdrop-blur-sm rounded-xl border border-gold/20 p-5 md:p-6 h-full">
                  {/* Inner glow accent */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-amber-500/5 via-transparent to-gold/5 pointer-events-none" />
                  
                  <div className="relative z-10">
                    {/* Heading */}
                    <h3 className="text-lg md:text-xl font-bold uppercase tracking-[0.15em] text-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.3)] mb-4">
                      THE EVENT BEGINS AT RIVERSIDE PARK
                    </h3>
                    
                    {/* Event Times */}
                    <div className="space-y-3 mb-5">
                      <p className="text-amber-100/85 text-sm md:text-base leading-relaxed">
                        <span className="text-gold">5pm:</span> Enjoy a fire show and hot drinks. 🔥
                      </p>
                      <p className="text-amber-100/85 text-sm md:text-base leading-relaxed">
                        <span className="text-gold">5:30pm:</span> Menorah lighting and a Gelt Drop, with Chanukah treats raining down from a fire truck! 🚒
                      </p>
                    </div>
                    
                    {/* Location */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gold/10">
                      <p className="text-[11px] md:text-xs text-amber-200/60 tracking-wide">
                        📍 Riverside Park, Chagrin Falls Main Street
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Block 2: Chabad at the Falls */}
              <div className="relative group">
                {/* Subtle glow on hover */}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-400/20 via-gold/10 to-amber-500/20 rounded-xl blur-sm opacity-60 group-hover:opacity-80 transition-opacity" />
                
                <div className="relative bg-gradient-to-br from-black/50 via-black/40 to-black/50 backdrop-blur-sm rounded-xl border border-gold/20 p-5 md:p-6 h-full">
                  {/* Inner glow accent */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-amber-500/5 via-transparent to-gold/5 pointer-events-none" />
                  
                  <div className="relative z-10">
                    {/* Heading */}
                    <h3 className="text-lg md:text-xl font-bold uppercase tracking-[0.15em] text-gold drop-shadow-[0_0_10px_rgba(255,215,0,0.3)] mb-4">
                      THE PARTY CONTINUES AT CHABAD
                    </h3>
                    
                    {/* Description */}
                    <div className="space-y-3 mb-5">
                      <p className="text-amber-100/85 text-sm md:text-base leading-relaxed">
                        After the lighting, the celebration continues up the street at Chabad at the Falls.
                      </p>
                      <p className="text-amber-100/85 text-sm md:text-base leading-relaxed">
                        Hot latkes and donuts, children's activities, and more Chanukah fun for all ages.
                      </p>
                    </div>
                    
                    {/* Location */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gold/10">
                      <p className="text-[11px] md:text-xs text-amber-200/60 tracking-wide">
                        📍 Chabad at the Falls | 100 N Main Street, Suite 100
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative sparkle divider */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/30" />
              <span className="text-gold/60 text-sm">✦</span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/30" />
            </div>
          </div>
          
          {/* Main Glass Card with rounded bottom corners */}
          <div className="relative glass-card glass-card-mobile rounded-b-3xl shadow-2xl shadow-mobile p-8 md:p-12 border border-gold/20 border-t-0">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gold/5 via-transparent to-amber/5 pointer-events-none" />
            
            {/* Register Here Heading */}
            <div className="text-center mb-8 relative z-10">
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-[0.15em] text-gold drop-shadow-[0_0_12px_rgba(255,215,0,0.4)]">
                REGISTER HERE
              </h2>
            </div>

            <div className="relative z-10">
              <RaffleForm />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center animate-fade-in space-y-6 py-6 content-offscreen">
          {/* Location */}
          
          
          {/* Powered by Techrupt */}
          <div className="mb-4">
            <div className="relative inline-block">
              <p className="text-xl font-semibold tracking-wide" style={{
              color: '#FFC670',
              textShadow: '0 0 12px rgba(255, 200, 100, 0.45)'
            }}>
                Powered by Techrupt Innovations
              </p>
              {/* Elegant underline accent */}
              <div className="mx-auto mt-2 w-3/5 h-px" style={{
              background: 'linear-gradient(90deg, transparent, rgba(255, 198, 112, 0.4) 50%, transparent)',
              boxShadow: '0 0 4px rgba(255, 200, 100, 0.3)'
            }}></div>
            </div>
          </div>
          
          {/* Main message */}
          <p className="text-lg text-gold font-light tracking-wide drop-shadow-[0_0_10px_rgba(255,215,0,0.3)] text-center md:text-lg">
            May the lights of Chanukah bring warmth and joy to your home
          </p>
          
          {/* Sponsor credit */}
          <p className="text-sm md:text-base font-semibold text-ivory/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] tracking-wide">
            Made by Techrupt Innovations. Need tech for your idea?{' '}
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSf1d7_AmmXfYFQ1U47oAYKWS-AM_BIbbV-IBUpnCAKhSCo0IQ/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer" className="text-gold-light hover:underline transition-all duration-200">
              Click here
            </a>.
          </p>
        </div>
      </div>
    </div>;
};
export default Index;