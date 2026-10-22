(() => {
const canvas = document.getElementById('canvas'), ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const files = {
  torso:'Torso.png', 'skull:jaw:'jaw.png', 'skull.png',
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
  jaw:{x:1055,y:478,angle:0,vel:0,base:0,limit:.55},
  leftKnee:{x:1200,y:1460,angle:0,vel:0,base:0,limit:1.15}
  
};
let gravity=.45, strength=1, damping=.94, sensitivity=1, tilt=0, dragging=null, lastTime=0, randomUntil=0;
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
  drawLayer('skull',null,0);
  drawLayer('jaw',joints.jaw,joints.jaw.angle);
}
function step(t){
  const dt=Math.min(.035,(t-lastTime)/1000||.016);lastTime=t;
  for(const [name,j] of Object.entries(joints)){
    if(name===dragging) continue;
    let impulse=0;
    if(t<randomUntil) impulse=(Math.random()-.5)*.14*strength;
    const gravityPull = name==='jaw' ? 0 : Math.sin(j.angle)*gravity*.018;
    const target=j.base + gravityPull + tilt*.18*sensitivity + impulse;
    j.vel=(j.vel+(target-j.angle)*.075*strength)*damping;
    j.angle=clamp(j.angle+j.vel*(dt*60),-j.limit,j.limit);
  }
  draw();requestAnimationFrame(step);
}
requestAnimationFrame(step);
function setRange(id,fn){const el=document.getElementById(id),out=document.getElementById(id+'Val');el.addEventListener('input',()=>{const v=Number(el.value);out.textContent=v.toFixed(2).replace(/0$/,'').replace(/\.$/,'');fn(v);});}
setRange('gravity',v=>gravity=v);setRange('swing',v=>strength=v);setRange('damping',v=>damping=v);setRange('sensitivity',v=>sensitivity=v);
document.getElementById('random').addEventListener('click',()=>{randomUntil=performance.now()+1800;for(const j of Object.values(joints))j.vel+=(Math.random()-.5)*.7*strength;status.textContent='Random movement triggered.';});
document.getElementById('reset').addEventListener('click',()=>{for(const j of Object.values(joints)){j.angle=0;j.vel=0;j.base=0;}tilt=0;status.textContent='Pose reset.';});
document.getElementById('gyro').addEventListener('click',async()=>{
  try{
    if(typeof DeviceOrientationEvent==='undefined'){status.textContent='This device/browser does not expose orientation sensors.';return;}
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      const permission=await DeviceOrientationEvent.requestPermission();
      if(permission!=='granted'){status.textContent='Motion permission was not granted.';return;}
    }
    window.addEventListener('deviceorientation',e=>{if(e.gamma!=null)tilt=clamp(e.gamma/45,-1,1);},{passive:true});
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
