import {openAccountCenter} from './omni-auth.js';

// 将模块顶栏头像接入应用内个人中心，不再跳转到独立登录页。
function profile(){
  try{
    const email=localStorage.getItem('omniformos.session')||localStorage.getItem('omniformos.account')||'';
    const user=(JSON.parse(localStorage.getItem('omniformos.users')||'{}')[email]||{});
    return {email,user,label:user.nickname||email||'个人中心'};
  }catch{return {email:'',user:{},label:'个人中心'};}
}
function mount(){
  const p=profile();
  document.querySelectorAll('span.desk-user-avatar,.top-actions>span.avatar').forEach(element=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=element.className;
    button.innerHTML=element.innerHTML;
    button.dataset.accountCenter='';
    button.title=p.email?`${p.label} · 个人中心`:'登录账户';
    button.setAttribute('aria-label',p.email?`${p.label}，打开个人中心`:'登录账户');
    element.replaceWith(button);
  });
  document.querySelectorAll('[data-account-center]').forEach(button=>{
    button.title=p.email?`${p.label} · 个人中心`:'登录账户';
    button.setAttribute('aria-label',p.email?`${p.label}，打开个人中心`:'登录账户');
  });
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-account-center]');
  if(!button)return;
  event.preventDefault();
  openAccountCenter();
});
window.addEventListener('omni-auth-changed',mount);
const root=document.getElementById('app');
if(root){new MutationObserver(mount).observe(root,{childList:true,subtree:true});mount();}
