<?php
// Crecimiento: precios, cupones, contactos, consentimientos, segmentos, campañas, automatizaciones, SMS y analítica.
//   bash tests/support/serve.sh && php tests/growth.php [/tmp/fhb-harness]
$W=$argv[1]??'/tmp/fhb-harness';putenv('FHB_SQLITE='.$W.'/growth.sqlite');putenv('FHB_ENV_FILE='.$W.'/app/private/config/.env');putenv('STORAGE_PATH='.$W.'/storage-growth');@unlink($W.'/growth.sqlite');
$_SERVER['REMOTE_ADDR']='127.0.0.1';$_SESSION=[];
require $W.'/app/private/bootstrap.php';$ok=0;$bad=0;
function t(string $n,bool $c,string $x=''):void{global $ok,$bad;if($c){$ok++;echo "  ok   $n\n";}else{$bad++;echo "  FAIL $n $x\n";}}
function thrown(callable $f,?string $contains=null):?string{try{$f();return null;}catch(HttpError $e){return $e->getMessage();}}
$brief=['genre'=>'Pop','mood'=>'Romántica','voice'=>'Femenina','recipient'=>'Mamá','occasion'=>'Cumpleaños','story'=>str_repeat('x',40),'language'=>'Español','tempo'=>'A tu criterio','details'=>''];
function buy(string $email,string $product='personalizada',array $extra=[]):array{global $brief;$_SESSION=['orders'=>[]];
 return createOrder($extra+['product'=>$product,'consent'=>true,'name'=>'Ana '.substr($email,0,3),'email'=>$email,'phone'=>'3001234567','brief'=>$brief,'idempotency_key'=>bin2hex(random_bytes(20))]);}
function pay(array $o):void{$ref=$o['reference'].'-PAY'.bin2hex(random_bytes(2));sql('INSERT INTO payment_attempts(order_id,reference,amount_in_cents,currency,status) VALUES(?,?,?,?,?)',[$o['id'],$ref,$o['amount_in_cents'],'COP','CREATED']);
 applyPayment(['id'=>'tx'.bin2hex(random_bytes(3)),'reference'=>$ref,'status'=>'APPROVED','amount_in_cents'=>(int)$o['amount_in_cents'],'currency'=>'COP'],bin2hex(random_bytes(8)));}
function coupon(array $o):int{$d=$o+['label'=>'','min_amount_in_cents'=>0,'max_discount_in_cents'=>null,'product_codes'=>null,'first_order_only'=>0,'returning_only'=>0,'contact_id'=>null,'starts_at'=>null,'ends_at'=>null,'max_redemptions'=>null,'per_contact_limit'=>1,'stackable'=>0,'active'=>1,'source'=>'manual','created_at'=>nowUtc()];
 sql('INSERT INTO coupons('.implode(',',array_keys($d)).') VALUES('.inList($d).')',array_values($d));return (int)db()->lastInsertId();}
function getO(int $id):array{return sql('SELECT * FROM orders WHERE id=?',[$id])->fetch();}
$LIST=12990000;   // personalizada

echo "— esquema\n";
t('la migración crea todo la primera vez',growthEnsure()===true);
growthMigrate();growthMigrate();t('y se puede repetir sin error',true);
t('las 4 automatizaciones vienen creadas y apagadas',(int)sql('SELECT COUNT(*) FROM automations WHERE enabled=0')->fetchColumn()===4);

echo "— precios\n";
$q=priceQuote('personalizada');t('sin promociones el precio es el de lista',$q['total']===$LIST&&$q['discount']===0);
sql("INSERT INTO promotions(name,kind,value,badge,banner,active,created_at) VALUES('Mes de la madre','percent',20,'-20%','Mes de la madre: 20 % en todas las canciones',1,?)",[nowUtc()]);
$q=priceQuote('personalizada');t('la promoción activa se aplica sola (20 %)',$q['total']===$LIST-intdiv($LIST*20,100)&&$q['promo']['name']==='Mes de la madre');
t('el banner público sale de la promoción',str_contains(publicBanner(),'Mes de la madre'));
t('los productos para empresas no cambian de precio',priceQuote('jingle')['total']===catalog()['jingle']['price']);
sql("UPDATE promotions SET ends_at=? WHERE name='Mes de la madre'",[gmdate('Y-m-d H:i:s',time()-60)]);
t('una promoción vencida deja de aplicar',priceQuote('personalizada')['total']===$LIST);
sql("UPDATE promotions SET ends_at=NULL,starts_at=? WHERE name='Mes de la madre'",[gmdate('Y-m-d H:i:s',time()+3600)]);
t('una promoción que aún no empieza no aplica',priceQuote('personalizada')['total']===$LIST);
sql("UPDATE promotions SET starts_at=NULL,active=0 WHERE name='Mes de la madre'");t('una promoción apagada no aplica',priceQuote('personalizada')['total']===$LIST);
sql("UPDATE promotions SET active=1");$promoId=(int)sql("SELECT id FROM promotions")->fetchColumn();
coupon(['code'=>'AMOR10','kind'=>'percent','value'=>10]);
$q=priceQuote('personalizada','amor10');t('un cupón peor que la promoción no la reemplaza: se vende al precio de temporada y se avisa (sin bloquear)',$q['coupon']===null&&$q['coupon_error']===null&&$q['coupon_note']!==null&&$q['total']===$LIST-intdiv($LIST*20,100),json_encode($q['coupon_note']));
coupon(['code'=>'AMOR30','kind'=>'percent','value'=>30]);
$q=priceQuote('personalizada',' amor30 ');t('un cupón mejor reemplaza la promoción (se escribe en cualquier formato)',$q['coupon']['code']==='AMOR30'&&$q['total']===$LIST-intdiv($LIST*30,100)&&$q['promo']===null);
coupon(['code'=>'SUMA5','kind'=>'percent','value'=>5,'stackable'=>1]);
$q=priceQuote('personalizada','SUMA5');t('un cupón acumulable se suma a la promoción',$q['promo']!==null&&$q['coupon']['code']==='SUMA5'&&$q['total']===$LIST-intdiv($LIST*20,100)-intdiv(($LIST-intdiv($LIST*20,100))*5,100));
coupon(['code'=>'REGALA','kind'=>'fixed','value'=>99999999]);sql("UPDATE promotions SET active=0");
$q=priceQuote('personalizada','REGALA');t('ningún descuento deja el total bajo el piso de pago',$q['total']===PRICE_FLOOR&&$q['discount']===$LIST-PRICE_FLOOR);
coupon(['code'=>'TOPE','kind'=>'percent','value'=>50,'max_discount_in_cents'=>1000000]);
t('el tope de descuento se respeta',priceQuote('personalizada','TOPE')['total']===$LIST-1000000);
t('un cupón inexistente da un mensaje',priceQuote('personalizada','NOEXISTE')['coupon_error']!==null);
t('un código con símbolos raros se limpia',priceQuote('personalizada','AMOR10;DROP TABLE')['coupon_error']!==null);
t('la vista pública no expone internos',!array_key_exists('contact_id',(array)(quoteView(priceQuote('personalizada','AMOR10'))['coupon']??[])));

