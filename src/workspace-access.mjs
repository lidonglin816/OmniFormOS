import {randomBytes} from 'node:crypto';
export function createWorkspaceAccess(){
 const sessions=new Map();
 return{
  open(req){const remote=req.socket?.remoteAddress;if(remote&&!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote))throw Error('工作区仅限本机访问');const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))throw Error('不受信任的工作区地址');if(req.headers.origin&&req.headers.origin!==`http://${host}`)throw Error('禁止跨站工作区请求');if(!req.headers['content-type']?.startsWith('application/json'))throw Error('请使用 JSON 请求');for(const[key,expires]of sessions)if(expires<Date.now())sessions.delete(key);const key=randomBytes(32).toString('hex');sessions.set(key,Date.now()+8*3600000);return`omni_workspace=${key}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`;},
  authorized(req){const key=req.headers.cookie?.match(/(?:^|;\s*)omni_workspace=([^;]+)/)?.[1];return !!key&&sessions.get(key)>Date.now();}
 };
}
