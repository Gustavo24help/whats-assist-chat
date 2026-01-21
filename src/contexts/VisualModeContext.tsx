import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type BackgroundMode = "neutral" | "gradient" | "colored";
export type CardMode = "white" | "tinted" | "vibrant";
export type AccentIntensity = "subtle" | "medium" | "bold";

interface VisualModeContextType {
  backgroundMode: BackgroundMode;
  cardMode: CardMode;
  accentIntensity: AccentIntensity;
  setBackgroundMode: (mode: BackgroundMode) => void;
  setCardMode: (mode: CardMode) => void;
  setAccentIntensity: (intensity: AccentIntensity) => void;
}

const VisualModeContext = createContext<VisualModeContextType | undefined>(undefined);

const STORAGE_KEY = 'visual-mode-preferences';

interface StoredPreferences {
  backgroundMode: BackgroundMode;
  cardMode: CardMode;
  accentIntensity: AccentIntensity;
}

const defaultPreferences: StoredPreferences = {
  backgroundMode: "neutral",
  cardMode: "white",
  accentIntensity: "medium",
};

export const VisualModeProvider = ({ children }: { children: ReactNode }) => {
  const [backgroundMode, setBackgroundModeState] = useState<BackgroundMode>(defaultPreferences.backgroundMode);
  const [cardMode, setCardModeState] = useState<CardMode>(defaultPreferences.cardMode);
  const [accentIntensity, setAccentIntensityState] = useState<AccentIntensity>(defaultPreferences.accentIntensity);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const preferences: StoredPreferences = JSON.parse(stored);
        setBackgroundModeState(preferences.backgroundMode || defaultPreferences.backgroundMode);
        setCardModeState(preferences.cardMode || defaultPreferences.cardMode);
        setAccentIntensityState(preferences.accentIntensity || defaultPreferences.accentIntensity);
      }
    } catch (error) {
      console.error('Error loading visual mode preferences:', error);
    }
  }, []);

  // Apply data attributes to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-background-mode', backgroundMode);
    document.documentElement.setAttribute('data-card-mode', cardMode);
    document.documentElement.setAttribute('data-accent-intensity', accentIntensity);
  }, [backgroundMode, cardMode, accentIntensity]);

  // Save preferences to localStorage
  const savePreferences = (preferences: StoredPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving visual mode preferences:', error);
    }
  };

  const setBackgroundMode = (mode: BackgroundMode) => {
    setBackgroundModeState(mode);
    savePreferences({ backgroundMode: mode, cardMode, accentIntensity });
  };

  const setCardMode = (mode: CardMode) => {
    setCardModeState(mode);
    savePreferences({ backgroundMode, cardMode: mode, accentIntensity });
  };

  const setAccentIntensity = (intensity: AccentIntensity) => {
    setAccentIntensityState(intensity);
    savePreferences({ backgroundMode, cardMode, accentIntensity: intensity });
  };

  return (
    <VisualModeContext.Provider
      value={{
        backgroundMode,
        cardMode,
        accentIntensity,
        setBackgroundMode,
        setCardMode,
        setAccentIntensity,
      }}
    >
      {children}
    </VisualModeContext.Provider>
  );
};

export const useVisualMode = (): VisualModeContextType => {
  const context = useContext(VisualModeContext);
  if (context === undefined) {
    throw new Error('useVisualMode must be used within a VisualModeProvider');
  }
  return context;
};
