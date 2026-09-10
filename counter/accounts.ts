import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { emptyProfile, validateProfile } from '../lib/personal-pool';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyIdentity(token:string,audience:string,keys=googleKeys):Promise<JWTPayload> {
 const {payload}=await jwtVerify(token,keys,{audience,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],requiredClaims:['sub','exp','iat']});
 if(!payload.sub || payload.sub.length>255) throw new Error('Invalid identity');
 return payload;
}
export function isAdmin(identity:JWTPayload,email:string) {
 // Only Google's verified @gmail.com identity can bootstrap the owner account.
 return !!email && email.endsWith('@gmail.com') && identity.email_verified===true && identity.email===email;
}
async function readBody(request:Request) {
 const reader=request.body?.getReader(); if(!reader) throw new Error('Missing body');
 let size=0; const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();throw new Error('Body too large')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
export async function accounts(request:Request,env:Cloudflare.Env):Promise<Response> {
 const origin=request.headers.get('Origin');
 const headers=new Headers({'Cache-Control':'no-store','Vary':'Origin'});
 if(origin===env.ALLOWED_ORIGIN) headers.set('Access-Control-Allow-Origin',origin);
 const json=(data:unknown,status=200)=>Response.json(data,{headers,status});
 if(origin && origin!==env.ALLOWED_ORIGIN)return json({error:'Origin not allowed'},403);
 if(request.method==='OPTIONS'){
  headers.set('Access-Control-Allow-Methods','GET, PUT, DELETE, OPTIONS');headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');headers.set('Access-Control-Max-Age','86400');return new Response(null,{status:204,headers});
 }
 const path=new URL(request.url).pathname;
 if(!['/profile','/admin/summary'].includes(path))return json({error:'Not found'},404);
 if(!(await env.ACCOUNT_RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)return json({error:'Too many requests'},429);
 let user:JWTPayload;
 try{
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')||auth.length>8192)throw new Error('Missing token');
  user=await verifyIdentity(auth.slice(7),env.GOOGLE_CLIENT_ID);
 }catch{return json({error:'Please sign in again'},401)}
 const admin=isAdmin(user,env.ADMIN_GOOGLE_EMAIL||'');
 try{
  if(path==='/admin/summary'){
   if(!admin)return json({error:'Forbidden'},403);
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const start=Date.now();
   const [total,profiles]=await env.DB.batch<Record<string,number>>([
    env.DB.prepare('SELECT spins FROM totals WHERE id=1'),
    env.DB.prepare("SELECT COUNT(*) AS profiles, COALESCE(SUM(json_array_length(json_extract(profile,'$.custom'))),0) AS customFoods, COALESCE(SUM(CASE WHEN updated_at >= unixepoch()-86400 THEN 1 ELSE 0 END),0) AS updatedToday FROM user_food_profiles")
   ]);
   return json({count:total.results[0]?.spins??0,...profiles.results[0],databaseMs:Date.now()-start,checkedAt:new Date().toISOString()});
  }
  const sub=user.sub!;
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT profile, revision FROM user_food_profiles WHERE user_sub=?').bind(sub).first<{profile:string;revision:number}>();
   return json({profile:row?{...JSON.parse(row.profile),revision:row.revision}:emptyProfile(),admin,name:typeof user.name==='string'?user.name:'',sub});
  }
  if(request.method==='DELETE'){
   await env.DB.prepare('DELETE FROM user_food_profiles WHERE user_sub=?').bind(sub).run();return json({profile:emptyProfile()});
  }
  if(request.method!=='PUT')return json({error:'Method not allowed'},405);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected JSON'},415);
  let profile;try{profile=validateProfile(await readBody(request))}catch{return json({error:'Invalid pool. Keep at least one dish; custom dishes: 10–500k, max 50.'},400)}
  const encoded=JSON.stringify({disabled:profile.disabled,custom:profile.custom});
  // Compare-and-swap prevents a stale tab overwriting a newer profile.
  const row= profile.revision===0
   ? await env.DB.prepare('INSERT INTO user_food_profiles(user_sub,profile) VALUES(?,?) ON CONFLICT(user_sub) DO NOTHING RETURNING revision').bind(sub,encoded).first<{revision:number}>()
   : await env.DB.prepare('UPDATE user_food_profiles SET profile=?,revision=revision+1,updated_at=unixepoch() WHERE user_sub=? AND revision=? RETURNING revision').bind(encoded,sub,profile.revision).first<{revision:number}>();
  if(!row)return json({error:'Pool changed on another device. Reload before saving.'},409);
  return json({profile:{...profile,revision:row.revision}});
 }catch{
  console.error(JSON.stringify({message:'Account storage unavailable',path}));
  return json({error:'Temporarily unavailable'},503);
 }
}
