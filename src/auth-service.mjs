import {createClient} from '@supabase/supabase-js';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {safeReturn,validateAuth} from '../public/auth-model.js';
export function authConfiguration(env=process.env){
  const required=env.OMNIFORM_AUTH_REQUIRED==='true',url=env.SUPABASE_URL||'',key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'',base=env.OMNIFORM_AUTH_APP_URL||'';
  let configured=false,keyAllowed=!key.startsWith('sb_secret_');
  try{if(key.split('.').length===3&&JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='service_role')keyAllowed=false;}catch{keyAllowed=false;}
  try{const provider=new URL(url),site=new URL(base);configured=!!key&&keyAllowed&&provider.protocol==='https:'&&!provider.username&&!provider.password&&(site.protocol==='https:'||(site.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(site.hostname)))&&!site.username&&!site.password&&site.pathname==='/'&&!site.search&&!site.hash;}catch{}
  return {required,configured,url,key,base:base.replace(/\/$/,''),minLength:Math.min(128,Math.max(8,Number(env.OMNIFORM_AUTH_PASSWORD_MIN_LENGTH)||8)),allowedEmails:(env.OMNIFORM_AUTH_ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean),terms:env.OMNIFORM_AUTH_TERMS_URL||'',privacy:env.OMNIFORM_AUTH_PRIVACY_URL||''};
}
export function createAuthService({directory,env=process.env,fetchImpl=fetch}={}){
  const cfg=authConfiguration(env);mkdirSync(directory,{recursive:true});
  const keyFile=join(directory,'session.key');
  if(!existsSync(keyFile))try{writeFileSync(keyFile,randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
  const secret=readFileSync(keyFile);if(secret.length!==32)throw Error('Invalid authentication session key file.');
  const db=new DatabaseSync(join(directory,'sessions.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, body TEXT, expires INTEGER); CREATE TABLE IF NOT EXISTS limits(id TEXT PRIMARY KEY, count INTEGER, expires INTEGER);');
  const ttl=7*86400_000,locks=new Map();
  const hash=x=>createHash('sha256').update(x).digest('hex');
  const encrypt=value=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',secret,iv);const data=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64');};
  const decrypt=value=>{const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',secret,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString());};
  const client=()=>createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetchImpl(url,{...options,signal:AbortSignal.timeout(15000)})}});
  const sid=req=>req.headers.cookie?.match(/(?:^|;\s*)omni_auth=([a-f0-9]{64})(?:;|$)/)?.[1];
  const cookie=(value,maxAge)=>`omni_auth=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${cfg.base.startsWith('https:')?'; Secure':''}`;
  function store(id,value,expires=Date.now()+ttl){db.prepare('INSERT INTO sessions VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,expires=excluded.expires').run(hash(id),encrypt(value),expires);}
  function drop(req){const id=sid(req);if(id)db.prepare('DELETE FROM sessions WHERE id=?').run(hash(id));}
  function issue(req,res,session,recovery=false){drop(req);const id=randomBytes(32).toString('hex');store(id,{userId:session.user?.id,access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at,recovery,recoveryUntil:recovery?Date.now()+15*60000:0});res.setHeader('Set-Cookie',cookie(id,ttl/1000));}
  async function authenticated(req){
    if(!cfg.configured)return null;const id=sid(req);if(!id)return null;
    if(locks.has(id))return locks.get(id);
    const promise=(async()=>{
      const record=db.prepare('SELECT * FROM sessions WHERE id=? AND expires>?').get(hash(id),Date.now());if(!record)return null;
      try{let saved=decrypt(record.body);const supa=client();
        if(!saved.expires_at||saved.expires_at*1000<Date.now()+60000){const {data,error}=await supa.auth.refreshSession({refresh_token:saved.refresh_token});if(error||!data.session){drop(req);return null;}saved={...saved,access_token:data.session.access_token,refresh_token:data.session.refresh_token,expires_at:data.session.expires_at};store(id,saved,record.expires);}
        const {data,error}=await supa.auth.getUser(saved.access_token);if(error||!data.user?.email_confirmed_at)return null;
        return {user:data.user,saved,client:supa};
      }catch{return null;}
    })();locks.set(id,promise);try{return await promise;}finally{locks.delete(id);}
  }
  const workspaceAllowed=identity=>!!identity?.user?.email&&cfg.allowedEmails.includes(identity.user.email.toLowerCase());
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));};
  function rate(req,action,email=''){
    const now=Date.now();db.prepare('DELETE FROM limits WHERE expires<?').run(now);db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
    const window=action==='login'?300000:60000,max=action==='login'?10:action==='signup'?5:10;
    for(const [part,cap]of [[req.socket?.remoteAddress||'local',max],...(email&&['forgot','resend'].includes(action)?[[email.toLowerCase(),1]]:[])]){
      const key=hash(action+':'+part),old=db.prepare('SELECT * FROM limits WHERE id=?').get(key);
      if(old&&old.count>=cap)return Math.max(1,Math.ceil((old.expires-now)/1000));
      db.prepare('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1').run(key,now+window);
    }return 0;
  }
  async function body(req){let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>16384)throw Error('request');}const value=JSON.parse(raw||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw Error('request');return value;}
  function originOK(req){return req.headers.origin===cfg.base&&`http${cfg.base.startsWith('https:')?'s':''}://${req.headers.host}`===cfg.base;}
  async function handle(req,res,path){
    if(!path.startsWith('/api/auth/'))return false;
    const action=path.slice('/api/auth/'.length);
    if(action==='config'&&req.method==='GET'){json(res,200,{configured:cfg.configured,required:cfg.required,minLength:cfg.minLength,google:false,terms:cfg.terms,privacy:cfg.privacy});return true;}
    if(!cfg.configured){json(res,503,{error:'Authentication is not configured. Contact your workspace administrator.'});return true;}
    if(action==='me'&&req.method==='GET'){
      const session=await authenticated(req);json(res,session?200:401,session?{user:{email:session.user.email},workspaceAllowed:workspaceAllowed(session),recovery:session.saved.recovery&&session.saved.recoveryUntil>Date.now()}:{error:'Please sign in to continue.'});return true;
    }
    if(req.method!=='POST'){json(res,405,{error:'Method not allowed.'});return true;}
    if(!originOK(req)||!req.headers['content-type']?.startsWith('application/json')){json(res,403,{error:'This request could not be verified. Refresh the page and try again.'});return true;}
    try{
      const input=await body(req);const errors=validateAuth(action,input,cfg.minLength);if(Object.keys(errors).length){json(res,400,{error:'Check the highlighted fields.',fields:errors});return true;}
      const email=String(input.email||'').trim();const cooldown=rate(req,action,email);if(cooldown){res.setHeader('Retry-After',String(cooldown));json(res,429,{error:'Too many requests. Please try again later.',retryAfter:cooldown});return true;}
      const supa=client();let result;
      if(action==='login'){
        result=await supa.auth.signInWithPassword({email,password:input.password});
        if(result.error){
          if(result.error.status===429){json(res,429,{error:'Too many requests. Please try again later.',retryAfter:60});return true;}
          if(result.error.status>=500||result.error.name==='AuthRetryableFetchError'){json(res,503,{error:'Something went wrong. Please try again.'});return true;}
          json(res,401,{error:result.error.code==='email_not_confirmed'?'Please verify your email address to continue.':'Invalid email or password.'});return true;
        }
        if(!result.data.user?.email_confirmed_at||!result.data.session){json(res,403,{error:'Please verify your email address to continue.'});return true;}
        issue(req,res,result.data.session);json(res,200,{next:safeReturn(input.next)});return true;
      }
      if(action==='signup'){
        result=await supa.auth.signUp({email,password:input.password,options:{emailRedirectTo:cfg.base+'/auth/callback'}});
        if(result.error){json(res,result.error.status===429?429:400,{error:result.error.code==='weak_password'?'Password does not meet your account security requirements.':'Your account could not be created. Please try again later.'});return true;}
        if(result.data.session){await supa.auth.signOut({scope:'local'});json(res,200,{next:'/login',message:'Your account is ready. Sign in to continue.'});return true;}
        json(res,200,{next:'/verify-email',message:'If this address is eligible, a verification email will arrive shortly.'});return true;
      }
      if(action==='forgot'||action==='resend'){
        result=action==='forgot'?await supa.auth.resetPasswordForEmail(email,{redirectTo:cfg.base+'/auth/callback'}):await supa.auth.resend({type:'signup',email,options:{emailRedirectTo:cfg.base+'/auth/callback'}});
        if(result.error&&!['user_not_found','email_not_confirmed','email_already_confirmed','over_email_send_rate_limit'].includes(result.error.code)){json(res,503,{error:'Email delivery is unavailable. Please try again later.'});return true;}
        if(result.error?.code==='over_email_send_rate_limit'){json(res,429,{error:'Please wait before requesting another email.',retryAfter:60});return true;}
        json(res,200,{message:action==='forgot'?"If an account exists for this email, you'll receive a password reset link.":'If this address is eligible, a verification email will arrive shortly.',retryAfter:60});return true;
      }
      if(action==='verify'){
        if(typeof input.token_hash!=='string'||!/^[a-zA-Z0-9_-]{20,200}$/.test(input.token_hash)||!['email','signup','recovery'].includes(input.type)){json(res,400,{error:'This verification link is invalid or has expired.'});return true;}
        result=await supa.auth.verifyOtp({token_hash:input.token_hash,type:input.type});
        if(result.error||!result.data.session||!result.data.user?.email_confirmed_at){json(res,400,{error:'This verification link is invalid or has expired.'});return true;}
        issue(req,res,result.data.session,input.type==='recovery');json(res,200,{next:input.type==='recovery'?'/reset-password':'/dashboard'});return true;
      }
      if(action==='logout'||action==='reset'){
        const session=await authenticated(req);
        if(action==='logout'){
          // Local invalidation does not depend on successful provider revocation.
          drop(req);res.setHeader('Set-Cookie',cookie('',0));
          if(session){await session.client.auth.setSession(session.saved);await session.client.auth.signOut({scope:'local'});}
          json(res,200,{next:'/login'});return true;
        }
        if(!session?.saved.recovery||session.saved.recoveryUntil<Date.now()){json(res,401,{error:'This reset link is invalid or has expired. Request a new one.'});return true;}
        const restored=await session.client.auth.setSession(session.saved);
        if(restored.error){json(res,401,{error:'This reset link is invalid or has expired. Request a new one.'});return true;}
        result=await session.client.auth.updateUser({password:input.password});
        if(result.error){json(res,400,{error:'Your password could not be updated. Check the password requirements and try again.'});return true;}
        // Revoke all local sessions for this account and provider refresh sessions after a reset.
        const records=db.prepare('SELECT id,body FROM sessions').all();
        for(const record of records)try{const value=decrypt(record.body);if(value.userId===session.user.id||value.access_token===session.saved.access_token)db.prepare('DELETE FROM sessions WHERE id=?').run(record.id);}catch{}
        await session.client.auth.signOut({scope:'global'});drop(req);res.setHeader('Set-Cookie',cookie('',0));json(res,200,{next:'/login?reset=success'});return true;
      }
      json(res,404,{error:'Authentication endpoint not found.'});return true;
    }catch{json(res,503,{error:'Something went wrong. Please try again.'});return true;}
  }
  const publicPath=path=>/^\/api\/(?:canvas\/public|exam\/student|exam\/public|flow\/public|adapt\/public|doc\/public|tablemind\/public)(?:\/|$)/.test(path)||path==='/api/adapt/event';
  async function guard(req,res,path){
    if(!cfg.required||path==='/api/health'||path.startsWith('/api/auth/')||publicPath(path))return false;
    const isApp=path==='/'||path==='/index.html'||path.startsWith('/api/')||/^\/(?:workspace-data|restore-browser)\.html$/.test(path);
    if(!isApp)return false;
    const identity=await authenticated(req);
    if(identity&&workspaceAllowed(identity)&&!identity.saved.recovery)return false;
    if(path.startsWith('/api/'))json(res,identity?403:401,{error:identity?'Your account does not have access to this workspace.':'Please sign in to continue.'});
    else{res.writeHead(303,{Location:identity?'/dashboard':'/login?next='+encodeURIComponent(safeReturn(req.url)), 'Cache-Control':'no-store'});res.end();}
    return true;
  }
  return {handle,guard,authenticated,workspaceAllowed,configuration:cfg,close:()=>db.close()};
}