echo "— pedido: el servidor decide el precio\n";
sql("UPDATE promotions SET active=1");
$o=buy('uno@example.com','personalizada',['price'=>1,'amount_in_cents'=>100,'total'=>100]);
t('el navegador no puede fijar el importe',(int)$o['amount_in_cents']===$LIST-intdiv($LIST*20,100)&&(int)$o['list_amount_in_cents']===$LIST&&(int)$o['discount_in_cents']===intdiv($LIST*20,100),json_encode([$o['amount_in_cents'],$o['list_amount_in_cents']]));
$o2=buy('UNO@example.com ','personalizada');
t('un mismo correo es UN contacto, con mayúsculas o espacios',(int)sql('SELECT COUNT(*) FROM contacts WHERE email=?',['uno@example.com'])->fetchColumn()===1&&(int)$o['contact_id']===(int)$o2['contact_id']);
t('cada pedido enlaza su contacto (también en customers)',(int)sql('SELECT contact_id FROM customers WHERE id=?',[$o['customer_id']])->fetchColumn()===(int)$o['contact_id']);
t('sin casilla marcada, no hay consentimiento',(int)sql('SELECT email_optin FROM contacts WHERE id=?',[$o['contact_id']])->fetchColumn()===0&&(int)sql('SELECT COUNT(*) FROM consent_log')->fetchColumn()===0);
$oc=buy('dos@example.com','personalizada',['coupon'=>'amor30','optin_email'=>true,'optin_sms'=>true,'attr'=>['v'=>'vis_abcdefghijklmnop','ft'=>['s'=>'instagram','c'=>'mes-madre'],'lt'=>['s'=>'email<script>','c'=>'camp"1'],'c'=>str_repeat('a',32)]]);
t('con cupón el pedido guarda el código y el descuento',$oc['coupon_code']==='AMOR30'&&(int)$oc['amount_in_cents']===$LIST-intdiv($LIST*30,100));
$ct=contactByEmail('dos@example.com');
t('la casilla de correo solo PIDE el permiso: queda pendiente y se manda un correo de confirmación',!canMarket($ct)&&$ct['email_optin_pending_at']!==null&&(int)sql("SELECT COUNT(*) FROM consent_log WHERE contact_id=? AND action='request'",[$ct['id']])->fetchColumn()===1&&(int)sql("SELECT COUNT(*) FROM mail_queue WHERE recipient='dos@example.com' AND dedupe_key LIKE 'optin:%'")->fetchColumn()===1);
t('el SMS no se activa desde el pago (hace falta verificar el teléfono)',!canMarket($ct,'sms')&&(int)$ct['sms_optin']===0);
consentSet((int)$ct['id'],'email',true,'double-optin');$ct=contactByEmail('dos@example.com');
t('al confirmar desde su correo el permiso queda activo con su prueba',canMarket($ct)&&$ct['email_optin_source']==='double-optin'&&$ct['email_optin_pending_at']===null&&(int)sql("SELECT COUNT(*) FROM consent_log WHERE contact_id=? AND action='grant'",[$ct['id']])->fetchColumn()===1);
consentSet((int)$ct['id'],'sms',true,'test-otp');   // (lo que haría una verificación por código)
t('la atribución se guarda limpia (sin etiquetas ni comillas)',$oc['first_source']==='instagram'&&$oc['last_source']==='emailscript'&&$oc['last_campaign']==='camp1'&&$oc['visitor_id']==='vis_abcdefghijklmnop'&&$oc['send_token']===str_repeat('a',32),json_encode([$oc['last_source'],$oc['last_campaign']]));
t('queda el evento order_created con el importe',(int)sql("SELECT value_in_cents FROM events WHERE name='order_created' AND order_id=?",[$oc['id']])->fetchColumn()===(int)$oc['amount_in_cents']);
t('un cupón inválido impide crear el pedido',thrown(fn()=>buy('tres@example.com','personalizada',['coupon'=>'NOEXISTE']))!==null&&!contactByEmail('tres@example.com'));

