<?php
declare(strict_types=1);
// Marketing engine: segments, campaigns (email + SMS), automations. Built on growth.php (contacts, consent, coupons).
// Rules that are NOT configurable, because they keep the business legal and the sender reputation clean:
//   · a promotional message only goes to a contact who opted in on that channel and has not unsubscribed;
//   · every promotional email carries a visible unsubscribe link and the List-Unsubscribe headers;
//   · every send is logged per contact (campaign_sends / automation_runs), so nothing is ever sent twice.

// ------------------------------------------------------------------------------------------------ segments
const SEGMENT_KEYS=['orders_min','orders_max','last_order_days_min','last_order_days_max','spent_min_cop','never_paid','product','tag','source','joined_days_max','include_capped'];
/** Turns the admin's filter object into SQL. Only whitelisted keys, always bound parameters. */
function segmentWhere(array $seg,string $channel='email'): array {
 $w=$channel==='sms'?["c.sms_optin=1","c.sms_unsub_at IS NULL","c.phone<>''"]:["c.email_optin=1","c.email_unsub_at IS NULL"];$p=[];
 $int=fn($k,$max=36500)=>isset($seg[$k])&&$seg[$k]!==''&&is_numeric($seg[$k])?max(0,min($max,(int)$seg[$k])):null;   // bounded: absurd values must not break the worker
 if(($v=$int('orders_min'))!==null){$w[]='c.orders_paid>=?';$p[]=$v;}
 if(($v=$int('orders_max'))!==null){$w[]='c.orders_paid<=?';$p[]=$v;}
 if(($v=$int('last_order_days_min'))!==null){$w[]='c.last_order_at IS NOT NULL AND c.last_order_at<=?';$p[]=gmdate('Y-m-d H:i:s',time()-$v*86400);}
 if(($v=$int('last_order_days_max'))!==null){$w[]='c.last_order_at IS NOT NULL AND c.last_order_at>=?';$p[]=gmdate('Y-m-d H:i:s',time()-$v*86400);}
 if(($v=$int('spent_min_cop',1000000000))!==null){$w[]='c.spent_in_cents>=?';$p[]=$v*100;}
 if(($v=$int('joined_days_max'))!==null){$w[]='c.created_at>=?';$p[]=gmdate('Y-m-d H:i:s',time()-$v*86400);}
 if(!empty($seg['never_paid'])){$w[]='c.orders_paid=0';}
 // contacts who already got a promotion in the last MARKETING_CAP_DAYS days rest, unless the campaign says otherwise
 if(empty($seg['include_capped'])&&marketingCapDays()>0){$w[]='(c.last_marketing_at IS NULL OR c.last_marketing_at<=?)';$p[]=gmdate('Y-m-d H:i:s',time()-marketingCapDays()*86400);}
 if(isset($seg['product'])&&is_string($seg['product'])&&isset(catalog()[$seg['product']])){$w[]="EXISTS(SELECT 1 FROM orders o WHERE o.contact_id=c.id AND o.product_code=? AND o.status IN (".inList(PAID_STATES)."))";$p[]=$seg['product'];array_push($p,...PAID_STATES);}
 if(isset($seg['tag'])&&is_string($seg['tag'])&&trim($seg['tag'])!==''){$w[]='c.tags LIKE ?';$p[]='%'.str_replace(['%','_'],'',trim($seg['tag'])).'%';}
 if(isset($seg['source'])&&is_string($seg['source'])&&trim($seg['source'])!==''){$w[]='c.first_source=?';$p[]=cleanTag($seg['source'])??'';}
 return [implode(' AND ',$w),$p];
}
function segmentClean(mixed $seg): array { $out=[];if(!is_array($seg))return $out;foreach(SEGMENT_KEYS as $k)if(isset($seg[$k])&&$seg[$k]!==''&&$seg[$k]!==false&&$seg[$k]!==null)$out[$k]=is_scalar($seg[$k])?$seg[$k]:null;return array_filter($out,fn($v)=>$v!==null); }
function audienceCount(array $seg,string $channel='email'): int { [$w,$p]=segmentWhere($seg,$channel);return (int)sql("SELECT COUNT(*) FROM contacts c WHERE $w",$p)->fetchColumn(); }
function audienceRows(array $seg,string $channel='email',int $limit=5000,int $after=0): array { [$w,$p]=segmentWhere($seg,$channel);return sql("SELECT c.* FROM contacts c WHERE $w AND c.id>? ORDER BY c.id LIMIT ".(int)$limit,array_merge($p,[$after]))->fetchAll(); }
function marketingCapDays(): int { return max(0,(int)env('MARKETING_CAP_DAYS','3')); }
/** People who match the filters but rest because they got a promotion recently (what the campaign would skip). */
function cappedCount(array $seg,string $channel='email'): int { return audienceCount(array_merge($seg,['include_capped'=>1]),$channel)-audienceCount($seg,$channel); }

