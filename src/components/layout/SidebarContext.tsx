'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type SidebarMode = 'expanded' | 'collapsed';

interface SidebarContextValue {
  mode: SidebarMode;
  mobileOpen: boolean;
  setMode: (mode: SidebarMode) => void;
  toggleCollapse: () => void;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const STORAGE_KEY = 'oud_erp_sidebar_mode';

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<SidebarMode>('expanded');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'expanded' || saved === 'collapsed') {
        setModeState(saved);
      } else if (saved === 'hidden') {
        // Migrate any previous 'hidden' state to 'collapsed' (icon bar)
        setModeState('collapsed');
        window.localStorage.setItem(STORAGE_KEY, 'collapsed');
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setMode = useCallback((newMode: SidebarMode) => {
    setModeState(newMode);
    try {
      window.localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    setModeState((prev) => {
      const next: SidebarMode = prev === 'collapsed' ? 'expanded' : 'collapsed';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Keyboard shortcuts: Ctrl+B to toggle sidebar, Escape to dismiss open modal overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      } else if (e.key === 'Escape') {
        setMobileOpen(false);
        const backdrops = document.querySelectorAll<HTMLElement>('.fixed.inset-0.z-50');
        if (backdrops.length > 0) {
          const topBackdrop = backdrops[backdrops.length - 1];
          topBackdrop.click();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse]);

  return (
    <SidebarContext.Provider
      value={{
        mode,
        mobileOpen,
        setMode,
        toggleCollapse,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return ctx;
}
