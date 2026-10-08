<?php
declare(strict_types=1);
// HTTP surface of the growth layer. Public: prices (in bootstrap), coupon-check, track, open pixel. Everything else is admin().

function growthPixel(): never {
 if(preg_match('/^[a-f0-9]{32}$/D',(string)($_GET['t']??''))&&growthEnsure())campaignOpened((string)$_GET['t']);
 header('Content-Type: image/gif');header('Cache-Control: no-store');http_response_code(200);
 echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');exit;
}
function adminDays(): int { return max(1,min(365,(int)($_GET['days']??30))); }
function pct(int $a,int $b): float { return $b>0?round($a*100/$b,1):0.0; }
function dayList(int $days): array { $o=[];for($i=$days-1;$i>=0;$i--)$o[]=gmdate('Y-m-d',time()-$i*86400);return $o; }

/** Everything the "Resumen" tab shows, computed in a handful of grouped queries. Money in cents. */
function growthOverview(int $days): array {
 $since=gmdate('Y-m-d H:i:s',time()-$days*86400);$paid=inList(PAID_STATES);$when='COALESCE(o.paid_at,o.created_at)';
 $k=sql("SELECT COUNT(*) n,COALESCE(SUM(o.amount_in_cents),0) rev,COALESCE(SUM(o.discount_in_cents),0) disc,COALESCE(SUM(o.is_repeat),0) rep FROM orders o WHERE o.status IN ($paid) AND $when>=?",array_merge(PAID_STATES,[$since]))->fetch();
 $n=(int)$k['n'];$rev=(int)$k['rev'];
 $daily=[];foreach(sql("SELECT substr($when,1,10) d,COUNT(*) n,COALESCE(SUM(o.amount_in_cents),0) rev FROM orders o WHERE o.status IN ($paid) AND $when>=? GROUP BY substr($when,1,10)",array_merge(PAID_STATES,[$since]))->fetchAll() as $r)$daily[$r['d']]=$r;
 $series=array_map(fn($d)=>['day'=>$d,'orders'=>(int)($daily[$d]['n']??0),'revenue'=>(int)($daily[$d]['rev']??0)],dayList(min($days,90)));
 // funnel: distinct visitors per step
 $fn=[];foreach(sql("SELECT name,COUNT(DISTINCT visitor_id) v FROM events WHERE created_at>=? AND name IN ('view','select_product','begin_checkout','order_created','purchase') GROUP BY name",[$since])->fetchAll() as $r)$fn[$r['name']]=(int)$r['v'];
 // the last two steps come from the orders themselves (a purchase is a fact, not a browser event)
 $fn['order_created']=(int)sql("SELECT COUNT(DISTINCT COALESCE(NULLIF(visitor_id,''),reference)) FROM orders WHERE created_at>=?",[$since])->fetchColumn();
 $fn['purchase']=(int)sql("SELECT COUNT(DISTINCT COALESCE(NULLIF(o.visitor_id,''),o.reference)) FROM orders o WHERE o.status IN ($paid) AND $when>=?",array_merge(PAID_STATES,[$since]))->fetchColumn();
 $funnel=[];foreach([['view','Visitaron el estudio'],['select_product','Eligieron una experiencia'],['begin_checkout','Llegaron al pago'],['order_created','Guardaron su pedido'],['purchase','Pagaron']] as [$key,$label])$funnel[]=['key'=>$key,'label'=>$label,'visitors'=>$fn[$key]??0];
 $first=max(1,$funnel[0]['visitors']);foreach($funnel as &$f)$f['pct']=pct($f['visitors'],$first);unset($f);
 // where the money comes from (last touch)
 $src=sql("SELECT COALESCE(NULLIF(o.last_source,''),'directo') s,COALESCE(NULLIF(o.last_campaign,''),'') c,COUNT(*) n,COALESCE(SUM(o.amount_in_cents),0) rev FROM orders o WHERE o.status IN ($paid) AND $when>=? GROUP BY COALESCE(NULLIF(o.last_source,''),'directo'),COALESCE(NULLIF(o.last_campaign,''),'') ORDER BY rev DESC LIMIT 12",array_merge(PAID_STATES,[$since]))->fetchAll();
 $vis=[];foreach(sql("SELECT COALESCE(NULLIF(utm_source,''),'directo') s,COUNT(DISTINCT visitor_id) v FROM events WHERE name='view' AND created_at>=? GROUP BY COALESCE(NULLIF(utm_source,''),'directo')",[$since])->fetchAll() as $r)$vis[$r['s']]=(int)$r['v'];
 // audience
 $a=sql("SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN email_optin=1 AND email_unsub_at IS NULL THEN 1 ELSE 0 END),0) opt,COALESCE(SUM(CASE WHEN email_unsub_at IS NOT NULL THEN 1 ELSE 0 END),0) unsub,COALESCE(SUM(CASE WHEN sms_optin=1 AND sms_unsub_at IS NULL THEN 1 ELSE 0 END),0) sms,COALESCE(SUM(CASE WHEN orders_paid>=1 THEN 1 ELSE 0 END),0) buyers,COALESCE(SUM(CASE WHEN orders_paid>=2 THEN 1 ELSE 0 END),0) repeaters,COALESCE(SUM(spent_in_cents),0) spent FROM contacts")->fetch();
 $newOpt=(int)sql("SELECT COUNT(*) FROM contacts WHERE email_optin_at>=?",[$since])->fetchColumn();
 // coupons and campaigns
 $cp=sql("SELECT cp.code,cp.label,COUNT(*) n,COALESCE(SUM(r.discount_in_cents),0) disc,COALESCE(SUM(o.amount_in_cents),0) rev FROM coupon_redemptions r JOIN coupons cp ON cp.id=r.coupon_id JOIN orders o ON o.id=r.order_id WHERE r.status='applied' AND r.created_at>=? GROUP BY cp.id,cp.code,cp.label ORDER BY n DESC LIMIT 8",[$since])->fetchAll();
 $camps=sql("SELECT c.id,c.name,c.channel,c.status,COUNT(s.id) sent,COALESCE(SUM(CASE WHEN s.opened_at IS NOT NULL THEN 1 ELSE 0 END),0) opened,COALESCE(SUM(CASE WHEN s.clicked_at IS NOT NULL THEN 1 ELSE 0 END),0) clicked,COALESCE(SUM(CASE WHEN s.converted_order_id IS NOT NULL THEN 1 ELSE 0 END),0) orders FROM campaigns c LEFT JOIN campaign_sends s ON s.campaign_id=c.id WHERE c.created_at>=? GROUP BY c.id,c.name,c.channel,c.status ORDER BY c.id DESC LIMIT 8",[$since])->fetchAll();
 foreach($camps as &$c){$c['open_rate']=pct((int)$c['opened'],(int)$c['sent']);$c['click_rate']=pct((int)$c['clicked'],(int)$c['sent']);$c['revenue']=(int)sql("SELECT COALESCE(SUM(o.amount_in_cents),0) FROM campaign_sends s JOIN orders o ON o.id=s.converted_order_id WHERE s.campaign_id=?",[$c['id']])->fetchColumn();}unset($c);
 $auto=sql("SELECT a.akey,a.name,a.enabled,COUNT(r.id) sent,COALESCE(SUM(CASE WHEN r.clicked_at IS NOT NULL THEN 1 ELSE 0 END),0) clicked,COALESCE(SUM(CASE WHEN r.converted_order_id IS NOT NULL THEN 1 ELSE 0 END),0) orders FROM automations a LEFT JOIN automation_runs r ON r.automation_id=a.id AND r.created_at>=? GROUP BY a.id,a.akey,a.name,a.enabled",[$since])->fetchAll();
 return ['days'=>$days,'kpi'=>['orders'=>$n,'revenue'=>$rev,'aov'=>$n?intdiv($rev,$n):0,'discounts'=>(int)$k['disc'],'repeat_orders'=>(int)$k['rep'],'repeat_share'=>pct((int)$k['rep'],$n),
   'conversion'=>min(100.0,pct($fn['purchase']??0,max(1,$fn['view']??0)))],
  'series'=>$series,'funnel'=>$funnel,'funnel_note'=>($fn['view']??0)<($fn['order_created']??0)?'Las visitas se cuentan solo desde que se activó la medición en el sitio; por eso puede haber más pedidos que visitas en los primeros días.':'',
  'sources'=>array_map(fn($r)=>['source'=>$r['s'],'campaign'=>$r['c'],'orders'=>(int)$r['n'],'revenue'=>(int)$r['rev'],'visitors'=>$vis[$r['s']]??null],$src),
  'audience'=>['contacts'=>(int)$a['total'],'email_optin'=>(int)$a['opt'],'unsubscribed'=>(int)$a['unsub'],'sms_optin'=>(int)$a['sms'],'buyers'=>(int)$a['buyers'],'repeaters'=>(int)$a['repeaters'],'repeat_rate'=>pct((int)$a['repeaters'],(int)$a['buyers']),'ltv'=>(int)$a['buyers']?intdiv((int)$a['spent'],(int)$a['buyers']):0,'new_optin'=>$newOpt],
  'coupons'=>$cp,'campaigns'=>$camps,'automations'=>$auto];
}

