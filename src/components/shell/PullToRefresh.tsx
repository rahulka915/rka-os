import { useState, useRef } from 'react';
import { forceSyncAll } from '../../data/sync';

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (contentRef.current && contentRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    } else {
      startY.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === 0 || isRefreshing) return;
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) {
      // Prevent default scrolling when pulling down
      e.preventDefault();
      // Add resistance to the pull
      const distance = Math.min(diff * 0.4, 80);
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(60); // Hold at max distance while refreshing
      try {
        await forceSyncAll();
      } catch (e) {
        console.error(e);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    startY.current = 0;
    currentY.current = 0;
  };

  return (
    <div 
      ref={contentRef}
      style={{ 
        flex: 1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto', 
        position: 'relative',
        WebkitOverflowScrolling: 'touch'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 64px)',
          left: 0,
          right: 0,
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--rka-text-secondary)',
          fontSize: '13px',
          fontWeight: 600,
          transform: `translateY(${Math.min(pullDistance - 60, 0)}px)`,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.3s ease-out' : 'none',
          zIndex: 0
        }}
      >
        {isRefreshing ? 'Syncing...' : pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
      </div>
      <div 
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.3s ease-out' : 'none',
          minHeight: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'var(--rka-bg)',
          position: 'relative',
          zIndex: 1
        }}
      >
        {children}
      </div>
    </div>
  );
}
