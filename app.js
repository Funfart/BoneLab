(() => {
const canvas = document.getElementById('canvas'), ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const files = {
  torso:'Torso.png', skull:'skull.png', jaw:'jaw.png',
  rh:'RightHumerus.png', rfa:'LowerRightArm.png',
  lh:'LeftHumerus.png', lfa:'LowerLeftArm.png',
  rt:'RightFemur.png', rsh:'LowerRightLeg.png',
  lt:'LeftFemur.png', lsh:'LowerLeftLeg.png'
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
let gravity=.45, strength=1, damping=.94, sensitivity=1, shakeSensitivity=1, tilt=0, dragging=null, lastTime=0, danceUntil=0, danceStart=0, lastShake=0, lastAcceleration=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rotatePoint(x,y,pivot,a){const dx=x-pivot.x,dy=y-pivot.y,c=Math.cos(a),s=Math.sin(a);return {x:pivot.x+dx*c-dy*s,y:pivot.y+dx*s+dy*c};}
function drawLayer(key, pivot, angle=0) {
  const im=imgs[key]; if(!im || !im.complete || !im.naturalWidth) return;
  ctx.save();
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
  for(const [name,j] of Object.entries(joints)){
    if(name===dragging) continue;
    // Dance and phone tilt both rotate around the same joint anchors.
    // Dance is a smooth, bounded left-right sway, not random per-joint impulses.
    const danceActive = t < danceUntil;
    const danceElapsed = (t-danceStart)/1000;
    // Ten-second dance routine: alternating arm swings, elbow bounces,
    // side-to-side hip shifts, alternating knee kicks, and a light jaw bob.
    const danceFade = danceActive ? Math.min(1, (danceUntil-t)/650, danceElapsed/0.35) : 0;
    const side = (name==='rightShoulder'||name==='rightElbow'||name==='rightHip'||name==='rightKnee') ? -1 : 1;
    const isLimb = name!=='jaw';
    let danceMove = 0;
    if(danceActive){
      const beat = danceElapsed * Math.PI * 2 * 1.35;
      if(name==='leftShoulder') danceMove = Math.sin(beat) * .43;
      else if(name==='rightShoulder') danceMove = Math.sin(beat + Math.PI) * .43;
      else if(name==='leftElbow') danceMove = Math.sin(beat*1.02 + 1.1) * .30;
      else if(name==='rightElbow') danceMove = Math.sin(beat*1.02 + Math.PI + 1.1) * .30;
      else if(name==='leftHip') danceMove = Math.sin(beat + Math.PI/2) * .24;
      else if(name==='rightHip') danceMove = Math.sin(beat + Math.PI*1.5) * .24;
      else if(name==='leftKnee') danceMove = Math.max(0,Math.sin(beat + .4)) * .48 - .12;
      else if(name==='rightKnee') danceMove = Math.max(0,Math.sin(beat + Math.PI + .4)) * .48 - .12;
      else if(name==='jaw') danceMove = Math.sin(beat*2) * .10;
    }
    const gravityPull = name==='jaw' ? 0 : Math.sin(j.angle)*gravity*.018;
    const swayTarget = (isLimb ? tilt*.18*sensitivity : 0) + danceMove*danceFade*strength;
    const target = j.base + gravityPull + swayTarget;
    j.vel=(j.vel+(target-j.angle)*.075*strength)*damping;
    j.angle=clamp(j.angle+j.vel*(dt*60),-j.limit,j.limit);
  }
  draw();requestAnimationFrame(step);
}
requestAnimationFrame(step);
function setRange(id,fn){const el=document.getElementById(id),out=document.getElementById(id+'Val');el.addEventListener('input',()=>{const v=Number(el.value);out.textContent=v.toFixed(2).replace(/0$/,'').replace(/\.$/,'');fn(v);});}
setRange('gravity',v=>gravity=v);setRange('swing',v=>strength=v);setRange('damping',v=>damping=v);setRange('sensitivity',v=>sensitivity=v);setRange('shakeSensitivity',v=>shakeSensitivity=v);
document.getElementById('dance').addEventListener('click',()=>{danceStart=performance.now();danceUntil=danceStart+10000;status.textContent='Dance routine started — 10 seconds of coordinated movement.';});
document.getElementById('reset').addEventListener('click',()=>{for(const j of Object.values(joints)){j.angle=0;j.vel=0;j.base=0;}tilt=0;status.textContent='Pose reset.';});
const settingsToggle=document.getElementById('settingsToggle');
const settingsPopover=document.getElementById('settingsPopover');
function setSettingsOpen(open){settingsPopover.hidden=!open;settingsToggle.setAttribute('aria-expanded',String(open));settingsToggle.setAttribute('aria-label',open?'Close settings':'Open settings');}
settingsToggle.addEventListener('click',()=>setSettingsOpen(settingsPopover.hidden));
document.getElementById('settingsClose').addEventListener('click',()=>setSettingsOpen(false));
function triggerShake(){
  const now=performance.now(); if(now-lastShake<380)return; lastShake=now;
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
document.getElementById('gyro').addEventListener('click',async()=>{
  try{
    if(typeof DeviceOrientationEvent==='undefined'){status.textContent='This device/browser does not expose orientation sensors.';return;}
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      const permission=await DeviceOrientationEvent.requestPermission();
      if(permission!=='granted'){status.textContent='Motion permission was not granted.';return;}
    }
    window.addEventListener('deviceorientation',e=>{if(e.gamma!=null)tilt=clamp(-e.gamma/45,-1,1);},{passive:true});
    status.textContent='Phone tilt enabled. Gently tilt the device to swing the limbs.';
  }catch(e){status.textContent='Could not enable phone tilt. Use HTTPS and allow sensor permission.';}
});
function canvasPoint(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*2048,y:(e.clientY-r.top)/r.height*2048};}
function pickJoint(p){
  let best=null,dist=Infinity;
  for(const [name,j] of Object.entries(joints)){if(name==='jaw'||name.endsWith('Shoulder')||name.endsWith('Hip')||name.endsWith('Elbow')||name.endsWith('Knee')){const d=Math.hypot(p.x-j.x,p.y-j.y);if(d<90&&d<dist){best=name;dist=d;}}}
  return best;
}
canvas.addEventListener('pointerdown',e=>{const p=canvasPoint(e);dragging=pickJoint(p);if(dragging){canvas.setPointerCapture(e.pointerId);status.textContent='Dragging '+dragging+'.';}});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const p=canvasPoint(e),j=joints[dragging];j.base=clamp((p.x-j.x)/230,-j.limit,j.limit);j.angle=j.base;j.vel=0;});
function release(){if(dragging){dragging=null;status.textContent='Released. The joint will swing and settle.';}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
})();
