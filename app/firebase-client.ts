'use client';
import {getApp, getApps, initializeApp} from 'firebase/app';
import {getAuth, type User} from 'firebase/auth';
import {firebaseConfig} from './firebase-config';

export function echoAuth() {
  return getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
}

export async function reportRequest(user:User, init:RequestInit={}) {
  const token=await user.getIdToken();
  const response=await fetch('/api/reports', {
    ...init, cache:'no-store',
    headers:{...init.headers, 'Content-Type':'application/json', Authorization:`Bearer ${token}`},
  });
  if(!response.ok)throw new Error(response.status===401?'Please sign in again.':'Your report could not be saved or loaded. Please try again.');
  return response;
}
