import assert from 'node:assert/strict';
import {Studio} from '../assets/studio.js';
import * as THREE from '../assets/vendor/three.module.js';
const grad={addColorStop(){}};
const context=new Proxy({measureText:t=>({width:t.length*50}),createRadialGradient:()=>grad,createLinearGradient:()=>grad},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
globalThis.document={querySelector:()=>null,createElement:()=>({getContext:()=>context}),createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(v){}}),fonts:{load:()=>Promise.resolve()}};
const s=Object.create(Studio.prototype);s.scene=new THREE.Scene();s.mobile=true;s.renderer={capabilities:{getMaxAnisotropy:()=>8}};s.labels=[];s.pickables=[];s.accentColor=new THREE.Color(0x9b5cff);s.accentTarget=s.accentColor.clone();s.buildMaterials();s.buildRoom();s.buildLogo();s.buildGear();s.buildClientDesk();s.buildInformation();s.buildAnchors();s.buildArt();s.buildParticles();s.scene.updateMatrixWorld(true);
let meshes=0,vertices=0;s.scene.traverse(o=>{if(o.isMesh){meshes++;const a=o.geometry.attributes.position.array;vertices+=a.length/3;for(const x of a)assert.ok(Number.isFinite(x));}});
assert.equal(s.records.length,6);assert.equal(s.podiums.length,3);assert.equal(s.logo.children[0].children.length,4);assert.equal(s.pickables.length,17);for(const record of s.records){assert.ok(record.art.position.z>.015);assert.ok(record.art.geometry.parameters.radius<.66);}
assert.equal(s.anchors.length,7);s.setProducts([{name:'Prueba',price:'$69.900 COP',features:['Canción de 2 a 4 minutos'],tag:'Digital'}]);
s.setTracks(['a','b','c','d','e','f']);s.setPlaying(2);assert.ok(s.records[2].ring.visible);assert.ok(!s.records[1].ring.visible);s.setScreen({genre:'Pop',recipient:'Luna'});
console.log(`PASS: actual Three.js geometry builds (${meshes} meshes / ${vertices} vertices), four logo contours, six cover placements, seventeen pick targets, audio highlight and studio monitor state.`);