// ------------------------------------------------------------------------------------------------ coupons made for one person
function personalCoupon(array $contact,array $tpl,string $source,string $prefix='GRACIAS'): ?array {
 $kind=($tpl['kind']??'percent')==='fixed'?'fixed':'percent';$value=(int)($tpl['value']??0);if($value<=0)return null;
 if($kind==='percent')$value=min(60,$value);
 $days=max(1,min(180,(int)($tpl['valid_days']??30)));
 for($i=0;$i<5;$i++){
  $code=$prefix.'-'.strtoupper(substr(strtr(bin2hex(random_bytes(5)),'01','XY'),0,6));
  try{
   sql('INSERT INTO coupons(code,label,kind,value,product_codes,contact_id,ends_at,max_redemptions,per_contact_limit,active,source,created_at) VALUES(?,?,?,?,?,?,?,1,1,1,?,?)',
    [$code,'Código personal',$kind,$value,$tpl['product_codes']??null,$contact['id'],gmdate('Y-m-d H:i:s',time()+$days*86400),$source,nowUtc()]);
   return sql('SELECT * FROM coupons WHERE code=?',[$code])->fetch()?:null;
  }catch(PDOException $e){/* collision: try another code */}
 }
 return null;
}
function couponSentence(array $cp): string {
 $what=$cp['kind']==='percent'?$cp['value'].'% de descuento':mailMoney((int)$cp['value']).' de descuento';
 $until=$cp['ends_at']!==null?' Vence el '.mailDate($cp['ends_at']).'.':'';
 return $cp['code'].' · '.$what.'.'.$until;
}