echo "— reglas de cupones\n";sql("UPDATE promotions SET active=0");
$cid=(int)$ct['id'];
t('el uso queda reservado mientras el pedido espera pago',(int)sql("SELECT COUNT(*) FROM coupon_redemptions WHERE order_id=? AND status='reserved'",[$oc['id']])->fetchColumn()===1);
t('un segundo uso por la misma persona se bloquea (límite 1)',thrown(fn()=>buy('dos@example.com','personalizada',['coupon'=>'AMOR30']))!==null);
growthOnCancelled($oc);
$oc2=buy('dos@example.com','personalizada',['coupon'=>'AMOR30']);t('si el pedido se cancela, el uso se libera',$oc2['coupon_code']==='AMOR30');
coupon(['code'=>'UNICO','kind'=>'percent','value'=>40,'max_redemptions'=>1]);buy('cuatro@example.com','personalizada',['coupon'=>'UNICO']);
t('un cupón con 1 uso máximo no sirve a otra persona',thrown(fn()=>buy('cinco@example.com','personalizada',['coupon'=>'UNICO']))!==null);
coupon(['code'=>'PRIMERA','kind'=>'percent','value'=>25,'first_order_only'=>1]);coupon(['code'=>'VUELVE','kind'=>'percent','value'=>25,'returning_only'=>1]);
t('«solo para clientes que ya compraron» no sirve a un cliente nuevo',priceQuote('personalizada','VUELVE','nuevo@example.com')['coupon_error']!==null);
$pa=buy('seis@example.com','personalizada',['coupon'=>'PRIMERA']);pay($pa);$pa=getO((int)$pa['id']);
t('pagar marca la redención como aplicada',(int)sql("SELECT COUNT(*) FROM coupon_redemptions WHERE order_id=? AND status='applied'",[$pa['id']])->fetchColumn()===1);
t('«primera compra» ya no sirve a quien ya pagó',priceQuote('personalizada','PRIMERA','seis@example.com')['coupon_error']!==null);
t('«clientes que vuelven» sí le sirve',priceQuote('personalizada','VUELVE','seis@example.com')['coupon_error']===null);
$pc=personalCoupon(contactByEmail('seis@example.com'),['kind'=>'percent','value'=>15,'valid_days'=>10],'test');
t('un cupón personal solo funciona con su correo',priceQuote('personalizada',$pc['code'],'otro@example.com')['coupon_error']!==null&&priceQuote('personalizada',$pc['code'],'seis@example.com')['coupon_error']===null);
t('el cupón personal no se puede usar sin identificarse',priceQuote('personalizada',$pc['code'])['coupon_error']!==null);
coupon(['code'=>'VENCIDO','kind'=>'percent','value'=>20,'ends_at'=>gmdate('Y-m-d H:i:s',time()-3600)]);coupon(['code'=>'FUTURO','kind'=>'percent','value'=>20,'starts_at'=>gmdate('Y-m-d H:i:s',time()+3600)]);coupon(['code'=>'APAGADO','kind'=>'percent','value'=>20,'active'=>0]);
t('vencido, futuro y apagado no sirven',priceQuote('personalizada','VENCIDO')['coupon_error']!==null&&priceQuote('personalizada','FUTURO')['coupon_error']!==null&&priceQuote('personalizada','APAGADO')['coupon_error']!==null);
coupon(['code'=>'SOLOFULL','kind'=>'percent','value'=>20,'product_codes'=>'full']);coupon(['code'=>'MINIMO','kind'=>'percent','value'=>20,'min_amount_in_cents'=>20000000]);
t('un cupón de un producto no sirve a otro',priceQuote('personalizada','SOLOFULL')['coupon_error']!==null&&priceQuote('full','SOLOFULL')['coupon_error']===null);
t('el mínimo de compra se respeta',priceQuote('personalizada','MINIMO')['coupon_error']!==null&&priceQuote('full','MINIMO')['coupon_error']===null);
t('los cupones no aplican a empresas y se le dice',priceQuote('jingle','AMOR30')['coupon_error']!==null&&priceQuote('jingle','AMOR30')['total']===catalog()['jingle']['price']);

echo "— pago, estadísticas y recompra\n";
$ct6=contactByEmail('seis@example.com');
t('pagar actualiza al contacto (compras, gasto, última compra)',(int)$ct6['orders_paid']===1&&(int)$ct6['spent_in_cents']===(int)$pa['amount_in_cents']&&$ct6['last_order_at']!==null&&$ct6['first_paid_at']!==null);
t('el pedido guarda cuándo se pagó y que no es recompra',$pa['paid_at']!==null&&(int)$pa['is_repeat']===0);
t('queda un evento purchase del servidor',(int)sql("SELECT COUNT(*) FROM events WHERE name='purchase' AND order_id=?",[$pa['id']])->fetchColumn()===1);
$pb=buy('seis@example.com','dedicatoria');pay($pb);$pb=getO((int)$pb['id']);
t('la segunda compra se marca como recompra',(int)$pb['is_repeat']===1&&(int)contactByEmail('seis@example.com')['orders_paid']===2);
applyPayment(['id'=>'txrepeat','reference'=>sql('SELECT reference FROM payment_attempts WHERE order_id=? LIMIT 1',[$pb['id']])->fetchColumn(),'status'=>'APPROVED','amount_in_cents'=>(int)$pb['amount_in_cents'],'currency'=>'COP'],'chk-repeat-1');
t('repetir el aviso de pago no duplica estadísticas',(int)contactByEmail('seis@example.com')['orders_paid']===2);

