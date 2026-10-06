"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Public web config (identifiers, not secrets), from NEXT_PUBLIC_ env vars.
const app = () =>
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

export const clientAuth = () => getAuth(app());
