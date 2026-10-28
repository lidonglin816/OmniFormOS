import React,{useEffect,useMemo,useRef,Component} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {pointerGaze,dampingAlpha} from '../public/mascot-tracking.js';

const white='#f6f3ff',purple='#9873d5',ink='#302064',cyan='#9feaff';
function Orb({position=[0,0,0],scale=[1,1,1],color=white,metalness=.25,roughness=.28,...props}){
  return <mesh position={position} scale={scale} {...props}><sphereGeometry args={[1,28,20]}/><meshStandardMaterial color={color} metalness={metalness} roughness={roughness}/></mesh>;
}
function Star({position=[0,0,0],scale=.18,color=purple}){
  const shape=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,1);s.quadraticCurveTo(.2,.22,1,0);s.quadraticCurveTo(.22,-.2,0,-1);s.quadraticCurveTo(-.2,-.22,-1,0);s.quadraticCurveTo(-.22,.2,0,1);return s;},[]);
  return <mesh position={position} scale={scale}><extrudeGeometry args={[shape,{depth:.08,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:2,steps:1}]}/><meshStandardMaterial color={color} metalness={.35} roughness={.22}/></mesh>;
}
function Eye({x,pupilRef}){return <group position={[x,.03,.9]}>
  <Orb scale={[.4,.49,.15]} color='#faf5ff'/>
  <group ref={pupilRef} position={[0,0,.12]}><Orb scale={[.255,.35,.09]} color={ink}/><Orb position={[0,-.14,.04]} scale={[.21,.17,.07]} color={purple}/><Orb position={[.09,.16,.09]} scale={[.085,.085,.035]} color='white'/><Star position={[-.015,.015,.105]} scale={.075} color='white'/><Orb position={[-.11,-.13,.09]} scale={[.04,.04,.02]} color={cyan}/></group>
  </group>;}
