(() => {
const canvas = document.getElementById('canvas'), ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const files = {
  torso:'Torso2.png', skull:'skull2.png', jaw:'jaw2.png',
  rh:'RightHumerus2.png', rfa:'LowerRightArm2.png',
  lh:'LeftHumerus2.png', lfa:'LowerLeftArm2.png',
  rt:'RightFemur2.png', rsh:'LowerRightLeg2.png',
  lt:'LeftFemur2.png', lsh:'LowerLeftLeg2.png'
};
const imgs = {};
let loaded = 0;
for (const [key,file] of Object.entries(files)) {
  const im = new Image(); im.src = 'assets/' + file;
  im.onload = () => { loaded++; if(loaded===Object.keys(files).length) draw(); };
  im.onerror = () => { status.textContent = 'Could not load '+file+'. Keep the assets folder beside index.html.'; };
  imgs[key] = im;
}
const joints = {
  rightShoulder:{x:850,y:715,angle:0,vel:0,base:0,limit:1.25},
  rightElbow:{x:865,y:1028,angle:0,vel:0,base:0,limit:1.5},
  leftShoulder:{x:1260,y:720,angle:0,vel:0,base:0,limit:1.25},
  leftElbow:{x:1260,y:1038,angle:0,vel:0,base:0,limit:1.5},
  rightHip:{x:850,y:1190,angle:0,vel:0,base:0,limit:.9},
  rightKnee:{x:855,y:1450,angle:0,vel:0,base:0,limit:1.15},
  leftHip:{x:1200,y:1200,angle:0,vel:0,base:0,limit:.9},
  leftKnee:{x:1200,y:1460,angle:0,vel:0,base:0,limit:1.15},
  jaw:{x:1055,y:478,angle:0,vel:0,base:0,limit:.55}
};
let gravity=.45, strength=1, damping=.94, sensitivity=1, shakeSensitivity=1, tilt=0, dragging=null, lastTime=0, danceActive=false, danceStart=0, lastShake=0, lastAcceleration=null, bonesCollapsed=false, collapseProgress=0, skullWiggle=0, tiltListening=false;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const layerKeys=Object.keys(files);
const falls=Object.fromEntries(layerKeys.map(key=>[key,{x:0,y:0,vx:0,vy:0,rot:0,vr:0}]));
function rotatePoint(x,y,pivot,a){const dx=x-pivot.x,dy=y-pivot.y,c=Math.cos(a),s=Math.sin(a);return {x:pivot.x+dx*c-dy*s,y:pivot.y+dx*s+dy*c};}
function drawLayer(key, pivot, angle=0) {
  const im=imgs[key]; if(!im || !im.complete || !im.naturalWidth) return;
  ctx.save();
  const f=falls[key], cx=1024, cy=1024;
  ctx.translate(cx+f.x,cy+f.y);ctx.rotate(f.rot);ctx.translate(-cx,-cy);
  if(key==='skull'){ctx.translate(1050,420);ctx.rotate(skullWiggle);ctx.translate(-1050,-420);}
  if(pivot){ctx.translate(pivot.x,pivot.y);ctx.rotate(angle);ctx.drawImage(im,-pivot.x,-pivot.y);}
  else ctx.drawImage(im,0,0);
  ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,2048,2048);
  // Far-side arm and legs first, then rigid torso and near-side limbs.
  drawLayer('rh',joints.rightShoulder,joints.rightShoulder.angle);
  const re=rotatePoint(joints.rightElbow.x,joints.rightElbow.y,joints.rightShoulder,joints.rightShoulder.angle);
  drawLayer('rfa',re,joints.rightShoulder.angle+joints.rightElbow.angle);
  drawLayer('rt',joints.rightHip,joints.rightHip.angle);
  const rk=rotatePoint(joints.rightKnee.x,joints.rightKnee.y,joints.rightHip,joints.rightHip.angle);
  drawLayer('rsh',rk,joints.rightHip.angle+joints.rightKnee.angle);
  drawLayer('torso',null,0);
  drawLayer('lt',joints.leftHip,joints.leftHip.angle);
  const lk=rotatePoint(joints.leftKnee.x,joints.leftKnee.y,joints.leftHip,joints.leftHip.angle);
  drawLayer('lsh',lk,joints.leftHip.angle+joints.leftKnee.angle);
  drawLayer('lh',joints.leftShoulder,joints.leftShoulder.angle);
  const le=rotatePoint(joints.leftElbow.x,joints.leftElbow.y,joints.leftShoulder,joints.leftShoulder.angle);
  drawLayer('lfa',le,joints.leftShoulder.angle+joints.leftElbow.angle);
  drawLayer('jaw',joints.jaw,joints.jaw.angle);
  drawLayer('skull',null,0);
  
}
function step(t){
  const dt=Math.min(.035,(t-lastTime)/1000||.016);lastTime=t;
  const frameDance=danceActive&&!bonesCollapsed;
  for(const [key,f] of Object.entries(falls)){
    if(bonesCollapsed){
      f.vy+=1100*dt; f.vx+=(Math.sin((t/170)+(layerKeys.indexOf(key)*1.7))*35-f.vx)*.6*dt;
      f.vy=Math.min(f.vy,1500); f.x+=f.vx*dt; f.y+=f.vy*dt; f.vr+=(Math.sin(t/240+layerKeys.indexOf(key))*1.8-f.vr)*.8*dt; f.rot+=f.vr*dt;
      f.y=Math.min(f.y,Math.max(0,canvas.height-650)); if(f.y>=canvas.height-650)f.vy*=.15;
    } else {
      f.x*=Math.max(0,1-5*dt); f.y*=Math.max(0,1-5*dt); f.rot*=Math.max(0,1-4.5*dt); f.vx=0;f.vy=0;f.vr=0;
    }
  }
  for(const [name,j] of Object.entries(joints)){
    if(name===dragging) continue;
    const danceElapsed=(t-danceStart)/1000;
    const danceFade=frameDance?1:0;
    const danceBeat=danceElapsed*Math.PI*2*1.35;
    let danceMove=0;
    if(frameDance){
      if(name==='leftShoulder')danceMove=Math.sin(danceBeat)*.43;
      else if(name==='rightShoulder')danceMove=Math.sin(danceBeat+Math.PI)*.43;
      else if(name==='leftElbow')danceMove=Math.sin(danceBeat*1.02+1.1)*.30;
      else if(name==='rightElbow')danceMove=Math.sin(danceBeat*1.02+Math.PI+1.1)*.30;
      else if(name==='leftHip')danceMove=Math.sin(danceBeat+Math.PI/2)*.24;
      else if(name==='rightHip')danceMove=Math.sin(danceBeat+Math.PI*1.5)*.24;
      else if(name==='leftKnee')danceMove=Math.max(0,Math.sin(danceBeat+.4))*.48-.12;
      else if(name==='rightKnee')danceMove=Math.max(0,Math.sin(danceBeat+Math.PI+.4))*.48-.12;
      else if(name==='jaw')danceMove=Math.sin(danceBeat*2)*.10;
    }
    const gravityPull=name==='jaw'?0:Math.sin(j.angle)*gravity*.018;
    const swayTarget=(name==='jaw'?0:tilt*.18*sensitivity)+danceMove*danceFade*strength;
    const target=j.base+gravityPull+swayTarget;
    j.vel=(j.vel+(target-j.angle)*.075*strength)*damping;
    j.angle=clamp(j.angle+j.vel*(dt*60),-j.limit,j.limit);
  }
  skullWiggle+=(0-skullWiggle)*Math.min(1,dt*5);
  draw();requestAnimationFrame(step);
}
requestAnimationFrame(step);
function setRange(id,fn){const el=document.getElementById(id),out=document.getElementById(id+'Val');el.addEventListener('input',()=>{const v=Number(el.value);out.textContent=v.toFixed(2).replace(/0$/,'').replace(/\.$/,'');fn(v);});}
setRange('gravity',v=>gravity=v);setRange('swing',v=>strength=v);setRange('damping',v=>damping=v);setRange('sensitivity',v=>sensitivity=v);setRange('shakeSensitivity',v=>shakeSensitivity=v);
const danceButton=document.getElementById('dance');
danceButton.addEventListener('click',()=>{if(bonesCollapsed){status.textContent='Turn Bones ON to dance.';return;}danceActive=!danceActive;if(danceActive)danceStart=performance.now();danceButton.textContent='Dance: '+(danceActive?'ON':'OFF');danceButton.setAttribute('aria-pressed',String(danceActive));status.textContent=danceActive?'Dance animation looping. Tap Dance again to stop.':'Dance stopped.';});
const bonesButton=document.getElementById('bones');
bonesButton.addEventListener('click',()=>{bonesCollapsed=!bonesCollapsed;if(bonesCollapsed){danceActive=false;danceButton.textContent='Dance: OFF';danceButton.setAttribute('aria-pressed','false');for(const f of Object.values(falls)){f.vy-=80;f.vx+=(Math.random()-.5)*180;f.vr+=(Math.random()-.5)*1.8;}bonesButton.textContent='Bones: OFF';bonesButton.setAttribute('aria-pressed','true');status.textContent='Bones OFF — collapsing to the bottom. Dance disabled.';}else{bonesButton.textContent='Bones: ON';bonesButton.setAttribute('aria-pressed','false');for(const f of Object.values(falls)){f.vx=0;f.vy=0;f.vr=0;}status.textContent='Bones ON — reassembling. Dance is available again.';}});
document.getElementById('reset').addEventListener('click',()=>{for(const j of Object.values(joints)){j.angle=0;j.vel=0;j.base=0;}tilt=0;status.textContent='Pose reset.';});
const settingsToggle=document.getElementById('settingsToggle');
const settingsPopover=document.getElementById('settingsPopover');
function setSettingsOpen(open){settingsPopover.hidden=!open;settingsToggle.setAttribute('aria-expanded',String(open));settingsToggle.setAttribute('aria-label',open?'Close settings':'Open settings');}
settingsToggle.addEventListener('click',()=>setSettingsOpen(settingsPopover.hidden));
document.getElementById('settingsClose').addEventListener('click',()=>setSettingsOpen(false));
function triggerShake(){
  if(bonesCollapsed)return;
  const now=performance.now(); if(now-lastShake<380)return; lastShake=now;
  skullWiggle+=(Math.random()<.5?-1:1)*.11;
  const skullJoint=joints.jaw;skullJoint.vel+=(Math.random()<.5?-1:1)*.08;
  for(const [name,j] of Object.entries(joints)){
    if(name==='jaw'||name===dragging)continue;
    const side=(name==='rightShoulder'||name==='rightElbow'||name==='rightHip'||name==='rightKnee')?-1:1;
    j.vel += (Math.random()*.9+.35)*side*shakeSensitivity*(Math.random()<.5?-1:1);
  }
  status.textContent='Shake detected — the marionette is swinging!';
}
document.getElementById('shakeEnable').addEventListener('click',async()=>{
  try{
    if(typeof DeviceMotionEvent==='undefined'){status.textContent='This device/browser does not expose motion sensors.';return;}
    if(typeof DeviceMotionEvent.requestPermission==='function'){
      const permission=await DeviceMotionEvent.requestPermission();
      if(permission!=='granted'){status.textContent='Motion permission was not granted.';return;}
    }
    window.addEventListener('devicemotion',e=>{
      const a=e.acceleration;
      const g=e.accelerationIncludingGravity;
      const current=a && a.x!=null ? [a.x,a.y,a.z] : (g && g.x!=null ? [g.x,g.y,g.z] : null);
      if(!current)return;
      if(a && a.x!=null){
        const magnitude=Math.hypot(...current);
        if(magnitude>9/shakeSensitivity)triggerShake();
      } else {
        if(lastAcceleration){const delta=Math.hypot(current[0]-lastAcceleration[0],current[1]-lastAcceleration[1],current[2]-lastAcceleration[2]);if(delta>7.5/shakeSensitivity)triggerShake();}
        lastAcceleration=current;
      }
    },{passive:true});
    status.textContent='Phone shake enabled. Gently shake the phone to trigger movement.';
  }catch(e){status.textContent='Could not enable phone shake. Use HTTPS and allow motion-sensor permission.';}
});
function startTiltListener(){
  if(tiltListening)return;
  if(typeof DeviceOrientationEvent==='undefined'){status.textContent='Automatic tilt unavailable in this browser; tap the screen to jolt the bones.';return;}
  window.addEventListener('deviceorientation',e=>{if(e.gamma!=null)tilt=clamp(-e.gamma/45,-1,1);},{passive:true});
  tiltListening=true;
  status.textContent='Tilt control active where supported. Tap the stage to jolt the bones.';
}
// Start automatically unless the browser requires a user gesture for permission.
if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission!=='function')startTiltListener();
async function requestTiltIfNeeded(){
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'&&!tiltListening){
    try{const permission=await DeviceOrientationEvent.requestPermission();if(permission==='granted')startTiltListener();else status.textContent='Tilt permission denied. Tap the stage to jolt the bones.';}catch(e){status.textContent='Tilt needs browser permission. Tap the stage to jolt the bones.';}
  }
}
function canvasPoint(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*2048,y:(e.clientY-r.top)/r.height*2048};}
function pickJoint(p){
  let best=null,dist=Infinity;
  for(const [name,j] of Object.entries(joints)){if(name==='jaw'||name.endsWith('Shoulder')||name.endsWith('Hip')||name.endsWith('Elbow')||name.endsWith('Knee')){const d=Math.hypot(p.x-j.x,p.y-j.y);if(d<90&&d<dist){best=name;dist=d;}}}
  return best;
}
canvas.addEventListener('pointerdown',e=>{requestTiltIfNeeded();const p=canvasPoint(e);dragging=pickJoint(p);if(dragging){canvas.setPointerCapture(e.pointerId);status.textContent='Dragging '+dragging+'.';}else{triggerShake();status.textContent='Tap detected — bone composition jolted.';}});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const p=canvasPoint(e),j=joints[dragging];j.base=clamp((p.x-j.x)/230,-j.limit,j.limit);j.angle=j.base;j.vel=0;});
function release(){if(dragging){dragging=null;status.textContent='Released. The joint will swing and settle.';}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
})();
