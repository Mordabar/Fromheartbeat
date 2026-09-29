import assert from 'node:assert/strict';
import {Studio} from '../assets/studio.js';
import * as THREE from '../assets/vendor/three.module.js';
const sizes=[[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900],[1920,1080]];
const zones=['lobby','samples','genre','mood','voice','story','products','checkout','session'];
let tests=0;
for(const [w,h] of sizes){globalThis.innerWidth=w;globalThis.innerHeight=h;globalThis.devicePixelRatio=3;for(const zone of zones){const s=Object.create(Studio.prototype);s.camera=new THREE.PerspectiveCamera(50,w/h,.1,80);s.productIndex=-1;s.productZoom=false;const mobile=w<760;s.free=[16,80,w-16,h-(mobile?205:150)];const shot=s.shot(zone);s.camera.position.copy(shot.pos);s.camera.lookAt(shot.look);s.camera.setViewOffset(w,h,shot.offset.x*w,shot.offset.y*h,w,h);s.camera.updateMatrixWorld();const q=shot.look.clone().project(s.camera);const px=(q.x+1)/2*w,py=(1-q.y)/2*h;assert.ok(Math.abs(px-(s.free[0]+s.free[2])/2)<.01);assert.ok(Math.abs(py-(s.free[1]+s.free[3])/2)<.01);assert.ok(shot.pos.distanceTo(shot.look)>1);assert.ok(Number.isFinite(shot.pos.x));assert.ok(s.pixelRatio()<=2.5);tests++;}}
console.log(`${tests} camera center/projection cases passed across ${sizes.length} viewport sizes`);
const subjects={lobby:{c:[0,3.6,0],r:[1.55,1.97,.15],yaw:0},samples:{c:[-7.2,2.7,-6.3],r:[3.25,2.25,.2],yaw:.63},genre:{c:[3.3,1.2,2.9],r:[2.5,1.2,1],yaw:.5},voice:{c:[-5.6,1.8,1.8],r:[1.8,1.8,1.8],yaw:-.15}};
for(const [w,h] of sizes){globalThis.innerWidth=w;globalThis.innerHeight=h;for(const [zone,obj]of Object.entries(subjects)){const s=Object.create(Studio.prototype);s.camera=new THREE.PerspectiveCamera(50,w/h,.1,80);s.free=[16,80,w-16,h-(w<760?205:150)];const sh=s.shot(zone);s.camera.position.copy(sh.pos);s.camera.lookAt(sh.look);s.camera.setViewOffset(w,h,sh.offset.x*w,sh.offset.y*h,w,h);s.camera.updateMatrixWorld();let escaped=0;for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const q=new THREE.Vector3(x*obj.r[0],y*obj.r[1],z*obj.r[2]).applyAxisAngle(THREE.Object3D.DEFAULT_UP,obj.yaw).add(new THREE.Vector3(...obj.c)).project(s.camera);const px=(q.x+1)/2*w,py=(1-q.y)/2*h;if(px<s.free[0]-1||px>s.free[2]+1||py<s.free[1]-1||py>s.free[3]+1)escaped++;}assert.equal(escaped,0,`Subject cropped: ${w}x${h} ${zone}`);}}

console.log("PASS: 28 subject-volume framing cases for logo, records, console and booth.");
