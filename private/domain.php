<?php
declare(strict_types=1);
function history(array $order,string $note,string $actor='system',bool $visible=true):void {
 sql('INSERT INTO order_history(order_id,status,stage,note,actor,visible) VALUES(?,?,?,?,?,?)',[$order['id'],$order['status'],$order['production_stage'],$note,$actor,(int)$visible]);
}
function enqueue(string $key,string $recipient,string $subject,string $body):void {
 if(!filter_var($recipient,FILTER_VALIDATE_EMAIL))return;
 sql('INSERT IGNORE INTO mail_queue(dedupe_key,recipient,subject,body) VALUES(?,?,?,?)',[$key,$recipient,$subject,$body]);
}
function customerFor(array $order):array {return sql('SELECT * FROM customers WHERE id=?',[$order['customer_id']])->fetch();}
function privateLink(array $order):string {
 // Deterministic secret token is recoverable for transactional email without storing plaintext tokens.
 need(strlen(env('APP_KEY'))>=32,'Falta configurar la clave de la aplicación.',503);
 return hash_hmac('sha256','order:'.$order['reference'],env('APP_KEY'));
}
function notifyOrder(array $o,string $subject,string $message,string $key):void {
 $c=customerFor($o); $url=appUrl('/?session='.$o['reference'].'#token='.privateLink($o));
 enqueue($key.':customer',$c['email'],$subject,"Hola {$c['name']},\n\n$message\n\nSesión {$o['reference']}\nTu acceso privado (no lo compartas):\n$url\n\nFromheartbeat");
 enqueue($key.':team',env('TEAM_EMAIL'),$subject,"Pedido {$o['reference']}\n$message\nRevisar en ".appUrl('/admin.html'));
}
function orderView(array $o,bool $isAdmin=false):array {
 $o['brief']=json_decode($o['brief'],true); unset($o['idempotency_key'],$o['request_hash'],$o['token_hash']);
 $o['customer']=customerFor($o); $o['product']=catalog()[$o['product_code']];
 $o['history']=sql('SELECT status,stage,note,actor,created_at'.($isAdmin?',visible':'').' FROM order_history WHERE order_id=?'.($isAdmin?'':' AND visible=1').' ORDER BY id',[$o['id']])->fetchAll();
 $o['files']=sql('SELECT id,original_name,mime,size_bytes,kind,created_at FROM deliverables WHERE order_id=? ORDER BY id',[$o['id']])->fetchAll();
 if($isAdmin)$o['payments']=sql('SELECT * FROM payment_attempts WHERE order_id=? ORDER BY id DESC',[$o['id']])->fetchAll();
 return $o;
}
function accessOrder(string $reference):array {
 sessionBoot(); $o=sql('SELECT * FROM orders WHERE reference=?',[$reference])->fetch();
 need($o && (isset($_SESSION['admin_id']) || (isset($_SESSION['orders'][$reference]) && strtotime($o['token_expires_at'])>time())),'El enlace no es válido o ha vencido.',404); return $o;
}
function validateBrief(array $in,string $audience):array {
 $brief=[]; foreach(['genre'=>[1,40],'mood'=>[1,40],'voice'=>[1,40],'recipient'=>[2,120],'occasion'=>[2,100],'story'=>[30,6000]] as $k=>$limit) $brief[$k]=field($in,$k,...$limit);
 $brief['language']=field($in,'language',0,40)?:'Español'; $brief['tempo']=field($in,'tempo',0,40)?:'A tu criterio';
 need(in_array($brief['genre'],briefChoices('genre'),true),'Género inválido.');
 need(in_array($brief['mood'],briefChoices('mood'),true),'Emoción inválida.');
 need(in_array($brief['voice'],briefChoices('voice'),true),'Voz inválida.');
 need(in_array($brief['language'],briefChoices('language'),true),'Idioma inválido.');
 need(in_array($brief['tempo'],briefChoices('tempo'),true),'Tempo inválido.');
 $brief['details']=field($in,'details',0,2000);
 if($audience==='business')foreach(['brand','campaign','channels','license_scope'] as $k)$brief[$k]=field($in,$k,2,1000);
 return $brief;
}
function createOrder(array $in):array {
 $code=field($in,'product',1,40); $p=catalog()[$code]??null; need((bool)$p,'Selecciona un producto.');
 need(($in['consent']??false)===true,'Acepta los términos y la política de privacidad.');
 $c=['name'=>field($in,'name',2,120),'email'=>strtolower(field($in,'email',5,254)),'phone'=>field($in,'phone',7,40)];
 need((bool)filter_var($c['email'],FILTER_VALIDATE_EMAIL),'Escribe un correo válido.'); $brief=validateBrief($in['brief']??[],$p['audience']);
 $key=field($in,'idempotency_key',32,100); $key=hash('sha256',$key); $requestHash=hash('sha256',json_encode([$code,$c,$brief],JSON_UNESCAPED_UNICODE));
 $existing=sql('SELECT * FROM orders WHERE idempotency_key=?',[$key])->fetch();
 if($existing){need(hash_equals($existing['request_hash'],$requestHash),'Este intento ya contiene otra sesión. Inicia una nueva.',409); need(isset($_SESSION['orders'][$existing['reference']]),'Este pedido ya existe. Usa tu enlace privado.',409);return $existing;}
 db()->beginTransaction();
 try {
  sql('INSERT INTO customers(name,email,phone) VALUES(?,?,?)',array_values($c)); $cid=db()->lastInsertId();
  $ref='FHB-'.date('ymd').'-'.strtoupper(bin2hex(random_bytes(5))); $token=privateLink(['reference'=>$ref]);
  sql('INSERT INTO orders(reference,customer_id,product_code,product_name,amount_in_cents,audience,brief,consent_version,idempotency_key,request_hash,token_hash,token_expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[$ref,$cid,$code,$p['name'],$p['price'],$p['audience'],json_encode($brief,JSON_UNESCAPED_UNICODE),'2026-09-11',$key,$requestHash,hash('sha256',$token),gmdate('Y-m-d H:i:s',time()+86400*(int)env('LINK_DAYS','365'))]);
  $o=sql('SELECT * FROM orders WHERE reference=?',[$ref])->fetch(); history($o,'Historia recibida. Tu sesión está guardada.');
  notifyJourney($o,$p['audience']==='business'?'received_business':'received',[],'created:'.$ref,'Nuevo pedido',$p['audience']==='business'?'Llegó un brief de marca. Revísalo y envía la propuesta con alcance, licencia y precio.':'Entró una historia nueva. Queda pendiente el pago del cliente.');
  db()->commit(); $_SESSION['orders'][$ref]=true; return $o;
 }catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
}
function integrity(string $reference,int $amount,string $currency,string $secret):string {return hash('sha256',$reference.$amount.$currency.$secret);}
function eventChecksum(array $e,string $secret):string {
 need($secret!=='' && is_array($e['signature']['properties']??null) && count($e['signature']['properties'])>0,'Firma no válida.',401);
 $s=''; foreach($e['signature']['properties'] as $path){need(is_string($path),'Firma no válida.',401);$value=$e['data']??[];foreach(explode('.',$path) as $k){need(is_array($value)&&array_key_exists($k,$value),'Firma no válida.',401);$value=$value[$k];}need(is_scalar($value),'Firma no válida.',401);$s.=(string)$value;}
 need(is_int($e['timestamp']??null),'Fecha de evento no válida.',401);return hash('sha256',$s.$e['timestamp'].$secret);
}
// Sandbox tools (test kit, mailbox, private links in admin) exist only outside production with Wompi test keys.
function testMode():bool {return env('APP_ENV')!=='production'&&env('WOMPI_ENV','test')!=='prod';}
function wompiGet(string $path):array {
 $prefix=env('WOMPI_ENV','test')==='prod'?'prv_prod_':'prv_test_';need(str_starts_with(env('WOMPI_PRIVATE_KEY'),$prefix),'Falta configurar la verificación privada de Wompi.',503);
 $host=env('WOMPI_ENV','test')==='prod'?'https://production.wompi.co/v1':'https://sandbox.wompi.co/v1';
 $ch=curl_init($host.$path);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>20,CURLOPT_HTTPHEADER=>['Accept: application/json','Authorization: Bearer '.env('WOMPI_PRIVATE_KEY')],CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
 $raw=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);need($raw!==false&&$code===200,'No pudimos verificar el pago con Wompi. Se reintentará.',503);
 $data=json_decode($raw,true);need(is_array($data['data']??null),'Respuesta de pago inválida.',503);
 return $data['data'];
}
function fetchTransaction(string $id):array {
 need((bool)preg_match('/^[A-Za-z0-9-]{1,100}$/',$id),'Transacción inválida.');
 $t=wompiGet('/transactions/'.rawurlencode($id));
 if(isset($t['merchant']['public_key']))need(hash_equals(env('WOMPI_PUBLIC_KEY'),$t['merchant']['public_key']),'El comercio de la transacción no corresponde.',422);
 return $t;
}
// Pull the result of open payment attempts from Wompi by reference. Covers a missed or delayed webhook
// and local development, where Wompi can neither redirect back to http://127.0.0.1 nor reach the webhook.
function syncPayments(array $o):array {
 if(!in_array($o['status'],['created','payment_pending','cancelled'],true))return $o;
 $refs=sql("SELECT reference FROM payment_attempts WHERE order_id=? AND status IN ('CREATED','PENDING')",[$o['id']])->fetchAll(PDO::FETCH_COLUMN);
 foreach($refs as $ref){
  $list=array_filter(wompiGet('/transactions?reference='.rawurlencode($ref)),fn($t)=>($t['reference']??'')===$ref);
  usort($list,fn($a,$b)=>(($b['status']??'')==='APPROVED')<=>(($a['status']??'')==='APPROVED'));
  foreach($list as $t){try{applyPayment($t,hash('sha256','sync:'.$t['id'].':'.$t['status']));break;}catch(HttpError $e){error_log('FHB sync '.$ref.' '.$e->getMessage());}}
 }
 return sql('SELECT * FROM orders WHERE id=?',[$o['id']])->fetch();
}
// Test kit: attaches the deliverables required to complete a sandbox order (MP3, WAV, cover).
function attachTestKit(array $o):int {
 need(testMode(),'Disponible sólo en el entorno de pruebas.',403);
 $wav=tempnam(sys_get_temp_dir(),'fhb');$rate=8000;$samples=$rate*2;$data='';for($i=0;$i<$samples;$i++)$data.=pack('v',(int)(sin($i*2*M_PI*440/$rate)*3000));
 file_put_contents($wav,'RIFF'.pack('V',36+strlen($data)).'WAVEfmt '.pack('VvvVVvv',16,1,1,$rate,$rate*2,2,16).'data'.pack('V',strlen($data)).$data);
 $kit=[[dirname(BASE).'/assets/audio/quedate.mp3','Cancion-prueba.mp3','audio/mpeg',false],[$wav,'Cancion-prueba.wav','audio/wav',true],[dirname(BASE).'/assets/images/icono-logo-png-fromheartbeat.png','Portada-prueba.png','image/png',false]];
 $n=0;foreach($kit as [$src,$name,$mime,$temp]){$store=bin2hex(random_bytes(24)).'.'.pathinfo($name,PATHINFO_EXTENSION);need(copy($src,storage().'/'.$store),'No se pudo copiar el archivo de prueba.',500);if($temp)unlink($src);sql('INSERT INTO deliverables(order_id,storage_name,original_name,mime,size_bytes,kind) VALUES(?,?,?,?,?,?)',[$o['id'],$store,$name,$mime,filesize(storage().'/'.$store),'delivery']);$n++;}
 history($o,'Kit de entregables de prueba añadido.','admin:'.$_SESSION['admin_id'],false);return $n;
}
function applyPayment(array $t,string $checksum):array {
 db()->beginTransaction(); try {
  $a=sql('SELECT * FROM payment_attempts WHERE reference=? FOR UPDATE',[$t['reference']??''])->fetch();need((bool)$a,'Referencia desconocida.',422);
  $o=sql('SELECT * FROM orders WHERE id=? FOR UPDATE',[$a['order_id']])->fetch();
  need((int)($t['amount_in_cents']??-1)===(int)$a['amount_in_cents'] && ($t['currency']??'')===$a['currency'],'El importe o la moneda no corresponden.',422);
  // A reference can see more than one transaction (the customer reopens the window after a PENDING one). An APPROVED one always counts;
  // any other transaction that is not the one already on record is refused.
  $other=$a['transaction_id'] && $a['transaction_id']!==$t['id'];
  need(!$other || ($t['status']??'')==='APPROVED','La referencia pertenece a otra transacción.',409);
  need(in_array($t['status']??'', ['PENDING','APPROVED','DECLINED','ERROR','VOIDED'],true),'Estado de pago desconocido.');
  if(sql('SELECT checksum FROM webhook_events WHERE checksum=?',[$checksum])->fetch()){db()->commit();return $o;}
  sql('INSERT INTO webhook_events(checksum,transaction_id) VALUES(?,?)',[$checksum,$t['id']]);
  if($other && $a['status']==='APPROVED'){ // a second approved transaction on an attempt that was already paid: the studio must reconcile it (possible double charge)
   sql('UPDATE orders SET requires_attention=1 WHERE id=?',[$o['id']]);history($o,'Se recibió una segunda aprobación para el mismo intento de pago. Conciliar posible pago duplicado.','wompi',false);enqueue('duplicate:'.$t['id'],env('TEAM_EMAIL'),'Revisar pago adicional '.$o['reference'],'Revisar transacción '.$t['id'].' en Wompi antes de realizar cualquier reembolso.');
   db()->commit();return $o;
  }
  if($a['status']!=='APPROVED')sql('UPDATE payment_attempts SET transaction_id=?,status=? WHERE id=?',[$t['id'],$t['status'],$a['id']]);
  if($t['status']==='APPROVED' && $a['status']!=='APPROVED') {
   if(in_array($o['status'],['created','payment_pending','cancelled'],true)) {
    $attention=$o['status']==='cancelled'?1:0;$o['status']='paid';sql('UPDATE orders SET status=?,requires_attention=? WHERE id=?',['paid',$attention,$o['id']]);history($o,'Pago confirmado. Tu sesión ha comenzado.','wompi');notifyJourney($o,'paid',['at'=>gmdate('Y-m-d H:i:s'),'transaction'=>(string)$t['id']],'paid:'.$o['reference'],'Pago confirmado','Wompi confirmó el pago. La sesión pasó a «Pagado»: toca comenzar la producción.');
   } else { sql('UPDATE orders SET requires_attention=1 WHERE id=?',[$o['id']]);history($o,'Se recibió una aprobación adicional. Conciliar posible pago duplicado.','wompi',false);enqueue('duplicate:'.$t['id'],env('TEAM_EMAIL'),'Revisar pago adicional '.$o['reference'],'Revisar transacción '.$t['id'].' en Wompi antes de realizar cualquier reembolso.'); }
  }
  if(in_array($t['status'],['DECLINED','ERROR'],true) && in_array($o['status'],['created','payment_pending'],true))notifyJourney($o,'payment_failed',['payment'=>$t['status']],'payfail:'.$t['id']);
  if($t['status']==='VOIDED' && $a['status']==='APPROVED'){sql('UPDATE orders SET requires_attention=1 WHERE id=?',[$o['id']]);history($o,'Wompi notificó anulación de un pago aprobado. Requiere conciliación.','wompi',false);}
  db()->commit();return $o;
 }catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
}
function checkout(array $o):array {
 need(env('COMMERCE_READY')==='true','El estudio aún está configurando los pagos. Tu sesión quedó guardada.',503);
 if(env('APP_ENV')==='production') {
  need(str_starts_with(appUrl(),'https://') && env('SESSION_SECURE')==='true','Falta configurar HTTPS para los pagos.',503);
  need(env('LEGAL_NAME')!=='' && env('LEGAL_TAX_ID')!=='' && env('LEGAL_ADDRESS')!=='' && filter_var(env('SUPPORT_EMAIL'),FILTER_VALIDATE_EMAIL)!==false,'Falta completar la información comercial del estudio.',503);
  need(env('SMTP_HOST')!==''&&env('SMTP_USERNAME')!==''&&env('SMTP_PASSWORD')!==''&&env('MAIL_FROM')!==''&&env('TEAM_EMAIL')!==''&&env('MAIL_TRANSPORT')==='smtp','Falta configurar el correo transaccional.',503);
  need(env('WOMPI_ENV')==='prod'&&str_starts_with(env('WOMPI_PUBLIC_KEY'),'pub_prod_')&&str_starts_with(env('WOMPI_PRIVATE_KEY'),'prv_prod_')&&env('WOMPI_EVENTS_SECRET')!=='','Falta configurar Wompi para producción.',503);
 }
 need(env('WOMPI_PUBLIC_KEY')!==''&&env('WOMPI_INTEGRITY_SECRET')!=='','Los pagos aún no están disponibles.',503);
 need($o['audience']==='person'||$o['quoted_at']!==null,'Primero acordaremos el alcance y la licencia de tu proyecto.',409);
 db()->beginTransaction();try {
  $o=sql('SELECT * FROM orders WHERE id=? FOR UPDATE',[$o['id']])->fetch();need(in_array($o['status'],['created','payment_pending'],true),'Este pedido no admite otro pago.',409);
  $a=sql("SELECT * FROM payment_attempts WHERE order_id=? AND status IN ('CREATED','PENDING') ORDER BY id DESC LIMIT 1",[$o['id']])->fetch();
  if(!$a){$ref=$o['reference'].'-'.strtoupper(bin2hex(random_bytes(4)));sql('INSERT INTO payment_attempts(order_id,reference,amount_in_cents,currency) VALUES(?,?,?,?)',[$o['id'],$ref,$o['amount_in_cents'],$o['currency']]);$a=['reference'=>$ref];}
  if($o['status']==='created'){$o['status']='payment_pending';sql('UPDATE orders SET status=? WHERE id=?',['payment_pending',$o['id']]);history($o,'Pago pendiente de confirmación.');}db()->commit();
 }catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
 $params=['public-key'=>env('WOMPI_PUBLIC_KEY'),'currency'=>'COP','amount-in-cents'=>(int)$o['amount_in_cents'],'reference'=>$a['reference'],'signature:integrity'=>integrity($a['reference'],(int)$o['amount_in_cents'],'COP',env('WOMPI_INTEGRITY_SECRET'))];
 // Wompi's edge rejects checkouts whose return URL is not public HTTPS (e.g. local http://127.0.0.1), so only send it then.
 if(str_starts_with(appUrl(),'https://'))$params['redirect-url']=appUrl('/?session='.$o['reference']);
 // 'widget' lets the page open Wompi's secure window on top of the studio (no redirect); 'url' is the fallback.
 return ['url'=>'https://checkout.wompi.co/p/?'.http_build_query($params),'reference'=>$o['reference'],'widget'=>['currency'=>'COP','amountInCents'=>(int)$o['amount_in_cents'],'reference'=>$a['reference'],'publicKey'=>env('WOMPI_PUBLIC_KEY'),'signature'=>['integrity'=>$params['signature:integrity']]]];
}
