import {Studio, MOODS} from './studio.js';
import {StudioGesture, firstMissingBrief} from './spatial-controls.js';
import {iconFor, iconSvg, LANGUAGE_BADGE} from './icons.js';
import {GENRE_INFO, MOOD_INFO, OCCASIONS, buildContent} from './content.js';
const $=(s)=>document.querySelector(s), esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n/100);
const root=$('#content'), audio=$('#sample-audio');
let boot,view='lobby',lastView='lobby',currentOrder=null,playing=-1,studio,genreTab=null,flowView=null,myOrders=[];
let productPreview=1, modalReturnFocus=null, plainMode=false;   // plainMode: the visitor chose the plain-text panels; it follows them from step to step
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
 checkout:{title:'Tus datos y pago',hint:'Revisa tu canción y déjanos dónde enviártela.',zone:'Tu sesión',need:'Completa tus datos y acepta los términos.'}
};
const ZONES={lobby:'Tu estudio',samples:'La pared de vinilos',info:'Información',about:'Nosotros',session:'Tu sesión',recover:'Tu sesión',terms:'Información',privacy:'Información'};
const catalogPerson=()=>boot.catalog.filter(p=>p.audience==='person');
const selectedProduct=()=>catalogPerson().find(p=>p.code===draft.product)||catalogPerson().find(p=>p.code==='personalizada');

