const radians=degrees=>degrees*Math.PI/180;
export function pointerGaze(clientX,clientY,width,height){
  const x=Math.max(-1,Math.min(1,clientX/Math.max(width,1)*2-1));
  const y=Math.max(-1,Math.min(1,1-clientY/Math.max(height,1)*2));
  return {x,y,yaw:x*radians(20),pitch:-y*radians(12),bodyYaw:0};
}
export function dampingAlpha(delta,returning=false){return 1-Math.exp(-Math.min(Math.max(delta,0),.08)*(returning?3:12));}