// ------------------------------------------------------------------------------------------------ the message
/** '{nombre}' → first name (or nothing); never raw HTML: the engine escapes everything it prints. */
function mkFill(string $s,array $contact,?array $coupon=null): string {
 $first=mailFirstName(['name'=>(string)($contact['name']??'')]);   // letters only: a name typed by a stranger can never carry a link or a line break into our mail
 $s=str_replace(['{nombre}','{cupon}'],[$first,$coupon?$coupon['code']:''],$s);
 return trim((string)preg_replace('/\s+,/u',',',(string)preg_replace('/[ \t]{2,}/u',' ',$s)));
}
/** Only relative paths of this site, so a campaign can never point to somewhere else. */
function safePath(string $path): string {
 $path=trim($path);if($path===''||$path[0]!=='/'||str_starts_with($path,'//')||preg_match('~[\s\\\\<>"]|^/+[^?#]*:~',$path))return '/';
 return mb_substr($path,0,200);
}
function trackedUrl(string $path,string $token,string $campaignName,?string $coupon=null): string {
 $path=safePath($path);$frag='';if(($i=strpos($path,'#'))!==false){$frag=substr($path,$i);$path=substr($path,0,$i);}
 $q='c='.$token.'&utm_source=email&utm_medium=email&utm_campaign='.rawurlencode(cleanTag($campaignName,80)??'campana').($coupon?'&cupon='.rawurlencode($coupon):'');
 return appUrl($path.(str_contains($path,'?')?'&':($path==='/'?'?':'?')).$q.$frag);
}
function legalFoot(string $why): string {
 $legal=array_filter([env('LEGAL_NAME'),env('LEGAL_TAX_ID')!==''?'NIT '.env('LEGAL_TAX_ID'):'',env('LEGAL_ADDRESS')]);
 return $why.($legal?' '.implode(' · ',$legal).'.':'').' Puedes cancelar cuando quieras.';
}
/** Builds the stored mail body for one contact. $promo=true adds the unsubscribe machinery and the opt-in footer. */
function marketingBody(array $contact,array $c,string $token,?array $coupon,bool $promo,?string $sessionUrl=null): array {
 $name=(string)$c['campaign_name'];$subject=mkFill((string)$c['subject'],$contact,$coupon);
 $paras=array_values(array_filter(array_map('trim',preg_split('/\R{2,}/u',mkFill((string)$c['body'],$contact,$coupon))?:[]),fn($x)=>$x!==''));
 $blocks=[];foreach($paras as $i=>$p)$blocks[]=$i===0?['lead'=>$p]:['p'=>$p];
 if($coupon)$blocks[]=['callout'=>['title'=>'Tu código','text'=>couponSentence($coupon)]];
 if(trim((string)$c['cta_label'])!=='')$blocks[]=['cta'=>['label'=>mb_substr((string)$c['cta_label'],0,40),'url'=>$sessionUrl??trackedUrl((string)($c['cta_path']??'/'),$token,$name,$coupon['code']??null)]];
 $unsub=unsubUrl((int)$contact['id']);
 $m=['kind'=>'marketing','subject'=>$subject,'preheader'=>mb_substr(mkFill((string)($c['preheader']??''),$contact,$coupon),0,150),'eyebrow'=>'Fromheartbeat','title'=>mkFill((string)$c['title'],$contact,$coupon),'hero'=>mailHasAsset('hero-update.jpg')?'hero-update.jpg':'','reference'=>'','blocks'=>$blocks];
 if($promo){$m['unsub']=$unsub;$m['foot']=legalFoot('Recibes este correo porque aceptaste recibir ofertas y novedades de Fromheartbeat.');}
 $html=mailBuild($m);
 $pixel='<img src="'.mh(appUrl('/api.php?action=o&t='.$token)).'" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;">';
 $html=str_replace('</body>',$pixel.'</body>',$html);
 $body=($promo?'<!--fhb:unsub='.$unsub."-->\n":'').$html;
 return [$subject,$body];
}
function newToken(): string { return bin2hex(random_bytes(16)); }