echo "— consentimiento y baja\n";
$c1=contactByEmail('dos@example.com');$n0=(int)sql('SELECT COUNT(*) FROM consent_log WHERE contact_id=?',[$c1['id']])->fetchColumn();
consentSet((int)$c1['id'],'email',true,'otra');t('conceder de nuevo no ensucia la evidencia',(int)sql('SELECT COUNT(*) FROM consent_log WHERE contact_id=?',[$c1['id']])->fetchColumn()===$n0);
$tok=unsubToken((int)$c1['id']);t('el enlace de baja válido funciona',unsubValid((int)$c1['id'],'email',$tok));
t('un enlace de otro contacto, de otro canal o alterado no sirve',!unsubValid((int)$c1['id']+1,'email',$tok)&&!unsubValid((int)$c1['id'],'sms',$tok)&&!unsubValid((int)$c1['id'],'email',substr($tok,0,40).'0000')&&!unsubValid((int)$c1['id'],'email','abc'));
t('el enlace corto de SMS (20 caracteres) sirve para SMS',unsubValid((int)$c1['id'],'sms',substr(unsubToken((int)$c1['id'],'sms'),0,20)));
consentSet((int)$c1['id'],'email',false,'baja-link');$c1=contactByEmail('dos@example.com');
t('darse de baja apaga el correo y queda registrado',!canMarket($c1)&&$c1['email_unsub_at']!==null&&(int)sql("SELECT COUNT(*) FROM consent_log WHERE contact_id=? AND action='revoke'",[$c1['id']])->fetchColumn()===1);
consentSet((int)$c1['id'],'email',true,'baja-page');t('volver a suscribirse limpia la baja',canMarket(contactByEmail('dos@example.com')));

echo "— segmentos\n";
consentSet((int)contactByEmail('seis@example.com')['id'],'email',true,'test');
foreach(['tres','siete','ocho','nueve'] as $n)buy($n.'@seg.test');
$s7=contactByEmail('siete@seg.test');consentSet((int)$s7['id'],'email',true,'test');
$s8=contactByEmail('ocho@seg.test');consentSet((int)$s8['id'],'email',true,'test');consentSet((int)$s8['id'],'email',false,'test');
$s9=contactByEmail('nueve@seg.test');consentSet((int)$s9['id'],'email',true,'test');sql("UPDATE contacts SET tags='vip,madres',orders_paid=3,spent_in_cents=90000000,last_order_at=? WHERE id=?",[gmdate('Y-m-d H:i:s',time()-200*86400),$s9['id']]);
t('solo entra quien aceptó y no se dio de baja',audienceCount([])>=3&&!in_array('ocho@seg.test',array_column(audienceRows([]),'email'),true)&&!in_array('tres@seg.test',array_column(audienceRows([]),'email'),true));
t('filtro por compras mínimas',array_column(audienceRows(['orders_min'=>3]),'email')===['nueve@seg.test']);
t('filtro por inactividad (más de 100 días sin comprar)',array_column(audienceRows(['last_order_days_min'=>100]),'email')===['nueve@seg.test']);
t('filtro por gasto mínimo en pesos',array_column(audienceRows(['spent_min_cop'=>800000]),'email')===['nueve@seg.test'],json_encode(array_column(audienceRows(['spent_min_cop'=>800000]),'email')));
t('filtro por etiqueta',array_column(audienceRows(['tag'=>'vip']),'email')===['nueve@seg.test']);
t('«nunca compró» excluye a quien ya pagó',!in_array('seis@example.com',array_column(audienceRows(['never_paid'=>1]),'email'),true)&&in_array('siete@seg.test',array_column(audienceRows(['never_paid'=>1]),'email'),true));
t('filtro por producto comprado',array_column(audienceRows(['product'=>'dedicatoria']),'email')===['seis@example.com']);
t('un filtro con SQL malicioso no rompe nada ni filtra de más',audienceCount(['tag'=>"x' OR '1'='1",'source'=>"' OR 1=1 --"])===0);
t('claves desconocidas se ignoran',segmentClean(['orders_min'=>2,'drop'=>'x','__proto__'=>1])===['orders_min'=>2]);
t('el SMS exige casilla de SMS y teléfono',audienceCount([],'sms')===1);   // solo dos@ aceptó SMS

echo "— campañas de correo\n";
sql("INSERT INTO campaigns(name,channel,subject,preheader,title,body,cta_label,cta_path,coupon_id,personal_coupon,segment,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
 ['Día de la madre','email','{nombre}, una canción para mamá','Un detalle','Para *mamá*',"Hola {nombre}.\n\nEste mes tenemos algo para ti.",'Crear mi canción','//evil.example/x',null,json_encode(['kind'=>'percent','value'=>15,'valid_days'=>20]),json_encode([]),'draft',nowUtc()]);
