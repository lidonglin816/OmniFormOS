import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Readable} from 'node:stream';
import {createAuthService,authConfiguration} from '../src/auth-service.mjs';
import {validateAuth,safeReturn,maskedEmail} from '../public/auth-model.js';
const origin='http://127.0.0.1:3900';
const env={SUPABASE_URL:'https://auth-contract.invalid',SUPABASE_PUBLISHABLE_KEY:'test-public-key',OMNIFORM_AUTH_APP_URL:origin,OMNIFORM_AUTH_REQUIRED:'true',OMNIFORM_AUTH_ALLOWED_EMAILS:'owner@example.test'};
const user={id:'test-provider-user',email:'owner@example.test',email_confirmed_at:'2026-10-25T00:00:00Z',aud:'authenticated',app_metadata:{},user_metadata:{}};
const jwt=()=>[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),Buffer.from('contract-test-signature').toString('base64url')].join('.');
// Contract doubles exist only in tests. Production always uses the Supabase SDK.
function fixture(overrides={}){
  const directory=mkdtempSync(join(tmpdir(),'omni-auth-test-')),calls=[];
  let refreshes=0;
  const fetchImpl=async(url,options={})=>{
    calls.push({url:String(url),method:options.method,body:options.body});const path=new URL(url).pathname;
    const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
    if(path.endsWith('/user')&&options.method!=='PUT')return reply(user);
    if(path.endsWith('/user'))return reply(user);
    if(path.endsWith('/logout'))return new Response(null,{status:204});
    if(path.endsWith('/token')){if(String(url).includes('refresh_token'))refreshes++;return reply({access_token:jwt(),refresh_token:'provider-refresh-contract',expires_in:3600,token_type:'bearer',user});}
    if(path.endsWith('/verify'))return reply({access_token:jwt(),refresh_token:'provider-verify-contract',expires_in:3600,token_type:'bearer',user});
    if(path.endsWith('/signup'))return reply({id:user.id,email:user.email,identities:[{id:user.id}]});
    return reply({});
  };
  const service=createAuthService({directory,env:{...env,...overrides},fetchImpl});
  return {service,calls,directory,fetchImpl,refreshes:()=>refreshes,close(){service.close();rmSync(directory,{recursive:true,force:true});}};
}
async function request(service,action,{input={},method='POST',cookie='',originHeader=origin,guard=false,path}={}){
  const req=Readable.from(method==='GET'?[]:[JSON.stringify(input)]);req.method=method;req.url=path||'/api/auth/'+action;req.headers={host:'127.0.0.1:3900',origin:originHeader,'content-type':'application/json',cookie};req.socket={remoteAddress:'127.0.0.1'};
  let status=200,raw='',headers={};const res={setHeader(k,v){headers[k.toLowerCase()]=v;},writeHead(s,h){status=s;for(const[k,v]of Object.entries(h||{}))headers[k.toLowerCase()]=v;return this;},end(value=''){raw+=value;return this;}};
  await (guard?service.guard(req,res,req.url):service.handle(req,res,req.url));
  return {status,headers,raw,data:raw?JSON.parse(raw):null};
}
test('auth validation and safe return reject invalid inputs and open redirects',()=>{
  assert.equal(validateAuth('signup',{email:'bad',password:'short',confirmPassword:'other'}).email,'Enter a valid email address.');
  assert.equal(validateAuth('reset',{password:'abcdefgh',confirmPassword:'abcdefgh'}).password,undefined);
  for(const value of ['https://evil.test','//evil.test','/\\evil.test','/login','/auth/callback?token_hash=secret'])assert.equal(safeReturn(value),'/dashboard');
  assert.equal(safeReturn('/#appcanvas'),'/#appcanvas');assert.equal(maskedEmail('owner@example.test'),'o•••@example.test');
});
test('auth configuration rejects insecure remote origins and preserves optional local mode',()=>{
  assert.equal(authConfiguration({}).required,false);assert.equal(authConfiguration({...env,OMNIFORM_AUTH_APP_URL:'http://public.example'}).configured,false);assert.equal(authConfiguration(env).configured,true);
});
test('unconfigured authentication returns 503 without claiming email delivery',async()=>{
  const f=fixture({SUPABASE_URL:''});try{const config=await request(f.service,'config',{method:'GET'});assert.equal(config.data.configured,false);const result=await request(f.service,'forgot',{input:{email:user.email}});assert.equal(result.status,503);assert.equal(f.calls.length,0);}finally{f.close();}
});
test('auth endpoints enforce same-origin JSON requests before contacting provider',async()=>{
  const f=fixture();try{const result=await request(f.service,'login',{input:{email:user.email,password:'anything'},originHeader:'https://evil.test'});assert.equal(result.status,403);assert.equal(f.calls.length,0);}finally{f.close();}
});
test('real SDK contract: encrypted persistent session, protected workspace, logout invalidation',async()=>{
  const f=fixture();try{
    const anonymous=await request(f.service,'',{guard:true,path:'/api/pilot/state'});assert.equal(anonymous.status,401);
    const login=await request(f.service,'login',{input:{email:user.email,password:'provider-contract-password',next:'//evil.test'}});assert.equal(login.status,200);assert.equal(login.data.next,'/dashboard');
    const cookie=login.headers['set-cookie'].split(';')[0];assert.match(login.headers['set-cookie'],/HttpOnly; SameSite=Lax/);
    const me=await request(f.service,'me',{method:'GET',cookie});assert.equal(me.data.user.email,user.email);assert.equal(me.data.workspaceAllowed,true);assert.equal(JSON.stringify(me.data).includes('access_token'),false);
    const database=readFileSync(join(f.directory,'sessions.sqlite'));assert.equal(database.includes(Buffer.from('provider-contract-password')),false);assert.equal(database.includes(Buffer.from('provider-refresh-contract')),false);
    const logout=await request(f.service,'logout',{cookie});assert.equal(logout.status,200);assert.equal((await request(f.service,'me',{method:'GET',cookie})).status,401);
  }finally{f.close();}
});
test('verified account without allowlist entry cannot access existing shared data',async()=>{
  const f=fixture({OMNIFORM_AUTH_ALLOWED_EMAILS:''});try{const login=await request(f.service,'login',{input:{email:user.email,password:'password'}});const cookie=login.headers['set-cookie'].split(';')[0];const blocked=await request(f.service,'',{guard:true,path:'/api/workspace/session',cookie});assert.equal(blocked.status,403);}finally{f.close();}
});
test('recovery session is scoped to password reset and rejects normal-session password changes',async()=>{
  const f=fixture();try{
    const login=await request(f.service,'login',{input:{email:user.email,password:'password'}});let cookie=login.headers['set-cookie'].split(';')[0];assert.equal((await request(f.service,'reset',{cookie,input:{password:'long-password',confirmPassword:'long-password'}})).status,401);
    const verified=await request(f.service,'verify',{input:{token_hash:'a'.repeat(64),type:'recovery'}});cookie=verified.headers['set-cookie'].split(';')[0];assert.equal(verified.data.next,'/reset-password');
    assert.equal((await request(f.service,'',{guard:true,path:'/api/pilot/state',cookie})).status,403);
    const changed=await request(f.service,'reset',{cookie,input:{password:'new-long-password',confirmPassword:'new-long-password'}});assert.equal(changed.status,200);assert.equal((await request(f.service,'me',{method:'GET',cookie})).status,401);
  }finally{f.close();}
});
test('email requests are provider-backed, neutral, and rate limited',async()=>{
  const f=fixture();try{const first=await request(f.service,'forgot',{input:{email:'unknown@example.test'}});assert.equal(first.status,200);assert.match(first.data.message,/If an account exists/);assert.ok(f.calls.some(call=>call.url.includes('/recover')));assert.equal((await request(f.service,'forgot',{input:{email:'unknown@example.test'}})).status,429);}finally{f.close();}
});
test('opaque session survives a server restart using encrypted storage and is revalidated',async()=>{
  const f=fixture();let restored;
  try{const login=await request(f.service,'login',{input:{email:user.email,password:'contract-password'}});const cookie=login.headers['set-cookie'].split(';')[0];f.service.close();restored=createAuthService({directory:f.directory,env,fetchImpl:f.fetchImpl});const me=await request(restored,'me',{method:'GET',cookie});assert.equal(me.status,200);assert.equal(me.data.user.email,user.email);}finally{restored?.close();rmSync(f.directory,{recursive:true,force:true});}
});
test('configuration refuses elevated Supabase service keys',()=>{
  assert.equal(authConfiguration({...env,SUPABASE_PUBLISHABLE_KEY:'sb_secret_not-a-public-key'}).configured,false);
  const key='header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';assert.equal(authConfiguration({...env,SUPABASE_PUBLISHABLE_KEY:key}).configured,false);
});
test('provider failures remain safe and distinguish bad credentials, throttling, and outage',async()=>{
  for(const [providerStatus,status,message]of [[400,401,'Invalid email or password.'],[429,429,'Too many requests. Please try again later.'],[503,503,'Something went wrong. Please try again.']]){
    const directory=mkdtempSync(join(tmpdir(),'omni-auth-error-'));const service=createAuthService({directory,env,fetchImpl:async()=>new Response(JSON.stringify({error_code:'provider_failure',msg:'INTERNAL_DETAIL_MUST_NOT_LEAK'}),{status:providerStatus,headers:{'Content-Type':'application/json'}})});
    try{const result=await request(service,'login',{input:{email:user.email,password:'password'}});assert.equal(result.status,status);assert.equal(result.data.error,message);assert.equal(result.raw.includes('INTERNAL_DETAIL'),false);}finally{service.close();rmSync(directory,{recursive:true,force:true});}
  }
});
test('HTTPS deployment issues Secure and HttpOnly cookies',async()=>{
  const f=fixture({OMNIFORM_AUTH_APP_URL:'https://127.0.0.1:3900'});try{const login=await request(f.service,'login',{input:{email:user.email,password:'password'},originHeader:'https://127.0.0.1:3900'});assert.equal(login.status,200);assert.match(login.headers['set-cookie'],/; Secure$/);assert.match(login.headers['set-cookie'],/HttpOnly/);}finally{f.close();}
});
