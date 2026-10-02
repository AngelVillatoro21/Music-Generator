// Execute the actual frontend with a minimal DOM adapter. This verifies state transitions,
// not rendering, native form validation or real browser playback.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function studio(provider){
 const all=[],ids=new Map(),events={};
 class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.innerHTML='';this.listeners={};this.classes=new Set();this.classList={toggle:(name,on)=>{if(on===undefined)on=!this.classes.has(name);on?this.classes.add(name):this.classes.delete(name);},contains:n=>this.classes.has(n)};all.push(this);}
  set className(v){this.classes=new Set(v.split(' '));}get className(){return [...this.classes].join(' ');}
  addEventListener(n,f){this.listeners[n]=f;}setAttribute(n,v){this[n]=v;}
  append(...nodes){this.children.push(...nodes);nodes.forEach(n=>n.parent=this);}
  prepend(node){this.children.unshift(node);node.parent=this;}
  replaceChildren(...nodes){this.children.forEach(n=>n.removed=true);this.children=[];this.append(...nodes);}
  replaceWith(node){if(this.parent){const a=this.parent.children;const i=a.indexOf(this);a[i]=node;node.parent=this.parent;}this.removed=true;}
  showModal(){this.open=true;}close(){this.open=false;this.listeners.close?.();}pause(){this.paused=true;}
 }
 for(const id of html.matchAll(/id="([^"]+)"/g)){ids.set(id[1],new Element());}
 for(const [id,value]of Object.entries({model:'V6',duration:'120',creativity:'50',adherence:'65',style:'Indie pop'}))ids.get(id).value=value;
 const modes=['simple','custom'].map(mode=>{const e=new Element('button');e.dataset.mode=mode;return e;});
 const presets=['lofi','dance','cinematic'].map(preset=>{const e=new Element('button');e.dataset.preset=preset;return e;});
 const collection=new Element();const requests=[];
 const document={getElementById:id=>{assert.ok(ids.has(id),`Missing HTML id ${id}`);return ids.get(id);},createElement:tag=>new Element(tag),querySelector:s=>s==='.collection'?collection:document.querySelectorAll(s)[0]||null,querySelectorAll:s=>s==='[data-mode]'?modes:s==='[data-preset]'?presets:all.filter(e=>!e.removed&&(s==='.track'?e.classes.has('track'):s==='audio'?e.tag==='audio':false))};
 const context=vm.createContext({document,window:{addEventListener:(name,fn)=>events[name]=fn},URL,AbortSignal,console,setTimeout:()=>1,clearTimeout:()=>{},fetch:async(url,options)=>{const req=JSON.parse(options.body);requests.push({...req,key:options.headers['X-Suno-Key']});return provider(req);}});
 vm.runInContext(source,context);
 return {ids,requests,context,events,run:s=>vm.runInContext(s,context),submit:async id=>{await ids.get(id).onsubmit({preventDefault(){}});await flush();},connect:async(key='mock-key-only')=>{ids.get('api-key').value=key;await ids.get('key-form').onsubmit({preventDefault(){}});await flush();}};
}
const good=req=>({ok:true,json:async()=>({data:req.action==='credits'?42:req.action==='generate'?{taskId:'task-1'}:{status:'SUCCESS',response:{sunoData:[{id:'track-1',audio_url:'https://cdn.example/song.mp3',title:'Song'}]}}})});
test('quick generation connects without storage and renders safe playable audio',async()=>{const s=studio(good);await s.connect();assert.equal(s.ids.get('api-key').value,'');s.ids.get('prompt').value='A sunset song';await s.submit('music-form');assert.equal(s.run('tracks.size'),1);assert.match(s.ids.get('status').textContent,/Ready/);assert.equal(s.requests.find(r=>r.action==='generate').key,'mock-key-only');assert.equal(s.run("safeUrl('javascript:alert(1)')"),'');});
test('custom mode and instrumentals update lyrics requirements',()=>{const s=studio(good);s.run("setMode('custom')");assert.equal(s.ids.get('lyrics').required,true);assert.equal(s.ids.get('prompt').required,false);s.ids.get('instrumental').checked=true;s.run('instrumental()');assert.equal(s.ids.get('lyrics').required,false);assert.equal(s.ids.get('lyrics-section').hidden,true);assert.equal(s.ids.get('voice').disabled,true);});
test('disconnect forgets credentials and clears session tracks',async()=>{const s=studio(good);await s.connect();s.ids.get('prompt').value='A sunset song';await s.submit('music-form');assert.equal(s.run('tracks.size'),1);s.ids.get('disconnect').onclick();assert.equal(s.run('apiKey'),'');assert.equal(s.run('tracks.size'),0);assert.equal(s.run('job'),null);assert.equal(s.ids.get('track-count').textContent,'0 tracks');});
test('failed key replacement preserves existing key and task recovery',async()=>{let fail=false;const s=studio(req=>fail?{ok:false,json:async()=>({error:'Invalid key'})}:good(req));await s.connect();s.run("job={id:'original-task',active:false}");fail=true;await s.connect('bad-key-value');assert.equal(s.run('apiKey'),'mock-key-only');assert.equal(s.run('job.id'),'original-task');assert.equal(s.ids.get('key-error').textContent,'Invalid key');});
test('key replacement cannot interrupt an active submission',async()=>{const s=studio(good);await s.connect();s.run('submitting=true');await s.connect('different-key');assert.equal(s.run('apiKey'),'mock-key-only');assert.equal(s.requests.length,1);assert.match(s.ids.get('key-error').textContent,/Wait/);});
test('a late connection response cannot restore a disconnected key',async()=>{let resolve;const s=studio(()=>new Promise(r=>resolve=r));s.ids.get('api-key').value='mock-key-only';const pending=s.submit('key-form');s.ids.get('disconnect').onclick();resolve({ok:true,json:async()=>({data:42})});await pending;assert.equal(s.run('apiKey'),'');});
test('successful status without audio shows an error and allows rechecking',async()=>{const s=studio(req=>req.action==='music-status'?{ok:true,json:async()=>({data:{status:'SUCCESS',response:{sunoData:[]}}})}:good(req));await s.connect();s.ids.get('prompt').value='A sunset song';await s.submit('music-form');assert.match(s.ids.get('status').textContent,/no playable audio/);assert.equal(s.ids.get('resume').hidden,false);assert.equal(s.ids.get('generate').disabled,false);});
test('unreadable server response gives a useful error',async()=>{const s=studio(()=>({ok:false,json:async()=>{throw new Error('Invalid JSON');}}));await s.connect();assert.match(s.ids.get('key-error').textContent,/unreadable response/);assert.equal(s.run('apiKey'),'');});
test('lyrics variations populate editable custom lyrics',async()=>{const s=studio(req=>({ok:true,json:async()=>({data:req.action==='credits'?42:req.action==='lyrics'?{taskId:'lyric-task'}:{status:'SUCCESS',response:{data:[{text:'[Verse]\nFinding home',title:'New City',status:'complete'}]}}})}));await s.connect();s.ids.get('lyrics-idea').value='Finding home';await s.ids.get('write-lyrics').onclick();await flush();const choice=s.ids.get('lyric-options').children[0];assert.ok(choice);choice.onclick();assert.equal(s.ids.get('lyrics').value,'[Verse]\nFinding home');assert.equal(s.run('mode'),'custom');assert.equal(s.ids.get('title').value,'New City');});
test('return from browser cache clears keys and prior results',async()=>{const s=studio(good);await s.connect();s.events.pagehide();assert.equal(s.run('apiKey'),'');s.events.pageshow({persisted:true});assert.equal(s.ids.get('credits').textContent,'Bring your own key');assert.equal(s.run('tracks.size'),0);});
test('duplicate clicks do not submit another paid generation',async()=>{let resolve;let count=0;const s=studio(req=>{if(req.action==='generate'){count++;return new Promise(r=>resolve=r);}return good(req);});await s.connect();s.ids.get('prompt').value='One song';const first=s.submit('music-form');await flush();await s.submit('music-form');assert.equal(count,1);resolve({ok:true,json:async()=>({data:{taskId:'single-task'}})});await first;});
test('pausing ignores late status responses and never cancels upstream generation',async()=>{let resolve;const s=studio(req=>req.action==='music-status'?new Promise(r=>resolve=r):good(req));await s.connect();s.ids.get('prompt').value='One song';await s.submit('music-form');s.ids.get('stop').onclick();resolve({ok:true,json:async()=>({data:{status:'SUCCESS',response:{sunoData:[{id:'late',audio_url:'https://cdn.example/late.mp3'}]}}})});await flush();assert.equal(s.run('tracks.size'),0);assert.equal(s.run('job.active'),false);assert.equal(s.ids.get('resume').hidden,false);assert.ok(s.requests.every(r=>['credits','generate','music-status'].includes(r.action)));});
