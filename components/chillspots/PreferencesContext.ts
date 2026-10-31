import { createContext } from 'react';
import { defaultPreferences } from '@/lib/preferences';
export const PreferencesContext = createContext(defaultPreferences);
