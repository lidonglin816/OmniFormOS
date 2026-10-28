const key='omniformos.theme';
export const currentTheme=()=>typeof document!=='undefined'&&document.documentElement.dataset.theme==='dark'?'dark':'light';
export function setTheme(value,{persist=true}={}){const theme=value==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;if(persist)try{localStorage.setItem(key,theme);}catch{}document.querySelectorAll('[data-theme-set]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeSet===theme)));document.querySelectorAll('[data-theme-toggle]').forEach(button=>{button.textContent=theme==='dark'?'☀ 浅色':'☾ 深色';button.setAttribute('aria-label',theme==='dark'?'切换为浅色主题':'切换为深色主题');button.setAttribute('aria-pressed',String(theme==='dark'));});window.dispatchEvent(new CustomEvent('workspace-theme-change',{detail:{theme}}));}
function mount(){if(!document.querySelector('[data-theme-toggle]')){const button=document.createElement('button');button.type='button';button.dataset.themeToggle='';button.className='theme-toggle';document.body.append(button);}let theme=currentTheme();try{theme=localStorage.getItem(key)||theme;}catch{}setTheme(theme,{persist:false});}
if(typeof document!=='undefined'){
document.addEventListener('click',event=>{const control=event.target.closest('[data-theme-toggle],[data-theme-set]');if(control)setTheme(control.dataset.themeSet||(currentTheme()==='dark'?'light':'dark'));});
window.addEventListener('storage',event=>{if(event.key===key)setTheme(event.newValue,{persist:false});});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();

}
