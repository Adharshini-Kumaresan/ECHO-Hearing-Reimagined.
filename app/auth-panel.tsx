'use client';
import {useState} from 'react';
import {createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile, sendEmailVerification, type User} from 'firebase/auth';
import {ArrowRight, Headphones, ShieldCheck} from 'lucide-react';
import {echoAuth} from './firebase-client';

function authError(error:unknown) {
  const code=(error as {code?:string})?.code;
  if(code==='auth/weak-password')return 'Choose a stronger password with at least 12 characters.';
  if(code==='auth/too-many-requests')return 'Too many attempts. Wait a little before trying again.';
  if(code==='auth/network-request-failed')return 'Could not connect. Check your connection and retry.';
  if(code==='auth/email-already-in-use')return 'Unable to create this account. Try signing in or resetting your password.';
  return 'Unable to continue. Check your email and password, then try again.';
}
export function AuthPanel({onDone,forTest}:{onDone:(user:User)=>void;forTest:boolean}) {
  const [mode,setMode]=useState<'login'|'signup'|'reset'>(forTest?'signup':'login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  function change(next:typeof mode){setMode(next);setPassword('');setError('');setMessage('');}
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      const auth=echoAuth();
      if(mode==='reset'){
        try{await sendPasswordResetEmail(auth,email.trim());}catch(error){if((error as {code?:string}).code!=='auth/user-not-found')throw error;}
        setMessage('If an account exists for that email, a reset link will arrive shortly. Check your spam folder too.');
      }else if(mode==='signup'){
        const credential=await createUserWithEmailAndPassword(auth,email.trim(),password);
        try{await updateProfile(credential.user,{displayName:name.trim()});}catch{/* The test asks for a display name. */}
        try{await sendEmailVerification(credential.user);}catch{/* Verification can be resent from the dashboard. */}
        setPassword('');onDone(credential.user);
      }else{
        const credential=await signInWithEmailAndPassword(auth,email.trim(),password);
        setPassword('');onDone(credential.user);
      }
    }catch(error){setError(authError(error));}finally{setBusy(false);}
  }
  return <section className="flow-card auth-card"><div className="auth-symbol"><Headphones size={30}/></div>
    <div className="eyebrow">YOUR PRIVATE SOUND SPACE</div>
    <h2>{mode==='signup'?<>Make it <em>yours.</em></>:mode==='reset'?<>A fresh <em>start.</em></>:<>Welcome <em>back.</em></>}</h2>
    <p>{mode==='reset'?'We’ll send a link to reset your password.':forTest?'Create an account or log in to take the hearing check.':'Keep your sound journeys together, wherever you return.'}</p>
    {mode!=='reset'&&<div className="auth-tabs" aria-label="Account options"><button type="button" aria-pressed={mode==='login'} disabled={busy} onClick={()=>change('login')}>Log in</button><button type="button" aria-pressed={mode==='signup'} disabled={busy} onClick={()=>change('signup')}>Create account</button></div>}
    <form onSubmit={submit}>
      {mode==='signup'&&<label>Your name<input autoComplete="name" required maxLength={60} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label>}
      <label>Email address<input autoComplete="username" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
      {mode!=='reset'&&<label>Password<input autoComplete={mode==='signup'?'new-password':'current-password'} type="password" required minLength={mode==='signup'?12:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>{mode==='signup'&&<small>Use at least 12 characters.</small>}</label>}
      {error&&<p className="auth-error" role="alert">{error}</p>}{message&&<p className="auth-message" role="status">{message}</p>}
      <button className="primary" disabled={busy}>{busy?'One moment…':mode==='signup'?'Create my account':mode==='reset'?'Send reset link':'Log in to Echo'}<ArrowRight size={18}/></button>
    </form>
    <button className="text-button auth-reset" disabled={busy} onClick={()=>change(mode==='reset'?'login':'reset')}>{mode==='reset'?'Back to log in':'Forgot your password?'}</button>
    <div className="demo-note"><ShieldCheck size={21}/><span>Authentication is managed by Firebase. Your test history is private to your account.</span></div>
  </section>;
}
