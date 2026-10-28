export function safeReturn(value){
  if(typeof value!=='string'||value.length>1000||!value.startsWith('/')||value.startsWith('//')||/[\\\r\n]/.test(value))return '/dashboard';
  try{const u=new URL(value,'https://local.invalid');if(u.origin!=='https://local.invalid'||/^\/(?:login|signup|auth\/callback|reset-password|forgot-password|verify-email)(?:\/|$)/.test(u.pathname))return '/dashboard';return u.pathname+u.search+u.hash;}catch{return '/dashboard';}
}
export function validateAuth(action,input,minLength=8){
  const errors={};const email=String(input.email||'').trim();
  if(['login','signup','forgot','resend'].includes(action)){
    if(!email)errors.email='Email address is required.';
    else if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))errors.email='Enter a valid email address.';
  }
  if(['login','signup','reset'].includes(action)){
    if(typeof input.password!=='string'||!input.password)errors.password='Password is required.';
    else if(input.password.length>1024)errors.password='Password is too long.';
    else if(action!=='login'&&input.password.length<minLength)errors.password=`Password must be at least ${minLength} characters.`;
    if(action!=='login'&&input.password!==input.confirmPassword)errors.confirmPassword='Passwords do not match.';
  }
  return errors;
}
export function maskedEmail(value){const [name,domain]=String(value||'').split('@');return domain?name.slice(0,1)+'•••@'+domain:'';}
