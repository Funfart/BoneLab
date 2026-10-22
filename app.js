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
let bonesOn=true, collapseMode=false, bonesMotionStart=0, bonesPhase='idle', danceEnabled=true, danceCooldownUntil=0, danceRunning=false;
const pieceOrder=['rh','rfa','rt','rsh','torso','lt','lsh','lh','lfa','skull','jaw'];
const pieceAnchors={rh:[850,715],rfa:[865,1028],rt:[850,1190],rsh:[855,1450],torso:[1024,1024],lt:[1200,1200],lsh:[1200,1460],lh:[1260,720],lfa:[1260,1038],skull:[1055,390],jaw:[1055,478]};
const fallen=Object.fromEntries(pieceOrder.map((key,i)=>[key,{x:0,y:0,vx:(Math.random()-.5)*5,vy:0,rot:0,vr:(Math.random()-.5)*.035,restY:Math.max(0,1660-pieceAnchors[key][1])+(i%3)*18}]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rotatePoint(x,y,pivot,a){const dx=x-pivot.x,dy=y-pivot.y,c=Math.cos(a),s=Math.sin(a);return {x:pivot.x+dx*c-dy*s,y:pivot.y+dx*s+dy*c};}
function drawLayer(key, pivot, angle=0) {
  const im=imgs[key]; if(!im || !im.complete || !im.naturalWidth) return;
  ctx.save();
  if(pivot){ctx.translate(pivot.x,pivot.y);ctx.rotate(angle);ctx.drawImage(im,-pivot.x,-pivot.y);}
  else ctx.drawImage(im,0,0);
  ctx.restore();
}
function drawFallenLayer(key){
  const im=imgs[key], f=fallen[key]; if(!im || !im.complete || !im.naturalWidth)return;
  ctx.save();ctx.translate(1024+f.x,1024+f.y);ctx.rotate(f.rot);ctx.drawImage(im,-1024,-1024);ctx.restore();
}
function updateBonesMotion(t,dt){
  if(bonesPhase==='idle')return;
  const elapsed=(t-bonesMotionStart)/1000;
  if(bonesPhase==='collapse'){
    for(const key of pieceOrder){const f=fallen[key];f.vy+=Math.max(.08,gravity*.55)*(dt*60);f.x+=f.vx*(dt*60);f.y+=f.vy*(dt*60);f.rot+=f.vr*(dt*60);
      if(f.y>=f.restY){f.y=f.restY;f.vy*=-.16;f.vx*=.78;f.vr*=.65;if(Math.abs(f.vy)<.8)f.vy=0;}}
    if(elapsed>2.8){bonesPhase='idle';}
  } else if(bonesPhase==='reassemble'){
    const u=clamp(elapsed/1.7,0,1),ease=1-Math.pow(1-u,3);
    for(const key of pieceOrder){const f=fallen[key];f.x*=1-ease;f.y*=1-ease;f.rot*=1-ease;f.vx=0;f.vy=0;f.vr=0;}
    if(u>=1){for(const key of pieceOrder){const f=fallen[key];f.x=f.y=f.rot=f.vx=f.vy=f.vr=0;}bonesPhase='idle';collapseMode=false;bonesOn=true;danceButton.disabled=false;danceButton.textContent='Dance · 10s';status.textContent='Bones reassembled. Dance is ready.';}
  }
}
function draw(){
  ctx.clearRect(0,0,2048,2048);
  if(collapseMode){for(const key of pieceOrder)drawFallenLayer(key);return;}
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
  updateBonesMotion(t,dt);
  if(!bonesOn){draw();requestAnimationFrame(step);return;}
  if(danceRunning && t>=danceUntil){danceRunning=false;danceCooldownUntil=t+7000;danceButton.disabled=true;danceButton.textContent='Cooling down · 7s';status.textContent='Dance finished. 7-second cooldown started.';}
  if(!danceRunning && danceCooldownUntil>0 && t>=danceCooldownUntil){danceCooldownUntil=0;danceButton.disabled=!bonesOn;danceButton.textContent='Dance · 10s';}
  for(const [name,j] of Object.entries(joints)){
    if(name===dragging) continue;
    // Dance and phone tilt both rotate around the same joint anchors.
    // Dance is a smooth, bounded left-right sway, not random per-joint impulses.
    const danceActive = danceRunning && t < danceUntil;
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
const danceButton=document.getElementById('dance');
danceButton.addEventListener('click',()=>{const now=performance.now();if(!bonesOn||bonesPhase!=='idle')return;if(danceRunning){danceRunning=false;danceUntil=0;danceCooldownUntil=now+7000;danceButton.disabled=true;danceButton.textContent='Cooling down · 7s';status.textContent='Dance stopped. 7-second cooldown started.';return;}if(now<danceCooldownUntil)return;danceRunning=true;danceStart=now;danceUntil=now+10000;danceButton.textContent='Stop dance';status.textContent='Dance started — runs for up to 10 seconds. Stop starts a 7-second cooldown.';});
const bonesButton=document.getElementById('bonesToggle');
bonesButton.addEventListener('click',()=>{const now=performance.now();if(bonesOn){bonesOn=false;danceRunning=false;danceUntil=0;danceCooldownUntil=0;danceButton.disabled=true;danceButton.textContent='Dance unavailable';collapseMode=true;bonesPhase='collapse';bonesMotionStart=now;for(const key of pieceOrder){const f=fallen[key];f.vx=(Math.random()-.5)*5;f.vy=Math.random()*-2;f.vr=(Math.random()-.5)*.045;f.restY=Math.max(0,1710-pieceAnchors[key][1])+(Math.random()*36); }bonesButton.textContent='Bones · ON';bonesButton.setAttribute('aria-pressed','false');status.textContent='Bones OFF — image layers collapsing to the bottom.';}else{bonesOn=true;collapseMode=true;bonesPhase='reassemble';bonesMotionStart=now;danceButton.disabled=true;bonesButton.textContent='Bones · OFF';bonesButton.setAttribute('aria-pressed','true');status.textContent='Bones ON — reassembling marionette...';}});
document.getElementById('reset').addEventListener('click',()=>{for(const j of Object.values(joints)){j.angle=0;j.vel=0;j.base=0;}tilt=0;if(!bonesOn){bonesOn=true;collapseMode=true;bonesPhase='reassemble';bonesMotionStart=performance.now();}status.textContent='Pose reset.';});
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
