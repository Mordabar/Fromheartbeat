<?php
// Pagos repetidos sobre una misma referencia (PENDING y luego APPROVED, o dos APPROVED). Usa la copia de pruebas con SQLite.
//   bash tests/support/serve.sh && php tests/payment-dupes.php [/tmp/fhb-harness]
$W=$argv[1]??'/tmp/fhb-harness';putenv('FHB_SQLITE='.$W.'/dupes.sqlite');putenv('FHB_ENV_FILE='.$W.'/app/private/config/.env');putenv('STORAGE_PATH='.$W.'/storage');@unlink($W.'/dupes.sqlite');
require $W.'/app/private/bootstrap.php';$ok=0;$bad=0;
function t(string $n,bool $c,string $x=''):void{global $ok,$bad;if($c){$ok++;echo "  ok   $n\n";}else{$bad++;echo "  FAIL $n $x\n";}}
function order():array{sql("INSERT INTO customers(name,email,phone) VALUES('A','a@b.co','3001234567')");$cid=db()->lastInsertId();$ref='FHB-T-'.bin2hex(random_bytes(3));
 sql("INSERT INTO orders(reference,customer_id,product_code,product_name,amount_in_cents,audience,brief,consent_version,idempotency_key,request_hash,token_hash,token_expires_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",[$ref,$cid,'personalizada','Canción Personalizada',12990000,'person','{}','x',bin2hex(random_bytes(8)),'h','t','2099-01-01','payment_pending']);
 $o=sql('SELECT * FROM orders WHERE reference=?',[$ref])->fetch();$pr=$ref.'-AAAA1111';sql("INSERT INTO payment_attempts(order_id,reference,amount_in_cents,currency,status) VALUES(?,?,?,?,?)",[$o['id'],$pr,12990000,'COP','CREATED']);return [$o,$pr];}
$tx=fn($ref,$id,$st)=>['id'=>$id,'reference'=>$ref,'status'=>$st,'amount_in_cents'=>12990000,'currency'=>'COP'];
[$o,$pr]=order();applyPayment($tx($pr,'tx1','PENDING'),'c1');
t('una transacción PENDING deja el pedido pendiente',sql('SELECT status FROM orders WHERE id=?',[$o['id']])->fetchColumn()==='payment_pending');
applyPayment($tx($pr,'tx2','APPROVED'),'c2');
t('una APPROVED posterior sobre la misma referencia SÍ paga el pedido',sql('SELECT status FROM orders WHERE id=?',[$o['id']])->fetchColumn()==='paid',sql('SELECT status FROM orders WHERE id=?',[$o['id']])->fetchColumn());
t('y el intento queda con la transacción aprobada',sql('SELECT transaction_id FROM payment_attempts WHERE reference=?',[$pr])->fetchColumn()==='tx2');
applyPayment($tx($pr,'tx3','APPROVED'),'c3');
t('una segunda APPROVED marca el pedido para conciliar',(int)sql('SELECT requires_attention FROM orders WHERE id=?',[$o['id']])->fetchColumn()===1);
t('y avisa al equipo (correo «pago adicional»)',(int)sql("SELECT COUNT(*) FROM mail_queue WHERE dedupe_key='duplicate:tx3'")->fetchColumn()===1);
applyPayment($tx($pr,'tx3','APPROVED'),'c3');applyPayment($tx($pr,'tx3','APPROVED'),'c3b');
t('repetir el aviso no duplica correos ni historia',(int)sql("SELECT COUNT(*) FROM mail_queue WHERE dedupe_key='duplicate:tx3'")->fetchColumn()===1);
try{applyPayment($tx($pr,'tx9','DECLINED'),'c9');t('una DECLINED de otra transacción se rechaza',false);}catch(HttpError $e){t('una DECLINED de otra transacción se rechaza',$e->statusCode===409);}
[$o2,$pr2]=order();applyPayment($tx($pr2,'tx5','DECLINED'),'d1');
t('DECLINED no paga',sql('SELECT status FROM orders WHERE id=?',[$o2['id']])->fetchColumn()==='payment_pending');
[$o3,$pr3]=order();try{applyPayment(['id'=>'tx6','reference'=>$pr3,'status'=>'APPROVED','amount_in_cents'=>100,'currency'=>'COP'],'e1');t('importe distinto se rechaza',false);}catch(HttpError $e){t('importe distinto se rechaza',$e->statusCode===422);}
echo "\n$ok bien, $bad mal\n";exit($bad?1:0);