// ------------------------------------------------------------------------------------------------ campaigns
function campaignRow(int $id): array { $c=sql('SELECT * FROM campaigns WHERE id=?',[$id])->fetch();need((bool)$c,'Campaña no encontrada.',404);return $c; }
function campaignContent(array $camp): array { $camp['campaign_name']=$camp['name'];return $camp; }
/** Creates one send per eligible contact and queues the message. Re-running it never duplicates (unique per campaign+contact). */
function campaignQueue(int $id,int $max=5000): array {
 growthEnsure();$camp=campaignRow($id);need(in_array($camp['status'],['draft','scheduled','sending'],true),'Esta campaña ya se envió o fue cancelada.',409);
 $seg=json_decode((string)$camp['segment'],true)?:[];$ch=$camp['channel']==='sms'?'sms':'email';
 sql("UPDATE campaigns SET status='sending' WHERE id=?",[$id]);
 $coupon=$camp['coupon_id']?sql('SELECT * FROM coupons WHERE id=?',[$camp['coupon_id']])->fetch():null;$tpl=$camp['personal_coupon']?json_decode((string)$camp['personal_coupon'],true):null;
 $queued=0;$skipped=0;$after=0;
 while($queued+$skipped<$max&&($rows=audienceRows($seg,$ch,500,$after))){
  foreach($rows as $c){
   $after=(int)$c['id'];
   if(sql('SELECT status FROM campaigns WHERE id=?',[$id])->fetchColumn()==='cancelled')return ['queued'=>$queued,'skipped'=>$skipped,'pending'=>false,'cancelled'=>true];
   if(sql('SELECT id FROM campaign_sends WHERE campaign_id=? AND contact_id=?',[$id,$c['id']])->fetch()){$skipped++;continue;}
   $token=newToken();
   try{sql('INSERT INTO campaign_sends(campaign_id,contact_id,channel,token,status,created_at) VALUES(?,?,?,?,?,?)',[$id,$c['id'],$ch,$token,'queued',nowUtc()]);}catch(PDOException $e){$skipped++;continue;}
   $cp=$coupon;if(is_array($tpl)&&$tpl)$cp=personalCoupon($c,$tpl,'campaign:'.$id)??$coupon;
   if($ch==='email'){[$subject,$body]=marketingBody($c,campaignContent($camp),$token,$cp,true);enqueue('camp:'.$id.':'.$c['id'],$c['email'],$subject,$body);}
   else smsEnqueue($c,mkFill((string)$camp['body'],$c,$cp).' '.trackedUrl((string)$camp['cta_path'],$token,(string)$camp['name']),$id,true);
   sql("UPDATE campaign_sends SET status='sent',sent_at=? WHERE token=?",[nowUtc(),$token]);sql('UPDATE contacts SET last_marketing_at=? WHERE id=?',[nowUtc(),$c['id']]);$queued++;
  }
 }
 $left=audienceRows($seg,$ch,1,$after);   // anything beyond $max waits for the next worker pass
 sql("UPDATE campaigns SET status=?,queued_at=? WHERE id=? AND status<>'cancelled'",[$left?'sending':'sent',nowUtc(),$id]);
 return ['queued'=>$queued,'skipped'=>$skipped,'pending'=>(bool)$left];
}
function campaignsDue(): int { $n=0;foreach(sql("SELECT id FROM campaigns WHERE status IN ('scheduled','sending') AND (scheduled_at IS NULL OR scheduled_at<=?)",[nowUtc()])->fetchAll() as $r){campaignQueue((int)$r['id']);$n++;}return $n; }
/** One test message to the admin's own address, with a throw-away token: nothing is recorded against a contact. */
function campaignTest(int $id,string $to,string $adminName='Equipo'): void {
 growthEnsure();$camp=campaignRow($id);$fake=['id'=>0,'name'=>$adminName,'email'=>$to];$tok=newToken();
 $cp=$camp['coupon_id']?sql('SELECT * FROM coupons WHERE id=?',[$camp['coupon_id']])->fetch():null;
 if(!$cp&&$camp['personal_coupon'])$cp=['code'=>'GRACIAS-PRUEBA','kind'=>'percent','value'=>(int)(json_decode((string)$camp['personal_coupon'],true)['value']??10),'ends_at'=>gmdate('Y-m-d H:i:s',time()+30*86400)];
 [$subject,$body]=marketingBody($fake,campaignContent($camp),$tok,$cp,true);   // the test is the real message, unsubscribe link and footer included
 enqueue('camptest:'.$id.':'.bin2hex(random_bytes(4)),$to,'[Prueba] '.$subject,$body);
}
function touchSend(string $token,string $col): void {
 if(!preg_match('/^[a-f0-9]{32}$/D',$token))return;$now=nowUtc();
 sql("UPDATE campaign_sends SET $col=? WHERE token=? AND $col IS NULL",[$now,$token]);sql("UPDATE automation_runs SET $col=? WHERE token=? AND $col IS NULL",[$now,$token]);
}
function campaignOpened(string $token): void { growthSafe(fn()=>touchSend($token,'opened_at')); }
function campaignClicked(string $token): void { growthSafe(function()use($token){touchSend($token,'clicked_at');touchSend($token,'opened_at');}); }

