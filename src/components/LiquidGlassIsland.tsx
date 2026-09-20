import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring, useMotionValue, useTransform } from 'motion/react';
import { Home, Compass, Plus, RefreshCw, Settings } from 'lucide-react';

interface LiquidGlassIslandProps {
  activeTab: string;
  onChangeTab: (tabId: string) => void;
}

const TABS = [
  { id: 'home', label: 'Trang chủ', icon: Home },
  { id: 'manga', label: 'Truyện', icon: Compass },
  { id: 'update', label: 'Cập nhật', icon: RefreshCw },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

export const LiquidGlassIsland: React.FC<LiquidGlassIslandProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const activeIdx = TABS.findIndex((t) => t.id === activeTab);
  const activeIndexSafe = activeIdx !== -1 ? activeIdx : 0;
  const containerRef = useRef<HTMLDivElement>(null);

  // Position calculation for 4 equal tab slots
  const blobTargetX = useMotionValue(0);
  const pressTargetScaleX = useMotionValue(1);
  const pressTargetScaleY = useMotionValue(1);

  // 1. Horizontal Motion Spring
  const animatedX = useSpring(blobTargetX, {
    stiffness: 700,
    damping: 24,
    mass: 0.5,
  });

  // 2. Press Swell Scale Springs
  const pressScaleX = useSpring(pressTargetScaleX, {
    stiffness: 350,
    damping: 25,
  });

  const pressScaleY = useSpring(pressTargetScaleY, {
    stiffness: 350,
    damping: 25,
  });

  // Dynamic Clip-Path that scales and moves synchronously with animatedX and pressScaleX
  const clipPathStyle = useTransform(
    [animatedX, pressScaleX],
    ([x, scaleX]) => {
      const currentWidth = 71 * (scaleX as number);
      const offset = (currentWidth - 71) / 2;
      const newX = (x as number) - offset;
      return `inset(5px calc(100% - (${newX}px + ${currentWidth}px)) 5px ${newX}px round 9999px)`;
    }
  );

  const isDragging = useRef(false);
  const pointerStartRef = useRef(0);
  const xStartRef = useRef(0);

  // Helper to calculate dynamic bounds based on current container width
  const getBounds = () => {
    if (!containerRef.current) return { min: 0, max: 280, itemWidth: 70 };
    const containerWidth = containerRef.current.offsetWidth || 350;
    const itemWidth = containerWidth / TABS.length;
    const min = itemWidth / 2 - 35.5;
    const max = (TABS.length - 1) * itemWidth + itemWidth / 2 - 35.5;
    return { min, max, itemWidth };
  };

  // Calculate and update position based on active tab index
  const updatePosition = (idx: number) => {
    if (isDragging.current) return; // Do not interrupt during manual drag
    const { min, itemWidth } = getBounds();
    const targetX = idx * itemWidth + itemWidth / 2 - 35.5;
    blobTargetX.set(targetX);
  };

  useEffect(() => {
    updatePosition(activeIndexSafe);
  }, [activeIndexSafe]);

  useEffect(() => {
    const handleResize = () => updatePosition(activeIndexSafe);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeIndexSafe]);

  const handlePointerDown = (idx: number) => {
    onChangeTab(TABS[idx].id);
    pressTargetScaleX.set(1.35);
    pressTargetScaleY.set(1.4);
  };

  const handlePointerUp = () => {
    pressTargetScaleX.set(1);
    pressTargetScaleY.set(1);
  };

  const handleTabClick = (tabId: string, idx: number) => {
    onChangeTab(tabId);
  };

  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // only left click / primary touch
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const paddingLeft = 6; // px-1.5 = 6px
    const localX = e.clientX - rect.left - paddingLeft;
    const targetX = localX - 35.5; // 35.5 is half of droplet width (71)

    const { min, max } = getBounds();
    let constrainedX = Math.max(min, Math.min(max, targetX));

    isDragging.current = true;
    pointerStartRef.current = e.clientX;
    xStartRef.current = constrainedX;

    blobTargetX.set(constrainedX);
    animatedX.set(constrainedX);

    // SWELL scales when grabbed
    pressTargetScaleX.set(1.35);
    pressTargetScaleY.set(1.4);

    if (e.currentTarget) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleDropletPointerMove = (e: React.PointerEvent<Element>) => {
    if (!isDragging.current) return;

    const deltaX = e.clientX - pointerStartRef.current;
    const { min, max } = getBounds();
    const rawNewX = xStartRef.current + deltaX;

    // Elastic boundary formula (like iOS scroll bouncing)
    let constrainedX = rawNewX;
    if (rawNewX < min) {
      const overdrag = min - rawNewX;
      constrainedX = min - overdrag * 0.35; // 35% elasticity
    } else if (rawNewX > max) {
      const overdrag = rawNewX - max;
      constrainedX = max + overdrag * 0.35; // 35% elasticity
    }

    blobTargetX.set(constrainedX);
    animatedX.set(constrainedX); // Immediate update for drag responsiveness
  };

  const handleDropletPointerUp = (e: React.PointerEvent<Element>) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (e.currentTarget) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        // ignore if capture lost
      }
    }

    pressTargetScaleX.set(1);
    pressTargetScaleY.set(1);

    const { min, itemWidth } = getBounds();
    const currentX = blobTargetX.get();
    
    // Snaps cleanly to the nearest slot
    const closestIdx = Math.max(
      0,
      Math.min(TABS.length - 1, Math.round((currentX - min) / itemWidth))
    );

    const targetX = closestIdx * itemWidth + itemWidth / 2 - 35.5;
    blobTargetX.set(targetX);
    onChangeTab(TABS[closestIdx].id);
  };

  return (
    <>
      {/* Hidden SVG Definition for Gradient Active Icons */}
      <svg className="absolute w-0 h-0 opacity-0 pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="bottom-nav-active-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e06b3a" /> {/* App Signature Orange */}
            <stop offset="100%" stopColor="#ff7e40" /> {/* Bright Peach Orange */}
          </linearGradient>
        </defs>
      </svg>
 
      {/* Outer Floating Bar Fixed Shell */}
      <div className="fixed bottom-6 left-0 right-0 z-30 flex flex-col items-center px-4 pointer-events-none pb-[env(safe-area-inset-top)] md:pb-[env(safe-area-inset-bottom)] pb-[env(safe-area-inset-bottom)]">
        {/* Liquid Glass Island Base Container */}
        <div
          ref={containerRef}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleDropletPointerMove}
          onPointerUp={handleDropletPointerUp}
          onPointerCancel={handleDropletPointerUp}
          style={{
            width: '100%',
            minWidth: 280,
            maxWidth: 500,
            height: 64,
            borderRadius: 9999,
            backgroundColor: 'rgba(255, 255, 255, 0)',
            backdropFilter: 'blur(2.5px) saturate(50%) brightness(100%) contrast(100%)',
            WebkitBackdropFilter: 'blur(2.5px) saturate(50%) brightness(100%) contrast(100%)',
            border: '0.2px solid rgba(255, 255, 255, 0.15)',
            boxShadow:
              '0px -30px 0px 0px rgba(0, 0, 0, 0), inset 0 1px 1px rgba(255, 255, 255, 0)',
          }}
          className="relative pointer-events-auto flex items-center justify-between px-1.5 select-none mx-auto cursor-grab active:cursor-grabbing touch-none"
        >
          {/* Droplet Positioning Wrapper matching Layer 1 & 2 px-1.5 */}
          <div className="absolute inset-0 px-1.5 flex items-center pointer-events-none z-0">
            {/* Liquid Droplet Indicator (Droplet Swell & Slide) */}
            <motion.div
              style={{
                x: animatedX,
                scaleX: pressScaleX,
                scaleY: pressScaleY,
                width: 71,
                height: 54,
                borderRadius: 9999,
                background:
                  'radial-gradient(ellipse at 50% 20%, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.02) 65%, rgba(255, 255, 255, 0.05) 100%)',
                backdropFilter: 'blur(0px) saturate(50%) contrast(50%)',
                WebkitBackdropFilter: 'blur(0px) saturate(50%) contrast(50%)',
                boxShadow:
                  'inset 0 1px 1.5px rgba(255, 255, 255, 0), inset 1.1px -1.1px 0px 0px rgba(255, 255, 255, 0.48), inset 1.6px -1.6px 0px rgba(255, 255, 255, 0.216)',
              }}
              className="absolute left-0 pointer-events-none z-0 border border-[#e06b3a]/40"
            />
          </div>

          {/* LAYER 1: Inactive Icons Base (#71717a - zinc-500) */}
          <div className="absolute inset-0 flex items-center justify-around z-10 px-1.5 pointer-events-none">
            {TABS.map((tab) => {
              const IconComp = tab.icon;
              return (
                <div
                  key={tab.id}
                  style={{
                    width: '25%',
                    height: 64,
                  }}
                  className="flex flex-col items-center justify-center text-[#71717a]"
                >
                  <IconComp size={24} stroke="#71717a" strokeWidth={2.5} className="floating-icon-inactive" />
                </div>
              );
            })}
          </div>

          {/* LAYER 2: Active Icons Overlaid with Dynamic Clip-Path Masking */}
          <motion.div
            style={{
              clipPath: clipPathStyle,
              height: 64,
            }}
            className="absolute inset-0 flex items-center justify-around z-20 pointer-events-none px-1.5"
          >
            {TABS.map((tab) => {
              const IconComp = tab.icon;
              return (
                <div
                  key={tab.id}
                  style={{
                    width: '25%',
                    height: 64,
                  }}
                  className="flex-1 h-full flex flex-col items-center justify-center"
                >
                  <IconComp 
                    size={24} 
                    stroke="url(#bottom-nav-active-gradient)" 
                    strokeWidth={2.5} 
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(224, 107, 58, 0.45))' }}
                  />
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </>
  );
};
