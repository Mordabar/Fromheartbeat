<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';
require __DIR__.'/private/music.php';
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
try {
 $action=$_GET['action']??'bootstrap'; $method=$_SERVER['REQUEST_METHOD'];
 if($action==='webhook') {
  need($method==='POST','Método no permitido.',405);$e=input();$expected=eventChecksum($e,env('WOMPI_EVENTS_SECRET'));need(hash_equals($expected,strtolower($e['signature']['checksum']??'')),'Firma no válida.',401);
  need(($e['environment']??'')===env('WOMPI_ENV','test'),'Entorno incorrecto.',401);
  if(($e['event']??'')!=='transaction.updated')jsonResponse(['received'=>true]);
  $remote=fetchTransaction((string)($e['data']['transaction']['id']??''));
  // Authoritative API result prevents tampering with reference/currency outside signed properties.
  $o=applyPayment($remote,$expected);jsonResponse(['received'=>true]);
 }
 sessionBoot();
 if($method==='POST')csrf();
 if($action==='bootstrap'&&$method==='GET')jsonResponse(['csrf'=>$_SESSION['csrf'],'tracks'=>musicPublic(),'catalog'=>array_values(catalog()),'options'=>briefOptions(),'content'=>siteContent(),'admin'=>isset($_SESSION['admin_id']),'environment'=>env('APP_ENV','production'),'commerceReady'=>env('COMMERCE_READY')==='true','testMode'=>testMode(),'heroVideo'=>env('HERO_VIDEO')==='true'&&is_file(__DIR__.'/assets/video/studio-loop.mp4')?'assets/video/studio-loop.mp4':null,'uploads'=>filesPublicConfig(),'support'=>env('SUPPORT_EMAIL'),'legal'=>['name'=>env('LEGAL_NAME'),'taxId'=>env('LEGAL_TAX_ID'),'address'=>env('LEGAL_ADDRESS')]]);
 if($action==='music-media'&&$method==='GET')musicStream();
 if($action==='admin-music'&&$method==='GET'){admin();jsonResponse(['tracks'=>musicRead()]);}
 if($action==='admin-music-save'&&$method==='POST')musicSave();
 if($action==='feedback'&&$method==='POST'){
  $in=input();$o=accessOrder(field($in,'reference',1,40));need(in_array($o['status'],['in_production','review','completed'],true),'Los comentarios estarán disponibles al iniciar la producción.',409);rate('feedback',12,3600);$message=field($in,'message',3,2000);
  db()->beginTransaction();try{history($o,'Comentario del cliente: '.$message,'customer');sql('UPDATE orders SET requires_attention=1 WHERE id=?',[$o['id']]);db()->commit();}catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}jsonResponse(['ok'=>true]);
 }
 if($action==='orders'&&$method==='POST'){rate('create',12,3600);$o=createOrder(input());jsonResponse(['order'=>orderView($o)],201);}
 if($action==='exchange'&&$method==='POST') {
  rate('exchange',30,900);$in=input();$ref=field($in,'reference',1,40);$token=field($in,'token',64,64);$o=sql('SELECT * FROM orders WHERE reference=? AND token_expires_at > UTC_TIMESTAMP()',[$ref])->fetch();
  need($o&&hash_equals($o['token_hash'],hash('sha256',$token)),'El enlace no es válido o ha vencido.',401);session_regenerate_id(true);$_SESSION['orders'][$ref]=true;jsonResponse(['ok'=>true]);
 }
 if($action==='recover'&&$method==='POST') {
  rate('recover',3,3600);$in=input();$email=strtolower(field($in,'email',5,254));
  $orders=sql('SELECT o.* FROM orders o JOIN customers c ON o.customer_id=c.id WHERE c.email=? AND o.token_expires_at>UTC_TIMESTAMP() ORDER BY o.id DESC LIMIT 10',[$email])->fetchAll();
  foreach($orders as $o)notifyJourney($o,'recover',[],'recover:'.$o['reference'].':'.intdiv(time(),3600));
  jsonResponse(['message'=>'Si hay sesiones activas con ese correo, recibirás sus enlaces privados.']);
 }
 if($action==='order'&&$method==='GET'){$o=accessOrder((string)($_GET['reference']??''));$last=$_SESSION['synced'][$o['reference']]??0;if(in_array($o['status'],['created','payment_pending'],true)&&time()-$last>=4){$_SESSION['synced'][$o['reference']]=time();try{$o=syncPayments($o);}catch(Throwable $e){error_log('FHB sync '.$e->getMessage());}}jsonResponse(['order'=>orderView($o)]);}
 if($action==='my-orders'&&$method==='GET'){$refs=array_keys($_SESSION['orders']??[]);$rows=$refs?sql('SELECT reference,product_name,amount_in_cents,status,production_stage,created_at FROM orders WHERE reference IN ('.implode(',',array_fill(0,count($refs),'?')).') ORDER BY id DESC',$refs)->fetchAll():[];jsonResponse(['orders'=>$rows]);}
 if($action==='checkout'&&$method==='POST'){$in=input();jsonResponse(checkout(accessOrder(field($in,'reference',1,40))));}
 if($action==='reconcile'&&$method==='POST') {
  rate('reconcile',30,900);$in=input();$o=accessOrder(field($in,'reference',1,40));$t=fetchTransaction(field($in,'transaction',1,100));
  need((bool)sql('SELECT id FROM payment_attempts WHERE reference=? AND order_id=?',[$t['reference'],$o['id']])->fetch(),'La transacción no pertenece a esta sesión.',403);
  applyPayment($t,hash('sha256','reconcile:'.$t['id'].':'.$t['status']));jsonResponse(['ok'=>true]);
 }
 if($action==='login'&&$method==='POST') {
  rate('admin-login',8,900);$in=input();$a=sql('SELECT * FROM admins WHERE email=?',[strtolower(field($in,'email',5,254))])->fetch();
  $valid=password_verify(field($in,'password',1,200),$a['password_hash']??'$2y$10$7EqJtq98hPqEX7fNZaFWoO5KKtHwQYgyJZnR11pRcLOEQtK8KCIe.');
  need($a&&$valid,'Correo o contraseña incorrectos.',401);session_regenerate_id(true);$_SESSION['admin_id']=(int)$a['id'];jsonResponse(['ok'=>true]);
 }
 if($action==='logout'&&$method==='POST'){$_SESSION=[];session_destroy();jsonResponse(['ok'=>true]);}
 if($action==='admin-orders'&&$method==='GET') {
  admin();$q=trim((string)($_GET['q']??''));$status=(string)($_GET['status']??'');
  $params=['%'.$q.'%','%'.$q.'%','%'.$q.'%'];$statusSql='';if($status!==''){$statusSql=' AND o.status=?';$params[]=$status;}
  $rows=sql('SELECT o.id,o.reference,o.product_name,o.amount_in_cents,o.status,o.production_stage,o.requires_attention,o.created_at,c.name,c.email,(SELECT h.actor FROM order_history h WHERE h.order_id=o.id AND (h.visible=1 OR h.note LIKE \'Atendida sin mensaje%\') AND h.actor<>\'wompi\' AND h.actor<>\'system\' AND h.note NOT LIKE \'Versión disponible:%\' AND h.note NOT LIKE \'Archivo añadido:%\' ORDER BY h.id DESC LIMIT 1) AS last_voice FROM orders o JOIN customers c ON c.id=o.customer_id WHERE (o.reference LIKE ? OR c.email LIKE ? OR c.name LIKE ?)'.$statusSql.' ORDER BY o.id DESC LIMIT 200',$params)->fetchAll();jsonResponse(['orders'=>$rows]);
 }
 if($action==='admin-order'&&$method==='GET'){admin();$o=orderView(accessOrder((string)($_GET['reference']??'')),true);if(testMode()){$o['testLink']=appUrl('/?session='.$o['reference'].'#token='.privateLink($o));$o['mails']=sql('SELECT recipient,subject,body,created_at FROM mail_queue WHERE dedupe_key LIKE ? ORDER BY id DESC',['%'.$o['reference'].'%'])->fetchAll();}jsonResponse(['order'=>$o]);}
 if($action==='admin-sync'&&$method==='POST'){admin();$o=syncPayments(accessOrder(field(input(),'reference',1,40)));jsonResponse(['status'=>$o['status']]);}
 if($action==='admin-test-kit'&&$method==='POST'){admin();jsonResponse(['added'=>attachTestKit(accessOrder(field(input(),'reference',1,40)))],201);}
 if($action==='admin-update'&&$method==='POST') {
  $aid=admin();$in=input();$ref=field($in,'reference',1,40);$note=field($in,'note',3,2000);$status=field($in,'status',1,24);$stage=filter_var($in['stage']??null,FILTER_VALIDATE_INT);need($stage!==false&&$stage>=0&&$stage<=5,'Etapa inválida.');
  $visible=($in['visible']??true)===true;need(!(($in['notify']??false)===true&&!$visible),'Una nota interna no puede enviarse al cliente.');
  db()->beginTransaction();try{
   $o=sql('SELECT * FROM orders WHERE reference=? FOR UPDATE',[$ref])->fetch();need((bool)$o,'Pedido no encontrado.',404);
   $allowed=['created'=>['created','cancelled'],'payment_pending'=>['payment_pending','cancelled'],'paid'=>['paid','in_production'],'in_production'=>['in_production','review','completed'],'review'=>['review','in_production','completed'],'completed'=>['completed','review'],'cancelled'=>['cancelled']];
   need(in_array($status,$allowed[$o['status']],true),'Transición de estado no permitida. El pago sólo lo confirma Wompi.',409);
   need($stage===0||in_array($status,['paid','in_production','review','completed'],true),'Primero debe confirmarse el pago.');
   if($status==='completed'){
    $mimes=sql("SELECT mime FROM deliverables WHERE order_id=? AND kind='delivery'",[$o['id']])->fetchAll(PDO::FETCH_COLUMN);
    need(in_array('audio/mpeg',$mimes,true),'Falta el MP3 de entrega.');
    if($o['product_code']!=='dedicatoria')need(count(array_intersect($mimes,['audio/wav','audio/x-wav']))>0,'Falta el WAV de entrega.');
    if($o['audience']==='person')need(count(array_intersect($mimes,['image/png','image/jpeg','image/webp']))>0,'Falta la portada de entrega.');
    if($o['product_code']==='full')need(in_array('video/mp4',$mimes,true),'Falta el video de Full Experience.');
   }
   if($status==='completed')$stage=5;
   $prevStatus=$o['status'];$prevStage=(int)$o['production_stage'];
   sql('UPDATE orders SET status=?,production_stage=?,requires_attention=? WHERE id=?',[$status,$stage,($in['attention']??false)?1:0,$o['id']]);$o['status']=$status;$o['production_stage']=$stage;history($o,$note,'admin:'.$aid,$visible);
   $changed=$status!==$prevStatus||($status==='in_production'&&$stage>$prevStage);
   if(($in['notify']??false)===true)notifyJourney($o,$changed?(['in_production'=>'production','review'=>'review','completed'=>'completed','cancelled'=>'cancelled'][$status]??'update'):'update',['note'=>$note],'update:'.$ref.':'.bin2hex(random_bytes(6)),'Novedad enviada al cliente',$note);
   db()->commit();jsonResponse(['ok'=>true]);
  }catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
 }
 if($action==='admin-quote'&&$method==='POST') {
  $aid=admin();$in=input();$o=accessOrder(field($in,'reference',1,40));$amount=filter_var($in['amount']??null,FILTER_VALIDATE_INT);$scope=field($in,'scope',20,4000);
  need($o['audience']==='business'&&$o['status']==='created','Este pedido no admite cotización.',409);need($amount!==false&&$amount>=(int)catalog()[$o['product_code']]['price']&&$amount<=10000000000,'Importe inválido.');
  db()->beginTransaction();try{$o=sql('SELECT * FROM orders WHERE id=? FOR UPDATE',[$o['id']])->fetch();need($o['status']==='created','El pedido ha cambiado. Actualiza la vista.',409);$b=json_decode($o['brief'],true);$b['agreed_scope']=$scope;sql('UPDATE orders SET amount_in_cents=?,brief=?,quoted_at=UTC_TIMESTAMP() WHERE id=?',[$amount,json_encode($b,JSON_UNESCAPED_UNICODE),$o['id']]);history($o,'Cotización disponible. Alcance y licencia: '.$scope,'admin:'.$aid);notifyJourney($o,'quote',[],'quote:'.$o['reference'].':'.bin2hex(random_bytes(5)),'Propuesta enviada','Enviaste la propuesta al cliente. Queda pendiente su pago.');db()->commit();jsonResponse(['ok'=>true]);}catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
 }
 if($action==='upload-init'&&$method==='POST')filesInit();
 if($action==='upload-status'&&$method==='GET')filesStatus();
 if($action==='upload-chunk'&&$method==='POST')filesChunk();
 if($action==='upload-finish'&&$method==='POST')filesFinish();
 if($action==='upload-cancel'&&$method==='POST')filesCancel();
 if($action==='upload-done'&&$method==='POST')filesDone();
 if($action==='file-delete'&&$method==='POST')filesDelete();
 if($action==='upload'&&$method==='POST') { // formulario clásico (un archivo, hasta el límite de PHP); el cargador por partes es el camino normal
  $o=accessOrder((string)($_POST['reference']??''));$isAdmin=isset($_SESSION['admin_id']);$f=$_FILES['file']??null;
  need($f&&$f['error']===UPLOAD_ERR_OK,'No se pudo recibir el archivo. Usa el cargador de la sesión para archivos grandes.');
  $r=filesCommit($o,$isAdmin,$isAdmin?(string)($_POST['kind']??'delivery'):'source',$f['tmp_name'],(string)$f['name'],fn(string $dest)=>move_uploaded_file($f['tmp_name'],$dest));jsonResponse(['ok'=>true,'file'=>$r],201);
 }
 if($action==='file'&&$method==='GET') {
  $f=sql('SELECT d.*,o.reference FROM deliverables d JOIN orders o ON o.id=d.order_id WHERE d.id=?',[(int)($_GET['id']??0)])->fetch();need((bool)$f,'Archivo no encontrado.',404);accessOrder($f['reference']);$path=storage().'/'.$f['storage_name'];need(is_file($path),'Archivo no disponible.',404);
  session_write_close();header('Content-Type: '.$f['mime']);header('Accept-Ranges: bytes');header_remove('Pragma');header_remove('Expires');header('Cache-Control: private, max-age=3600');header("Content-Disposition: ".(isset($_GET['download'])?'attachment':'inline')."; filename*=UTF-8''".rawurlencode($f['original_name']));
  $size=filesize($path);$start=0;$end=$size-1;
  if(isset($_SERVER['HTTP_RANGE'])){need((bool)preg_match('/^bytes=(\d*)-(\d*)$/',$_SERVER['HTTP_RANGE'],$m),'Rango inválido.',416);if($m[1]===''){$start=max(0,$size-(int)$m[2]);}else{$start=(int)$m[1];if($m[2]!=='')$end=min($end,(int)$m[2]);}need($start<=$end&&$start<$size,'Rango inválido.',416);http_response_code(206);header("Content-Range: bytes $start-$end/$size");}
  header('Content-Length: '.($end-$start+1));$fp=fopen($path,'rb');fseek($fp,$start);$left=$end-$start+1;while($left>0&&!feof($fp)){ $chunk=fread($fp,min(65536,$left));echo $chunk;$left-=strlen($chunk);}fclose($fp);exit;
 }
 throw new HttpError(404,'Ruta no encontrada.');
}catch(HttpError $e){jsonResponse(['error'=>$e->getMessage()],$e->statusCode);}catch(Throwable $e){$id=bin2hex(random_bytes(6));error_log('FHB '.$id.' '.get_class($e).' '.$e->getMessage());jsonResponse(['error'=>'No pudimos completar la solicitud. Inténtalo de nuevo. Referencia: '.$id],500);}
