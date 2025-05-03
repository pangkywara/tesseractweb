'use client';

import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n'; // Assuming i18n.ts is in the root of frontend

export default function I18nProviderComponent({ children }: { children: React.ReactNode }) {
  // Ensure i18n is initialized before rendering children
  // This might be implicitly handled by the import, but checking can be useful
  // if (!i18n.isInitialized) {
  //   // Optionally show a loading state or null while i18n initializes
  //   // console.log("i18n not initialized yet...");
  //   return null; 
  // }
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