async function api(action,data,query=''){const res=await fetch(`api.php?action=${action}${query}`,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json','X-CSRF-Token':boot?.csrf??''}:{},body:data?JSON.stringify(data):undefined});let json;try{json=await res.json();}catch{throw Error('No pudimos conectar con el estudio. Inténtalo de nuevo.');}if(!res.ok)throw Error(json.error||'No se pudo completar la solicitud.');return json;}
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
function summaryText(){return [draft.genre,draft.mood,draft.voice&&`Voz ${draft.voice.toLowerCase()}`].filter(Boolean).map(esc).join(' · ')||'Tu canción empieza aquí';}
function nextLabel(step){if(step==='products')return firstMissingBrief(draft)?'Crear con este paquete':'Revisar mi canción';if(step==='checkout'){const p=selectedProduct();return boot.commerceReady?`Ir a pagar ${money(p.price)}`:'Guardar mi sesión';}return 'Siguiente';}
function wizardFoot(step){const ok=valid(step),i=FLOW.indexOf(step);return `<p class="summary" id="summary">${summaryText()}</p><button class="primary next ${ok?'':'locked'}" id="next" ${step==='checkout'?'type="submit" form="checkout-form"':`type="button" data-next="${step==='products'?(firstMissingBrief(draft)||'checkout'):FLOW[i+1]}"`} aria-disabled="${!ok}">${nextLabel(step)} <span>→</span></button>`;}
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
function field(name,label,{type='text',min=0,max=200,placeholder='',area=false,required=true}={}){return `<label class="field"><span>${label}</span>${area?`<textarea name="${name}" minlength="${min}" maxlength="${max}" ${required?'required':''} placeholder="${esc(placeholder)}">${esc(draft[name])}</textarea>`:`<input name="${name}" type="${type}" value="${esc(draft[name])}" minlength="${min}" maxlength="${max}" ${required?'required':''} placeholder="${esc(placeholder)}" autocomplete="${{name:'name',email:'email',phone:'tel'}[name]||'off'}">`}</label>`;}
function storyStep(){return `<form id="story-form" novalidate>${field('recipient','¿Para quién es?',{min:2,max:120,placeholder:'Su nombre, como tú le dices'})}<fieldset class="opt-group"><legend>${ic('gift')} ¿Qué celebran?</legend><div class="opts chips">${occasions.map(o=>opt('occasion',o)).join('')}</div></fieldset>${field('occasion','Ocasión',{min:2,max:100,placeholder:'O escribe la tuya'})}${field('story','Su historia',{area:true,min:30,max:6000,placeholder:'Cómo se conocieron. Ese viaje. Una frase que solo ustedes entienden…'})}<p class="form-note"><span id="story-count">${draft.story.length}</span> / 6.000 · mínimo 30 caracteres</p>${field('details','Detalles que no pueden faltar (opcional)',{area:true,max:2000,required:false,placeholder:'Nombres, apodos, pronunciación, algo que prefieras evitar.'})}</form>`;}
function productsStep(){return `<div class="opts products">${catalogPerson().map((p,i)=>{const on=draft.product===p.code;return `<div class="product-card"><div class="package-art ${p.code}"><span>${iconSvg(iconFor('product',p.code),'pkg-svg')}</span><b>${['01 / ESENCIAL','02 / SIGNATURE','03 / CINEMA'][i]}</b></div><button type="button" class="opt product-opt ${on?'on':''}" data-pick="product" data-value="${p.code}" data-index="${i}" aria-pressed="${on}"><span class="product-top"><span class="tag">${esc(p.tag)}</span><b class="tick" aria-hidden="true">${ic('check')}</b></span><span class="opt-label">${esc(p.name)}</span><span class="price">${money(p.price)} <small>COP</small></span><span class="points">${(PRODUCT_POINTS[p.code]||[]).map(([i,t])=>`<i>${ic(i)}${t}</i>`).join('')}</span></button><details class="product-details" open><summary>Qué incluye</summary><ul>${p.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></details></div>`;}).join('')}</div><p class="form-note">Dedicatoria: creación digital con IA. Personalizada y Full: interpretación humana.</p>`;}
const PRODUCT_POINTS={dedicatoria:[['sparkle','Creación digital con IA'],['clock','Entrega más rápida']],personalizada:[['mic','Cantante real'],['refresh','1 ronda de ajustes']],full:[['music','Canción + video'],['gift','Presentación especial']]};
const testCard=()=>boot.testMode&&boot.commerceReady?`<div class="card test-card">${ic('flask')}<div><strong>Modo de pruebas (sandbox)</strong><p>No se cobra dinero real. Tarjeta aprobada: <code>4242 4242 4242 4242</code> · Rechazada: <code>4111 1111 1111 1111</code>. Cualquier fecha futura y CVC de 3 dígitos. El pago se abre en otra pestaña; vuelve aquí y la sesión se actualiza sola.</p></div></div>`:'';
function checkoutStep(){const p=selectedProduct();const row=(icon,label,value,step)=>`<div class="recap-row"><span>${ic(icon)}${label}</span><strong>${value}</strong><button type="button" data-go="${step}">${ic('pen')}<b>Editar</b></button></div>`;return `${testCard()}<div class="recap">${row('sliders','Sonido',esc([draft.genre,draft.mood].join(' · ')),'genre')}${row('mic','Voz',esc([draft.voice,draft.language,draft.tempo].join(' · ')),'voice')}${row('heart','Para',esc(`${draft.recipient} · ${draft.occasion}`),'story')}${row('gift','Experiencia',`${esc(p.name)} · ${money(p.price)}`,'products')}</div><form id="checkout-form" novalidate>${field('name','Tu nombre completo',{min:2,max:120})}${field('email','Correo para recibir tu canción',{type:'email',max:254})}${field('phone','Celular',{type:'tel',min:7,max:40})}<label class="check"><input type="checkbox" name="consent" required ${draft.consent?'checked':''}><span>Acepto los <button type="button" data-go="terms">términos</button> y la <button type="button" data-go="privacy">política de privacidad</button>, y puedo compartir esta historia.</span></label><p class="form-error" id="checkout-error" role="alert"></p><div class="total-row"><span>Total a pagar</span><strong>${money(p.price)} COP</strong></div><p class="form-note">${boot.commerceReady?'🔒 Pagas en Wompi (tarjeta, PSE, Nequi…). Guardamos tu historia antes de abrir el pago.':'Los pagos en línea se están configurando. Guardaremos tu sesión y te avisaremos por correo para completar el pago.'}</p></form>`;}
function wizardView(step){const body={genre:genreStep,mood:moodStep,voice:voiceStep,story:storyStep,products:productsStep,checkout:checkoutStep}[step]();return shell({cls:`wizard step-${step}`,head:wizardHead(step),body,foot:wizardFoot(step)});}

function recoverView(){const list=myOrders.length?`<h2 class="section-label">${ic('music')} En este dispositivo</h2><div class="my-orders">${myOrders.map(o=>`<button class="card my-order" data-order="${esc(o.reference)}"><span class="opt-ic" aria-hidden="true">${{completed:'🎧',paid:'✅',in_production:'🎚️',review:'👂',payment_pending:'⏳',created:'📝',cancelled:'✖️'}[o.status]||'🎵'}</span><span><strong>${esc(o.product_name)} · ${money(o.amount_in_cents)}</strong><small>${esc(statusNames[o.status])} · ${esc(o.reference)}</small></span>${ic('arrow')}</button>`).join('')}</div><h2 class="section-label">${ic('mail')} ¿Otro dispositivo?</h2>`:'';
 return shell({head:simpleHead('Tu sesión','Sigue tu canción o recupera tu enlace privado.'),body:`${list}<form id="recover-form"><label class="field"><span>El correo de tu pedido</span><input type="email" name="email" required autocomplete="email"></label><p class="form-error" id="recover-result" role="status"></p></form>`,foot:`<button class="primary" type="submit" form="recover-form">${ic('mail')} Recibir mi enlace</button>`});}

function sessionView(){const o=currentOrder;if(!o)return shell({head:simpleHead('Abriendo tu sesión…'),body:''});const pending=['created','payment_pending'].includes(o.status),delivery=o.files.filter(f=>f.kind==='delivery'),audioFiles=delivery.filter(f=>f.mime.startsWith('audio/')).slice().reverse();
 const title=o.status==='completed'?'Tu historia. <em>Ahora, tu canción.</em>':pending?'Tu historia ya <em>está en el estudio.</em>':'La sesión <em>ha comenzado.</em>';
 const waiting=o.status==='payment_pending'&&boot.commerceReady;
 const payBox=pending?`<div class="card status-card">${waiting?`<p class="live">${ic('refresh','spin')} <b>Esperando la confirmación de Wompi.</b></p><p>Completa el pago en la pestaña de Wompi. Esta pantalla se actualiza sola en cuanto el pago se apruebe.</p>`:`<p>${boot.commerceReady?'Tu historia está guardada. Completa el pago para iniciar la producción.':'Tu pedido está guardado. Los pagos en línea se están configurando; te avisaremos por correo para completarlo.'}</p>`}<div class="actions">${boot.commerceReady?`<button id="resume-payment" class="primary">${ic('lock')} ${waiting?'Abrir el pago otra vez':'Ir al pago seguro'}</button>`:''}<button id="refresh-order" class="secondary">${ic('refresh')} Actualizar</button></div><p class="form-error" id="payment-error" role="alert"></p></div>${testCard()}`:'';
 const room=delivery.length?`<div class="card listening-room"><p class="eyebrow"><span class="dash"></span>${o.product.listening?'Listening room · acceso privado':'Tu entrega'}</p><h2>${o.product.listening?'Este momento es solo tuyo.':'Una canción para guardar.'}</h2>${audioFiles.map((f,i)=>`<div class="version-player"><span>${i===0?'ÚLTIMA VERSIÓN':'VERSIÓN ANTERIOR'}</span><strong>${esc(f.original_name)}</strong><audio controls preload="none" src="api.php?action=file&id=${f.id}"></audio></div>`).join('')}${delivery.map(f=>`<div class="file-row"><span>${esc(f.original_name)}</span><a href="api.php?action=file&id=${f.id}&download=1">Descargar ↓</a></div>`).join('')}</div>`:`<div class="card listening-room"><p class="eyebrow"><span class="dash"></span>Cada detalle importa</p><h2>Las cosas que se sienten merecen su tiempo.</h2><p class="lede">Aquí verás los avances y encontrarás tu canción cuando esté lista.</p></div>`;
 const upload=o.product_code==='full'&&!pending?`<form id="source-form" class="card"><label class="field"><span>Tus fotos y clips para el video</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" required><small>Hasta 50 MB por archivo. Máximo 40 archivos por sesión.</small></label><button class="secondary">Enviar archivo →</button><p id="upload-result" role="status" class="form-note"></p></form>`:'';
 return shell({cls:'tall',head:`<div class="head-row"><button class="icon-btn" data-go="lobby" aria-label="Volver al inicio">${ic('back')}</button><span class="step-count">Tu sesión · ${esc(o.reference)}</span><span class="icon-spacer"></span></div><h1 id="panel-title">${title}</h1><p class="hint">${esc(statusNames[o.status])} · ${esc(o.product_name)} · ${money(o.amount_in_cents)} COP</p>`,body:`${payBox}${!pending?`<button id="refresh-order" class="secondary">${ic("refresh")} Actualizar mi sesión</button>`:""}${room}<h2 class="section-label">En qué estamos</h2><ol class="timeline">${stages.map((s,i)=>`<li data-index="${i+1}" class="${i<=Number(o.production_stage)?'done':''} ${i===Number(o.production_stage)?'current':''}">${s}${i===Number(o.production_stage)?'<small>Estamos aquí</small>':''}</li>`).join('')}</ol><div class="card"><h2 class="section-label">Tu historia</h2><p class="story-text">${esc(o.brief.story)}</p></div>${upload}${["in_production","review","completed"].includes(o.status)?`<form id="feedback-form" class="card"><h2>Conversemos sobre tu canción</h2><label class="field">Tus comentarios<textarea name="message" required minlength="3" maxlength="2000" placeholder="Cuéntanos qué te pareció y qué detalle quisieras revisar."></textarea></label><button class="secondary">Enviar al estudio →</button><p class="form-error" role="status"></p></form>`:""}<h2 class="section-label">Notas del estudio</h2>${o.history.slice().reverse().map(h=>`<div class="history-item"><small>${new Date(h.created_at.replace(' ','T')+'Z').toLocaleString('es-CO')}</small><p>${esc(h.note)}</p></div>`).join('')}${o.files.filter(f=>f.kind==='source').map(f=>`<div class="file-row"><span>${esc(f.original_name)}</span><a href="api.php?action=file&id=${f.id}&download=1">Tu archivo ↓</a></div>`).join('')}`});}

function legalView(privacy){return shell({cls:'tall',head:simpleHead(privacy?'Tu historia es <em>privada.</em>':'Antes de crear <em>tu canción.</em>','Versión 11 de septiembre de 2026.',lastView),body:`<article class="legal">${privacy?`<h2>Datos que tratamos y finalidad</h2><p>Recibimos tu nombre, correo, teléfono, brief musical y archivos que decidas compartir. Los utilizamos para gestionar tu pedido, crear la canción, atender solicitudes y entregar el resultado. Los datos de pago se procesan en Wompi; Fromheartbeat no recibe el número completo de tu tarjeta ni su código de seguridad.</p><h2>Tu historia y tus archivos</h2><p>Comparte sólo información que tengas derecho a usar. Evita datos sensibles innecesarios o información de menores sin autorización de su representante. El acceso al brief y los entregables se limita al equipo que produce la sesión y a los proveedores necesarios para prestarte el servicio, incluido el procesamiento tecnológico indicado en el producto.</p><h2>Acceso, conservación y derechos</h2><p>Puedes solicitar conocer, actualizar, rectificar o suprimir tus datos y revocar la autorización cuando corresponda, sin afectar obligaciones de conservación aplicables. Las solicitudes se reciben en el canal de contacto indicado al final. Los datos se conservan mientras sea necesario para el servicio y las obligaciones contables y contractuales; las copias de respaldo siguen su ciclo de eliminación.</p><h2>Cookies y enlaces privados</h2><p>Usamos una cookie de sesión para proteger tu acceso y almacenamiento del navegador para conservar el borrador mientras trabajas. No incorporamos publicidad ni seguimiento publicitario. El enlace enviado por correo permite acceder a tu pedido: no lo publiques ni lo compartas.</p>`:`<h2>Lo que compras</h2><p>Creamos una canción a partir de tu brief. Dedicatoria Musical utiliza un flujo de creación digital con IA y entrega MP3 y portada. Canción Personalizada añade interpretación humana, MP3 y WAV, portada, Listening Room y una ronda de ajustes. Full Experience incluye además video vertical, edición y una ronda de ajustes de video. La duración y los contenidos incluidos se detallan en cada producto.</p><h2>Pedido, pago y tiempos</h2><p>Tu pedido se guarda antes del pago. La producción se inicia cuando Wompi confirma el cobro y contamos con el brief y los materiales necesarios. El plazo se acuerda con el equipo según el alcance y la agenda; no se garantiza una fecha urgente sin acuerdo previo. Los precios personales se presentan en COP y el total se muestra antes del checkout.</p><h2>Revisión y entrega</h2><p>Los ajustes incluidos corresponden al brief acordado. Una nueva historia, una dirección musical distinta o trabajos audiovisuales de mayor complejidad requieren un nuevo acuerdo de alcance y precio. Los archivos se entregan por acceso privado y se notifica al correo del pedido.</p><h2>Derechos y uso</h2><p>Debes contar con autorización para proporcionar textos, nombres, fotografías y clips. Las experiencias personales se destinan al uso personal y al regalo; cualquier explotación comercial requiere acuerdo expreso. No se promete exclusividad sobre recursos que por su naturaleza o licencia no la permitan.</p><h2>Cancelaciones y reclamaciones</h2><p>Contacta al equipo con tu referencia para solicitar cambios, cancelación, corrección de un cobro o una reclamación. La respuesta considera el estado real de producción, el carácter personalizado del servicio y los derechos del consumidor aplicables. Estas condiciones no limitan los derechos legales que te correspondan.</p>`}<h2>Contacto y responsable</h2><p>${boot.legal.name?esc(boot.legal.name):'Fromheartbeat'}${boot.legal.taxId?' · NIT '+esc(boot.legal.taxId):''}${boot.legal.address?'<br>'+esc(boot.legal.address):''}${boot.support?`<br><a href="mailto:${esc(boot.support)}">${esc(boot.support)}</a>`:''}</p></article>`});}

// ===== The 3D studio is the interface. What follows connects it to the flow, the HUD and the plain-text drawer. =====
const isMobile=()=>innerWidth<760;
const optionsDialog=$('#options-dialog'), STEP_ICON={genre:'sliders',mood:'sparkle',voice:'mic',story:'lines',products:'star',checkout:'lock'};
const DRAWER_VIEWS=['about','terms','privacy','recover','session','checkout','story'];
const announce=text=>{const l=$('#live');l.textContent='';requestAnimationFrame(()=>{l.textContent=text;});};
const nextTarget=step=>step==='products'?(firstMissingBrief(draft)||'checkout'):FLOW[FLOW.indexOf(step)+1];
function sync3D(){if(!studio)return;studio.setDraft(draft);studio.stations.session?.setOrder(currentOrder?{reference:currentOrder.reference,statusLabel:statusNames[currentOrder.status],productName:currentOrder.product_name,stage:currentOrder.production_stage}:null);renderHud();}
function mountOptions(){const host=$('#mobile-content');if(root.parentElement!==host)host.append(root);document.body.classList.toggle('mobile-studio',isMobile());}
function openOptions(){mountOptions();if(!optionsDialog.open){modalReturnFocus=document.activeElement;optionsDialog.show();document.body.classList.add('options-open');$('#close-options').focus({preventScroll:true});}renderHud();frameStudio();}
function closeOptions(){if(optionsDialog.open)optionsDialog.close();document.body.classList.remove('options-open');optionsDialog.classList.remove('expanded');renderHud();frameStudio();}
function hydrateIcons(){document.querySelectorAll('.ico[data-icon]').forEach(el=>{el.innerHTML=iconSvg(el.dataset.icon);});}

// Caption and journey bar: the only chrome that lives over the 3D. Everything else happens in the scene.
function renderHud(){
 if(!boot)return;
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
 else primary=`<button class="j-next primary" data-plain><span>Abrir información</span>${iconSvg('lines')}</button>`;
 const steps=flow?`<ol class="j-steps">${FLOW.map((s,j)=>`<li><button class="j-step ${j===i?'current':valid(s)?'done':''}" data-go="${s}" aria-label="Paso ${j+1}: ${STEPS[s].zone}" ${j===i?'aria-current="step"':''}>${iconSvg(STEP_ICON[s])}</button></li>`).join('')}</ol>`:'';
 jr.innerHTML=`${steps}<div class="j-row"><button class="j-btn j-back" data-go="${back}" aria-label="${flow&&i?'Paso anterior':'Volver al estudio'}">${iconSvg('back')}</button>${primary}<button class="j-btn j-plain" data-plain aria-label="Ver en texto plano" title="Ver en texto plano">${iconSvg('lines')}</button></div>`;
}

// Tell the 3D camera which part of the screen is free of HUD and drawer: the subject is framed inside it.
function frameStudio(){
 if(!studio)return;
 const W=innerWidth,H=innerHeight,shown=e=>e&&!e.hidden&&getComputedStyle(e).display!=='none'?e.getBoundingClientRect():null;
 let top=$('.header').getBoundingClientRect().bottom+4,bottom=H-6,left=0,right=W;
 const cap=shown($('#caption')),jr=shown($('#journey')),dr=optionsDialog.open?optionsDialog.getBoundingClientRect():null;
 if(cap&&isMobile())top=Math.max(top,cap.bottom+4);
 document.documentElement.style.setProperty('--journey-h',(jr?Math.round(H-jr.top):0)+'px');
 if(jr)bottom=Math.min(bottom,jr.top-6);
 if(dr){if(isMobile())bottom=Math.min(bottom,dr.top-6);else right=Math.min(right,dr.left-12);}
 studio.setFree([left,top,right,Math.max(top+120,bottom)]);
 const off=Math.abs(studio.rig.yaw)+Math.abs(studio.rig.pitch)+Math.abs(studio.rig.zoom-1)>0.03;$('#reset-view').hidden=!off;
}
function render(enter=true){mountOptions();root.innerHTML=(FLOW.includes(view)?()=>wizardView(view):{lobby,info:aboutView,about:aboutView,samples:samplesView,recover:recoverView,session:sessionView,terms:()=>legalView(false),privacy:()=>legalView(true)}[view]||lobby)();const panel=root.querySelector('.panel');if(panel&&enter)panel.classList.add('enter');document.body.dataset.view=view;sync3D();requestAnimationFrame(frameStudio);}

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
 if(FLOW.includes(next)&&currentOrder&&view==='session'){draft.key=crypto.randomUUID();save();currentOrder=null;flowView=null;}
 if(next==='checkout'){const missing=firstMissingBrief(draft);if(missing){toast(STEPS[missing].need);next=missing;}}
 if(next!=='session'&&location.search.includes('session='))history.replaceState({},'',location.pathname);
 if(!['terms','privacy'].includes(view))lastView=view;
 if(next==='lobby')trail.length=0;else if(!back&&next!==view){trail.push(view);if(trail.length>20)trail.shift();}
 if(FLOW.includes(next))flowView=next;
 if(next==='recover')api('my-orders').then(r=>{myOrders=r.orders;if(view==='recover')render(false);}).catch(()=>{});
 view=next;genreTab=null;
 if(draft.mood)studio?.tone(draft.mood);
 render();
 if(DRAWER_VIEWS.includes(view)||keepPlain||(wasLegal&&drawerWasOpen)||studio?.light)openOptions();
 frameStudio();studio?.moveTo(next);
 announce(`${STEPS[view]?.title||ZONES[view]||'Estudio'}`);
}

// A choice made in the scene (or in the plain-text panel) lands here: the draft is the single source of truth.
function applyPick(name,value){
 draft[name]=value;save();
 if(name==='mood')studio?.tone(value);
 if(name==='occasion'){const input=root.querySelector('input[name=occasion]');if(input)input.value=value;}
 studio?.pulse(name==='voice'?1:.7);sync3D();refreshFoot();
}
const PICK_VIEW={genre:'genre',mood:'mood',voice:'voice',language:'voice',tempo:'voice'};
const PICK_SAY={genre:'Género',mood:'Emoción',voice:'Voz',language:'Idioma',tempo:'Ritmo'};
function chooseProduct(index){const p=catalogPerson()[index];if(!p)return;productPreview=index;applyPick('product',p.code);announce(`Experiencia elegida: ${p.name}`);if(!optionsDialog.open)render(false);}
function onAction(a){
 if(!a||!studio)return;
 studio.burst(studio.lastHit,a.type==='rec'?0xff3d7f:a.type==='listen'?0x22e4ff:studio.accent);
 if(studio.handle(a))return;
 if(a.type==='pick'){
  const target=PICK_VIEW[a.kind];if(target&&view!==target)go(target);
  applyPick(a.kind,a.value);announce(`${PICK_SAY[a.kind]}: ${a.value}`);if(!optionsDialog.open)render(false);
 }
 else if(a.type==='product'&&a.choose)chooseProduct(a.index);
 else if(a.type==='track'){if(view!=='samples')go('samples');playTrack(a.index);}
 else if(a.type==='library'){go('samples');openOptions();}
 else if(a.type==='rec')go('resume');
 else if(a.type==='listen')go('samples');
 else if(a.type==='go')go(a.view);
}

document.addEventListener('click',async e=>{const el=e.target.closest('button');if(!el)return;
 if(el.hasAttribute('data-plain')){if(FLOW.includes(view))plainMode=true;openOptions();return;}
 if(el.id==='reset-view'){studio?.resetView();return;}
 if(el.dataset.go){go(el.dataset.go);return;}
 if(el.dataset.next!==undefined){if(!valid(view)){toast(STEPS[view].need);announce(STEPS[view].need);el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');studio?.pulse(.8);return;}go(el.dataset.next);return;}
 if(el.dataset.tab){genreTab=el.dataset.tab;const body=root.querySelector('.panel-body');body.innerHTML=genreStep();body.scrollTop=0;body.querySelector('[role="tab"][aria-selected="true"]')?.focus();return;}
 if(el.dataset.pick){const name=el.dataset.pick,value=el.dataset.value;applyPick(name,value);root.querySelectorAll(`[data-pick="${name}"]`).forEach(b=>{const on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
  if(['language','tempo'].includes(name)){const summary=root.querySelector('.advanced-options summary span');if(summary)summary.textContent=`${draft.language} · ${draft.tempo}`;}
  if(name==='product')productPreview=Number(el.dataset.index);
  if(name==='genre'){const box=$('#pick-info');if(box){box.hidden=false;box.innerHTML=`<strong>${esc(value)}</strong><p>${esc(GENRE_INFO[value]||'')}</p>`;}}
  return;}
 if(el.dataset.track!==undefined){playTrack(Number(el.dataset.track));return;}
 if(el.dataset.order){loadOrder(el.dataset.order).catch(e=>toast(e.message));return;}
 if(el.id==='resume-payment'){el.disabled=true;const tab=paymentTab();try{openPayment(tab,(await api('checkout',{reference:currentOrder.reference})).url);await loadOrder(currentOrder.reference);}catch(e){tab?.close();$('#payment-error').textContent=e.message;el.disabled=false;}}
 if(el.id==='refresh-order')loadOrder(currentOrder.reference).catch(e=>toast(e.message));
});
document.addEventListener('input',e=>{const t=e.target;if(t.name&&t.name in draft){draft[t.name]=t.value;save();if(t.name==='story')$('#story-count').textContent=draft.story.length;if(t.name==='occasion')root.querySelectorAll('[data-pick=occasion]').forEach(b=>{const on=b.dataset.value===t.value;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});if(['recipient','occasion','story'].includes(t.name))sync3D();}refreshFoot();});
document.addEventListener('change',e=>{if(e.target.name==='consent'){draft.consent=e.target.checked;save();refreshFoot();}});
document.addEventListener('submit',async e=>{e.preventDefault();const form=e.target;
 if(form.id==='story-form'){$('#next')?.click();return;}
 if(form.id==='checkout-form'&&(firstMissingBrief(draft)||!valid('checkout'))){$('#checkout-error').textContent=STEPS.checkout.need;return;}
 const btn=form.id==='checkout-form'?$('#next'):root.querySelector(`[form="${form.id}"]`)||form.querySelector('button');
 if(btn)btn.disabled=true;
 const tab=form.id==='checkout-form'&&boot.commerceReady?paymentTab():null;
 try{
  if(form.id==='checkout-form'){const {order}=await api('orders',{product:draft.product,name:draft.name,email:draft.email,phone:draft.phone,consent:form.elements.consent.checked,idempotency_key:draft.key,brief:Object.fromEntries(['genre','mood','voice','language','tempo','recipient','occasion','story','details'].map(k=>[k,draft[k]]))});currentOrder=order;history.replaceState({},'',`?session=${order.reference}`);
   // The song is saved: start a clean draft for a future one, keeping the buyer's contact details.
   draft={...draft,genre:'',mood:'',voice:'',recipient:'',occasion:'',story:'',details:'',consent:false,key:crypto.randomUUID()};flowView=null;trail.length=0;save();
   if(boot.commerceReady){try{openPayment(tab,(await api('checkout',{reference:order.reference})).url);}catch(err){tab?.close();await loadOrder(order.reference);$('#payment-error').textContent=err.message;return;}}
   await loadOrder(order.reference);studio?.celebrate();return;}
  if(form.id==='recover-form'){const data=await api('recover',{email:form.elements.email.value});$('#recover-result').textContent=data.message;}
  if(form.id==='feedback-form'){await api('feedback',{reference:currentOrder.reference,message:form.elements.message.value});await loadOrder(currentOrder.reference);toast('Tu comentario llegó al estudio.');}
  if(form.id==='source-form'){const data=new FormData(form);data.append('reference',currentOrder.reference);const res=await fetch('api.php?action=upload',{method:'POST',headers:{'X-CSRF-Token':boot.csrf},body:data});const json=await res.json();if(!res.ok)throw Error(json.error);await loadOrder(currentOrder.reference);toast('Archivo guardado en tu sesión.');}
 }catch(error){tab?.close();const out=form.querySelector('.form-error, #upload-result');if(out)out.textContent=error.message;else toast(error.message);}finally{if(btn)btn.disabled=false;}
});
// Wompi only returns to public HTTPS sites. Elsewhere (local sandbox) the checkout opens in a new tab while this tab
// stays on the session and polls; the tab is opened during the click so the browser does not block it.
const returnsHere=()=>location.protocol==='https:';
function paymentTab(){if(returnsHere())return null;const w=window.open('','_blank');if(w){w.opener=null;}if(w)w.document.write('<p style="font:16px sans-serif;padding:24px">Abriendo el pago seguro de Wompi…</p>');return w;}
function openPayment(tab,url){if(tab&&!tab.closed){tab.location.href=url;toast('El pago se abrió en otra pestaña. Esta sesión se actualiza sola.');}else location.assign(url);}

// Gestures: one finger looks around (exactly, with limits), two fingers pinch, a tap touches an object.
const gesture=new StudioGesture({look:(dx,dy)=>{studio?.lookAround(dx,dy);},start:()=>studio?.beginLook(),end:(vx,vy)=>studio?.endLook(vx,vy),zoom:ratio=>studio?.zoomBy(ratio),pick:(x,y)=>onAction(studio?.pick(x,y)?.action)});
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
function syncPlayer(){const on=!audio.paused;studio?.setPlaying(on?playing:-1);document.body.classList.toggle('sound-on',on);$('#audio-dock').classList.toggle('is-playing',on);$('#sound-toggle').setAttribute('aria-pressed',String(on));$('#sound-toggle').setAttribute('aria-label',on?'Pausar canción':'Reproducir una canción');const t=$('#player-toggle');t.innerHTML=ic(on?'pause':'play');t.setAttribute('aria-label',on?'Pausar canción':'Reproducir canción');if(view==='samples')root.querySelectorAll('.track').forEach((b,i)=>{const p=i===playing&&on;b.classList.toggle('playing',p);b.setAttribute('aria-label',`${p?'Pausar':'Escuchar'} ${tracks[i].name}`);b.querySelector('.play').innerHTML=ic(p?'pause':'play');});}
async function playTrack(index){if(!tracks.length){toast('Pronto encontrarás canciones aquí.');return;}index=(index+tracks.length)%tracks.length;if(playing===index&&!audio.paused){audio.pause();return;}const changed=playing!==index;playing=index;const t=tracks[index];if(changed||!audio.src)audio.src=t.audio||'assets/audio/'+t.file+'.mp3';$('#track-name').textContent=t.name;$('.dock-cover').style.backgroundImage=`url("${t.cover||'assets/images/covers/'+t.file+'.webp'}")`;$('#track-genre').textContent=t.genre;$('#audio-dock').hidden=false;requestAnimationFrame(frameStudio);document.body.classList.add('audio-open');if(changed)paintSeek(0);try{studio?.connectAudio(audio);await audio.play();}catch{toast('No se pudo reproducir esta canción. Inténtalo otra vez.');}syncPlayer();}
const seekEl=$('#audio-seek');let seeking=false;
function paintSeek(ratio){ratio=Math.max(0,Math.min(1,ratio||0));seekEl.style.setProperty('--p',(ratio*100).toFixed(2)+'%');seekEl.setAttribute('aria-valuenow',String(Math.round(ratio*100)));seekEl.setAttribute('aria-valuetext',`${clock(ratio*audio.duration)} de ${clock(audio.duration)}`);$('#audio-time').textContent=clock(ratio*(audio.duration||0));}
const ratioAt=e=>{const r=seekEl.getBoundingClientRect();return (e.clientX-r.left)/r.width;};
seekEl.addEventListener('pointerdown',e=>{if(!Number.isFinite(audio.duration))return;seeking=true;seekEl.setPointerCapture(e.pointerId);seekEl.classList.add('dragging');paintSeek(ratioAt(e));});
seekEl.addEventListener('pointermove',e=>{if(seeking)paintSeek(ratioAt(e));});
const endSeek=e=>{if(!seeking)return;seeking=false;seekEl.classList.remove('dragging');const r=Math.max(0,Math.min(1,ratioAt(e)));audio.currentTime=r*audio.duration;paintSeek(r);};
seekEl.addEventListener('pointerup',endSeek);seekEl.addEventListener('pointercancel',()=>{seeking=false;seekEl.classList.remove('dragging');});
seekEl.addEventListener('keydown',e=>{if(!Number.isFinite(audio.duration))return;const step={ArrowRight:5,ArrowLeft:-5,ArrowUp:10,ArrowDown:-10}[e.key];if(step===undefined&&!['Home','End'].includes(e.key))return;e.preventDefault();audio.currentTime=e.key==='Home'?0:e.key==='End'?audio.duration-1:Math.max(0,Math.min(audio.duration,audio.currentTime+step));});
$('#player-toggle').onclick=()=>{if(audio.paused)playTrack(playing<0?0:playing);else audio.pause();};
// "Previous" restarts the song first, like any music app; a second press goes back one track.
$('#player-prev').onclick=()=>{if(audio.currentTime>3){audio.currentTime=0;return;}playTrack(playing-1);};
$('#player-next').onclick=()=>playTrack(playing+1);
$('#player-close').onclick=()=>{audio.pause();$('#audio-dock').hidden=true;document.body.classList.remove('audio-open');requestAnimationFrame(frameStudio);};
$('#sound-toggle').onclick=()=>{if(audio.paused)playTrack(playing<0?0:playing);else audio.pause();};
audio.ontimeupdate=()=>{if(!seeking&&audio.duration)paintSeek(audio.currentTime/audio.duration);};
audio.onloadedmetadata=audio.ondurationchange=()=>{$('#audio-duration').textContent=clock(audio.duration);};
audio.onprogress=()=>{if(audio.duration&&audio.buffered.length)seekEl.style.setProperty('--b',(audio.buffered.end(audio.buffered.length-1)/audio.duration*100).toFixed(1)+'%');};
audio.onplay=audio.onpause=syncPlayer;
audio.onended=()=>playTrack(playing+1);
$('#player-toggle').innerHTML=ic('play');

async function loadOrder(ref){currentOrder=(await api('order',null,'&reference='+encodeURIComponent(ref))).order;go('session');}
async function start(){try{boot=await api('bootstrap');if(Array.isArray(boot.tracks))tracks=boot.tracks;if(!catalogPerson().some(p=>p.code===draft.product))draft.product='personalizada';studio=new Studio($('#studio'));if(studio.light)document.body.classList.add('light-mode');studio.setContent(buildContent(boot,tracks,money));studio.setTracks(tracks);studio.setDraft(draft);if(draft.mood)studio.tone(draft.mood);hydrateIcons();render();frameStudio();if(studio.light)openOptions();
 if(new URLSearchParams(location.search).has('e2e'))window.__fhb={studio,go,draft:()=>draft,view:()=>view,onAction};
 const params=new URLSearchParams(location.search);const ref=params.get('session');if(ref){const hash=new URLSearchParams(location.hash.slice(1));const token=hash.get('token');if(token){await api('exchange',{reference:ref,token});history.replaceState({},'',`?session=${encodeURIComponent(ref)}`);}if(params.get('id')){try{await api('reconcile',{reference:ref,transaction:params.get('id')});}catch(e){toast(e.message);}}await loadOrder(ref);}}catch(e){if(boot){go('recover');toast(e.message);}else{root.innerHTML=shell({head:`<h1 id="panel-title">El estudio está <em>tomando aire.</em></h1>`,body:`<p class="lede">${esc(e.message)}</p>`,foot:`<button class="primary" id="retry-start">Volver a intentar ↻</button>`});mountOptions();openOptions();$('#retry-start').onclick=start;}}}
start();
// While a payment is open, check its result often (the server asks Wompi) and celebrate when it is approved.
let lastOrderPoll=0;
const pollOrder=async()=>{if(view!=='session'||!currentOrder||document.hidden||document.activeElement?.matches('input,textarea')||[...root.querySelectorAll('audio')].some(a=>!a.paused))return;const pending=['created','payment_pending'].includes(currentOrder.status);if(Date.now()-lastOrderPoll<(pending?4000:20000))return;lastOrderPoll=Date.now();const signature=o=>JSON.stringify([o.status,o.production_stage,o.files,o.history]);const before=currentOrder;try{const o=(await api('order',null,'&reference='+encodeURIComponent(currentOrder.reference))).order;if(signature(o)!==signature(before)){currentOrder=o;render(false);if(o.status==='paid'&&before.status!=='paid'){toast('¡Pago confirmado! Tu canción entra a producción.');studio?.celebrate();}}}catch{}};
setInterval(pollOrder,5000);addEventListener('focus',pollOrder);

// Compact application navigation, with native modal focus containment and Escape support.
const menu=$('#studio-menu');
function closeMenu(){if(menu?.open)menu.close();$('#menu-toggle')?.setAttribute('aria-expanded','false');}
$('#menu-toggle').onclick=()=>{menu.showModal();$('#menu-toggle').setAttribute('aria-expanded','true');};
$('#menu-close').onclick=closeMenu;
menu.addEventListener('close',()=>$('#menu-toggle').setAttribute('aria-expanded','false'));
menu.addEventListener('click',e=>{if(e.target===menu)closeMenu();});
$('#quality-toggle').onclick=()=>{if(!studio)return;studio.setLight(!studio.light);document.body.classList.toggle('light-mode',studio.light);if(studio.light)openOptions();else closeOptions();sync3D();$('#quality-toggle').textContent=studio.light?'Activar estudio 3D':'Usar modo ligero';requestAnimationFrame(frameStudio);};
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