$cid1=(int)db()->lastInsertId();sql("UPDATE contacts SET name=? WHERE id=?",['<b>Sofía</b> Gómez',$s7['id']]);sql("UPDATE contacts SET name='Sofía Gómez' WHERE id=?",[$s9['id']]);
$optin=audienceCount([]);$r=campaignQueue($cid1);$sends=sql('SELECT * FROM campaign_sends WHERE campaign_id=?',[$cid1])->fetchAll();
t('se crea un envío por contacto elegible, ninguno para quien no aceptó',$r['queued']===$optin&&count($sends)===$optin,json_encode([$r,$optin]));
t('la campaña ya enviada no se puede reenviar',thrown(fn()=>campaignQueue($cid1))!==null);
$mail=sql("SELECT * FROM mail_queue WHERE dedupe_key=?",['camp:'.$cid1.':'.$s7['id']])->fetch();$parts=mailParts($mail['body']);
t('el correo lleva la marca de baja con un clic y el enlace visible',$parts['unsub']!==null&&str_contains($parts['html'],'Cancelar suscripción')&&str_contains($parts['text'],'Cancelar suscripción: '));
t('el pie legal dice por qué recibe el correo',str_contains($parts['html'],'aceptaste recibir ofertas'));
t('un nombre con HTML no entra al correo (solo letras)',!str_contains($parts['html'],'<b>Sofía')&&!str_contains($mail['subject'],'<'),$mail['subject']);
$m9=sql('SELECT * FROM mail_queue WHERE dedupe_key=?',['camp:'.$cid1.':'.$s9['id']])->fetch();t('un nombre normal sí se usa en el asunto',str_contains($m9['subject'],'Sofía'),$m9['subject']);
t('el botón no puede apuntar fuera del sitio (//evil.example → inicio)',!str_contains($parts['html'],'evil.example')&&str_contains($parts['html'],'c='.sql('SELECT token FROM campaign_sends WHERE campaign_id=? AND contact_id=?',[$cid1,$s7['id']])->fetchColumn()));
t('lleva el píxel de apertura',str_contains($parts['html'],'action=o&amp;t='));
$codes=sql("SELECT code FROM coupons WHERE source=?",['campaign:'.$cid1])->fetchAll(PDO::FETCH_COLUMN);
t('cada contacto recibe su propio código, todos distintos',count($codes)===$optin&&count(array_unique($codes))===$optin);
t('el código del correo es el del contacto',str_contains($parts['html'],sql('SELECT code FROM coupons WHERE source=? AND contact_id=?',['campaign:'.$cid1,$s7['id']])->fetchColumn()));
t('quien se dio de baja no recibió nada',!sql("SELECT id FROM mail_queue WHERE recipient='ocho@seg.test' AND dedupe_key LIKE 'camp:%'")->fetch());
t('el último mensaje de marketing queda anotado (tope de frecuencia)',contactByEmail('siete@seg.test')['last_marketing_at']!==null);
$tk=sql('SELECT token FROM campaign_sends WHERE campaign_id=? AND contact_id=?',[$cid1,$s7['id']])->fetchColumn();
campaignOpened($tk);campaignClicked($tk);$srow=sql('SELECT * FROM campaign_sends WHERE token=?',[$tk])->fetch();
t('aperturas y clics se registran una vez',$srow['opened_at']!==null&&$srow['clicked_at']!==null);
$op=buy('siete@seg.test','dedicatoria',['attr'=>['c'=>$tk]]);pay($op);
t('la compra se atribuye a la campaña',(int)sql('SELECT converted_order_id FROM campaign_sends WHERE token=?',[$tk])->fetchColumn()===(int)$op['id']);
campaignClicked('no-es-un-token');campaignOpened(str_repeat('z',32));t('tokens falsos no rompen nada',true);
$wrapTest=['campaign_name'=>'x','subject'=>'s {nombre}','preheader'=>'','title'=>'t','body'=>'b','cta_label'=>'','cta_path'=>'/'];
[$subj,$body]=marketingBody(['id'=>0,'name'=>'','email'=>'a@b.co'],$wrapTest,newToken(),null,false);
t('la prueba (sin baja) no lleva la marca de baja',!str_starts_with($body,'<!--fhb:unsub='));
t('safePath rechaza esquemas y dobles barras',safePath('//x.com')==='/'&&safePath('https://x.com')==='/'&&safePath('javascript:alert(1)')==='/'&&safePath('/?ver=info')==='/?ver=info');

echo "— automatizaciones\n";
sql("UPDATE automations SET enabled=1,delay_hours=0 WHERE akey='abandoned'");
$ab=buy('abandono@example.com');$abNo=buy('nobaja@example.com');consentSet((int)contactByEmail('nobaja@example.com')['id'],'email',true,'t');consentSet((int)contactByEmail('nobaja@example.com')['id'],'email',false,'t');
sql("UPDATE orders SET created_at=? WHERE id IN (?,?)",[gmdate('Y-m-d H:i:s',time()-3*3600),$ab['id'],$abNo['id']]);
$st=automationsRun();$m1=sql("SELECT * FROM mail_queue WHERE recipient='abandono@example.com' AND dedupe_key LIKE 'auto:abandoned:%'")->fetch();
t('el recordatorio de pedido sin pagar llega una vez',(bool)$m1&&$st['abandoned']>=1);
$pp=mailParts($m1['body']);t('a quien no aceptó marketing se le manda sin cupón, pero con enlace de baja',$pp['unsub']!==null&&str_contains($pp['html'],'Cancelar suscripción')&&!str_contains($pp['html'],'Tu código')&&str_contains($pp['html'],'session='));
automationsRun();t('correr de nuevo no repite',(int)sql("SELECT COUNT(*) FROM mail_queue WHERE recipient='abandono@example.com' AND dedupe_key LIKE 'auto:abandoned:%'")->fetchColumn()===1);
t('quien se dio de baja no recibe ni recordatorios',!sql("SELECT id FROM mail_queue WHERE recipient='nobaja@example.com' AND dedupe_key LIKE 'auto:%'")->fetch());
sql("UPDATE orders SET status='paid' WHERE id=?",[$ab['id']]);
$ab2=buy('compro@example.com');sql("UPDATE orders SET created_at=? WHERE id=?",[gmdate('Y-m-d H:i:s',time()-3*3600),$ab2['id']]);$ab3=buy('compro@example.com');pay($ab3);
automationsRun();t('si ya compró después, no se le recuerda el pedido viejo',!sql("SELECT id FROM mail_queue WHERE recipient='compro@example.com' AND dedupe_key LIKE 'auto:abandoned:%'")->fetch());
sql("UPDATE automations SET enabled=1,delay_hours=24 WHERE akey='reorder'");
$rc=contactByEmail('seis@example.com');consentSet((int)$rc['id'],'email',true,'t');sql("UPDATE contacts SET last_order_at=?,last_marketing_at=NULL WHERE id=?",[gmdate('Y-m-d H:i:s',time()-5*86400),$rc['id']]);
$st=automationsRun();$m2=sql("SELECT * FROM mail_queue WHERE recipient='seis@example.com' AND dedupe_key LIKE 'auto:reorder:%'")->fetch();
t('recompra: el cliente que aceptó recibe su código personal con baja',(bool)$m2&&mailParts($m2['body'])['unsub']!==null&&str_contains(mailParts($m2['body'])['html'],'Tu código'));
sql("UPDATE automations SET enabled=1,delay_hours=24 WHERE akey='winback'");sql("UPDATE contacts SET last_order_at=? WHERE id=?",[gmdate('Y-m-d H:i:s',time()-5*86400),$rc['id']]);automationsRun();
t('el tope de frecuencia evita dos mensajes de marketing seguidos',!sql("SELECT id FROM mail_queue WHERE recipient='seis@example.com' AND dedupe_key LIKE 'auto:winback:%'")->fetch());

