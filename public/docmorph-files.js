function openDB() {
  return new Promise((resolve, reject) => { const request = indexedDB.open('omniformos-docmorph-files', 1); request.onupgradeneeded = () => request.result.createObjectStore('files'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('浏览器无法打开原文件存储')); });
}
export async function saveOriginal(id, blob) {
  const db = await openDB();
  try { await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(blob, id); tx.oncomplete = resolve; tx.onerror = () => reject(new Error('原文件保存失败，可能是浏览器存储空间不足')); tx.onabort = tx.onerror; }); } finally { db.close(); }
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
  const response=await fetch('/api/doc/original/'+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:blob.name||'原件.'+({ 'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'})[blob.type],base64:data})});if(!response.ok)throw Error((await response.json()).error||'原文件服务端保存失败，本机副本已保留');
}
export async function getOriginal(id) {
  const db = await openDB();
  try { const blob=await new Promise((resolve, reject) => { const request = db.transaction('files').objectStore('files').get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('原文件读取失败')); });if(blob)return blob; } finally { db.close(); }
  const response=await fetch('/api/doc/original/'+encodeURIComponent(id));if(response.ok)return response.blob();return null;
}
