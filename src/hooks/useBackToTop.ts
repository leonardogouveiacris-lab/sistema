/**
 * Custom hook for "Back to Top" functionality
 * Optimized to avoid re-renders in parent component
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Hook that manages back-to-top button visibility based on scroll position
 * Uses Intersection Observer for better performance than scroll listeners
 */
export function useBackToTop() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const observerTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowBackToTop(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { showBackToTop, observerTargetRef };
}
