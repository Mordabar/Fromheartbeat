import {sessionMarkup,STATE,STAGE_INFO} from './session-ui.js';
import {configure as configureUploads,mount as mountUploader,busy as uploadsBusy,subscribe as onUploadStats} from './uploader.js';
import {SESSION_VIEWS} from './st-cockpit.js';
import {Studio, MOODS} from './studio.js';
import {StudioGesture, firstMissingBrief} from './spatial-controls.js';
import {iconFor, iconSvg, LANGUAGE_BADGE} from './icons.js';
import {GENRE_INFO, MOOD_INFO, OCCASIONS, buildContent} from './content.js';
const $=(s)=>document.querySelector(s), esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n/100);
const root=$('#content'), audio=$('#sample-audio');
let boot,view='lobby',lastView='lobby',currentOrder=null,playing=-1,studio,genreTab=null,flowView=null,myOrders=[];
let productPreview=1, modalReturnFocus=null, plainMode=false, sessionFocus='session', sessionPanel=null, customTrack=null;   // sessionFocus: corner of the 3D session room the camera is on · sessionPanel: the small panel (talk | files | full) opened from it
   // plainMode: the visitor chose the plain-text panels; it follows them from step to step
const trail=[]; // screens visited, so "back" returns where the customer came from (e.g. About → the step they were on)
let draft={product:'personalizada',genre:'',mood:'',voice:'',language:'Español',tempo:'A tu criterio',recipient:'',occasion:'',story:'',details:'',name:'',email:'',phone:'',key:crypto.randomUUID()};
try{const saved=JSON.parse(sessionStorage.getItem('fhb-draft'));if(saved)draft={...draft,...saved};}catch{}
draft.audience='person';
const save=()=>{try{sessionStorage.setItem('fhb-draft',JSON.stringify(draft));}catch{}};
let tracks=[{name:'Quédate',genre:'Pop · Amor',file:'quedate',dedication:'Hay personas que se vuelven hogar.'},{name:'Ey, mor',genre:'Afrobeat · Conexión',file:'ey-mor',dedication:'Ese encuentro que lo cambia todo.'},{name:'Ando tumbao',genre:'Trap · Actitud',file:'ando-tumbao',dedication:'Una historia con su propio ritmo.'},{name:'A country story',genre:'Country · En inglés',file:'country',dedication:'Los recuerdos también cruzan fronteras.'},{name:'Perreo en la disco',genre:'Reggaetón · Energía',file:'perreo',dedication:'Para los que celebran a todo volumen.'},{name:'¡Feliz cumpleaños, Danilo!',genre:'Celebración · Dedicatoria',file:'danilo',dedication:'Un cumpleaños que merece su canción.'}];
const stages=['Historia recibida','Letra','Grabación','Producción','Mezcla y master','Entrega'];
const statusNames={created:'Sesión guardada',payment_pending:'Confirmando el pago',paid:'Pago confirmado',in_production:'En producción',review:'En revisión',completed:'Tu canción está lista',cancelled:'Sesión cancelada'};
const ICONS={headphones:'<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z"/>',users:'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',back:'<path d="M19 12H5M12 19l-7-7 7-7"/>',close:'<path d="M18 6 6 18M6 6l12 12"/>',arrow:'<path d="M5 12h14M12 5l7 7-7 7"/>',play:'<path d="M7 4v16l13-8z" fill="currentColor"/>',pause:'<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',card:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',check:'<path d="M20 6 9 17l-5-5"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" fill="currentColor"/>',refresh:'<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/>',mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',flask:'<path d="M9 3h6M10 3v6L4 20a1 1 0 0 0 .9 1.5h14.2A1 1 0 0 0 20 20L14 9V3"/><path d="M7 15h10"/>'};
const ic=(n,cls='')=>`<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const occasions=OCCASIONS;
// The creation flow: one decision per step, each one lives in a zone of the 3D studio.
const FLOW=['genre','mood','voice','story','products','checkout'];
const STEPS={
 genre:{title:'¿Qué género te mueve?',hint:'Elige el estilo base de tu canción. Lo afinamos en producción.',zone:'La consola',need:'Elige un género para continuar.'},
 mood:{title:'¿Cómo quieres que se sienta?',hint:'La emoción cambia la luz del estudio. Pruébalas.',zone:'La luz del estudio',need:'Elige una emoción para continuar.'},
 voice:{title:'¿Quién la canta?',hint:'Voz, idioma y ritmo de la canción.',zone:'La cabina de voz',need:'Elige la voz para continuar.'},
 story:{title:'Cuéntanos la historia',hint:'No busques palabras perfectas: los detalles pequeños hacen la canción.',zone:'El lounge',need:'Completa para quién es, la ocasión y al menos 30 caracteres de historia.'},
 products:{title:'Elige tu experiencia',hint:'La misma historia, tres formas de entregarla.',zone:'Las experiencias',need:'Elige una experiencia.'},
 checkout:{title:'Tus datos y pago',hint:'Son dos minutos: revisa, dinos dónde enviártela y paga.',zone:'Tu sesión',need:'Completa tus datos y acepta los términos.'}
};
const ZONES={lobby:'Tu estudio',samples:'La pared de vinilos',info:'Información',about:'Nosotros',session:'Tu sesión',recover:'Tu sesión',terms:'Información',privacy:'Información'};
const catalogPerson=()=>boot.catalog.filter(p=>p.audience==='person');
const selectedProduct=()=>catalogPerson().find(p=>p.code===draft.product)||catalogPerson().find(p=>p.code==='personalizada');

async function api(action,data,query=''){let res;try{res=await fetch(`api.php?action=${action}${query}`,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json','X-CSRF-Token':boot?.csrf??''}:{},body:data?JSON.stringify(data):undefined})}catch{throw new Error('No pudimos conectar con el estudio. Revisa tu conexión e inténtalo de nuevo.');}let json;try{json=await res.json();}catch{throw Error('No pudimos conectar con el estudio. Inténtalo de nuevo.');}if(!res.ok)throw Error(json.error||'No se pudo completar la solicitud.');return json;}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),5000);}
const wave=()=>`<span class="mini-wave" aria-hidden="true">${Array.from({length:16},(_,i)=>`<i style="height:${4+Math.abs(Math.sin(i*1.78))*16}px"></i>`).join('')}</span>`;
const hex=n=>'#'+n.toString(16).padStart(6,'0');
function valid(step){
 if(step==='genre')return !!draft.genre;
 if(step==='mood')return !!draft.mood;
 if(step==='voice')return !!(draft.voice&&draft.language&&draft.tempo);
 if(step==='story')return draft.recipient.trim().length>=2&&draft.occasion.trim().length>=2&&draft.story.trim().length>=30;
 if(step==='products')return !!selectedProduct();
 if(step==='checkout')return draft.name.trim().length>=2&&/^\S+@\S+\.\S+$/.test(draft.email)&&draft.phone.trim().length>=7&&!!document.querySelector('[name=consent]')?.checked;
 return true;
}

// One option component for every choice in the plain-text panels. Icons are the same vector set the 3D studio uses.
const optGlyph=(name,value)=>name==='language'?`<span class="opt-badge">${esc(LANGUAGE_BADGE[value]||String(value).slice(0,2))}</span>`:iconSvg(iconFor(name,value),'opt-svg');
const opt=(name,value,{sub='',dot='',label=value}={})=>{const on=draft[name]===value;return `<button type="button" class="opt ${on?'on':''}" data-pick="${name}" data-value="${esc(value)}" aria-pressed="${on}"><span class="opt-ic" aria-hidden="true" ${dot?`style="--c:${dot}"`:''}>${optGlyph(name,value)}</span><span class="opt-text"><span class="opt-label">${esc(label)}</span>${sub?`<small>${esc(sub)}</small>`:''}</span><b class="tick" aria-hidden="true">${ic('check')}</b></button>`;};
const group=(label,name,values,extra=()=>({}))=>`<fieldset class="opt-group"><legend>${label}</legend><div class="opts">${values.map(v=>opt(name,v,extra(v))).join('')}</div></fieldset>`;

function shell({head,body,foot='',cls=''}){return `<section class="panel ${cls}" aria-labelledby="panel-title"><button class="sheet-toggle" aria-label="Minimizar panel para explorar el estudio" aria-expanded="true"><span></span></button><header class="panel-head">${head}</header><div class="panel-body" id="panel-body">${body}</div>${foot?`<footer class="panel-foot">${foot}</footer>`:''}</section>`;}
const simpleHead=(title,hint='',back='back')=>`<div class="head-row"><button class="icon-btn" data-go="${back}" aria-label="Volver">${ic('back')}</button><span class="step-count">${esc(ZONES[view]||'')}</span><span class="icon-spacer"></span></div><h1 id="panel-title">${title}</h1>${hint?`<p class="hint">${hint}</p>`:''}`;

function wizardHead(step){const i=FLOW.indexOf(step),m=STEPS[step];return `<div class="head-row"><button class="icon-btn" data-go="${i?FLOW[i-1]:'lobby'}" aria-label="${i?'Paso anterior':'Volver al inicio'}">${ic('back')}</button><span class="step-count">Paso ${i+1} de ${FLOW.length} · ${m.zone}</span><button class="icon-btn" data-go="lobby" aria-label="Salir al inicio (tu avance se guarda)">${ic('close')}</button></div><div class="progress" aria-hidden="true">${FLOW.map((s,j)=>`<i class="${j<i?'done':j===i?'now':''}"></i>`).join('')}</div><h1 id="panel-title">${m.title}</h1><p class="hint">${m.hint}</p>`;}
function summaryText(){if(view==='checkout')return boot.commerceReady?'El pago seguro se abre aquí mismo · tu historia queda guardada':'Tu historia queda guardada y te avisamos para pagar';return [draft.genre,draft.mood,draft.voice&&`Voz ${draft.voice.toLowerCase()}`].filter(Boolean).map(esc).join(' · ')||'Tu canción empieza aquí';}
function nextLabel(step){if(returnTo&&step!=='checkout')return 'Listo, volver al pago';if(step==='products')return firstMissingBrief(draft)?'Crear con este paquete':'Revisar mi canción';if(step==='checkout'){const p=selectedProduct();return boot.commerceReady?`Ir a pagar ${money(p.price)}`:'Guardar mi sesión';}return 'Siguiente';}
function wizardFoot(step){const ok=valid(step),i=FLOW.indexOf(step);return `<p class="summary" id="summary">${summaryText()}</p><button class="primary next ${ok?'':'locked'}" id="next" ${step==='checkout'?'type="submit" form="checkout-form"':`type="button" data-next="${nextTarget(step)}"`} aria-disabled="${!ok}">${nextLabel(step)} <span>→</span></button>`;}
// Say exactly what is missing, in words, and put the cursor there.
function clearFieldErrors(){document.querySelectorAll('.field.invalid,.check.invalid').forEach(x=>{x.classList.remove('invalid');x.querySelector('.field-err')?.remove();x.querySelector('[aria-describedby^=err-]')?.removeAttribute('aria-describedby');});}
function checkoutProblem(form){
 const missing=firstMissingBrief(draft),f=form.elements;let msg,el;
 if(missing){msg=STEPS[missing].need;}
 else if((draft.name||'').trim().length<2){msg='Escribe tu nombre completo.';el=f.name;}
 else if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((draft.email||'').trim())){msg='Revisa tu correo: parece incompleto (por ejemplo ana@ejemplo.com).';el=f.email;}
 else if(((draft.phone||'').replace(/\D/g,'')).length<7){msg='Escribe tu celular con todos los números.';el=f.phone;}
 else{msg='Marca la casilla para aceptar los términos y poder continuar.';el=f.consent;}
 $('#checkout-error').textContent=msg;clearFieldErrors();
 if(el){const box=el.closest('.field,.check');box?.classList.add('invalid');const e=document.createElement('p');e.className='field-err';e.id='err-'+el.name;e.setAttribute('role','alert');e.textContent=msg;box?.append(e);el.setAttribute('aria-describedby',e.id);el.focus({preventScroll:true});box?.scrollIntoView?.({block:'center'});}
 else $('#checkout-error')?.scrollIntoView?.({block:'center'});
 announce(msg);
}
function refreshFoot(){if(!FLOW.includes(view))return;const ok=valid(view);document.querySelectorAll('#next,#j-next').forEach(n=>{n.classList.toggle('locked',!ok);n.setAttribute('aria-disabled',String(!ok));});const s=$('#summary');if(s)s.innerHTML=summaryText();}

const stars=n=>`<span class="stars" aria-label="${n} de 5 estrellas">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span>`;
const reviewsBlock=(list)=>`<div class="reviews">${list.map(r=>`<figure class="card review">${stars(r.rating)}<blockquote>${esc(r.text)}</blockquote><figcaption><strong>${esc(r.name)}</strong><span>${esc(r.context)}</span>${r.sample?'<em class="badge-sample">Ejemplo</em>':''}</figcaption></figure>`).join('')}</div>`;
const faqBlock=()=>`<div class="faq">${boot.content.faq.map(f=>`<details class="card"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>`;
// Where "Crear mi canción" should land: the step the customer left, or the first unfinished one.
function resumeStep(){if(flowView)return flowView;if(!draft.genre)return 'genre';return FLOW.find(s=>s!=='checkout'&&!valid(s))||'products';}
function createCta(label='Crear mi canción'){const started=!!(flowView||draft.genre);const step=resumeStep();return `<button class="primary" data-go="resume">${started?`Continuar · paso ${FLOW.indexOf(step)+1}`:label} ${ic('arrow')}</button>`;}
function lobby(){const from=money(Math.min(...catalogPerson().map(p=>p.price)));return shell({cls:'lobby-panel',head:`<p class="eyebrow"><span class="live-dot"></span> ESTUDIO DE CANCIONES PERSONALIZADAS</p><h1 id="panel-title">Tu historia.<br><em>Su próxima canción.</em></h1>`,body:`<p class="lede">Entra, encuentra tu sonido y convierte lo que sientes en una canción para alguien especial.</p><p class="microcopy">Desde <b>${from} COP</b> · Sin crear cuenta</p>`,foot:`<div class="foot-row">${createCta('Entrar al estudio')}<button class="secondary" data-go="samples">${ic('play')} Escuchar</button></div><p class="lobby-note">Hecho para una persona. Escuchado para siempre.</p>`});}
const PILLAR_ICONS=['pen','mic','shield'];
function aboutView(){const c=boot.content;return shell({cls:'tall',head:simpleHead(esc(c.about.title),'Un estudio para convertir historias en canciones.'),body:`${c.about.paragraphs.map(p=>`<p class="lede">${esc(p)}</p>`).join('')}<div class="pillars">${c.about.pillars.map((p,i)=>`<div class="card pillar"><b>${ic(PILLAR_ICONS[i]||'sparkle')}</b><div><strong>${esc(p.title)}</strong><p>${esc(p.text)}</p></div></div>`).join('')}</div>${c.reviews.some(r=>!r.sample)?`<h2 class="section-label">${ic('star')} Reseñas</h2>${reviewsBlock(c.reviews.filter(r=>!r.sample))}`:''}<h2 class="section-label">${ic('sparkle')} Preguntas frecuentes</h2>${faqBlock()}`,foot:`<div class="foot-row">${createCta()}<button class="secondary" data-go="samples">${ic('headphones')} Escuchar</button></div>`});}

function samplesView(){return shell({cls:'music-library',head:simpleHead('Hechas de historias.','FROMHEARTBEAT ORIGINALS · Tu próxima inspiración'),body:`<div class="library-feature"><img src="${esc(tracks[0]?.cover||'assets/images/covers/'+(tracks[0]?.file||'quedate')+'.webp')}" alt="Portada de la colección"><div><p class="eyebrow">LA COLECCIÓN DEL ESTUDIO</p><h2>Canciones que<br>se quedan contigo.</h2><p>${tracks.length} canciones · Creadas en Fromheartbeat</p>${tracks.length?'<button class="primary" data-track="0">▶ Escuchar colección</button>':''}</div></div><label class="library-search">Buscar en la colección<input type="search" id="track-search" placeholder="Canción o género" autocomplete="off"></label><div class="tracks">${tracks.map((t,i)=>{const on=playing===i&&!audio.paused;return `<button class="track ${on?'playing':''}" data-track="${i}" aria-label="Escuchar ${esc(t.name)}"><span class="track-number">${String(i+1).padStart(2,'0')}</span><span class="track-art"><img src="${esc(t.cover||'assets/images/covers/'+t.file+'.webp')}" alt="" width="48" height="48"><span class="play" aria-hidden="true">${ic(on?'pause':'play')}</span></span><span class="track-meta"><strong>${esc(t.name)}</strong><small>${esc(t.genre)}</small></span><span class="track-dedication">${esc(t.dedication)}</span>${wave()}</button>`;}).join('')}</div><p id="track-empty" hidden>No encontramos canciones con ese nombre o género.</p>`,foot:createCta('Crear mi propia canción')});}

function genreStep(){const cats=Object.keys(boot.options.genre);const current=genreTab||cats.find(c=>boot.options.genre[c].includes(draft.genre))||cats[0];return `<div class="tabs" role="tablist">${cats.map((c,i)=>`<button type="button" role="tab" id="genre-tab-${i}" aria-controls="genre-options" tabindex="${c===current?0:-1}" class="tab ${c===current?'on':''}" data-tab="${esc(c)}" aria-selected="${c===current}"><span aria-hidden="true">${iconSvg(iconFor('bank',c),'tab-svg')}</span>${esc(c)}</button>`).join('')}</div><div class="opts grid" id="genre-options" role="tabpanel" aria-labelledby="genre-tab-${cats.indexOf(current)}">${boot.options.genre[current].map(g=>opt('genre',g)).join('')}</div>${pickInfo('genre')}`;}
function pickInfo(name){const v=draft[name],text=name==='genre'?GENRE_INFO[v]:MOOD_INFO[v];return `<div class="pick-info card" id="pick-info" ${v?'':'hidden'}><strong>${esc(v)}</strong><p>${esc(text||'')}</p></div>`;}
function moodStep(){return `<div class="opts grid">${boot.options.mood.map(m=>opt('mood',m,{dot:hex(MOODS[m]??0x9b5cff),sub:MOOD_INFO[m]})).join('')}</div>`;}
function voiceStep(){return group(`${ic('mic')} Voz`,'voice',boot.options.voice,v=>({sub:{Femenina:'Una cantante',Masculina:'Un cantante',Dúo:'Ella y él',Coro:'Varias voces','A tu criterio':'Lo decidimos'}[v]}))+`<details class="advanced-options"><summary>Idioma y ritmo <span>${esc(draft.language)} · ${esc(draft.tempo)}</span></summary>`+group(`${ic('users')} Idioma`,'language',boot.options.language)+group(`${ic('clock')} Tempo`,'tempo',boot.options.tempo,v=>({sub:{Lento:'Balada, calma',Medio:'Para cantar',Rápido:'Para bailar','A tu criterio':'Según el género'}[v]}))+`</details>`;}
function field(name,label,{type='text',min=0,max=200,placeholder='',area=false,required=true,hint=''}={}){return `<label class="field"><span>${label}</span>${hint?`<small class="field-hint">${hint}</small>`:''}${area?`<textarea name="${name}" minlength="${min}" maxlength="${max}" ${required?'required':''} placeholder="${esc(placeholder)}">${esc(draft[name])}</textarea>`:`<input name="${name}" type="${type}" value="${esc(draft[name])}" minlength="${min}" maxlength="${max}" ${required?'required':''} placeholder="${esc(placeholder)}" autocomplete="${{name:'name',email:'email',phone:'tel'}[name]||'off'}">`}</label>`;}
function storyStep(){return `<form id="story-form" novalidate>${field('recipient','¿Para quién es?',{min:2,max:120,placeholder:'Su nombre, como tú le dices'})}<fieldset class="opt-group"><legend>${ic('gift')} ¿Qué celebran?</legend><div class="opts chips">${occasions.map(o=>opt('occasion',o)).join('')}</div></fieldset>${field('occasion','Ocasión',{min:2,max:100,placeholder:'O escribe la tuya'})}${field('story','Su historia',{area:true,min:30,max:6000,placeholder:'Cómo se conocieron. Ese viaje. Una frase que solo ustedes entienden…'})}<p class="form-note"><span id="story-count">${draft.story.length}</span> / 6.000 · mínimo 30 caracteres</p>${field('details','Detalles que no pueden faltar (opcional)',{area:true,max:2000,required:false,placeholder:'Nombres, apodos, pronunciación, algo que prefieras evitar.'})}</form>`;}
function productsStep(){return `<div class="opts products">${catalogPerson().map((p,i)=>{const on=draft.product===p.code;return `<div class="product-card"><div class="package-art ${p.code}"><span>${iconSvg(iconFor('product',p.code),'pkg-svg')}</span><b>${['01 / ESENCIAL','02 / SIGNATURE','03 / CINEMA'][i]}</b></div><button type="button" class="opt product-opt ${on?'on':''}" data-pick="product" data-value="${p.code}" data-index="${i}" aria-pressed="${on}"><span class="product-top"><span class="tag">${esc(p.tag)}</span><b class="tick" aria-hidden="true">${ic('check')}</b></span><span class="opt-label">${esc(p.name)}</span><span class="price">${money(p.price)} <small>COP</small></span><span class="points">${(PRODUCT_POINTS[p.code]||[]).map(([i,t])=>`<i>${ic(i)}${t}</i>`).join('')}</span></button><details class="product-details" open><summary>Qué incluye</summary><ul>${p.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></details></div>`;}).join('')}</div><p class="form-note">Todas se graban con artistas. Las más completas añaden edición vocal, mezcla y master.</p>`;}
const PRODUCT_POINTS={dedicatoria:[['mic','Grabada por artistas'],['clock','Entrega más rápida']],personalizada:[['mic','Cantante real'],['refresh','1 ronda de ajustes']],full:[['music','Canción + video'],['gift','Presentación especial']]};
const testCard=()=>boot.testMode&&boot.commerceReady?`<details class="test-card"><summary>${ic('flask')} Estás en modo de pruebas · no se cobra nada</summary><p>Tarjeta aprobada: <code>4242 4242 4242 4242</code> · Rechazada: <code>4111 1111 1111 1111</code>. Cualquier fecha futura y CVC de 3 dígitos.</p></details>`:'';
function checkoutStep(){const p=selectedProduct(),recap3d=!(studio?.light||plainMode)&&!!studio?.renderer;
 const row=(icon,label,value,step)=>`<div class="recap-row"><span>${ic(icon)}${label}</span><strong>${value}</strong><button type="button" data-go="${step}" aria-label="Cambiar ${label.toLowerCase()}">${ic('pen')}<b>Cambiar</b></button></div>`;
 const sec=(n,title,sub,body)=>`<section class="c-sec"><h2 class="c-h"><span class="c-n" aria-hidden="true">${n}</span><span><b>${title}</b><small>${sub}</small></span></h2>${body}</section>`;
 const pay=boot.commerceReady?`<ul class="c-trust"><li>${ic('lock')}<span>Pagas en la página segura de <b>Wompi</b>. Fromheartbeat nunca ve ni guarda tu tarjeta.</span></li><li>${ic('arrow')}<span>El pago se abre en una <b>ventana segura sobre esta misma página</b>: no sales de Fromheartbeat. Al terminar, tu sesión empieza sola.</span></li><li>${ic('check')}<span>Tu historia queda guardada <b>antes</b> de pagar: no se pierde si algo falla.</span></li></ul>`:`<p class="c-soon">${ic('clock')}<span>Los pagos en línea se están configurando. Guardaremos tu sesión y te avisaremos por correo para completar el pago.</span></p>`;
 return `<form id="checkout-form" novalidate class="c-form">
  ${recap3d?`<p class="c-hint">${ic('pen')}<span>Tu canción está en el ticket del estudio: <b>toca cualquier línea</b> para cambiarla.</span></p>`:sec(1,'Tu canción','Revisa que todo esté bien. Puedes cambiar lo que quieras.',`<div class="recap">${row('sliders','Sonido',esc([draft.genre,draft.mood].join(' · ')),'genre')}${row('mic','Voz',esc([draft.voice,draft.language,draft.tempo].join(' · ')),'voice')}${row('heart','Para',esc(`${draft.recipient} · ${draft.occasion}`),'story')}${row('gift','Experiencia',`${esc(p.name)}`,'products')}</div>`)}
  ${sec(recap3d?1:2,'¿A dónde te la enviamos?','Con estos datos recibes tu enlace privado. No creas cuenta ni contraseña.',`${field('name','Tu nombre completo',{min:2,max:120,placeholder:'Ana Pérez'})}${field('email','Tu correo',{type:'email',max:254,placeholder:'ana@ejemplo.com',hint:'Aquí te llega el enlace a tu sesión.'})}${field('phone','Tu celular',{type:'tel',min:7,max:40,placeholder:'300 123 4567',hint:'Solo lo usamos si hay algo urgente de tu canción.'})}<label class="check"><input type="checkbox" name="consent" required ${draft.consent?'checked':''}><span>Acepto los <button type="button" data-go="terms">términos</button> y la <button type="button" data-go="privacy">política de privacidad</button>, y puedo compartir esta historia.</span></label>`)}
  ${sec(recap3d?2:3,'Pago seguro',boot.commerceReady?'Un último paso y el estudio empieza.':'Casi listo.',`<div class="total-row"><span>Total a pagar</span><strong>${money(p.price)} COP</strong></div>${pay}<p class="form-error" id="checkout-error" role="alert"></p>`)}
  ${testCard()}
 </form>`;}
function wizardView(step){const body={genre:genreStep,mood:moodStep,voice:voiceStep,story:storyStep,products:productsStep,checkout:checkoutStep}[step]();return shell({cls:`wizard step-${step}`,head:wizardHead(step),body,foot:wizardFoot(step)});}

function recoverView(){
 const has=myOrders.length>0,mail=`<form id="recover-form"><label class="field"><span>El correo con el que hiciste tu pedido</span><input type="email" name="email" required autocomplete="email" placeholder="tucorreo@ejemplo.com"></label><p class="form-error" id="recover-result" role="status"></p><button class="secondary" type="submit">${ic('mail')} Enviarme mi enlace</button></form>`;
 const list=has?`<h2 class="s-h"><span>En este dispositivo</span><b>${myOrders.length} ${myOrders.length>1?'sesiones':'sesión'}</b></h2><div class="my-orders">${myOrders.map(o=>{const st=STATE[o.status]||STATE.created,stg=['created','payment_pending','cancelled'].includes(o.status)?'':o.status==='completed'?'Entregada':'Etapa '+(Number(o.production_stage)+1)+' de 6 · '+STAGE_INFO[Number(o.production_stage)||0][0];return `<button class="my-order tone-${st.tone}" data-order="${esc(o.reference)}"><span class="mo-badge" aria-hidden="true">${ic(st.icon)}</span><span class="mo-text"><b class="mo-state">${esc(st.label)}</b><strong>${esc(o.product_name)} · ${money(o.amount_in_cents)}</strong><small>${esc(stg||'Aún no empieza')} · ${esc(o.reference)}</small></span>${ic('arrow')}</button>`;}).join('')}</div><details class="s-card s-lost"><summary>${ic('mail')} ¿No ves tu sesión? Recíbela por correo</summary>${mail}</details>`:`<p class="s-says">No encontramos sesiones en este dispositivo. Escribe el correo de tu pedido y te enviamos tu enlace privado.</p>${mail}`;
 return shell({cls:'session',head:`<div class="head-row"><button class="icon-btn" data-go="lobby" aria-label="Volver al inicio">${ic('back')}</button><span class="step-count">Mi sesión</span><span class="icon-spacer"></span></div>`,body:`<div class="s-wrap">${list}</div>`});}

function sessionView(){const o=currentOrder;if(!o)return shell({head:simpleHead('Abriendo tu sesión…'),body:''});
 // The session lives in the 3D room. This panel only opens for one job at a time (write, send files) or as the plain-text version.
 if(!sessionPanel)return '';
 const part=sessionPanel==='talk'?'talk':sessionPanel==='files'?'files':'all',title={talk:'Tu productor',files:'Tu material',all:''}[sessionPanel];
 const back=part==='all'?`<button class="icon-btn" data-go="lobby" aria-label="Volver al inicio">${ic('back')}</button>`:`<button class="icon-btn" data-session-back aria-label="Volver a la sala">${ic('back')}</button>`;
 return shell({cls:'tall session',head:`<div class="head-row">${back}<span class="step-count">Tu sesión</span><span class="icon-spacer"></span></div>${title?`<h1 id="panel-title">${title}</h1>`:''}`,body:sessionMarkup(o,{esc,money,ic,boot,testCard,part})});}

function legalView(privacy){return shell({cls:'tall',head:simpleHead(privacy?'Tu historia es <em>privada.</em>':'Antes de crear <em>tu canción.</em>','Versión 11 de septiembre de 2026.',lastView),body:`<article class="legal">${privacy?`<h2>Datos que tratamos y finalidad</h2><p>Recibimos tu nombre, correo, teléfono, brief musical y archivos que decidas compartir. Los utilizamos para gestionar tu pedido, crear la canción, atender solicitudes y entregar el resultado. Los datos de pago se procesan en Wompi; Fromheartbeat no recibe el número completo de tu tarjeta ni su código de seguridad.</p><h2>Tu historia y tus archivos</h2><p>Comparte sólo información que tengas derecho a usar. Evita datos sensibles innecesarios o información de menores sin autorización de su representante. El acceso al brief y los entregables se limita al equipo que produce la sesión y a los proveedores necesarios para prestarte el servicio.</p><h2>Acceso, conservación y derechos</h2><p>Puedes solicitar conocer, actualizar, rectificar o suprimir tus datos y revocar la autorización cuando corresponda, sin afectar obligaciones de conservación aplicables. Las solicitudes se reciben en el canal de contacto indicado al final. Los datos se conservan mientras sea necesario para el servicio y las obligaciones contables y contractuales; las copias de respaldo siguen su ciclo de eliminación.</p><h2>Cookies y enlaces privados</h2><p>Usamos una cookie de sesión para proteger tu acceso y almacenamiento del navegador para conservar el borrador mientras trabajas. No incorporamos publicidad ni seguimiento publicitario. El enlace enviado por correo permite acceder a tu pedido: no lo publiques ni lo compartas.</p>`:`<h2>Lo que compras</h2><p>Creamos una canción a partir de tu brief. Dedicatoria Musical entrega MP3 y portada digital. Canción Personalizada añade edición vocal, mezcla y master, MP3 y WAV, portada personalizada, Listening Room y una ronda de ajustes. Full Experience incluye además video vertical, edición y una ronda de ajustes de video. La duración y los contenidos incluidos se detallan en cada producto.</p><h2>Pedido, pago y tiempos</h2><p>Tu pedido se guarda antes del pago. La producción se inicia cuando Wompi confirma el cobro y contamos con el brief y los materiales necesarios. El plazo se acuerda con el equipo según el alcance y la agenda; no se garantiza una fecha urgente sin acuerdo previo. Los precios personales se presentan en COP y el total se muestra antes del checkout.</p><h2>Revisión y entrega</h2><p>Los ajustes incluidos corresponden al brief acordado. Una nueva historia, una dirección musical distinta o trabajos audiovisuales de mayor complejidad requieren un nuevo acuerdo de alcance y precio. Los archivos se entregan por acceso privado y se notifica al correo del pedido.</p><h2>Derechos y uso</h2><p>Debes contar con autorización para proporcionar textos, nombres, fotografías y clips. Las experiencias personales se destinan al uso personal y al regalo; cualquier explotación comercial requiere acuerdo expreso. No se promete exclusividad sobre recursos que por su naturaleza o licencia no la permitan.</p><h2>Cancelaciones y reclamaciones</h2><p>Contacta al equipo con tu referencia para solicitar cambios, cancelación, corrección de un cobro o una reclamación. La respuesta considera el estado real de producción, el carácter personalizado del servicio y los derechos del consumidor aplicables. Estas condiciones no limitan los derechos legales que te correspondan.</p>`}<h2>Contacto y responsable</h2><p>${boot.legal.name?esc(boot.legal.name):'Fromheartbeat'}${boot.legal.taxId?' · NIT '+esc(boot.legal.taxId):''}${boot.legal.address?'<br>'+esc(boot.legal.address):''}${boot.support?`<br><a href="mailto:${esc(boot.support)}">${esc(boot.support)}</a>`:''}</p></article>`});}

// ===== The 3D studio is the interface. What follows connects it to the flow, the HUD and the plain-text drawer. =====
const isMobile=()=>innerWidth<900;
const optionsDialog=$('#options-dialog'), STEP_ICON={genre:'sliders',mood:'sparkle',voice:'mic',story:'lines',products:'star',checkout:'lock'};
const DRAWER_VIEWS=['about','terms','privacy','recover','checkout','story'];
const announce=text=>{const l=$('#live');l.textContent='';requestAnimationFrame(()=>{l.textContent=text;});};
let returnTo=null;
const nextTarget=step=>returnTo&&step!=='checkout'?'checkout':step==='products'?(firstMissingBrief(draft)||'checkout'):FLOW[FLOW.indexOf(step)+1];
function sync3D(){if(!studio)return;studio.setDraft(draft);studio.stations.session?.setOrder(currentOrder?{reference:currentOrder.reference,status:currentOrder.status,productName:currentOrder.product_name,stage:currentOrder.production_stage}:null);studio.stations.cockpit?.setOrder(currentOrder);renderHud();}
function mountOptions(){const host=$('#mobile-content');if(root.parentElement!==host)host.append(root);document.body.classList.toggle('mobile-studio',isMobile());}
function syncInert(){const k=$('#stage-keys');if(k)k.inert=optionsDialog.open&&(DRAWER_VIEWS.includes(view)||(view==='session'&&!!sessionPanel));}
function openOptions(){mountOptions();if(!optionsDialog.open){modalReturnFocus=document.activeElement;optionsDialog.show();document.body.classList.add('options-open');$('#close-options').focus({preventScroll:true});}syncInert();renderHud();frameStudio();}
function closeOptions(){if(optionsDialog.open)optionsDialog.close();document.body.classList.remove('options-open');if(view==='session'&&sessionPanel&&!studio?.light){sessionPanel=null;plainMode=false;render(false);}syncInert();optionsDialog.classList.remove('expanded');renderHud();frameStudio();}
function hydrateIcons(){document.querySelectorAll('.ico[data-icon]').forEach(el=>{el.innerHTML=iconSvg(el.dataset.icon);});}


// Keyboard and screen-reader mirror of what can be touched in the 3D right now (visually hidden; focusing one lights the object).
const KEY_LABEL=a=>{
 switch(a.type){
  case'pick':return a.kind==='bank'?`Banco ${a.value}`:a.kind==='nav'?'':`${PICK_SAY[a.kind]||a.kind}: ${a.value}`;
  case'product':return a.choose?`Elegir la experiencia ${a.index+1}`:`Ver y elegir la experiencia ${a.index+1}`;
  case'product-step':return a.dir<0?'Experiencia anterior':'Experiencia siguiente';
  case'track':return`Escuchar la canción ${a.index+1}`;
  case'session-play':return'Escuchar mi canción';case'session-file':return`Descargar ${currentOrder?.files?.find(f=>f.id===a.id)?.original_name||'un archivo de la entrega'}`;case'session-pay':return'Ir al pago seguro';case'session-plain':return'Ver la sesión en texto';case'session-talk':return'Escribir al productor';case'session-files':return'Subir material';case'session-stage':return`Ver la etapa ${a.index+1}`;
  case'edit':return`Cambiar ${{genre:'el género',mood:'la emoción',voice:'la voz',story:'para quién es',products:'la experiencia'}[a.step]||a.step}`;
  case'rec':return'Crear mi canción';case'listen':return'Escuchar canciones';case'library':return'Ver toda la colección';
  case'go':return{recover:'Abrir mi sesión',mood:'Elegir la emoción',terms:'Leer los términos',privacy:'Leer la privacidad'}[a.view]||`Ir a ${a.view}`;
  default:return'';
 }};
let keysTimer=0,keysSig='';
function syncKeys(){
 const host=$('#stage-keys');if(!studio||!host)return;
 const live=studio.pickables.filter(o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return o.userData?.action;});
 const seenLabel=new Set(),items=live.map(o=>({o,label:KEY_LABEL(o.userData.action)})).filter(x=>x.label&&!seenLabel.has(x.label)&&seenLabel.add(x.label));
 const sig=items.map(x=>x.o.userData.id).join('|');
 const pressed=x=>{const a=x.o.userData.action;return a.type==='pick'?draft[a.kind]===a.value:false;};
 if(sig!==keysSig){keysSig=sig;host.replaceChildren(...items.map(x=>{const b=document.createElement('button');b.type='button';b.textContent=x.label;
  if(x.o.userData.action.type==='pick')b.setAttribute('aria-pressed',String(pressed(x)));
  b.addEventListener('click',()=>onAction(x.o.userData.action));
  b.addEventListener('focus',()=>{studio.hovered=x.o.userData.target||null;});b.addEventListener('blur',()=>{studio.hovered=null;});return b;}));}
 else items.forEach((x,i)=>{if(x.o.userData.action.type==='pick')host.children[i]?.setAttribute('aria-pressed',String(pressed(x)));});
}
const scheduleKeys=()=>{clearTimeout(keysTimer);keysTimer=setTimeout(()=>{syncKeys();keysTimer=setTimeout(syncKeys,1800);},350);};

// The session room: four corners the camera can stand in, and the one thing worth doing right now.
const SESSION_NAV=[['session','sliders','Estado de tu canción'],['session-song','headphones','Tu canción y tus archivos'],['session-talk','mail','Mensajes del productor'],['session-files','confetti','Tu material']];
function sessionNeeds(o){return o.product_code==='full'&&!(o.files||[]).some(f=>f.kind==='source')&&['paid','in_production'].includes(o.status);}
let heardSong=false;
function sessionPrimary(){const o=currentOrder,st=studio?.stations.cockpit,audio=!!st?.audioFile();
 if(['created','payment_pending'].includes(o.status)&&boot.commerceReady)return{act:'pay',icon:'lock',label:o.status==='payment_pending'?'Abrir el pago otra vez':'Ir al pago seguro'};
 if(['review','completed'].includes(o.status)&&audio&&!heardSong)return{act:'play',icon:'play',label:o.status==='completed'?'Escuchar mi canción':'Escuchar y opinar'};
 if(sessionNeeds(o))return{act:'files',icon:'confetti',label:'Subir mis fotos y videos'};
 if(['in_production','review','completed'].includes(o.status))return{act:'talk',icon:'mail',label:'Escribir al productor'};
 return{act:'status',icon:'sliders',label:'Ver qué está pasando'};}
function focusSession(v){if(!SESSION_VIEWS.includes(v))return;sessionFocus=v;studio?.moveTo(v);renderHud();frameStudio();announce(SESSION_NAV.find(x=>x[0]===v)?.[2]||'');}
function openSessionPanel(kind){if(view!=='session')return;sessionPanel=kind;if(kind==='full')plainMode=true;render(false);openOptions();}
function doSession(act){
 if(act==='pay')resumePayment();
 else if(act==='play'){if(sessionFocus!=='session-song')focusSession('session-song');playOrderAudio();}
 else if(act==='talk'){focusSession('session-talk');openSessionPanel('talk');}
 else if(act==='files'){focusSession('session-files');openSessionPanel('files');}
 else if(act==='plain')openSessionPanel('full');
 else if(act==='status'){focusSession('session');const o=currentOrder;if(o)studio?.stations.cockpit?.handle({type:'session-stage',index:['review','completed'].includes(o.status)?5:Number(o.production_stage)||0});}
}
// Caption and journey bar: the only chrome that lives over the 3D. Everything else happens in the scene.
function renderHud(){
 if(!boot)return;
 scheduleKeys();
 const i=FLOW.indexOf(view),cap=$('#caption'),jr=$('#journey'),drawer=optionsDialog.open,flow=i>=0;
 let kicker='',title='';
 if(flow){kicker=`Paso ${i+1} de ${FLOW.length} · ${STEPS[view].zone}`;title=STEPS[view].title;}
 else if(view==='samples'){kicker='Fromheartbeat Originals';title='Historias que ya suenan';}
 else if(view==='info')title='Información del estudio';
 cap.hidden=!title||drawer||studio?.light;
 cap.innerHTML=title?`<p class="cap-kicker">${esc(kicker)}</p><h2 class="cap-title">${esc(title)}</h2>`:'';
 const show=view!=='lobby'&&!drawer&&!studio?.light;
 jr.hidden=!show;document.body.classList.toggle('journey-on',show);$('#lobby-hint').hidden=view!=='lobby'||drawer||!!studio?.light;
 if(!show){jr.innerHTML='';return;}
 const ok=flow&&valid(view),back=flow?(i?FLOW[i-1]:'lobby'):'lobby';
 let primary;
 if(flow&&['story','checkout'].includes(view)&&!ok)primary=`<button class="j-next primary" data-plain>${iconSvg('pen')}<span>${view==='story'?'Escribir mi historia':'Completar mis datos'}</span></button>`;
 else if(flow&&view==='checkout')primary=`<button class="j-next primary" data-plain>${iconSvg('lock')}<span>${esc(nextLabel('checkout'))}</span></button>`;
 else if(flow)primary=`<button class="j-next primary ${ok?'':'locked'}" id="j-next" data-next="${nextTarget(view)}" aria-disabled="${!ok}"><span>${esc(nextLabel(view))}</span>${iconSvg('arrow')}</button>`;
 else if(view==='samples')primary=`<button class="j-next primary" data-go="resume"><span>Crear mi canción</span>${iconSvg('arrow')}</button>`;
 else if(view==='session'&&currentOrder){const p=sessionPrimary();primary=`<button class="j-next primary" data-session="${p.act}">${iconSvg(p.icon)}<span>${esc(p.label)}</span></button>`;}
 else primary=`<button class="j-next primary" data-plain><span>Abrir información</span>${iconSvg('lines')}</button>`;
 const steps=view==='session'&&currentOrder?`<ol class="j-steps">${SESSION_NAV.map(([v,icon,label])=>`<li><button class="j-step ${v===sessionFocus?'current':''}" data-focus="${v}" aria-label="${label}" ${v===sessionFocus?'aria-current="step"':''}>${iconSvg(icon)}</button></li>`).join('')}</ol>`:flow?`<ol class="j-steps">${FLOW.map((s,j)=>`<li><button class="j-step ${j===i?'current':valid(s)?'done':''}" data-go="${s}" aria-label="Paso ${j+1}: ${STEPS[s].zone}" ${j===i?'aria-current="step"':''}>${iconSvg(STEP_ICON[s])}</button></li>`).join('')}</ol>`:'';
 jr.innerHTML=`${steps}<div class="j-row"><button class="j-btn j-back" data-go="${back}" aria-label="${flow&&i?'Paso anterior':'Volver al estudio'}">${iconSvg('back')}</button>${primary}<button class="j-btn j-plain" data-plain aria-label="Ver en texto plano" title="Ver en texto plano">${iconSvg('lines')}</button></div>`;
}

// Tell the 3D camera which part of the screen is free of HUD and drawer: the subject is framed inside it.
function frameStudio(){
 if(!studio)return;
 const W=innerWidth,H=innerHeight,shown=e=>e&&!e.hidden&&getComputedStyle(e).display!=='none'?e.getBoundingClientRect():null;
 let top=$('.header').getBoundingClientRect().bottom+4,bottom=H-6,left=0,right=W;
 const cap=shown($('#caption')),jr=shown($('#journey')),dr=optionsDialog.open?optionsDialog.getBoundingClientRect():null;
 if(cap&&cap.width>W*0.7)top=Math.max(top,cap.bottom+4);
 document.documentElement.style.setProperty('--journey-h',(jr?Math.round(H-jr.top):0)+'px');
 if(jr)bottom=Math.min(bottom,jr.top-6);
 // The drawer is a bottom sheet or a side panel depending on the CSS: read what is really there, not a breakpoint.
 if(dr){if(dr.width>W*0.7)bottom=Math.min(bottom,dr.top-6);else if(dr.left>W/2)right=Math.min(right,dr.left-12);else left=Math.max(left,dr.right+12);}
 const dock=shown($('#audio-dock'));if(dock&&dock.width>W*0.7&&dock.top>H/2)bottom=Math.min(bottom,dock.top-6);
 studio.setFree([left,top,right,Math.max(top+120,bottom)]);
 const off=Math.abs(studio.rig.yaw)+Math.abs(studio.rig.pitch)+Math.abs(studio.rig.zoom-1)>0.03;$('#reset-view').hidden=!off;
}
function render(enter=true){mountOptions();const keepMsg=root.querySelector('#s-msg')?.value||'';const keepScroll=!enter?(root.querySelector('.panel-body')?.scrollTop||0):0;root.innerHTML=(FLOW.includes(view)?()=>wizardView(view):{lobby,info:aboutView,about:aboutView,samples:samplesView,recover:recoverView,session:sessionView,terms:()=>legalView(false),privacy:()=>legalView(true)}[view]||lobby)();const panel=root.querySelector('.panel');if(panel&&enter)panel.classList.add('enter');document.body.dataset.view=view;if(keepScroll){const pb=root.querySelector('.panel-body');if(pb)pb.scrollTop=keepScroll;}const msgBox=root.querySelector('#s-msg');if(msgBox&&keepMsg)msgBox.value=keepMsg;sync3D();mountUploads();requestAnimationFrame(frameStudio);}

function mountUploads(){const el=root.querySelector('[data-uploader]');if(el&&currentOrder&&view==='session')mountUploader(el,{ref:currentOrder.reference,role:'customer',kind:'source',files:currentOrder.files,status:currentOrder.status});}
async function refreshAfterUpload(ref){if(view!=='session'||currentOrder?.reference!==ref)return;const inUp=!!document.activeElement?.closest?.('#s-upload');try{currentOrder=(await api('order',null,'&reference='+encodeURIComponent(ref))).order;render(false);if(inUp)root.querySelector('[data-u-pick]')?.focus({preventScroll:true});}catch{}}
function go(next){
 if(!boot)return;
 const wasLegal=['terms','privacy'].includes(view),drawerWasOpen=optionsDialog.open;
 if(next==='lobby')plainMode=false;
 const keepPlain=plainMode&&FLOW.includes(next);
 closeMenu();closeOptions();
 let back=false;
 if(next==='back'){next=trail.pop()||'lobby';back=true;}
 if(next==='resume')next=resumeStep();
 if(next==='console')next='genre';
 if(next==='review')next='checkout';
 if(next==='session'&&view!=='session'){sessionFocus='session';sessionPanel=null;heardSong=false;}
 if(next!=='session')sessionPanel=null;
 if(FLOW.includes(next)&&currentOrder&&view==='session'){draft.key=crypto.randomUUID();save();currentOrder=null;flowView=null;}
 if(next==='checkout'){const missing=firstMissingBrief(draft);if(missing){toast(STEPS[missing].need);next=missing;}else if(boot.commerceReady)loadWompi().catch(()=>{});}
 if(next!=='session'&&location.search.includes('session='))history.replaceState({},'',location.pathname);
 if(!['terms','privacy'].includes(view))lastView=view;
 if(next==='lobby')trail.length=0;else if(!back&&next!==view){trail.push(view);if(trail.length>20)trail.shift();}
 if(FLOW.includes(next))flowView=next;
 if(next==='checkout'||!FLOW.includes(next))returnTo=next==='terms'||next==='privacy'?returnTo:null;
 if(next==='recover')api('my-orders').then(r=>{myOrders=r.orders;if(view==='recover')render(false);}).catch(()=>{});
 view=next;genreTab=null;
 if(draft.mood)studio?.tone(draft.mood);
 render();
 if(view==='session'&&(plainMode||studio?.light)){sessionPanel='full';render(false);}
 // On a phone the ticket needs the screen: the form opens when the visitor asks for it («Completar mis datos»), not by itself.
 const ticketFirst=view==='checkout'&&isMobile()&&!plainMode&&!!studio?.renderer&&!studio.light;
 if((DRAWER_VIEWS.includes(view)&&!ticketFirst)||keepPlain||(wasLegal&&drawerWasOpen)||studio?.light||(view==='session'&&sessionPanel))openOptions();
 frameStudio();studio?.moveTo(next==='session'?sessionFocus:next);
 announce(`${STEPS[view]?.title||ZONES[view]||'Estudio'}`);
}

// A choice made in the scene (or in the plain-text panel) lands here: the draft is the single source of truth.
function applyPick(name,value){
 draft[name]=value;save();
 if(name==='mood')studio?.tone(value);
 if(name==='occasion'){const input=root.querySelector('input[name=occasion]');if(input)input.value=value;}
 studio?.pulse(name==='voice'?1:.7);sync3D();refreshFoot();syncKeys();
}
const PICK_VIEW={genre:'genre',mood:'mood',voice:'voice',language:'voice',tempo:'voice'};
const PICK_SAY={genre:'Género',mood:'Emoción',voice:'Voz',language:'Idioma',tempo:'Ritmo'};
function chooseProduct(index){const p=catalogPerson()[index];if(!p)return;productPreview=index;applyPick('product',p.code);announce(`Experiencia elegida: ${p.name}`);if(!optionsDialog.open)render(false);}
function onAction(a){
 if(!a||!studio)return;
 studio.burst(studio.lastHit,a.type==='rec'?0xff3d7f:a.type==='listen'?0x22e4ff:studio.accent);
 if(studio.handle(a)){scheduleKeys();return;}
 if(a.type==='pick'){
  const target=PICK_VIEW[a.kind];if(target&&view!==target)go(target);
  applyPick(a.kind,a.value);announce(`${PICK_SAY[a.kind]}: ${a.value}`);if(!optionsDialog.open)render(false);
 }
 else if(a.type==='product')chooseProduct(a.index);
 else if(a.type==='track'){if(view!=='samples')go('samples');playTrack(a.index);}
 else if(a.type==='library'){go('samples');openOptions();}
 else if(a.type==='rec')go('resume');
 else if(a.type==='listen')go('samples');
 else if(a.type==='go')go(a.view);
 else if(a.type==='edit'){returnTo='checkout';go(a.step);}
 else if(a.type==='session-play')playOrderAudio();
 else if(a.type==='session-file')location.assign(`api.php?action=file&id=${a.id}&download=1`);
 else if(a.type==='session-pay')resumePayment();
 else if(a.type==='session-plain')openSessionPanel('full');
 else if(a.type==='session-talk'){if(a.direct||sessionFocus==='session-talk'){focusSession('session-talk');openSessionPanel('talk');}else focusSession('session-talk');}
 else if(a.type==='session-files'){if(sessionFocus==='session-files'){openSessionPanel('files');}else focusSession('session-files');}
}

document.addEventListener('click',async e=>{const el=e.target.closest('button');if(!el)return;
 if(el.dataset.focus){focusSession(el.dataset.focus);return;}
 if(el.dataset.session){doSession(el.dataset.session);return;}
 if(el.hasAttribute('data-session-back')){closeOptions();return;}
 if(el.hasAttribute('data-plain')){if(view==='session'){openSessionPanel('full');return;}if(FLOW.includes(view))plainMode=true;openOptions();return;}
 if(el.id==='reset-view'){studio?.resetView();return;}
 if(el.dataset.go){if(el.closest('.recap-row'))returnTo='checkout';go(el.dataset.go);return;}
 if(el.dataset.next!==undefined){if(!valid(view)){toast(STEPS[view].need);announce(STEPS[view].need);el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');studio?.pulse(.8);return;}go(el.dataset.next);return;}
 if(el.dataset.tab){genreTab=el.dataset.tab;const body=root.querySelector('.panel-body');body.innerHTML=genreStep();body.scrollTop=0;body.querySelector('[role="tab"][aria-selected="true"]')?.focus();return;}
 if(el.dataset.pick){const name=el.dataset.pick,value=el.dataset.value;applyPick(name,value);root.querySelectorAll(`[data-pick="${name}"]`).forEach(b=>{const on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
  if(['language','tempo'].includes(name)){const summary=root.querySelector('.advanced-options summary span');if(summary)summary.textContent=`${draft.language} · ${draft.tempo}`;}
  if(name==='product')productPreview=Number(el.dataset.index);
  if(name==='genre'){const box=$('#pick-info');if(box){box.hidden=false;box.innerHTML=`<strong>${esc(value)}</strong><p>${esc(GENRE_INFO[value]||'')}</p>`;}}
  return;}
 if(el.dataset.track!==undefined){playTrack(Number(el.dataset.track));return;}
 if(el.dataset.order){loadOrder(el.dataset.order).catch(e=>toast(e.message));return;}
 if(el.id==='resume-payment'){resumePayment(el);return;}
 if(el.dataset.quick){const t=el.closest('form').elements.message;if(!t.value.includes(el.dataset.quick))t.value=(t.value?t.value+' ':'')+el.dataset.quick+'. ';t.focus();return;}
 if(el.dataset.readmore!==undefined){const p=el.previousElementSibling,open=p.classList.toggle('clamp')===false;el.textContent=open?'Mostrar menos':'Leer completa';el.setAttribute('aria-expanded',String(open));return;}
 if(el.id==='refresh-order')refreshOrder().catch(e=>toast(e.message));
});
document.addEventListener('input',e=>{const t=e.target;if(t.closest?.('.field.invalid,.check.invalid'))clearFieldErrors();if(t.name&&t.name in draft){draft[t.name]=t.value;save();if(t.name==='story')$('#story-count').textContent=draft.story.length;if(t.name==='occasion')root.querySelectorAll('[data-pick=occasion]').forEach(b=>{const on=b.dataset.value===t.value;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});if(['recipient','occasion','story'].includes(t.name))sync3D();}refreshFoot();});
document.addEventListener('change',e=>{if(e.target.name==='consent'){draft.consent=e.target.checked;save();refreshFoot();}});
document.addEventListener('submit',async e=>{e.preventDefault();const form=e.target;
 if(form.id==='story-form'){$('#next')?.click();return;}
 if(form.id==='checkout-form'&&(firstMissingBrief(draft)||!valid('checkout'))){checkoutProblem(form);return;}
 const btn=form.id==='checkout-form'?$('#next'):root.querySelector(`[form="${form.id}"]`)||form.querySelector('button');
 if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');if(form.id==='checkout-form'){btn.dataset.idle=btn.innerHTML;btn.textContent='Guardando tu historia…';}}
  try{
  if(form.id==='checkout-form'){const {order}=await api('orders',{product:draft.product,name:draft.name,email:draft.email,phone:draft.phone,consent:form.elements.consent.checked,idempotency_key:draft.key,brief:Object.fromEntries(['genre','mood','voice','language','tempo','recipient','occasion','story','details'].map(k=>[k,draft[k]]))});currentOrder=order;history.replaceState({},'',`?session=${order.reference}`);
   // The song is saved: start a clean draft for a future one, keeping the buyer's contact details.
   draft={...draft,genre:'',mood:'',voice:'',recipient:'',occasion:'',story:'',details:'',consent:false,key:crypto.randomUUID()};flowView=null;trail.length=0;save();
   if(boot.commerceReady){let pay;try{pay=await api('checkout',{reference:order.reference});}catch(err){await loadOrder(order.reference);const pe=$('#payment-error');if(pe)pe.textContent=err.message;else toast(err.message);return;}
    const r=await startPayment(pay,order.reference);if(r==='redirect')return;
    await loadOrder(order.reference);if(currentOrder.status==='paid')studio?.celebrate();else if(r==='closed')toast('Tu pago quedó pendiente. Puedes retomarlo desde tu sesión.');return;}
   await loadOrder(order.reference);studio?.celebrate();return;}
  if(form.id==='recover-form'){const data=await api('recover',{email:form.elements.email.value});$('#recover-result').textContent=data.message;}
  if(form.id==='feedback-form'){if(form.elements.message.value.trim().length<3){const out=form.querySelector('.form-error');out.textContent='Escribe al menos unas palabras para tu productor.';form.elements.message.focus();return;}await api('feedback',{reference:currentOrder.reference,message:form.elements.message.value});await refreshOrder();toast('Tu comentario llegó al estudio.');}
 }catch(error){const out=form.querySelector('.form-error');if(out)out.textContent=error.message;else toast(error.message);}finally{if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');if(btn.dataset.idle){btn.innerHTML=btn.dataset.idle;delete btn.dataset.idle;}}}
});
// Wompi opens as a secure window over the studio: the visitor never leaves fromheartbeat.com. If Wompi's script cannot load
// (blocked, offline), the full-page checkout is the fallback. The widget reports the transaction; the server verifies it with Wompi.
let wompiLoad=null;
function loadWompi(){if(window.WidgetCheckout)return Promise.resolve();return wompiLoad||=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://checkout.wompi.co/widget.js';s.async=true;
 const t=setTimeout(()=>{wompiLoad=null;s.remove();no(new Error('timeout'));},15000);
 s.onload=()=>{clearTimeout(t);if(window.WidgetCheckout)ok();else{wompiLoad=null;no(new Error('widget'));}};
 s.onerror=()=>{clearTimeout(t);wompiLoad=null;s.remove();no(new Error('blocked'));};document.head.append(s);});}
async function startPayment(pay,ref){
 let tx;try{await loadWompi();tx=await new Promise((done,fail)=>{try{new window.WidgetCheckout(pay.widget).open(r=>done(r?.transaction||null));}catch(e){fail(e);}});}catch{tx=undefined;}
 if(tx===undefined){toast('Abriendo el pago seguro de Wompi…');location.assign(pay.url);return 'redirect';}
 if(tx?.id){try{await api('reconcile',{reference:ref,transaction:String(tx.id)});}catch{/* the webhook and the session poll settle it */}}
 return tx?'done':'closed';
}
let payingNow=false;
async function resumePayment(btn){
 if(payingNow)return;payingNow=true;if(btn)btn.disabled=true;
 try{const pay=await api('checkout',{reference:currentOrder.reference});const r=await startPayment(pay,currentOrder.reference);if(r!=='redirect'){await loadOrder(currentOrder.reference);if(currentOrder.status==='paid')studio?.celebrate();}}
 catch(e){toast(e.message);}finally{payingNow=false;if(btn)btn.disabled=false;}
}

// Gestures: one finger looks around (exactly, with limits), two fingers pinch, a tap touches an object.
// A tap on an object can change the screen under the finger (the journey bar appears, a drawer opens); the browser then
// delivers the same tap as a click to whatever is there now. That ghost click must not press an unrelated button.
let stageTap={t:-1e9,x:0,y:0};
document.addEventListener('click',e=>{if(e.detail>0&&performance.now()-stageTap.t<450&&Math.hypot(e.clientX-stageTap.x,e.clientY-stageTap.y)<14&&e.target.closest?.('#journey,.header,#audio-dock,#options-dialog,#reset-view')){e.preventDefault();e.stopImmediatePropagation();}},true);
const gesture=new StudioGesture({look:(dx,dy)=>{studio?.lookAround(dx,dy);},start:()=>studio?.beginLook(),end:(vx,vy)=>studio?.endLook(vx,vy),zoom:ratio=>studio?.zoomBy(ratio),pick:(x,y)=>{stageTap={t:performance.now(),x,y};onAction(studio?.pick(x,y)?.action);}});
{const stage=$('#stage');let hoverRaf=0;
 stage.addEventListener('pointerdown',e=>{if(e.button>0)return;gesture.down(e.pointerId,e.clientX,e.clientY,e.pointerType);stage.setPointerCapture(e.pointerId);stage.classList.add('grabbing');});
 stage.addEventListener('pointermove',e=>{if(gesture.points.size){gesture.move(e.pointerId,e.clientX,e.clientY);return;}if(e.pointerType==='mouse'&&!hoverRaf){const x=e.clientX,y=e.clientY;hoverRaf=requestAnimationFrame(()=>{hoverRaf=0;stage.style.cursor=studio?.hover(x,y)?'pointer':'grab';});}});
 const release=e=>{gesture.up(e.pointerId,e.clientX,e.clientY);stage.classList.remove('grabbing');};
 stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',()=>{gesture.cancel();stage.classList.remove('grabbing');});
 stage.addEventListener('lostpointercapture',()=>{if(!gesture.points.size)stage.classList.remove('grabbing');});
 stage.addEventListener('pointerleave',()=>{studio&&(studio.hovered=null);});
 stage.addEventListener('wheel',e=>{e.preventDefault();studio?.zoomBy(Math.exp(-e.deltaY*.0012));},{passive:false});}
document.addEventListener('keydown',e=>{
 if(e.target.matches('input,textarea,select,[role="tab"],[role="slider"]'))return;
 if(e.key==='Escape'&&optionsDialog.open){plainMode=false;closeOptions();return;}
 if(optionsDialog.open||menu?.open)return;
 const k={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,2.5],ArrowDown:[0,-2.5]}[e.key];
 if(k){e.preventDefault();studio?.nudge(k[0],k[1]);}
 else if(e.key==='Home'){studio?.resetView();}
});
addEventListener('resize',()=>{const previous=document.body.classList.contains('mobile-studio');mountOptions();if(previous!==isMobile())render(false);renderHud();requestAnimationFrame(frameStudio);});
setInterval(()=>{if(studio&&boot)frameStudio();},400);

// ---- Player: play/pause, previous/next, click or drag the bar to seek, keyboard arrows ----
const clock=s=>Number.isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';
function syncPlayer(){const on=!audio.paused;studio?.setPlaying(on&&!customTrack?playing:-1);studio?.setOrderPlaying(on&&!!customTrack);document.body.classList.toggle('sound-on',on);$('#audio-dock').classList.toggle('is-playing',on);$('#sound-toggle').setAttribute('aria-pressed',String(on));$('#sound-toggle').setAttribute('aria-label',on?'Pausar canción':'Reproducir una canción');const t=$('#player-toggle');t.innerHTML=ic(on?'pause':'play');t.setAttribute('aria-label',on?'Pausar canción':'Reproducir canción');if(view==='samples')root.querySelectorAll('.track').forEach((b,i)=>{const p=i===playing&&on;b.classList.toggle('playing',p);b.setAttribute('aria-label',`${p?'Pausar':'Escuchar'} ${tracks[i].name}`);b.querySelector('.play').innerHTML=ic(p?'pause':'play');});}
async function playTrack(index){customTrack=null;if(!tracks.length){toast('Pronto encontrarás canciones aquí.');return;}index=(index+tracks.length)%tracks.length;if(playing===index&&!audio.paused){audio.pause();return;}const changed=playing!==index;playing=index;const t=tracks[index];if(changed||!audio.src)audio.src=t.audio||'assets/audio/'+t.file+'.mp3';$('#track-name').textContent=t.name;$('.dock-cover').style.backgroundImage=`url("${t.cover||'assets/images/covers/'+t.file+'.webp'}")`;$('#track-genre').textContent=t.genre;$('#audio-dock').hidden=false;requestAnimationFrame(frameStudio);document.body.classList.add('audio-open');if(changed)paintSeek(0);try{studio?.connectAudio(audio);await audio.play();}catch{toast('No se pudo reproducir esta canción. Inténtalo otra vez.');}syncPlayer();}
const seekEl=$('#audio-seek');let seeking=false;
function paintSeek(ratio){ratio=Math.max(0,Math.min(1,ratio||0));seekEl.style.setProperty('--p',(ratio*100).toFixed(2)+'%');seekEl.setAttribute('aria-valuenow',String(Math.round(ratio*100)));seekEl.setAttribute('aria-valuetext',`${clock(ratio*audio.duration)} de ${clock(audio.duration)}`);$('#audio-time').textContent=clock(ratio*(audio.duration||0));}
const ratioAt=e=>{const r=seekEl.getBoundingClientRect();return (e.clientX-r.left)/r.width;};
seekEl.addEventListener('pointerdown',e=>{if(!Number.isFinite(audio.duration))return;seeking=true;seekEl.setPointerCapture(e.pointerId);seekEl.classList.add('dragging');paintSeek(ratioAt(e));});
seekEl.addEventListener('pointermove',e=>{if(seeking)paintSeek(ratioAt(e));});
const endSeek=e=>{if(!seeking)return;seeking=false;seekEl.classList.remove('dragging');const r=Math.max(0,Math.min(1,ratioAt(e)));audio.currentTime=r*audio.duration;paintSeek(r);};
seekEl.addEventListener('pointerup',endSeek);seekEl.addEventListener('pointercancel',()=>{seeking=false;seekEl.classList.remove('dragging');});
seekEl.addEventListener('keydown',e=>{if(!Number.isFinite(audio.duration))return;const step={ArrowRight:5,ArrowLeft:-5,ArrowUp:10,ArrowDown:-10}[e.key];if(step===undefined&&!['Home','End'].includes(e.key))return;e.preventDefault();audio.currentTime=e.key==='Home'?0:e.key==='End'?audio.duration-1:Math.max(0,Math.min(audio.duration,audio.currentTime+step));});
$('#player-toggle').onclick=()=>{if(audio.paused){if(customTrack)audio.play().catch(()=>{});else playTrack(playing<0?0:playing);}else audio.pause();};
// "Previous" restarts the song first, like any music app; a second press goes back one track.
$('#player-prev').onclick=()=>{if(audio.currentTime>3||customTrack){audio.currentTime=0;return;}playTrack(playing-1);};
$('#player-next').onclick=()=>{if(!customTrack)playTrack(playing+1);};
$('#player-close').onclick=()=>{audio.pause();$('#audio-dock').hidden=true;document.body.classList.remove('audio-open');requestAnimationFrame(frameStudio);};
$('#sound-toggle').onclick=()=>{if(audio.paused){if(customTrack)audio.play().catch(()=>{});else playTrack(playing<0?0:playing);}else audio.pause();};
audio.ontimeupdate=()=>{if(!seeking&&audio.duration)paintSeek(audio.currentTime/audio.duration);};
audio.onloadedmetadata=audio.ondurationchange=()=>{$('#audio-duration').textContent=clock(audio.duration);};
audio.onprogress=()=>{if(audio.duration&&audio.buffered.length)seekEl.style.setProperty('--b',(audio.buffered.end(audio.buffered.length-1)/audio.duration*100).toFixed(1)+'%');};
audio.onplay=audio.onpause=syncPlayer;
audio.onended=()=>{if(customTrack){syncPlayer();return;}playTrack(playing+1);};
$('#player-toggle').innerHTML=ic('play');

// The song of the customer's own session plays through the same dock as the studio's collection.
async function playOrderAudio(){
 const f=studio?.stations.cockpit?.audioFile();if(!f){toast('Tu canción aparecerá aquí en cuanto el estudio la suba.');return;}
 const url=`api.php?action=file&id=${f.id}`;if(customTrack===url&&!audio.paused){audio.pause();return;}
 const cover=(currentOrder?.files||[]).filter(x=>x.kind==='delivery'&&x.mime.startsWith('image/')).pop();
 customTrack=url;playing=-2;if(!audio.src.endsWith(url))audio.src=url;
 $('#track-name').textContent=studio.stations.cockpit.songTitle()||f.original_name.replace(/\.[^.]+$/,'');$('#track-genre').textContent='Tu canción · Fromheartbeat';
 $('.dock-cover').style.backgroundImage=cover?`url("api.php?action=file&id=${cover.id}")`:'';$('#audio-dock').hidden=false;document.body.classList.add('audio-open');requestAnimationFrame(frameStudio);paintSeek(0);
 try{studio?.connectAudio(audio);await audio.play();heardSong=true;renderHud();}catch{toast('No se pudo reproducir la canción. Inténtalo otra vez.');}syncPlayer();
}
async function refreshOrder(){if(!currentOrder)return;currentOrder=(await api('order',null,'&reference='+encodeURIComponent(currentOrder.reference))).order;if(sessionPanel)render(false);else sync3D();}
async function loadOrder(ref){currentOrder=(await api('order',null,'&reference='+encodeURIComponent(ref))).order;go('session');}
async function start(){try{boot=await api('bootstrap');configureUploads({getCsrf:()=>boot.csrf,setCsrf:t=>{boot.csrf=t;},config:boot.uploads,onBatchDone:refreshAfterUpload});if(Array.isArray(boot.tracks))tracks=boot.tracks;if(!catalogPerson().some(p=>p.code===draft.product))draft.product='personalizada';studio=new Studio($('#studio'));if(studio.light)document.body.classList.add('light-mode');studio.setContent(buildContent(boot,tracks,money));studio.stations.cockpit?.setCommerce(boot.commerceReady);if(boot.commerceReady)setTimeout(()=>loadWompi().catch(()=>{}),2500);onUploadStats(u=>{if(currentOrder&&u.ref===currentOrder.reference)studio?.stations.cockpit?.setUpload(u);});studio.setTracks(tracks);studio.setDraft(draft);if(draft.mood)studio.tone(draft.mood);hydrateIcons();render();frameStudio();if(studio.light)openOptions();
 if(new URLSearchParams(location.search).has('e2e'))window.__fhb={studio,go,draft:()=>draft,view:()=>view,onAction,order:()=>currentOrder,focus:()=>sessionFocus,panel:()=>sessionPanel};
 const params=new URLSearchParams(location.search);const ref=params.get('session');if(ref){const hash=new URLSearchParams(location.hash.slice(1));const token=hash.get('token');if(token){await api('exchange',{reference:ref,token});history.replaceState({},'',`?session=${encodeURIComponent(ref)}`);}if(params.get('id')){try{await api('reconcile',{reference:ref,transaction:params.get('id')});}catch(e){toast(e.message);}}await loadOrder(ref);}else{const map={terminos:'terms',privacidad:'privacy',info:'about'},k=params.get('ver'),v=Object.prototype.hasOwnProperty.call(map,k)?map[k]:null;if(v){history.replaceState({},'',location.pathname);go(v);}}}catch(e){if(boot){go('recover');toast(e.message);}else{root.innerHTML=shell({head:`<h1 id="panel-title">El estudio está <em>tomando aire.</em></h1>`,body:`<p class="lede">${esc(e.message)}</p>`,foot:`<button class="primary" id="retry-start">Volver a intentar ↻</button>`});mountOptions();openOptions();$('#retry-start').onclick=start;}}}
start();
// While a payment is open, check its result often (the server asks Wompi) and celebrate when it is approved.
let lastOrderPoll=0;
const pollOrder=async()=>{if(view!=='session'||!currentOrder||document.hidden||uploadsBusy()||document.activeElement?.matches('input,textarea')||[...root.querySelectorAll('audio')].some(a=>!a.paused))return;const pending=['created','payment_pending'].includes(currentOrder.status);if(Date.now()-lastOrderPoll<(pending?4000:20000))return;lastOrderPoll=Date.now();const signature=o=>JSON.stringify([o.status,o.production_stage,o.files,o.history]);const before=currentOrder;try{const o=(await api('order',null,'&reference='+encodeURIComponent(currentOrder.reference))).order;if(signature(o)!==signature(before)){currentOrder=o;if(sessionPanel)render(false);else sync3D();if(o.status==='paid'&&before.status!=='paid'){toast('¡Pago confirmado! Tu canción entra a producción.');studio?.celebrate();}}}catch{}};
setInterval(pollOrder,5000);addEventListener('focus',pollOrder);

// Compact application navigation, with native modal focus containment and Escape support.
// If the browser takes WebGL away mid-visit, the studio falls to light mode: bring up the text version so nobody is left without a screen.
let lastLight=false;
setInterval(()=>{if(!studio||studio.light===lastLight)return;lastLight=studio.light;if(!studio.light)return;document.body.classList.add('light-mode');if(view==='session'){sessionPanel='full';plainMode=true;}render(false);openOptions();},1000);
const menu=$('#studio-menu');
function closeMenu(){if(menu?.open)menu.close();$('#menu-toggle')?.setAttribute('aria-expanded','false');}
$('#menu-toggle').onclick=()=>{menu.showModal();$('#menu-toggle').setAttribute('aria-expanded','true');};
$('#menu-close').onclick=closeMenu;
menu.addEventListener('close',()=>$('#menu-toggle').setAttribute('aria-expanded','false'));
menu.addEventListener('click',e=>{if(e.target===menu)closeMenu();});
$('#quality-toggle').onclick=()=>{if(!studio)return;studio.setLight(!studio.light);lastLight=studio.light;document.body.classList.toggle('light-mode',studio.light);if(view==='session'){sessionPanel=studio.light?'full':null;plainMode=studio.light;}render(false);if(studio.light)openOptions();else closeOptions();sync3D();$('#quality-toggle').textContent=studio.light?'Activar estudio 3D':'Usar modo ligero';if(menu.open)menu.close();requestAnimationFrame(frameStudio);};
new ResizeObserver(()=>requestAnimationFrame(frameStudio)).observe(optionsDialog);
document.fonts?.ready?.then(()=>requestAnimationFrame(frameStudio));
document.addEventListener('focusin',e=>{if(e.target.matches('input,textarea')){document.body.classList.add('editing');requestAnimationFrame(frameStudio);}});
document.addEventListener('focusout',()=>{requestAnimationFrame(()=>{if(!document.activeElement?.matches('input,textarea')){document.body.classList.remove('editing');frameStudio();}});});
window.visualViewport?.addEventListener('resize',()=>{const previous=document.body.classList.contains('mobile-studio');mountOptions();if(previous!==isMobile())render(false);requestAnimationFrame(frameStudio);});

document.addEventListener('keydown',e=>{
 if(!e.target.matches('[role="tab"]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();const tabs=[...root.querySelectorAll('[role="tab"]')],i=tabs.indexOf(e.target);
 const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 tabs[next]?.click();
});
audio.addEventListener('error',()=>{toast('No pudimos cargar el audio. Prueba otra canción o revisa tu conexión.');syncPlayer();});

$('#close-options').onclick=()=>{plainMode=false;closeOptions();};
optionsDialog.addEventListener('close',()=>{if(optionsDialog.open)return;document.body.classList.remove('options-open');const target=modalReturnFocus?.isConnected?modalReturnFocus:null;target?.focus({preventScroll:true});});
document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();openOptions();});

// Music controls stay independent from the active room.
document.addEventListener('input',e=>{if(e.target.id==='track-search'){const q=e.target.value.toLocaleLowerCase();let count=0;root.querySelectorAll('.track').forEach(el=>{el.hidden=!el.textContent.toLocaleLowerCase().includes(q);if(!el.hidden)count++;});$('#track-empty').hidden=count>0;}});
$('#player-library').onclick=()=>{go('samples');openOptions();};
$('#player-volume').oninput=e=>{audio.volume=Number(e.target.value);};
$('#expand-options').onclick=()=>{const on=optionsDialog.classList.toggle('expanded');$('#expand-options').setAttribute('aria-pressed',String(on));};
document.addEventListener('play',e=>{if(e.target.tagName!=='AUDIO')return;document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause();});},true);