echo "— SMS\n";
t('números colombianos se normalizan',phoneE164('300 123 4567')==='+573001234567'&&phoneE164('573001234567')==='+573001234567'&&phoneE164('+14155550100')==='+14155550100'&&phoneE164('12345')===null&&phoneE164('abc')===null);
$smsC=contactByEmail('dos@example.com');t('sin casilla de SMS no se encola',!smsEnqueue(contactByEmail('uno@example.com'),'hola',null,true));
t('con casilla se encola con aviso de baja',smsEnqueue($smsC,'Hola, tienes un detalle',null,true)&&str_contains((string)sql('SELECT body FROM sms_outbox ORDER BY id DESC LIMIT 1')->fetchColumn(),'/baja.php?c='.$smsC['id'].'&ch=sms'));
t('el envío en modo registro solo anota',smsFlush()===1&&sql('SELECT status FROM sms_outbox ORDER BY id DESC LIMIT 1')->fetchColumn()==='logged');

echo "— analítica\n";
t('eventos válidos entran, los desconocidos no',trackBatch(['v'=>'visitante_1234567890','e'=>[['n'=>'view','p'=>'/'],['n'=>'hack','p'=>'/'],['n'=>'select_product','d'=>['product'=>'full']]]])===2);
t('un visitante inválido se rechaza',thrown(fn()=>trackBatch(['v'=>'<script>','e'=>[['n'=>'view']]]))!==null);
t('máximo 20 eventos por lote',trackBatch(['v'=>'visitante_1234567890','e'=>array_fill(0,50,['n'=>'view'])])===20);
t('no se guardan datos personales (sin IP ni agente)',!in_array('ip',array_column(db()->query("PRAGMA table_info(events)")->fetchAll(),'name'),true));
$ov=growthOverview(30);
t('el resumen calcula ingresos, pedidos y ticket promedio',$ov['kpi']['orders']>=3&&$ov['kpi']['revenue']>0&&$ov['kpi']['aov']===intdiv($ov['kpi']['revenue'],$ov['kpi']['orders']));
t('el resumen cuenta recompra y audiencia',$ov['kpi']['repeat_orders']>=1&&$ov['audience']['repeaters']>=1&&$ov['audience']['email_optin']>=3);
t('el embudo y las fuentes salen del resumen',count($ov['funnel'])===5&&$ov['funnel'][0]['visitors']>=1&&is_array($ov['sources']));
t('las campañas muestran apertura, clics y pedidos atribuidos',$ov['campaigns'][0]['orders']>=1&&$ov['campaigns'][0]['open_rate']>0);
t('el CSV neutraliza fórmulas',csvCell('=HYPERLINK("x")')==="\"'=HYPERLINK(\"\"x\"\")\""&&csvCell('+57')==="\"'+57\"");


