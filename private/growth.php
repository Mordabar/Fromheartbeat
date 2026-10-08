<?php
declare(strict_types=1);
// Growth layer: one identity per person (contacts), proof of consent, prices (seasonal promotions + coupons),
// first-party analytics and the hooks the order flow calls. Everything here is additive: the sale flow keeps working
// if these tables are empty, and nothing in this file sends a marketing message (see marketing.php).
//
// Dialect note: the app runs on MySQL/MariaDB; the test harness runs the same SQL on SQLite. Timestamps are therefore
// computed in PHP (UTC, 'Y-m-d H:i:s') and only portable SQL is used (no ON DUPLICATE KEY, no DATE_ADD).

const GROWTH_SCHEMA='2026-10-a';
const PAID_STATES=['paid','in_production','review','completed'];
const PRICE_FLOOR=150000;   // 1.500 COP in cents: a total below this never reaches the payment provider
const PRICE_FREEZE_HOURS=48;   // an unpaid order keeps the price (season/coupon) it was made with this long; after that it is re-priced at payment
function nowUtc(): string { return gmdate('Y-m-d H:i:s'); }
function inList(array $values): string { return implode(',',array_fill(0,count($values),'?')); }

// ------------------------------------------------------------------------------------------------ schema
function growthDdl(): array {
 $t=[];
 $t[]="CREATE TABLE IF NOT EXISTS contacts ({ID}, email VARCHAR(254) NOT NULL UNIQUE, email_canon VARCHAR(254) NOT NULL DEFAULT '', email_optin_pending_at DATETIME NULL, name VARCHAR(120) NOT NULL DEFAULT '', phone VARCHAR(40) NOT NULL DEFAULT '',
  email_optin TINYINT NOT NULL DEFAULT 0, email_optin_at DATETIME NULL, email_optin_source VARCHAR(40) NULL, email_unsub_at DATETIME NULL,
  sms_optin TINYINT NOT NULL DEFAULT 0, sms_optin_at DATETIME NULL, sms_unsub_at DATETIME NULL,
  first_source VARCHAR(60) NULL, first_campaign VARCHAR(80) NULL, orders_paid INT NOT NULL DEFAULT 0, spent_in_cents BIGINT NOT NULL DEFAULT 0,
  first_paid_at DATETIME NULL, last_order_at DATETIME NULL, last_marketing_at DATETIME NULL, tags VARCHAR(500) NOT NULL DEFAULT '', created_at DATETIME NOT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS consent_log ({ID}, contact_id BIGINT NOT NULL, channel VARCHAR(12) NOT NULL, action VARCHAR(8) NOT NULL, source VARCHAR(40) NOT NULL, text_version VARCHAR(20) NOT NULL, ip_hash CHAR(16) NULL, created_at DATETIME NOT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS coupons ({ID}, code VARCHAR(40) NOT NULL UNIQUE, label VARCHAR(120) NOT NULL DEFAULT '', kind VARCHAR(10) NOT NULL, value BIGINT NOT NULL,
  min_amount_in_cents BIGINT NOT NULL DEFAULT 0, max_discount_in_cents BIGINT NULL, product_codes VARCHAR(300) NULL, first_order_only TINYINT NOT NULL DEFAULT 0, returning_only TINYINT NOT NULL DEFAULT 0,
  contact_id BIGINT NULL, starts_at DATETIME NULL, ends_at DATETIME NULL, max_redemptions INT NULL, per_contact_limit INT NOT NULL DEFAULT 1, stackable TINYINT NOT NULL DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1, source VARCHAR(40) NOT NULL DEFAULT 'manual', created_at DATETIME NOT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS coupon_redemptions ({ID}, coupon_id BIGINT NOT NULL, order_id BIGINT NOT NULL UNIQUE, contact_id BIGINT NULL, discount_in_cents BIGINT NOT NULL, status VARCHAR(10) NOT NULL DEFAULT 'reserved', created_at DATETIME NOT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS promotions ({ID}, name VARCHAR(120) NOT NULL, kind VARCHAR(10) NOT NULL, value BIGINT NOT NULL, product_codes VARCHAR(300) NULL, badge VARCHAR(40) NOT NULL DEFAULT '', banner VARCHAR(200) NOT NULL DEFAULT '',
  starts_at DATETIME NULL, ends_at DATETIME NULL, active TINYINT NOT NULL DEFAULT 1, priority INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS events ({ID}, created_at DATETIME NOT NULL, visitor_id VARCHAR(40) NOT NULL, name VARCHAR(40) NOT NULL, path VARCHAR(120) NULL, props VARCHAR(600) NULL,
  utm_source VARCHAR(60) NULL, utm_medium VARCHAR(60) NULL, utm_campaign VARCHAR(80) NULL, device VARCHAR(8) NULL, order_id BIGINT NULL, value_in_cents BIGINT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS campaigns ({ID}, name VARCHAR(120) NOT NULL, channel VARCHAR(8) NOT NULL DEFAULT 'email', subject VARCHAR(150) NOT NULL DEFAULT '', preheader VARCHAR(150) NOT NULL DEFAULT '',
  title VARCHAR(150) NOT NULL DEFAULT '', body TEXT NOT NULL, cta_label VARCHAR(40) NOT NULL DEFAULT '', cta_path VARCHAR(200) NOT NULL DEFAULT '', coupon_id BIGINT NULL, personal_coupon TEXT NULL,
  segment TEXT NOT NULL, status VARCHAR(12) NOT NULL DEFAULT 'draft', scheduled_at DATETIME NULL, queued_at DATETIME NULL, created_at DATETIME NOT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS campaign_sends ({ID}, campaign_id BIGINT NOT NULL, contact_id BIGINT NOT NULL, channel VARCHAR(8) NOT NULL, token CHAR(32) NOT NULL UNIQUE, status VARCHAR(10) NOT NULL DEFAULT 'queued',
  sent_at DATETIME NULL, opened_at DATETIME NULL, clicked_at DATETIME NULL, converted_order_id BIGINT NULL, error VARCHAR(200) NULL, created_at DATETIME NOT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS automations ({ID}, akey VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL, enabled TINYINT NOT NULL DEFAULT 0, delay_hours INT NOT NULL DEFAULT 24, subject VARCHAR(150) NOT NULL DEFAULT '',
  title VARCHAR(150) NOT NULL DEFAULT '', body TEXT NOT NULL, cta_label VARCHAR(40) NOT NULL DEFAULT '', personal_coupon TEXT NULL, updated_at DATETIME NOT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS automation_runs ({ID}, automation_id BIGINT NOT NULL, contact_id BIGINT NOT NULL, order_id BIGINT NOT NULL DEFAULT 0, token CHAR(32) NOT NULL UNIQUE, opened_at DATETIME NULL, clicked_at DATETIME NULL, converted_order_id BIGINT NULL, created_at DATETIME NOT NULL){ENGINE}";
 $t[]="CREATE TABLE IF NOT EXISTS sms_outbox ({ID}, contact_id BIGINT NOT NULL, campaign_id BIGINT NULL, to_number VARCHAR(40) NOT NULL, body VARCHAR(480) NOT NULL, status VARCHAR(10) NOT NULL DEFAULT 'queued', provider_id VARCHAR(80) NULL, error VARCHAR(200) NULL, created_at DATETIME NOT NULL, sent_at DATETIME NULL){ENGINE}";
 return $t;
}
function growthIndexes(): array {
 return ['CREATE INDEX ix_contacts_optin ON contacts(email_optin,email_unsub_at)','CREATE INDEX ix_contacts_canon ON contacts(email_canon)','CREATE INDEX ix_contacts_last ON contacts(last_order_at)','CREATE INDEX ix_consent_contact ON consent_log(contact_id)',
  'CREATE INDEX ix_redeem_coupon ON coupon_redemptions(coupon_id,status)','CREATE INDEX ix_events_name ON events(name,created_at)','CREATE INDEX ix_events_visitor ON events(visitor_id)',
  'CREATE UNIQUE INDEX ux_sends_cc ON campaign_sends(campaign_id,contact_id)','CREATE INDEX ix_sends_contact ON campaign_sends(contact_id)','CREATE UNIQUE INDEX ux_runs ON automation_runs(automation_id,contact_id,order_id)',
  'CREATE INDEX ix_sms_status ON sms_outbox(status)','CREATE INDEX ix_orders_contact ON orders(contact_id)','CREATE INDEX ix_orders_paid ON orders(status,paid_at)'];
}
function growthColumns(): array {   // table => [column => definition]
 return ['customers'=>['contact_id'=>'BIGINT NULL'],
  'orders'=>['contact_id'=>'BIGINT NULL','list_amount_in_cents'=>'BIGINT NULL','discount_in_cents'=>'BIGINT NOT NULL DEFAULT 0','coupon_code'=>'VARCHAR(40) NULL','promo_id'=>'BIGINT NULL','visitor_id'=>'VARCHAR(40) NULL',
   'first_source'=>'VARCHAR(60) NULL','first_campaign'=>'VARCHAR(80) NULL','last_source'=>'VARCHAR(60) NULL','last_campaign'=>'VARCHAR(80) NULL','send_token'=>'VARCHAR(32) NULL','paid_at'=>'DATETIME NULL','is_repeat'=>'TINYINT NOT NULL DEFAULT 0']];
}
function growthColumnExists(string $table,string $col): bool {
 if(db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'){foreach(db()->query("PRAGMA table_info($table)")->fetchAll() as $r)if($r['name']===$col)return true;return false;}
 return (int)sql('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',[$table,$col])->fetchColumn()>0;
}
/** Creates what is missing. Safe to run any number of times, concurrently or not. */
function growthMigrate(): array {
 $sqlite=db()->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite';$done=[];
 $id=$sqlite?'id INTEGER PRIMARY KEY AUTOINCREMENT':'id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY';$engine=$sqlite?'':' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
 foreach(growthDdl() as $ddl){db()->exec(str_replace(['{ID}','{ENGINE}'],[$id,$engine],$ddl));}
 foreach(growthColumns() as $table=>$cols)foreach($cols as $c=>$def)if(!growthColumnExists($table,$c)){db()->exec("ALTER TABLE $table ADD COLUMN $c $def");$done[]="$table.$c";}
 foreach(growthIndexes() as $ix){try{db()->exec($ix);}catch(Throwable $e){/* already there */}}
 growthSeedAutomations();growthBackfill();
 return $done;
}
/** Cheap guard used by every entry point that touches the new tables: migrates once per deployment, then it is a file check. */
function growthEnsure(): bool {
 static $ok=null;if($ok!==null)return $ok;
 try{
  $flag=storage().'/growth-schema-'.GROWTH_SCHEMA.'.ok';if(is_file($flag))return $ok=true;
  $lock=fopen(storage().'/growth-migrate.lock','c');if(!$lock)return $ok=false;flock($lock,LOCK_EX);
  try{if(!is_file($flag)){growthMigrate();file_put_contents($flag,nowUtc());}}finally{flock($lock,LOCK_UN);fclose($lock);}
  return $ok=true;
 }catch(Throwable $e){error_log('FHB growth migrate '.$e->getMessage());return $ok=false;}   // the sale flow must keep working even if the database user cannot alter tables
}
/** Customers who bought BEFORE this layer existed become contacts (no marketing permission: they never gave any) so recompra and win-back can reach them once they opt in. */
function growthBackfill(): void {
 foreach(sql('SELECT id,name,email,phone FROM customers WHERE contact_id IS NULL ORDER BY id LIMIT 20000')->fetchAll() as $c){
  $id=contactUpsert((string)$c['email'],(string)$c['name'],(string)$c['phone']);sql('UPDATE customers SET contact_id=? WHERE id=?',[$id,$c['id']]);sql('UPDATE orders SET contact_id=? WHERE customer_id=? AND contact_id IS NULL',[$id,$c['id']]);
 }
 foreach(sql('SELECT id FROM contacts WHERE orders_paid=0 AND first_paid_at IS NULL')->fetchAll() as $c){
  $r=sql('SELECT COUNT(*) n,COALESCE(SUM(amount_in_cents),0) s,MIN(created_at) f,MAX(created_at) l FROM orders WHERE contact_id=? AND status IN ('.inList(PAID_STATES).')',array_merge([$c['id']],PAID_STATES))->fetch();
  if((int)$r['n']>0)sql('UPDATE contacts SET orders_paid=?,spent_in_cents=?,first_paid_at=?,last_order_at=? WHERE id=?',[$r['n'],$r['s'],$r['f'],$r['l'],$c['id']]);
 }
}
/** For code that runs inside a payment/cancel transaction: never migrate there (DDL would end the transaction). */
function growthSchemaReady(): bool { static $r=null;return $r??=is_file(storage().'/growth-schema-'.GROWTH_SCHEMA.'.ok'); }
function growthSeedAutomations(): void {
 $defs=[
  ['abandoned','Pedido sin pagar',0,2,'Tu canción te está esperando','Tu canción *te espera.*',"Guardamos tu historia tal como la contaste. Cuando quieras, completa el pago y el estudio empieza a trabajar en tu canción.",'Terminar mi pedido',null],
  ['post_purchase','Gracias y segunda canción',0,72,'Gracias por confiar tu historia','Gracias *por tu historia.*',"Fue un honor ponerle música a tu historia. Si hay otra persona que merezca una canción, aquí tienes un detalle de nuestra parte para tu próxima dedicatoria.",'Crear otra canción','{"kind":"percent","value":10,"valid_days":30}'],
  ['reorder','Recompra (pasado un tiempo)',0,2880,'¿A quién más le dedicamos una canción?','Hay *más historias.*',"Hace un tiempo hicimos tu canción. Los cumpleaños, aniversarios y fechas especiales vuelven: tenemos un código personal para tu próxima dedicatoria.",'Crear otra canción','{"kind":"percent","value":10,"valid_days":30}'],
  ['winback','Reactivación (clientes dormidos)',0,8760,'Te extrañamos en el estudio','Volvamos *a empezar.*',"Pasó un año desde tu última canción. Si hay una historia nueva por contar, este código es solo tuyo.",'Contar una historia nueva','{"kind":"percent","value":15,"valid_days":21}'],
 ];
 foreach($defs as [$k,$name,$en,$delay,$subj,$title,$body,$cta,$coupon]){
  if(sql('SELECT id FROM automations WHERE akey=?',[$k])->fetch())continue;
  sql('INSERT INTO automations(akey,name,enabled,delay_hours,subject,title,body,cta_label,personal_coupon,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[$k,$name,$en,$delay,$subj,$title,$body,$cta,$coupon,nowUtc()]);
 }
}

// ------------------------------------------------------------------------------------------------ contacts & consent
/** gmail ignores dots and +tags: alias tricks must not look like new people. Other providers: only +tag is ignored. */
function canonEmail(string $email): string {
 $e=strtolower(trim($email));if(!str_contains($e,'@'))return $e;[$l,$d]=explode('@',$e,2);$l=explode('+',$l,2)[0];
 if(in_array($d,['gmail.com','googlemail.com'],true)){$l=str_replace('.','',$l);$d='gmail.com';}
 return $l.'@'.$d;
}
function contactByEmail(string $email): ?array {
 $e=strtolower(trim($email));$r=sql('SELECT * FROM contacts WHERE email=?',[$e])->fetch();if($r)return $r;
 $r=sql('SELECT * FROM contacts WHERE email_canon=? ORDER BY id LIMIT 1',[canonEmail($e)])->fetch();return $r?:null;
}
/** One row per email address, whatever the number of orders. Names/phones only fill gaps; they never overwrite what the person typed first. */
function contactUpsert(string $email,string $name,string $phone,array $attr=[]): int {
 $email=strtolower(trim($email));$c=contactByEmail($email);
 if($c){
  if($c['name']===''&&$name!=='')sql('UPDATE contacts SET name=? WHERE id=?',[$name,$c['id']]);
  if($c['phone']===''&&$phone!=='')sql('UPDATE contacts SET phone=? WHERE id=?',[$phone,$c['id']]);
  return (int)$c['id'];
 }
 try{sql('INSERT INTO contacts(email,email_canon,name,phone,first_source,first_campaign,created_at) VALUES(?,?,?,?,?,?,?)',[$email,canonEmail($email),mb_substr($name,0,120),mb_substr($phone,0,40),$attr['first_source']??null,$attr['first_campaign']??null,nowUtc()]);}
 catch(PDOException $e){$c=contactByEmail($email);if($c)return (int)$c['id'];throw $e;}
 return (int)contactByEmail($email)['id'];
}
/** Records WHO agreed to WHAT, when and where, and flips the flag. Revoking is as easy as granting and also logged. */
function consentSet(int $contactId,string $channel,bool $grant,string $source,string $textVersion='2026-10'): void {
 need(in_array($channel,['email','sms'],true),'Canal inválido.');$now=nowUtc();$c=sql('SELECT * FROM contacts WHERE id=?',[$contactId])->fetch();if(!$c)return;
 $isOn=(int)$c[$channel.'_optin']===1&&$c[$channel.'_unsub_at']===null;
 // granting twice, or revoking someone already suppressed, writes nothing; revoking a person who never opted in DOES record the suppression (reminders stop too)
 if($grant?$isOn:$c[$channel.'_unsub_at']!==null)return;
 if($grant)sql("UPDATE contacts SET {$channel}_optin=1,{$channel}_optin_at=?,{$channel}_unsub_at=NULL".($channel==='email'?',email_optin_source=?,email_optin_pending_at=NULL':'')." WHERE id=?",$channel==='email'?[$now,$source,$contactId]:[$now,$contactId]);
 else sql("UPDATE contacts SET {$channel}_optin=0,{$channel}_unsub_at=?".($channel==='email'?',email_optin_pending_at=NULL':'')." WHERE id=?",[$now,$contactId]);
 consentLog($contactId,$channel,$grant?'grant':'revoke',$source,$textVersion);
}
function consentLog(int $contactId,string $channel,string $action,string $source,string $textVersion='2026-10'): void {
 $ip=hash('sha256',($_SERVER['REMOTE_ADDR']??'cli').env('APP_KEY'));
 sql('INSERT INTO consent_log(contact_id,channel,action,source,text_version,ip_hash,created_at) VALUES(?,?,?,?,?,?,?)',[$contactId,$channel,$action,mb_substr($source,0,40),$textVersion,substr($ip,0,16),nowUtc()]);
}
/**
 * Double opt-in. Ticking the box at checkout only ASKS: the person who owns the mailbox must click the link we send.
 * Nothing is asked of someone who unsubscribed (they can resubscribe themselves on the unsubscribe page), who is already in,
 * or who was asked in the last 7 days. Typing somebody else's address therefore cannot subscribe them.
 */
function consentRequest(int $contactId): void {
 $c=sql('SELECT * FROM contacts WHERE id=?',[$contactId])->fetch();if(!$c||canMarket($c)||$c['email_unsub_at']!==null)return;
 if($c['email_optin_pending_at']!==null&&$c['email_optin_pending_at']>gmdate('Y-m-d H:i:s',time()-7*86400))return;
 sql('UPDATE contacts SET email_optin_pending_at=? WHERE id=?',[nowUtc(),$contactId]);consentLog($contactId,'email','request','checkout');
 $url=appUrl('/baja.php?a=confirm&c='.$contactId.'&ch=email&t='.optinToken($contactId));
 $m=['kind'=>'optin','subject'=>'Confirma que quieres recibir ofertas','preheader'=>'Un clic y listo. Si no fuiste tú, ignora este correo.','eyebrow'=>'Fromheartbeat','title'=>'Un clic *y listo.*','hero'=>'','reference'=>'','blocks'=>[
  ['lead'=>mkFill('{nombre}, alguien (esperamos que tú) pidió recibir ofertas y novedades de Fromheartbeat en este correo.',$c)],['p'=>'Para activarlo, confirma con este botón. Si no fuiste tú, no hagas nada: no te escribiremos.'],
  ['cta'=>['label'=>'Sí, quiero recibirlas','url'=>$url]]],'foot'=>legalFoot('Recibes este correo porque se pidió una suscripción con tu dirección. No se activa hasta que confirmes.')];
 enqueue('optin:'.$contactId.':'.gmdate('oW'),$c['email'],$m['subject'],mailBuild($m));
}
function optinToken(int $contactId): string { need(strlen(env('APP_KEY'))>=32,'Falta configurar la clave de la aplicación.',503);return hash_hmac('sha256','optin:email:'.$contactId,env('APP_KEY')); }
function canMarket(array $c,string $channel='email'): bool { return (int)$c[$channel.'_optin']===1&&$c[$channel.'_unsub_at']===null; }
/** Unsubscribe links carry an HMAC of the contact: no table of tokens to leak, nothing to guess. */
function unsubToken(int $contactId,string $channel='email'): string { need(strlen(env('APP_KEY'))>=32,'Falta configurar la clave de la aplicación.',503);return hash_hmac('sha256','unsub:'.$channel.':'.$contactId,env('APP_KEY')); }
function unsubUrl(int $contactId,string $channel='email'): string { return appUrl('/baja.php?c='.$contactId.'&ch='.$channel.'&t='.unsubToken($contactId,$channel)); }
function unsubValid(int $contactId,string $channel,string $token): bool {   // SMS links are short on purpose: 20+ hex characters of the HMAC (80 bits) are accepted
 return in_array($channel,['email','sms'],true)&&strlen($token)>=20&&strlen($token)<=64&&ctype_xdigit($token)&&hash_equals(substr(unsubToken($contactId,$channel),0,strlen($token)),strtolower($token));
}

// ------------------------------------------------------------------------------------------------ pricing
function promotionsActive(): array {
 $now=nowUtc();
 return sql('SELECT * FROM promotions WHERE active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>=?) ORDER BY priority DESC,id DESC',[$now,$now])->fetchAll();
}
function codesOf(?string $csv): array { return $csv===null||trim($csv)===''?[]:array_values(array_filter(array_map('trim',explode(',',$csv)))); }
function discountOf(string $kind,int $value,int $base,?int $cap=null): int {
 $d=$kind==='percent'?intdiv($base*$value,100):$value;if($cap!==null&&$cap>0)$d=min($d,$cap);
 $d=intdiv($d,100)*100;   // whole pesos: the amount charged never has a fraction of a peso
 return max(0,min($d,$base));
}
function promoFits(array $pr,array $p): bool { $codes=codesOf($pr['product_codes']);return $p['audience']==='person'&&(!$codes||in_array($p['code'],$codes,true)); }
function couponCode(string $raw): string { return strtoupper(preg_replace('/[^A-Za-z0-9_-]/','',trim($raw))); }
function couponUsed(int $couponId,?int $contactId=null,int $exceptOrder=0): int {
 $q='SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=? AND order_id<>? AND (status=\'applied\' OR (status=\'reserved\' AND created_at>?))';$p=[$couponId,$exceptOrder,gmdate('Y-m-d H:i:s',time()-PRICE_FREEZE_HOURS*3600)];
 if($contactId!==null){$q.=' AND contact_id=?';$p[]=$contactId;}
 return (int)sql($q.(couponLock()?' FOR UPDATE':''),$p)->fetchColumn();   // inside an order transaction a locking read sees the other order's reservation that just committed
}
function couponLock(?bool $set=null): bool { static $v=false;if($set!==null)$v=$set;return $v; }
/** Null when the coupon works for this purchase, otherwise the sentence to show the customer. */
function couponProblem(array $cp,array $p,int $base,?array $contact,int $exceptOrder=0): ?string {
 $generic='Este cupón no es válido para este pedido.';   // rules that depend on WHO is buying never say why: that would tell strangers who is a customer
 $now=nowUtc();
 if(!(int)$cp['active'])return 'Este cupón no está disponible.';
 if($cp['starts_at']!==null&&$cp['starts_at']>$now)return 'Este cupón aún no está vigente.';
 if($cp['ends_at']!==null&&$cp['ends_at']<$now)return 'Este cupón ya venció.';
 $codes=codesOf($cp['product_codes']);if($codes&&!in_array($p['code'],$codes,true))return 'Este cupón no aplica a esta experiencia.';
 if($p['audience']!=='person')return 'Este cupón aplica a las experiencias para personas.';
 if((int)$cp['min_amount_in_cents']>$base)return 'Este cupón aplica a compras desde '.mailMoney((int)$cp['min_amount_in_cents']).'.';
 if($cp['contact_id']!==null&&(!$contact||(int)$contact['id']!==(int)$cp['contact_id']))return $generic;
 if($cp['max_redemptions']!==null&&couponUsed((int)$cp['id'],null,$exceptOrder)>=(int)$cp['max_redemptions'])return 'Este cupón ya alcanzó su límite de usos.';
 if($contact&&couponUsed((int)$cp['id'],(int)$contact['id'],$exceptOrder)>=max(1,(int)$cp['per_contact_limit']))return $generic;
 if((int)$cp['first_order_only']&&$contact&&(int)$contact['orders_paid']>0)return $generic;
 if((int)$cp['returning_only']&&(!$contact||(int)$contact['orders_paid']<1))return $generic;
 return null;
}
/**
 * The ONLY place a price is decided. The browser sends a product code and maybe a coupon; the total comes from here.
 * Best of promotion vs coupon, unless the coupon is marked stackable (then promotion first, coupon on what is left).
 */
function priceQuote(string $productCode,string $couponRaw='',?string $email=null,int $exceptOrder=0): array {
 $p=catalog()[$productCode]??null;need((bool)$p,'Selecciona un producto.');
 $list=(int)$p['price'];$q=['list'=>$list,'promo'=>null,'promo_discount'=>0,'coupon'=>null,'coupon_discount'=>0,'coupon_error'=>null,'coupon_note'=>null,'discount'=>0,'total'=>$list];
 if($p['audience']!=='person'){if(couponCode($couponRaw)!=='')$q['coupon_error']='Los cupones aplican a las experiencias para personas. Para empresas, el descuento se acuerda en la propuesta.';return $q;}
 foreach(promotionsActive() as $pr)if(promoFits($pr,$p)){$d=discountOf($pr['kind'],(int)$pr['value'],$list);if($d>$q['promo_discount']){$q['promo']=$pr;$q['promo_discount']=$d;}}
 $code=couponCode($couponRaw);
 if($code!==''){
  $cp=sql('SELECT * FROM coupons WHERE code=?',[$code])->fetch();$contact=$email!==null&&$email!==''?contactByEmail($email):null;
  if(!$cp)$q['coupon_error']='Ese cupón no existe. Revisa que esté bien escrito.';
  else{
   $base=$cp['stackable']?$list-$q['promo_discount']:$list;$err=couponProblem($cp,$p,$base,$contact,$exceptOrder);
   if($err!==null)$q['coupon_error']=$err;
   else{
    $d=discountOf($cp['kind'],(int)$cp['value'],$base,$cp['max_discount_in_cents']!==null?(int)$cp['max_discount_in_cents']:null);
    if($cp['stackable']){$q['coupon']=$cp;$q['coupon_discount']=$d;}
    elseif($d>$q['promo_discount']){$q['coupon']=$cp;$q['coupon_discount']=$d;$q['promo']=null;$q['promo_discount']=0;}
    else $q['coupon_note']='Ya tienes un descuento mejor aplicado a esta experiencia: el cupón no se suma.';
   }
  }
 }
 $q['discount']=$q['promo_discount']+$q['coupon_discount'];$q['total']=max(PRICE_FLOOR,$list-$q['discount']);$q['discount']=$list-$q['total'];
 return $q;
}
/** What the browser may show: no internals, no other people's data. */
function quoteView(array $q): array {
 return ['list'=>$q['list'],'total'=>$q['total'],'discount'=>$q['discount'],'promo'=>$q['promo']?['name'=>$q['promo']['name'],'badge'=>$q['promo']['badge'],'discount'=>$q['promo_discount']]:null,
  'coupon'=>$q['coupon']?['code'=>$q['coupon']['code'],'discount'=>$q['coupon_discount']]:null,'coupon_error'=>$q['coupon_error'],'coupon_note'=>$q['coupon_note']??null];
}
/** Public price list with the active season applied, for the catalog and the 3D podiums. */
function publicPrices(): array {
 $out=[];foreach(catalog() as $code=>$p){if($p['audience']!=='person')continue;$q=priceQuote($code);$out[$code]=['list'=>$q['list'],'total'=>$q['total'],'badge'=>$q['promo']['badge']??'','promo'=>$q['promo']['name']??''];}
 return $out;
}
function publicBanner(): string { foreach(promotionsActive() as $pr)if(trim((string)$pr['banner'])!=='')return (string)$pr['banner'];return ''; }

/**
 * Called when payment is about to open. An unpaid order keeps its price for PRICE_FREEZE_HOURS; after that it is priced again with today's season and the
 * coupon (if it still qualifies), so a promotion or a coupon limit cannot be used months later. Whatever changes is written on the order and its history.
 */
function repriceStale(array $o): array {
 if(!growthSchemaReady()||$o['audience']!=='person'||!in_array($o['status'],['created','payment_pending'],true))return $o;
 if(strtotime((string)$o['created_at'].' UTC')>time()-PRICE_FREEZE_HOURS*3600)return $o;
 if(sql("SELECT id FROM payment_attempts WHERE order_id=? AND status='APPROVED'",[$o['id']])->fetch())return $o;
 $email=(string)sql('SELECT email FROM customers WHERE id=?',[$o['customer_id']])->fetchColumn();$q=priceQuote($o['product_code'],(string)($o['coupon_code']??''),$email,(int)$o['id']);
 if((int)$q['total']===(int)$o['amount_in_cents'])return $o;
 sql('UPDATE orders SET amount_in_cents=?,list_amount_in_cents=?,discount_in_cents=?,coupon_code=?,promo_id=? WHERE id=?',[$q['total'],$q['list'],$q['discount'],$q['coupon']['code']??null,$q['promo']['id']??null,$o['id']]);
 sql("UPDATE coupon_redemptions SET status='void' WHERE order_id=? AND status='reserved'",[$o['id']]);
 if($q['coupon']){sql("DELETE FROM coupon_redemptions WHERE order_id=?",[$o['id']]);sql('INSERT INTO coupon_redemptions(coupon_id,order_id,contact_id,discount_in_cents,status,created_at) VALUES(?,?,?,?,?,?)',[$q['coupon']['id'],$o['id'],$o['contact_id'],$q['coupon_discount'],'reserved',nowUtc()]);}
 $o=sql('SELECT * FROM orders WHERE id=?',[$o['id']])->fetch();history($o,'Actualizamos el precio con las condiciones vigentes: '.mailMoney((int)$o['amount_in_cents']).'.','sistema');return $o;
}
/** Locks the coupon row, re-checks the limits inside the order transaction, and reserves one use. */
function couponReserve(array $cp,int $orderId,int $contactId,int $discount,array $p,int $base): void {
 $locked=sql('SELECT * FROM coupons WHERE id=? FOR UPDATE',[$cp['id']])->fetch();
 $contact=sql('SELECT * FROM contacts WHERE id=?',[$contactId])->fetch()?:null;
 couponLock(true);try{$err=couponProblem($locked,$p,$base,$contact,$orderId);}finally{couponLock(false);}need($err===null,$err??'Cupón no válido.',409);
 sql('INSERT INTO coupon_redemptions(coupon_id,order_id,contact_id,discount_in_cents,status,created_at) VALUES(?,?,?,?,?,?)',[$cp['id'],$orderId,$contactId,$discount,'reserved',nowUtc()]);
}

// ------------------------------------------------------------------------------------------------ attribution & analytics
function cleanTag(mixed $s,int $max=60): ?string { if(!is_string($s))return null;$s=trim((string)preg_replace('/[^\p{L}\p{N}_\-. ]/u','',$s));$s=mb_substr($s,0,$max);return $s===''?null:$s; }
/** Accepts what the browser collected about where the visit came from; keeps only short, plain labels. */
function attributionFrom(mixed $a): array {
 $a=is_array($a)?$a:[];$ft=is_array($a['ft']??null)?$a['ft']:[];$lt=is_array($a['lt']??null)?$a['lt']:[];
 $v=isset($a['v'])&&is_string($a['v'])&&preg_match('/^[A-Za-z0-9_-]{16,40}$/D',$a['v'])?$a['v']:null;
 $tok=isset($a['c'])&&is_string($a['c'])&&preg_match('/^[a-f0-9]{32}$/D',$a['c'])?$a['c']:null;
 return ['visitor'=>$v,'send_token'=>$tok,'first_source'=>cleanTag($ft['s']??null),'first_campaign'=>cleanTag($ft['c']??null,80),'last_source'=>cleanTag($lt['s']??null),'last_campaign'=>cleanTag($lt['c']??null,80)];
}
const TRACK_EVENTS=['view','pick','select_product','begin_checkout','coupon_try','coupon_ok','order_created','payment_open','purchase','play','share','library','campaign_click','optin'];
const TRACK_FROM_BROWSER=['view','pick','select_product','begin_checkout','payment_open','play','share','library','campaign_click'];   // sales and coupon events come from the server only: the browser cannot inflate them
function trackInsert(string $visitor,string $name,array $d=[]): void {
 if(!in_array($name,TRACK_EVENTS,true))return;
 $props=null;if(isset($d['props'])&&is_array($d['props'])){$keep=[];foreach(['view','k','v','product','kind','coupon','repeat'] as $k)if(array_key_exists($k,$d['props'])&&(is_scalar($d['props'][$k])||$d['props'][$k]===null))$keep[$k]=is_string($d['props'][$k])?mb_substr($d['props'][$k],0,30):$d['props'][$k];$props=$keep?json_encode($keep,JSON_UNESCAPED_UNICODE):null;}
 sql('INSERT INTO events(created_at,visitor_id,name,path,props,utm_source,utm_medium,utm_campaign,device,order_id,value_in_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
  [nowUtc(),$visitor,$name,isset($d['path'])?mb_substr((string)$d['path'],0,120):null,$props,cleanTag($d['us']??null),cleanTag($d['um']??null),cleanTag($d['uc']??null,80),in_array($d['dev']??'',['m','d','t'],true)?$d['dev']:null,$d['order_id']??null,$d['value']??null]);
}
/** Browser batch: ≤20 short events. No IP, no user agent, no personal data are stored. */
function trackBatch(array $in): int {
 if(!growthEnsure())return 0;$v=$in['v']??'';need(is_string($v)&&preg_match('/^[A-Za-z0-9_-]{16,40}$/D',$v)===1,'Visitante inválido.');
 $n=0;foreach(array_slice(is_array($in['e']??null)?$in['e']:[],0,20) as $e){
  if(!is_array($e)||!is_string($e['n']??null)||!in_array($e['n'],TRACK_FROM_BROWSER,true))continue;
  $tok=$e['c']??null;
  if($e['n']==='campaign_click'&&is_string($tok)&&preg_match('/^[a-f0-9]{32}$/D',$tok))campaignClicked($tok);
  trackInsert($v,$e['n'],['path'=>is_string($e['p']??null)?$e['p']:null,'props'=>is_array($e['d']??null)?$e['d']:null,'us'=>$e['us']??null,'um'=>$e['um']??null,'uc'=>$e['uc']??null,'dev'=>$e['dev']??null]);$n++;
 }
 return $n;
}

// ------------------------------------------------------------------------------------------------ hooks called by the order flow
function growthSafeValue(callable $fn,mixed $default=null): mixed { try{return $fn();}catch(Throwable $e){error_log('FHB growth '.$e->getMessage());return $default;} }
function growthSafe(callable $fn): void { try{$fn();}catch(Throwable $e){error_log('FHB growth '.get_class($e).' '.$e->getMessage());} }
/** An order was just paid (inside applyPayment's transaction): stats, coupon use, attribution, one server-side purchase event. */
function growthOnPaid(array $o): void {
 if(!growthSchemaReady())return;
 growthSafe(function()use($o){$o=sql('SELECT * FROM orders WHERE id=?',[$o['id']])->fetch();if(!$o||!$o['contact_id'])return;
  $c=sql('SELECT * FROM contacts WHERE id=?',[$o['contact_id']])->fetch();if(!$c)return;$now=nowUtc();
  $repeat=(int)$c['orders_paid']>0?1:0;
  sql('UPDATE orders SET paid_at=?,is_repeat=? WHERE id=?',[$now,$repeat,$o['id']]);
  sql('UPDATE contacts SET orders_paid=orders_paid+1,spent_in_cents=spent_in_cents+?,last_order_at=?,first_paid_at=COALESCE(first_paid_at,?) WHERE id=?',[(int)$o['amount_in_cents'],$now,$now,$c['id']]);
  sql("UPDATE coupon_redemptions SET status='applied' WHERE order_id=? AND status IN ('reserved','void')",[$o['id']]);   // a cancelled order that gets paid anyway did use the coupon
  if($o['send_token']){sql('UPDATE campaign_sends SET converted_order_id=? WHERE token=? AND converted_order_id IS NULL',[$o['id'],$o['send_token']]);sql('UPDATE automation_runs SET converted_order_id=? WHERE token=? AND converted_order_id IS NULL',[$o['id'],$o['send_token']]);}
  trackInsert($o['visitor_id']?:str_repeat('0',16),'purchase',['order_id'=>$o['id'],'value'=>(int)$o['amount_in_cents'],'props'=>['product'=>$o['product_code'],'coupon'=>$o['coupon_code'],'repeat'=>$repeat],'us'=>$o['last_source'],'uc'=>$o['last_campaign']]);
 });
}
function growthOnCancelled(array $o): void {
 if(!growthSchemaReady())return;
 growthSafe(function()use($o){sql("UPDATE coupon_redemptions SET status='void' WHERE order_id=? AND status='reserved'",[$o['id']]);});
}
