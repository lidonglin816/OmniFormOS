// Semi-implicit integration; bounded time steps remain stable after background tabs.
export function stepSpring(position,velocity,elapsed,{stiffness=100,damping=10,mass=1}={}) {
  let remaining=Math.min(Math.max(elapsed,0),.064);
  while(remaining>0){
    const dt=Math.min(remaining,1/120);
    velocity+=(-stiffness*position-damping*velocity)/mass*dt;
    position+=velocity*dt;remaining-=dt;
  }
  return {position,velocity,settled:Math.abs(position)<.15&&Math.abs(velocity)<.5};
}

export function flipDelta(first,last){
  return {x:first.left-last.left,y:first.top-last.top};
}
