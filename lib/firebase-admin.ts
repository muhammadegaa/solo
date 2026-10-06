import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { config } from "./config";

// Server only. Firestore rules deny all client access; every read and write goes through here.
const app = () => getApps()[0] ?? initializeApp({ credential: cert(config.firebaseServiceAccount()) });

export const adminAuth = () => getAuth(app());
export const db = () => getFirestore(app());
