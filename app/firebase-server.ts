import {firebaseConfig} from './firebase-config';

export class FirebaseRequestError extends Error {
  constructor(public status:number,message:string){super(message);}
}

export async function firebaseIdentity(req:Request) {
  const header=req.headers.get('Authorization');
  if(!header?.startsWith('Bearer '))throw new FirebaseRequestError(401,'Sign in to access reports');
  const token=header.slice(7);
  if(token.length>10000)throw new FirebaseRequestError(401,'Invalid sign-in');
  // Check project claims, then have Firebase verify the token and account status.
  // Never trust a client-supplied UID or the unverified JWT subject.
  try{
    const segment=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const claims=JSON.parse(atob(segment));
    if(claims.aud!==firebaseConfig.projectId||claims.iss!==`https://securetoken.google.com/${firebaseConfig.projectId}`)throw new Error('Wrong project');
  }catch{throw new FirebaseRequestError(401,'Invalid sign-in');}
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),cache:'no-store',
  });
  if(!response.ok)throw new FirebaseRequestError(response.status>=500?503:401,'Sign in again to access reports');
  const data=await response.json() as {users?:{localId:string;disabled?:boolean}[]};
  const user=data.users?.[0];
  if(!user?.localId||user.disabled)throw new FirebaseRequestError(401,'Sign in again to access reports');
  return {uid:user.localId,token};
}

export function firestoreReportsUrl(uid:string) {
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}/reports`;
}

export async function firestoreFetch(url:string,token:string,init:RequestInit={}){
  const response=await fetch(url,{
    ...init,cache:'no-store',
    // Use the end user's token, so Firestore enforces owner-only Security Rules.
    headers:{...init.headers,'Content-Type':'application/json',Authorization:`Bearer ${token}`},
  });
  if(!response.ok&&response.status!==409)throw new FirebaseRequestError(response.status===401?401:503,'Firebase storage is unavailable. Please retry.');
  return response;
}

export function firebaseError(error:unknown){
  const known=error instanceof FirebaseRequestError;
  return Response.json({error:known?error.message:'Firebase storage is unavailable. Please retry.'},{status:known?error.status:503,headers:{'Cache-Control':'private, no-store'}});
}