echo "— rondas de revisión: abuso, consentimiento, cupones y envío\n";
// double opt-in cannot be forced on someone else
$vic=buy('victima@x.test');$vc=contactByEmail('victima@x.test');consentSet((int)$vc['id'],'email',true,'t');consentSet((int)$vc['id'],'email',false,'baja-link');
$n0=(int)sql("SELECT COUNT(*) FROM mail_queue WHERE recipient='victima@x.test' AND dedupe_key LIKE 'optin:%'")->fetchColumn();
buy('victima@x.test','personalizada',['optin_email'=>true]);$vc=contactByEmail('victima@x.test');
t('teclear el correo de alguien que se dio de baja no lo vuelve a suscribir ni le escribe',!canMarket($vc)&&$vc['email_unsub_at']!==null&&(int)sql("SELECT COUNT(*) FROM mail_queue WHERE recipient='victima@x.test' AND dedupe_key LIKE 'optin:%'")->fetchColumn()===$n0);
$nw=buy('nuevo-opt@x.test','personalizada',['optin_email'=>true]);buy('nuevo-opt@x.test','personalizada',['optin_email'=>true]);
t('pedir el permiso dos veces seguidas manda un solo correo de confirmación',(int)sql("SELECT COUNT(*) FROM mail_queue WHERE recipient='nuevo-opt@x.test' AND dedupe_key LIKE 'optin:%'")->fetchColumn()===1&&!canMarket(contactByEmail('nuevo-opt@x.test')));
t('el enlace de confirmación es firmado y solo sirve para su contacto',hash_equals(optinToken((int)contactByEmail('nuevo-opt@x.test')['id']),optinToken((int)contactByEmail('nuevo-opt@x.test')['id']))&&optinToken(1)!==optinToken(2));
// suppression of someone who never opted in
$ghost=contactByEmail('abandono@example.com');$never=buy('nunca@x.test');$gc=contactByEmail('nunca@x.test');consentSet((int)$gc['id'],'email',false,'baja-link');
t('darse de baja sin haber aceptado queda registrado (y detiene los recordatorios)',contactByEmail('nunca@x.test')['email_unsub_at']!==null&&(int)sql("SELECT COUNT(*) FROM consent_log WHERE contact_id=? AND action='revoke'",[$gc['id']])->fetchColumn()===1);
// aliases are the same person
$g1=buy('mi.correo@gmail.com');$g2=buy('micorreo+oferta@gmail.com');t('alias de Gmail (puntos y +etiqueta) son la misma persona',(int)$g1['contact_id']===(int)$g2['contact_id']);
coupon(['code'=>'PRIM1','kind'=>'percent','value'=>40,'first_order_only'=>1]);sql("UPDATE promotions SET active=0");
pay($g1);t('el cupón de primera compra no se reutiliza con un alias del mismo correo',priceQuote('personalizada','PRIM1','M.i.correo+x@gmail.com')['coupon_error']!==null);
t('el mensaje de reglas por persona no revela si es cliente',priceQuote('personalizada','PRIM1','M.i.correo+x@gmail.com')['coupon_error']===priceQuote('personalizada','VUELVE','nadie-nuevo@x.test')['coupon_error']);
t('la vista pública del cupón no incluye el nombre interno',!array_key_exists('label',quoteView(priceQuote('personalizada','AMOR30'))['coupon']));
// rounding: whole pesos
sql("UPDATE promotions SET active=1,value=33");coupon(['code'=>'SUMA7','kind'=>'percent','value'=>7,'stackable'=>1]);$qq=priceQuote('personalizada','SUMA7');
t('con descuentos acumulados el importe sigue en pesos enteros',$qq['total']%100===0&&$qq['discount']%100===0,$qq['total']);sql("UPDATE promotions SET active=0,value=20");
// coupon limits: the order that waited too long is priced again at payment
coupon(['code'=>'UNO1','kind'=>'percent','value'=>35,'max_redemptions'=>1]);$ow=buy('espera@x.test','personalizada',['coupon'=>'UNO1']);
sql("UPDATE orders SET created_at=? WHERE id=?",[gmdate('Y-m-d H:i:s',time()-80*3600),$ow['id']]);sql("UPDATE coupon_redemptions SET created_at=? WHERE order_id=?",[gmdate('Y-m-d H:i:s',time()-80*3600),$ow['id']]);
buy('otro-uno@x.test','personalizada',['coupon'=>'UNO1']);   // the reservation of the first one has expired, so the second order gets the last use
$re=repriceStale(getO((int)$ow['id']));
t('un pedido con cupón que esperó más de 48 h se vuelve a calcular al pagar: si el cupón ya no alcanza, se cobra el precio vigente',$re['coupon_code']===null&&(int)$re['amount_in_cents']===$LIST&&(int)sql("SELECT COUNT(*) FROM coupon_redemptions WHERE order_id=? AND status IN ('reserved','applied')",[$ow['id']])->fetchColumn()===0,json_encode([$re['coupon_code'],$re['amount_in_cents']]));
t('y queda anotado en el historial del pedido',(int)sql("SELECT COUNT(*) FROM order_history WHERE order_id=? AND note LIKE 'Actualizamos el precio%'",[$ow['id']])->fetchColumn()===1);
$fresh=buy('fresco@x.test','personalizada',['coupon'=>'AMOR30']);t('dentro de las 48 h el precio no se toca',(int)repriceStale(getO((int)$fresh['id']))['amount_in_cents']===(int)$fresh['amount_in_cents']);
// cancelled then paid anyway: the coupon was used
coupon(['code'=>'CANCEL1','kind'=>'percent','value'=>30,'max_redemptions'=>1]);$oz=buy('cancel@x.test','personalizada',['coupon'=>'CANCEL1']);growthOnCancelled($oz);sql("UPDATE orders SET status='cancelled' WHERE id=?",[$oz['id']]);pay(getO((int)$oz['id']));
t('un pedido cancelado que se paga igual cuenta como uso del cupón',(int)sql("SELECT COUNT(*) FROM coupon_redemptions WHERE order_id=? AND status='applied'",[$oz['id']])->fetchColumn()===1&&priceQuote('personalizada','CANCEL1','otra@x.test')['coupon_error']!==null);
// sending: unsubscribed after queueing → nothing goes out
$sq=contactByEmail('dos@example.com');smsEnqueue($sq,'Oferta',null,true);consentSet((int)$sq['id'],'sms',false,'baja-link');$flushed=smsFlush();
t('un SMS en cola no sale si la persona se dio de baja después',sql('SELECT status FROM sms_outbox ORDER BY id DESC LIMIT 1')->fetchColumn()==='skipped');
// reminders: one per person, only people orders, unsubscribe link, no starvation
sql("UPDATE automations SET enabled=1,delay_hours=0 WHERE akey='abandoned'");sql("DELETE FROM automation_runs");
for($i=0;$i<3;$i++)buy('muchos@x.test');$mm=contactByEmail('muchos@x.test');sql("UPDATE orders SET created_at=? WHERE contact_id=?",[gmdate('Y-m-d H:i:s',time()-4*3600),$mm['id']]);
$bz=buy('empresa@x.test','jingle',['brief'=>$brief+['brand'=>'Marca X','campaign'=>'Campaña X','channels'=>'TV','license_scope'=>'Un año']]);
sql("UPDATE orders SET created_at=? WHERE contact_id=?",[gmdate('Y-m-d H:i:s',time()-4*3600),$bz['contact_id']]);
automationsRun();
t('cinco carritos de la misma persona son un solo recordatorio',(int)sql("SELECT COUNT(*) FROM mail_queue WHERE recipient='muchos@x.test' AND dedupe_key LIKE 'auto:abandoned:%'")->fetchColumn()===1);
t('a una empresa con propuesta pendiente no se le manda «termina tu pedido»',!sql("SELECT id FROM mail_queue WHERE recipient='empresa@x.test' AND dedupe_key LIKE 'auto:abandoned:%'")->fetch());
sql("DELETE FROM automation_runs");sql("UPDATE orders SET status='paid' WHERE status IN ('created','payment_pending')");
for($i=0;$i<103;$i++){$em="lote$i@x.test";sql("INSERT INTO contacts(email,email_canon,name,created_at) VALUES(?,?,?,?)",[$em,$em,'Lote',nowUtc()]);$cidl=(int)db()->lastInsertId();
 sql("INSERT INTO customers(name,email,phone,contact_id) VALUES(?,?,?,?)",['Lote',$em,'3001234567',$cidl]);$cu=(int)db()->lastInsertId();
 sql("INSERT INTO orders(reference,customer_id,product_code,product_name,amount_in_cents,audience,brief,consent_version,idempotency_key,request_hash,token_hash,token_expires_at,status,contact_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",['L-'.$i,$cu,'personalizada','x',12990000,'person','{}','x',bin2hex(random_bytes(8)).$i,'h','h',gmdate('Y-m-d H:i:s',time()+86400),'created',$cidl,gmdate('Y-m-d H:i:s',time()-4*3600)]);}