function csvCell(mixed $v): string { $s=(string)$v;$t=ltrim($s," \t\r\n\0");if($t!==''&&strpos("=+-@",$t[0])!==false)$s="'".$s;return '"'.str_replace('"','""',$s).'"'; }

function gfield(array $in,string $key,string $label,int $min,int $max): string {
 try{return field($in,$key,$min,$max);}catch(HttpError $e){throw new HttpError(422,'Revisa «'.$label.'»: debe tener entre '.$min.' y '.$max.' caracteres.');}
}
function cheapestPerson(): int { return min(array_map(fn($p)=>(int)$p['price'],array_filter(catalog(),fn($p)=>$p['audience']==='person'))); }
function datesOrder(?string $a,?string $b): void { need($a===null||$b===null||strtotime($b.' UTC')>strtotime($a.' UTC'),'La fecha de fin debe ser posterior a la de inicio.'); }
function couponInput(array $in): array {
 need(preg_match('/^[A-Za-z0-9_-]{3,40}$/D',trim((string)($in['code']??'')))===1,'El código debe tener entre 3 y 40 letras, números, guion o guion bajo, sin espacios.');$code=couponCode((string)$in['code']);
 $kind=($in['kind']??'')==='fixed'?'fixed':'percent';$value=filter_var($in['value']??null,FILTER_VALIDATE_INT);need($value!==false&&$value>0,'Escribe el valor del descuento.');
 if($kind==='percent')need($value<=90,'Un descuento no puede pasar del 90 %.');else {$value*=100;need($value<cheapestPerson()-PRICE_FLOOR,'Un descuento fijo no puede dejar la experiencia más barata por debajo de '.mailMoney(PRICE_FLOOR).'.');}   // fixed values are typed in COP
 $date=function(string $k)use($in):?string{$v=trim((string)($in[$k]??''));if($v==='')return null;$t=strtotime($v.' UTC');need($t!==false,'Fecha inválida.');return gmdate('Y-m-d H:i:s',$t);};
 $prods=array_values(array_filter(array_map('trim',(array)($in['product_codes']??[])),fn($c)=>is_string($c)&&isset(catalog()[$c])));
 $int=fn($k,$d=null)=>isset($in[$k])&&$in[$k]!==''&&is_numeric($in[$k])?max(0,min(1000000000,(int)$in[$k])):$d;
 datesOrder($date('starts_at'),$date('ends_at'));
 return ['code'=>$code,'label'=>mb_substr(trim((string)($in['label']??'')),0,120),'kind'=>$kind,'value'=>$value,'min'=>($int('min_cop',0))*100,'cap'=>$int('max_discount_cop')?$int('max_discount_cop')*100:null,
  'products'=>$prods?implode(',',$prods):null,'first'=>!empty($in['first_order_only'])?1:0,'returning'=>!empty($in['returning_only'])?1:0,'starts'=>$date('starts_at'),'ends'=>$date('ends_at'),
  'max'=>$int('max_redemptions'),'per'=>max(1,$int('per_contact_limit',1)),'stackable'=>!empty($in['stackable'])?1:0,'active'=>array_key_exists('active',$in)?(!empty($in['active'])?1:0):1];
}