// ------------------------------------------------------------------------------------------------ SMS (provider-agnostic)
function smsDriver(): string { return env('SMS_DRIVER','log'); }
/** Colombian mobile numbers by default (10 digits starting with 3 → +57); anything else must already start with +. */
function phoneE164(string $raw): ?string {
 $d=preg_replace('/[^\d+]/','',trim($raw));if($d==='')return null;
 if($d[0]==='+')return preg_match('/^\+\d{8,15}$/D',$d)?$d:null;
 $d=ltrim($d,'0');if(strlen($d)===10&&$d[0]==='3')return '+57'.$d;if(strlen($d)===12&&str_starts_with($d,'57'))return '+'.$d;return null;
}
function smsEnqueue(array $contact,string $text,?int $campaignId,bool $promo): bool {
 if($promo&&!canMarket($contact,'sms'))return false;$to=phoneE164((string)$contact['phone']);if(!$to)return false;
 $text=mb_substr(trim($text.($promo?' Baja: '.appUrl('/baja.php?c='.$contact['id'].'&ch=sms&t='.substr(unsubToken((int)$contact['id'],'sms'),0,20)):'')),0,480);
 sql('INSERT INTO sms_outbox(contact_id,campaign_id,to_number,body,status,created_at) VALUES(?,?,?,?,?,?)',[$contact['id'],$campaignId,$to,$text,'queued',nowUtc()]);return true;
}
/** 'log' (default) only records what WOULD be sent; 'twilio' really sends. Add a driver here for another provider. */
function smsFlush(int $limit=50): int {
 $n=0;foreach(sql("SELECT * FROM sms_outbox WHERE status='queued' ORDER BY id LIMIT ".(int)$limit)->fetchAll() as $m){
  $claim=db()->prepare("UPDATE sms_outbox SET status='sending' WHERE id=? AND status='queued'");$claim->execute([$m['id']]);if($claim->rowCount()!==1)continue;   // two workers never send the same message
  try{
   $c=sql('SELECT * FROM contacts WHERE id=?',[$m['contact_id']])->fetch();
   if(!$c||!canMarket($c,'sms')){sql("UPDATE sms_outbox SET status='skipped',error='baja' WHERE id=?",[$m['id']]);continue;}   // unsubscribed after it was queued: it does not go
   if(smsDriver()==='twilio'){
    need(env('TWILIO_SID')!==''&&env('TWILIO_TOKEN')!==''&&env('TWILIO_FROM')!=='','Falta configurar Twilio.');
    $ch=curl_init('https://api.twilio.com/2010-04-01/Accounts/'.rawurlencode(env('TWILIO_SID')).'/Messages.json');
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_USERPWD=>env('TWILIO_SID').':'.env('TWILIO_TOKEN'),CURLOPT_POSTFIELDS=>http_build_query(['To'=>$m['to_number'],'From'=>env('TWILIO_FROM'),'Body'=>$m['body']]),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20]);
    $r=curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);$j=json_decode((string)$r,true)?:[];
    need($code>=200&&$code<300,'Twilio '.$code.': '.mb_substr((string)($j['message']??''),0,120));
    sql("UPDATE sms_outbox SET status='sent',provider_id=?,sent_at=? WHERE id=?",[(string)($j['sid']??''),nowUtc(),$m['id']]);
   }else sql("UPDATE sms_outbox SET status='logged',sent_at=? WHERE id=?",[nowUtc(),$m['id']]);
   $n++;
  }catch(Throwable $e){sql("UPDATE sms_outbox SET status='failed',error=? WHERE id=?",[mb_substr($e->getMessage(),0,190),$m['id']]);}
 }
 return $n;
}

// ------------------------------------------------------------------------------------------------ automations
function automationRow(string $key): ?array { $r=sql('SELECT * FROM automations WHERE akey=?',[$key])->fetch();return $r?:null; }
function sentRecently(int $contactId): bool { $c=sql('SELECT last_marketing_at FROM contacts WHERE id=?',[$contactId])->fetch();return $c&&$c['last_marketing_at']!==null&&$c['last_marketing_at']>gmdate('Y-m-d H:i:s',time()-marketingCapDays()*86400); }
/**
 * One pass of all enabled automations. Each (automation, contact, order) happens once, ever. Promotional ones respect opt-in
 * and the frequency cap; the "unpaid order" reminder is a service message about the person's own order (no code unless they opted in).
 */
