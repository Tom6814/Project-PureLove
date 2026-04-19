import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SiteSettings {
  enableR18Blur: boolean;
}

const defaultSettings: SiteSettings = {
  enableR18Blur: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...defaultSettings, ...docSnap.data() });
      } else {
        setSettings(defaultSettings);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    await setDoc(doc(db, 'settings', 'general'), newSettings, { merge: true });
  };

  return { settings, loading, updateSettings };
}