function growthRoute(string $action,string $method): void {
 // ---- public
 if($action==='coupon-check'&&$method==='POST'){
  rate('coupon',20,600);$in=input();growthEnsure()||throw new HttpError(503,'Los descuentos aún no están disponibles.');
  $code=field($in,'product',1,40);$q=priceQuote($code,(string)($in['coupon']??''),isset($in['email'])&&is_string($in['email'])?strtolower(trim($in['email'])):null);
  trackInsert(is_string($in['v']??null)&&preg_match('/^[A-Za-z0-9_-]{16,40}$/D',$in['v'])?$in['v']:str_repeat('0',16),$q['coupon_error']===null&&$q['coupon']?'coupon_ok':'coupon_try',['props'=>['product'=>$code]]);
  jsonResponse(['quote'=>quoteView($q)]);
 }
 if($action==='track'&&$method==='POST'){rate('track',240,600);jsonResponse(['n'=>trackBatch(input())]);}
 static $mine=['admin-growth-setup','admin-growth-overview','admin-coupons','admin-coupon-save','admin-promos','admin-promo-save','admin-contacts','admin-contact','admin-contact-optout','admin-contacts-export','admin-segment-preview','admin-campaigns','admin-campaign-save','admin-campaign-test','admin-campaign-send','admin-campaign-cancel','admin-automations','admin-automation-save','admin-run-marketing'];
 if(!in_array($action,$mine,true))return;
 // ---- admin
 $aid=admin();
 if($action==='admin-growth-setup'&&$method==='POST'){$added=growthMigrate();@file_put_contents(storage().'/growth-schema-'.GROWTH_SCHEMA.'.ok',nowUtc());jsonResponse(['ok'=>true,'added'=>$added]);}
 growthEnsure()||throw new HttpError(503,'No se pudo preparar la base de datos de crecimiento. Revisa los permisos del usuario de la base de datos.');
 if($action==='admin-growth-overview'&&$method==='GET')jsonResponse(growthOverview(adminDays()));
 if($action==='admin-coupons'&&$method==='GET'){
  $rows=sql('SELECT cp.*,(SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id=cp.id AND r.status=\'applied\') used FROM coupons cp WHERE cp.contact_id IS NULL ORDER BY cp.id DESC LIMIT 200')->fetchAll();
  jsonResponse(['coupons'=>$rows,'products'=>array_values(array_map(fn($p)=>['code'=>$p['code'],'name'=>$p['name']],array_filter(catalog(),fn($p)=>$p['audience']==='person'))),'personal'=>(int)sql('SELECT COUNT(*) FROM coupons WHERE contact_id IS NOT NULL')->fetchColumn()]);
 }
 if($action==='admin-coupon-save'&&$method==='POST'){
  $in=input();$d=couponInput($in);$id=(int)($in['id']??0);
  if($id){sql('UPDATE coupons SET code=?,label=?,kind=?,value=?,min_amount_in_cents=?,max_discount_in_cents=?,product_codes=?,first_order_only=?,returning_only=?,starts_at=?,ends_at=?,max_redemptions=?,per_contact_limit=?,stackable=?,active=? WHERE id=? AND contact_id IS NULL',
   [$d['code'],$d['label'],$d['kind'],$d['value'],$d['min'],$d['cap'],$d['products'],$d['first'],$d['returning'],$d['starts'],$d['ends'],$d['max'],$d['per'],$d['stackable'],$d['active'],$id]);}
  else{need(!sql('SELECT id FROM coupons WHERE code=?',[$d['code']])->fetch(),'Ya existe un cupón con ese código.',409);
   sql('INSERT INTO coupons(code,label,kind,value,min_amount_in_cents,max_discount_in_cents,product_codes,first_order_only,returning_only,starts_at,ends_at,max_redemptions,per_contact_limit,stackable,active,source,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
   [$d['code'],$d['label'],$d['kind'],$d['value'],$d['min'],$d['cap'],$d['products'],$d['first'],$d['returning'],$d['starts'],$d['ends'],$d['max'],$d['per'],$d['stackable'],$d['active'],'manual',nowUtc()]);}
  jsonResponse(['ok'=>true],201);
 }
 if($action==='admin-promos'&&$method==='GET')jsonResponse(['promos'=>sql('SELECT * FROM promotions ORDER BY active DESC,id DESC LIMIT 100')->fetchAll(),'products'=>array_values(array_map(fn($p)=>['code'=>$p['code'],'name'=>$p['name'],'price'=>$p['price']],array_filter(catalog(),fn($p)=>$p['audience']==='person')))]);
 if($action==='admin-promo-save'&&$method==='POST'){
  $in=input();$id=(int)($in['id']??0);$name=gfield($in,'name','Nombre',2,120);$kind=($in['kind']??'')==='fixed'?'fixed':'percent';$value=filter_var($in['value']??null,FILTER_VALIDATE_INT);need($value!==false&&$value>0,'Escribe el valor del descuento.');
  if($kind==='percent')need($value<=90,'Un descuento no puede pasar del 90 %.');else{$value*=100;need($value<cheapestPerson()-PRICE_FLOOR,'Un descuento fijo no puede dejar la experiencia más barata por debajo de '.mailMoney(PRICE_FLOOR).'.');}
  $date=function(string $k)use($in):?string{$v=trim((string)($in[$k]??''));if($v==='')return null;$t=strtotime($v.' UTC');need($t!==false,'Fecha inválida.');return gmdate('Y-m-d H:i:s',$t);};datesOrder($date('starts_at'),$date('ends_at'));
  $prods=array_values(array_filter(array_map('trim',(array)($in['product_codes']??[])),fn($c)=>is_string($c)&&isset(catalog()[$c])));
  $row=[$name,$kind,$value,$prods?implode(',',$prods):null,mb_substr(trim((string)($in['badge']??'')),0,40),mb_substr(trim((string)($in['banner']??'')),0,200),$date('starts_at'),$date('ends_at'),!empty($in['active'])?1:0,(int)($in['priority']??0)];
  if($id)sql('UPDATE promotions SET name=?,kind=?,value=?,product_codes=?,badge=?,banner=?,starts_at=?,ends_at=?,active=?,priority=? WHERE id=?',array_merge($row,[$id]));
  else sql('INSERT INTO promotions(name,kind,value,product_codes,badge,banner,starts_at,ends_at,active,priority,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',array_merge($row,[nowUtc()]));
  jsonResponse(['ok'=>true],201);
 }
 if($action==='admin-contacts'&&$method==='GET'){
  $q=trim((string)($_GET['q']??''));$f=(string)($_GET['f']??'all');$page=max(0,min(100000,(int)($_GET['page']??0)));$w=['1=1'];$p=[];
  if($q!==''){$w[]='(c.email LIKE ? OR c.name LIKE ?)';$like='%'.str_replace(['%','_'],'',$q).'%';array_push($p,$like,$like);}
  $w[]=match($f){'optin'=>'c.email_optin=1 AND c.email_unsub_at IS NULL','unsub'=>'c.email_unsub_at IS NOT NULL','buyers'=>'c.orders_paid>=1','repeat'=>'c.orders_paid>=2','leads'=>'c.orders_paid=0',default=>'1=1'};
  $where=implode(' AND ',$w);$total=(int)sql("SELECT COUNT(*) FROM contacts c WHERE $where",$p)->fetchColumn();
  $rows=sql("SELECT c.id,c.name,c.email,c.phone,c.email_optin,c.email_unsub_at,c.sms_optin,c.sms_unsub_at,c.orders_paid,c.spent_in_cents,c.last_order_at,c.first_source,c.created_at FROM contacts c WHERE $where ORDER BY c.id DESC LIMIT 25 OFFSET ".($page*25),$p)->fetchAll();
  jsonResponse(['total'=>$total,'page'=>$page,'contacts'=>$rows]);
 }
 if($action==='admin-contact'&&$method==='GET'){
  $id=(int)($_GET['id']??0);$c=sql('SELECT * FROM contacts WHERE id=?',[$id])->fetch();need((bool)$c,'Contacto no encontrado.',404);
  jsonResponse(['contact'=>$c,'orders'=>sql('SELECT reference,product_name,amount_in_cents,discount_in_cents,coupon_code,status,created_at FROM orders WHERE contact_id=? ORDER BY id DESC LIMIT 30',[$id])->fetchAll(),
   'consent'=>sql('SELECT channel,action,source,text_version,created_at FROM consent_log WHERE contact_id=? ORDER BY id DESC LIMIT 30',[$id])->fetchAll(),
   'messages'=>sql("SELECT c.name,s.channel,s.sent_at,s.opened_at,s.clicked_at,s.converted_order_id FROM campaign_sends s JOIN campaigns c ON c.id=s.campaign_id WHERE s.contact_id=? ORDER BY s.id DESC LIMIT 20",[$id])->fetchAll()]);
 }
 if($action==='admin-contact-optout'&&$method==='POST'){   // the team can honour a request received by phone/WhatsApp
  $in=input();$id=(int)($in['id']??0);need((bool)sql('SELECT id FROM contacts WHERE id=?',[$id])->fetch(),'Contacto no encontrado.',404);$ch=($in['channel']??'email')==='sms'?'sms':'email';
  consentSet($id,$ch,false,'admin:'.$aid);jsonResponse(['ok'=>true]);
 }
 if($action==='admin-contacts-export'&&$method==='GET'){
  header('Content-Type: text/csv; charset=utf-8');header('Content-Disposition: attachment; filename="contactos-fromheartbeat.csv"');echo "\xEF\xBB\xBF";
  echo implode(',',array_map('csvCell',['correo','nombre','telefono','acepta_email','baja_email','acepta_sms','compras_pagadas','gastado_cop','ultima_compra','origen','creado']))."\r\n";
  foreach(sql('SELECT * FROM contacts ORDER BY id')->fetchAll() as $c)echo implode(',',array_map('csvCell',[$c['email'],$c['name'],$c['phone'],canMarket($c)?'si':'no',$c['email_unsub_at']??'',canMarket($c,'sms')?'si':'no',$c['orders_paid'],intdiv((int)$c['spent_in_cents'],100),$c['last_order_at']??'',$c['first_source']??'',$c['created_at']]))."\r\n";
  exit;
 }
 if($action==='admin-segment-preview'&&$method==='POST'){
  $in=input();$seg=segmentClean($in['segment']??[]);$ch=($in['channel']??'email')==='sms'?'sms':'email';
  $sample=array_map(fn($c)=>['name'=>mb_substr((string)$c['name'],0,30),'email'=>preg_replace('/^(.).*(@.*)$/u','$1•••$2',(string)$c['email'])],audienceRows($seg,$ch,5));
  jsonResponse(['count'=>audienceCount($seg,$ch),'capped'=>cappedCount($seg,$ch),'cap_days'=>marketingCapDays(),'sample'=>$sample]);
 }
 if($action==='admin-campaigns'&&$method==='GET'){
  $rows=sql('SELECT c.*,(SELECT COUNT(*) FROM campaign_sends s WHERE s.campaign_id=c.id) sent,(SELECT COUNT(*) FROM campaign_sends s WHERE s.campaign_id=c.id AND s.opened_at IS NOT NULL) opened,(SELECT COUNT(*) FROM campaign_sends s WHERE s.campaign_id=c.id AND s.clicked_at IS NOT NULL) clicked,(SELECT COUNT(*) FROM campaign_sends s WHERE s.campaign_id=c.id AND s.converted_order_id IS NOT NULL) orders FROM campaigns c ORDER BY c.id DESC LIMIT 50')->fetchAll();
  jsonResponse(['legal_ready'=>env('LEGAL_NAME')!==''&&env('LEGAL_TAX_ID')!==''&&env('LEGAL_ADDRESS')!=='','campaigns'=>$rows,'coupons'=>sql('SELECT id,code,label FROM coupons WHERE contact_id IS NULL AND active=1 ORDER BY id DESC LIMIT 100')->fetchAll(),'sms_driver'=>smsDriver(),'mail_ready'=>env('MAIL_TRANSPORT')==='smtp','cap_days'=>marketingCapDays()]);
 }
 if($action==='admin-campaign-save'&&$method==='POST'){
  $in=input();$id=(int)($in['id']??0);$ch=($in['channel']??'email')==='sms'?'sms':'email';
  if($id)need(in_array(campaignRow($id)['status'],['draft','scheduled'],true),'Una campaña enviada ya no se edita. Duplícala.',409);
  $name=gfield($in,'name','Nombre interno',2,120);$subject=$ch==='email'?gfield($in,'subject','Asunto',3,150):'';$title=$ch==='email'?gfield($in,'title','Título',3,150):'';$body=gfield($in,'body','Mensaje',3,$ch==='sms'?300:4000);
  $cta=mb_substr(trim((string)($in['cta_label']??'')),0,40);$path=safePath((string)($in['cta_path']??'/'));$pre=mb_substr(trim((string)($in['preheader']??'')),0,150);
  $couponId=isset($in['coupon_id'])&&is_numeric($in['coupon_id'])&&(int)$in['coupon_id']>0?(int)$in['coupon_id']:null;if($couponId)need((bool)sql('SELECT id FROM coupons WHERE id=? AND contact_id IS NULL',[$couponId])->fetch(),'Cupón no encontrado.');
  $pc=null;if(is_array($in['personal_coupon']??null)&&(int)($in['personal_coupon']['value']??0)>0){$t=$in['personal_coupon'];$pc=json_encode(['kind'=>($t['kind']??'')==='fixed'?'fixed':'percent','value'=>($t['kind']??'')==='fixed'?(int)$t['value']*100:min(60,(int)$t['value']),'valid_days'=>max(1,min(180,(int)($t['valid_days']??30)))]);}
  $seg=json_encode(segmentClean($in['segment']??[]),JSON_UNESCAPED_UNICODE);$sched=null;if(!empty($in['scheduled_at'])){$t=strtotime((string)$in['scheduled_at'].' UTC');need($t!==false&&$t>time(),'La fecha de envío debe estar en el futuro.');$sched=gmdate('Y-m-d H:i:s',$t);}
  $status=$sched?'scheduled':'draft';
  if($id)sql('UPDATE campaigns SET name=?,channel=?,subject=?,preheader=?,title=?,body=?,cta_label=?,cta_path=?,coupon_id=?,personal_coupon=?,segment=?,status=?,scheduled_at=? WHERE id=?',[$name,$ch,$subject,$pre,$title,$body,$cta,$path,$couponId,$pc,$seg,$status,$sched,$id]);
  else{sql('INSERT INTO campaigns(name,channel,subject,preheader,title,body,cta_label,cta_path,coupon_id,personal_coupon,segment,status,scheduled_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[$name,$ch,$subject,$pre,$title,$body,$cta,$path,$couponId,$pc,$seg,$status,$sched,nowUtc()]);$id=(int)db()->lastInsertId();}
  jsonResponse(['ok'=>true,'id'=>$id],201);
 }
 if($action==='admin-campaign-test'&&$method==='POST'){
  rate('camptest',10,600);$in=input();$admin=(string)sql('SELECT email FROM admins WHERE id=?',[$aid])->fetchColumn();$to=strtolower(trim((string)($in['email']??''))?:$admin);need((bool)filter_var($to,FILTER_VALIDATE_EMAIL),'Escribe un correo válido.');
  need($to===strtolower($admin)||$to===strtolower(env('TEAM_EMAIL')),'Las pruebas solo se envían al correo del administrador o al del equipo.');
  campaignTest((int)($in['id']??0),$to);jsonResponse(['ok'=>true]);
 }
 if($action==='admin-campaign-send'&&$method==='POST'){
  rate('campsend',10,3600);$in=input();$id=(int)($in['id']??0);$camp=campaignRow($id);need(in_array($camp['status'],['draft','scheduled'],true),'Esta campaña ya se envió.',409);
  need(($in['confirm']??false)===true,'Confirma el envío.');
  if($camp['channel']==='email')need(env('MAIL_TRANSPORT')==='smtp'||testMode(),'Configura el correo (SMTP) antes de enviar campañas.',503);
  need(testMode()||(env('LEGAL_NAME')!==''&&env('LEGAL_TAX_ID')!==''&&env('LEGAL_ADDRESS')!==''),'Antes de enviar promociones completa los datos del negocio (nombre legal, NIT y dirección) en la configuración: salen en el pie de cada mensaje.',503);
  jsonResponse(campaignQueue($id));
 }
 if($action==='admin-campaign-cancel'&&$method==='POST'){$id=(int)(input()['id']??0);campaignRow($id);sql("UPDATE campaigns SET status='cancelled' WHERE id=? AND status IN ('draft','scheduled','sending')",[$id]);jsonResponse(['ok'=>true]);}
 if($action==='admin-automations'&&$method==='GET'){jsonResponse(['automations'=>sql('SELECT * FROM automations ORDER BY id')->fetchAll(),'worker'=>env('MAIL_WORKER_ENABLED')==='true']);}
 if($action==='admin-automation-save'&&$method==='POST'){
  $in=input();$a=automationRow(field($in,'akey',3,20));need((bool)$a,'Automatización no encontrada.',404);
  $pc=null;if(is_array($in['personal_coupon']??null)&&(int)($in['personal_coupon']['value']??0)>0){$t=$in['personal_coupon'];$pc=json_encode(['kind'=>($t['kind']??'')==='fixed'?'fixed':'percent','value'=>($t['kind']??'')==='fixed'?(int)$t['value']*100:min(60,(int)$t['value']),'valid_days'=>max(1,min(180,(int)($t['valid_days']??30)))]);}
  sql('UPDATE automations SET enabled=?,delay_hours=?,subject=?,title=?,body=?,cta_label=?,personal_coupon=?,updated_at=? WHERE id=?',[!empty($in['enabled'])?1:0,max(0,min(24*365*3,(int)($in['delay_hours']??$a['delay_hours']))),gfield($in,'subject','Asunto',3,150),gfield($in,'title','Título',3,150),gfield($in,'body','Mensaje',3,2000),mb_substr(trim((string)($in['cta_label']??'')),0,40),$pc,nowUtc(),$a['id']]);
  jsonResponse(['ok'=>true]);
 }
 if($action==='admin-run-marketing'&&$method==='POST'){rate('runmk',20,3600);jsonResponse(['campaigns'=>campaignsDue(),'automations'=>automationsRun(),'sms'=>smsFlush()]);}
}