function automationsRun(int $limit=100): array {
 growthEnsure();$stats=[];
 foreach(sql('SELECT * FROM automations WHERE enabled=1')->fetchAll() as $a){
  $k=$a['akey'];$delay=max(0,(int)$a['delay_hours'])*3600;$cut=gmdate('Y-m-d H:i:s',time()-$delay);$tpl=$a['personal_coupon']?json_decode((string)$a['personal_coupon'],true):null;$sent=0;$aid=(int)$a['id'];
  // "not already done" is part of the query, so the same first people never crowd out the rest
  if($k==='abandoned'){$rows=sql("SELECT o.*,c.id AS cid FROM orders o JOIN contacts c ON c.id=o.contact_id WHERE o.audience='person' AND o.status IN ('created','payment_pending') AND o.created_at<=? AND o.created_at>=? AND NOT EXISTS(SELECT 1 FROM automation_runs r WHERE r.automation_id=? AND r.contact_id=o.contact_id AND r.order_id=o.id) ORDER BY o.id LIMIT ".(int)$limit,[$cut,gmdate('Y-m-d H:i:s',time()-7*86400),$aid])->fetchAll();}
  elseif($k==='post_purchase'){$rows=sql("SELECT o.*,c.id AS cid FROM orders o JOIN contacts c ON c.id=o.contact_id WHERE o.status='completed' AND o.updated_at<=? AND o.updated_at>=? AND NOT EXISTS(SELECT 1 FROM automation_runs r WHERE r.automation_id=? AND r.contact_id=o.contact_id AND r.order_id=o.id) ORDER BY o.id LIMIT ".(int)$limit,[$cut,gmdate('Y-m-d H:i:s',time()-30*86400),$aid])->fetchAll();}
  else{$rows=sql("SELECT c.id AS cid,0 AS id FROM contacts c WHERE c.orders_paid>=1 AND c.last_order_at<=? AND c.last_order_at>=? AND NOT EXISTS(SELECT 1 FROM automation_runs r WHERE r.automation_id=? AND r.contact_id=c.id AND r.created_at>=c.last_order_at) ORDER BY c.id LIMIT ".(int)$limit,[$cut,gmdate('Y-m-d H:i:s',time()-$delay-30*86400),$aid])->fetchAll();}
  foreach($rows as $r){
   $contact=sql('SELECT * FROM contacts WHERE id=?',[$r['cid']])->fetch();if(!$contact)continue;$orderId=(int)$r['id'];
   if($contact['email_unsub_at']!==null)continue;   // unsubscribed people get nothing, not even reminders
   if($k==='abandoned'&&sql("SELECT id FROM orders WHERE contact_id=? AND status IN (".inList(PAID_STATES).") AND created_at>=?",array_merge([$contact['id']],PAID_STATES,[$r['created_at']]))->fetch())continue;   // already bought since
   $promo=$k!=='abandoned';$optin=canMarket($contact,'email');
   if($promo&&(!$optin||sentRecently((int)$contact['id'])))continue;
   // one reminder per person every few days (not per order): five forgotten carts are still one email
   if(!$promo&&sql("SELECT id FROM automation_runs WHERE automation_id=? AND contact_id=? AND created_at>?",[$aid,$contact['id'],gmdate('Y-m-d H:i:s',time()-max(3,marketingCapDays())*86400)])->fetch())continue;
   $token=newToken();
   try{sql('INSERT INTO automation_runs(automation_id,contact_id,order_id,token,created_at) VALUES(?,?,?,?,?)',[$aid,$contact['id'],$orderId,$token,nowUtc()]);}catch(PDOException $e){continue;}
   $cp=($optin&&is_array($tpl)&&$tpl)?personalCoupon($contact,$tpl,'auto:'.$k):null;
   $content=['campaign_name'=>'auto-'.$k,'subject'=>$a['subject'],'preheader'=>'','title'=>$a['title'],'body'=>$a['body'],'cta_label'=>$a['cta_label'],'cta_path'=>'/'];
   $session=null;if($k==='abandoned'&&$orderId){$o=sql('SELECT * FROM orders WHERE id=?',[$orderId])->fetch();if($o)$session=mailSessionUrl($o).'';}
   [$subject,$body]=marketingBody($contact,$content,$token,$cp,true,$session);   // every one of these carries the unsubscribe link and headers
   enqueue('auto:'.$k.':'.$contact['id'].':'.$orderId,$contact['email'],$subject,$body);
   if($promo||$optin)sql('UPDATE contacts SET last_marketing_at=? WHERE id=?',[nowUtc(),$contact['id']]);$sent++;
  }
  $stats[$k]=$sent;
 }
 return $stats;
}