for($i=0;$i<3;$i++)automationsRun();
t('con más de 100 pendientes, las pasadas siguientes atienden al resto (nadie se queda sin turno)',(int)sql("SELECT COUNT(*) FROM automation_runs r JOIN contacts c ON c.id=r.contact_id WHERE c.email LIKE 'lote%'")->fetchColumn()===103);
// analytics cannot be inflated from the browser
$beforeP=(int)sql("SELECT COUNT(*) FROM events WHERE name='purchase'")->fetchColumn();
t('el navegador no puede inventar ventas ni pedidos',trackBatch(['v'=>'visitante_1234567890','e'=>array_fill(0,5,['n'=>'purchase'])])===0&&(int)sql("SELECT COUNT(*) FROM events WHERE name='purchase'")->fetchColumn()===$beforeP);
trackBatch(['v'=>'visitante_1234567890','e'=>[['n'=>'view','p'=>'/x','d'=>['email'=>'ana@x.co','view'=>'lobby'],'us'=>5,'um'=>['x'],'uc'=>null]]]);
t('solo se guardan las claves permitidas y valores de texto; tipos raros no rompen',!str_contains((string)sql("SELECT props FROM events WHERE path='/x' ORDER BY id DESC LIMIT 1")->fetchColumn(),'ana@x.co'));
$lastO=buy('tipos@x.test','personalizada',['attr'=>['v'=>'visitante_1234567890','ft'=>['s'=>5,'c'=>['x']],'lt'=>['s'=>true]]]);t('una atribución con tipos raros no rompe el pedido',(bool)$lastO);
// segments: absurd numbers and the rest period
t('números absurdos en un segmento no rompen',audienceCount(['last_order_days_min'=>'9999999999999999','orders_min'=>'99999999999999999999'])===0);
$rest=contactByEmail('siete@seg.test');sql("UPDATE contacts SET last_marketing_at=? WHERE id=?",[nowUtc(),$rest['id']]);
t('quien recibió una promoción hace poco descansa, salvo que la campaña diga lo contrario',!in_array('siete@seg.test',array_column(audienceRows([]),'email'),true)&&in_array('siete@seg.test',array_column(audienceRows(['include_capped'=>1]),'email'),true)&&cappedCount([])>=1);
// customers from before this layer
sql("INSERT INTO customers(name,email,phone) VALUES('Antiguo','antiguo@x.test','3001112222')");$lc=(int)db()->lastInsertId();
sql("INSERT INTO orders(reference,customer_id,product_code,product_name,amount_in_cents,audience,brief,consent_version,idempotency_key,request_hash,token_hash,token_expires_at,status) VALUES('OLD-1',?,'personalizada','x',12990000,'person','{}','x','oldkey1','h','h',?,'completed')",[$lc,gmdate('Y-m-d H:i:s',time()+86400)]);
growthBackfill();$ac=contactByEmail('antiguo@x.test');
t('los clientes de antes pasan a ser contactos (sin permiso de marketing) con su historial de compras',$ac&&(int)$ac['orders_paid']===1&&(int)$ac['spent_in_cents']===12990000&&!canMarket($ac));
t('el CSV neutraliza también espacios y saltos antes de la fórmula',csvCell("\n=1+1")==="\"'\n=1+1\""&&csvCell(" =1+1")==="\"' =1+1\"");
t('el pedido que ve el cliente no trae datos internos de marketing',!array_key_exists('send_token',orderView(getO((int)$oc['id'])))&&!array_key_exists('visitor_id',orderView(getO((int)$oc['id'])))&&!array_key_exists('contact_id',orderView(getO((int)$oc['id']))));

echo "\n$ok bien, $bad mal\n";exit($bad?1:0);
