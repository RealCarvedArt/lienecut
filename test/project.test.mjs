import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateProject} from '../src/project.js';
const image='data:image/png;base64,'+readFileSync(new URL('./fixtures/square-4x7.png',import.meta.url)).toString('base64');
const valid=()=>({format:'LieneCut',version:1,settings:{knifePressure:42,showCut:true},importedCut:null,artwork:[{name:'art',sw:1200,sh:2100,s:1,rot:23.5,x:0,y:0,stretchX:1.5,stretchY:1,marginMm:2,cutHoles:true,linked:false,image}]});
test('project schema preserves embedded artwork and independent transforms',()=>{const p=valid();assert.deepEqual(validateProject(JSON.stringify(p)),p);});
test('project rejects unsupported versions, invalid dimensions, pressure and transforms',()=>{
 for(const change of [p=>p.version=2,p=>p.settings.knifePressure=101,p=>p.artwork[0].s=0,p=>p.artwork[0].x=null,p=>p.artwork[0].sw=20000,p=>p.artwork[0].sw=100,p=>p.artwork[0].marginMm=-1,p=>p.artwork[0].image='https://example.com/art.png',p=>p.importedCut={name:'bad',plt:'IN;PU0,0;'}]){
  const p=valid();change(p);assert.throws(()=>validateProject(JSON.stringify(p)));
 }
});