function Robot({gaze,layer,reduced}){
  const body=useRef(),head=useRef(),left=useRef(),right=useRef(),eyes=useRef();
  const {size,camera,gl}=useThree();
  const euler=useMemo(()=>new THREE.Euler(),[]),target=useMemo(()=>new THREE.Quaternion(),[]);
  const time=useRef(0),blinkAt=useRef(3.8),blinkStart=useRef(-1),rendered=useRef(false);
  const shellShape=useMemo(()=>{const s=new THREE.Shape();s.moveTo(-1.34,-.65);s.bezierCurveTo(-1.8,-.3,-1.7,.95,-.9,1.3);s.bezierCurveTo(-.55,1.55,-.25,1.48,-.5,1.95);s.bezierCurveTo(.4,1.93,1.62,1.05,1.61,.1);s.bezierCurveTo(1.65,-.8,.75,-1.03,-.1,-1.03);s.bezierCurveTo(-.65,-1.03,-1.14,-.9,-1.34,-.65);return s;},[]);
  const antenna=useMemo(()=>new THREE.QuadraticBezierCurve3(new THREE.Vector3(.65,1.24,-.1),new THREE.Vector3(1.25,2,-.1),new THREE.Vector3(1.63,1.7,-.1)),[]);
  useEffect(()=>{camera.zoom=Math.min(size.width/4.6,size.height/3.55);camera.updateProjectionMatrix();},[camera,size.width,size.height]);
  useEffect(()=>{const canvas=gl.domElement;const lost=e=>{e.preventDefault();layer.dataset.renderer='fallback';};canvas.addEventListener('webglcontextlost',lost);return()=>canvas.removeEventListener('webglcontextlost',lost);},[gl,layer]);
  useFrame((state,delta)=>{
    if(!rendered.current){rendered.current=true;layer.dataset.renderer='webgl';}
    const dt=Math.min(delta,.05);time.current+=dt;const t=time.current;
    const g=reduced.current?{x:0,y:0,yaw:0,pitch:0,bodyYaw:0}:gaze.current;
    const alpha=dampingAlpha(dt,!gaze.current.active);
    euler.set(g.pitch,g.yaw,0);target.setFromEuler(euler);head.current.quaternion.slerp(target,alpha);
    // Face framing remains fixed; the background only breathes very slightly.
    body.current.position.y=reduced.current?0:Math.sin(t*.85)*.02;
    const breath=reduced.current?1:1+Math.sin(t*1.3)*.003;body.current.scale.setScalar(breath);
    const eyeAlpha=1-Math.exp(-(gaze.current.active?22:3)*dt);
    for(const pupil of [left.current,right.current]){pupil.position.x=THREE.MathUtils.lerp(pupil.position.x,g.x*.14,eyeAlpha);pupil.position.y=THREE.MathUtils.lerp(pupil.position.y,g.y*.11,eyeAlpha);}
    if(!reduced.current){
      if(t>blinkAt.current){blinkStart.current=t;blinkAt.current=t+4.1+Math.random()*2.3;}
      const blink=t-blinkStart.current;eyes.current.scale.y=blink>=0&&blink<.2?Math.max(.08,Math.abs(blink-.1)*10):1;
    }else eyes.current.scale.y=1;
  });
  return <group ref={body}>
    <group ref={head}>
      <mesh position={[0,0,-.34]}><extrudeGeometry args={[shellShape,{depth:.6,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.13,bevelThickness:.16,curveSegments:28}]}/><meshStandardMaterial color={white} metalness={.3} roughness={.26}/></mesh>
      <Orb position={[0,.05,.38]} scale={[1.42,1.08,.52]} color='#a48bcf'/>
      <Orb position={[0,.04,.48]} scale={[1.31,.96,.44]} color='#7c5ba8' metalness={.2} roughness={.34}/>
      <group ref={eyes}><Eye x={-.57} pupilRef={left}/><Eye x={.57} pupilRef={right}/></group>
      <Orb position={[0,-.48,.9]} scale={[.2,.15,.045]} color='#9f4cbb'/><Orb position={[0,-.54,.93]} scale={[.14,.07,.024]} color='#f4a1db'/>
      <Star position={[.03,1.03,.55]} scale={.19}/>
      <mesh><tubeGeometry args={[antenna,24,.027,6,false]}/><meshStandardMaterial color={purple}/></mesh><Star position={[1.63,1.7,-.1]} scale={.22} color={cyan}/>
      {[-1,1].map(side=><group key={side} position={[side*1.48,.4,.04]} rotation={[0,0,side*.12]}>
        <Orb position={[side*.16,-.52,0]} scale={[.48,.81,.38]} color={white}/>
        <Orb position={[side*.21,-.64,.3]} scale={[.28,.59,.13]} color='#9c78cb'/>
        <Orb position={[side*.15,.1,.05]} scale={[.31,.29,.29]} color={white}/>
      </group>)}
    </group>
  </group>;
}
function Scene({host,layer}){
  const gaze=useRef({...pointerGaze(1,1,2,2),active:false}),reduced=useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const {setFrameloop,invalidate}=useThree();
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');let visible=true;
    const refresh=()=>{reduced.current=media.matches;const active=visible&&!document.hidden&&!media.matches;layer.dataset.motion=active?'active':media.matches?'reduced':'paused';setFrameloop(active?'always':'demand');if(visible&&!document.hidden)invalidate();};
    const move=event=>{if(event.pointerType==='touch'||media.matches)return;gaze.current={...pointerGaze(event.clientX,event.clientY,innerWidth,innerHeight),active:true};};
    const reset=()=>{gaze.current={...pointerGaze(1,1,2,2),active:false};};
    const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;refresh();});observer.observe(host);
    window.addEventListener('pointermove',move,{passive:true});document.documentElement.addEventListener('pointerleave',reset);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',refresh);media.addEventListener('change',refresh);refresh();
    return()=>{observer.disconnect();window.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',reset);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',refresh);media.removeEventListener('change',refresh);};
  },[host,setFrameloop,invalidate]);
  return <><ambientLight intensity={1.7}/><directionalLight position={[3,4,6]} intensity={3}/><directionalLight position={[-4,1,2]} color='#a78bff' intensity={2}/><Robot gaze={gaze} reduced={reduced} layer={layer}/></>;
}
class Boundary extends Component{state={failed:false};static getDerivedStateFromError(){return{failed:true};}componentDidCatch(){this.props.layer.dataset.renderer='fallback';}render(){return this.state.failed?null:this.props.children;}}
function PerchingPaws(){
  const {size,camera,invalidate}=useThree();
  const zoom=size.width<650?32:45;
  const spread=Math.min(size.width*.25,380)/zoom;
  useEffect(()=>{camera.zoom=zoom;camera.updateProjectionMatrix();invalidate();},[camera,zoom,invalidate]);
  return <><ambientLight intensity={1.8}/><directionalLight position={[-3,5,7]} intensity={3}/><directionalLight position={[4,0,3]} color='#b89aff' intensity={1.1}/>
    {[-1,1].map(side=><group key={side} position={[side*spread,0,0]} scale={[1.45,1.3,1.3]} rotation={[.12,side*-.12,side*-.08]}>
      <Orb position={[0,.32,-.24]} scale={[.52,.3,.3]} color={purple}/>
      <Orb position={[0,.22,.02]} scale={[.58,.43,.34]} color={white}/>
      {[-1,0,1].map((finger,i)=><group key={finger} position={[finger*.31,-.18+(i===1?-.035:.025),.27]}>
        <Orb scale={[.185,.34,.21]} color={white}/>
        <Orb position={[0,-.15,.17]} scale={[.13,.13,.065]} color='#9f7bd3'/>
      </group>)}
      <Orb position={[side*-.56,.02,.09]} scale={[.23,.25,.24]} color={white}/>
      <Orb position={[side*-.6,-.05,.28]} scale={[.13,.13,.055]} color={purple}/>
    </group>)}
  </>;
}
export function mountHeroMascot(host,layer,pawsHost){
  const app=createRoot(host);
  app.render(<><Boundary layer={layer}><Canvas orthographic camera={{position:[0,.04,9],near:.1,far:30,zoom:65}} dpr={[1,1.5]} gl={{alpha:true,antialias:true,powerPreference:'low-power'}} fallback={null} onCreated={({gl})=>gl.setClearColor(0x000000,0)}><Scene host={host} layer={layer}/></Canvas></Boundary>{pawsHost&&createPortal(<Boundary layer={pawsHost}><Canvas orthographic frameloop="demand" camera={{position:[0,0,7],near:.1,far:20,zoom:45}} dpr={[1,1.5]} gl={{alpha:true,antialias:true,powerPreference:'low-power'}} fallback={null} onCreated={({gl})=>{gl.setClearColor(0x000000,0);pawsHost.dataset.renderer='webgl';}}><PerchingPaws/></Canvas></Boundary>,pawsHost)}</>);
  return()=>app.unmount();
}
