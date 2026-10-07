<?php
declare(strict_types=1);
// Renders every transactional email with sample data (no database, nothing is sent).
//   php scripts/preview-emails.php [--out=DIR] [--base=https://host]
// Writes DIR/<name>.html, DIR/<name>.txt and DIR/index.html (gallery). --base is where /assets/email/* is served from.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$opt=[];foreach(array_slice($argv,1) as $a)if(preg_match('/^--(\w+)=(.*)$/',$a,$m))$opt[$m[1]]=$m[2];
$out=rtrim($opt['out']??sys_get_temp_dir().'/fhb-emails','/');if(!is_dir($out))mkdir($out,0775,true);
putenv('APP_URL='.($opt['base']??'https://fromheartbeat.com'));putenv('APP_KEY='.str_repeat('k',40));putenv('SUPPORT_EMAIL=contacto@fromheartbeat.com');putenv('COMMERCE_READY=true');putenv('MAIL_FROM=contacto@fromheartbeat.com');
require __DIR__.'/../private/bootstrap.php';

$brief=['recipient'=>'Mi mamá, Luz Marina','occasion'=>'Sus 60 años','genre'=>'Bolero','mood'=>'Nostálgica','voice'=>'Femenina','language'=>'Español','tempo'=>'Lento','story'=>'Historia de ejemplo.'];
$biz=['brand'=>'Café Alborada','campaign'=>'Lanzamiento temporada 2026','channels'=>'Radio, Instagram y puntos de venta','license_scope'=>'Uso comercial en Colombia por 12 meses','story'=>'Historia de ejemplo.','agreed_scope'=>"Jingle de 30 segundos con 2 adaptaciones (MP3 + WAV).\nLicencia comercial para Colombia, 12 meses, medios digitales y radio.\nIncluye 1 ronda de ajustes."];
function sample(string $code,array $over=[]): array {
 global $brief,$biz;$p=catalog()[$code];$isBiz=$p['audience']==='business';
 return array_merge(['id'=>1,'reference'=>'FHB-260930-024D7A1892','product_code'=>$code,'product_name'=>$p['name'],'product'=>$p,'amount_in_cents'=>$p['price'],'audience'=>$p['audience'],'brief'=>json_encode($isBiz?$biz:$brief,JSON_UNESCAPED_UNICODE),'status'=>'created','production_stage'=>0],$over);
}
$cust=['name'=>'valentina restrepo','email'=>'valentina@example.com','phone'=>'+57 300 123 4567'];
$files=[['original_name'=>'Cancion-v2.mp3','mime'=>'audio/mpeg'],['original_name'=>'Cancion-master.wav','mime'=>'audio/wav'],['original_name'=>'Portada.png','mime'=>'image/png'],['original_name'=>'Video-emocional.mp4','mime'=>'video/mp4']];
$note="Subimos la versión 2 con la voz principal más cálida.\nCuéntanos qué sientes en el segundo coro: ¿lo quieres más suave?";
$cases=[
 'received'=>['received',sample('full'),$cust,[]],
 'received-dedicatoria'=>['received',sample('dedicatoria'),$cust,[]],
 'received-business'=>['received_business',sample('jingle'),$cust,[]],
 'quote'=>['quote',sample('jingle',['status'=>'created','amount_in_cents'=>64500000]),$cust,[]],
 'payment-failed'=>['payment_failed',sample('personalizada',['status'=>'payment_pending']),$cust,['payment'=>'DECLINED']],
 'payment-error'=>['payment_failed',sample('personalizada',['status'=>'payment_pending']),$cust,['payment'=>'ERROR']],
 'paid-full'=>['paid',sample('full',['status'=>'paid']),$cust,['at'=>'2026-09-30 13:34:00']],
 'paid-dedicatoria'=>['paid',sample('dedicatoria',['status'=>'paid']),$cust,['at'=>'2026-09-30 13:34:00']],
 'production-1-letra'=>['production',sample('full',['status'=>'in_production','production_stage'=>1]),$cust,['note'=>'Ya tenemos el primer borrador de tu letra.']],
 'production-2-grabacion'=>['production',sample('full',['status'=>'in_production','production_stage'=>2]),$cust,[]],
 'production-3-produccion'=>['production',sample('full',['status'=>'in_production','production_stage'=>3]),$cust,[]],
 'production-4-master'=>['production',sample('full',['status'=>'in_production','production_stage'=>4]),$cust,[]],
 'production-5-entrega'=>['production',sample('full',['status'=>'in_production','production_stage'=>5]),$cust,['note'=>'Estamos subiendo tus archivos finales.']],
 'review'=>['review',sample('full',['status'=>'review','production_stage'=>4]),$cust,['note'=>$note]],
 'completed-listening'=>['completed',sample('full',['status'=>'completed','production_stage'=>5]),$cust,['files'=>$files,'note'=>'Fue un honor ponerle música a esta historia.']],
 'completed-dedicatoria'=>['completed',sample('dedicatoria',['status'=>'completed','production_stage'=>5]),$cust,['files'=>[$files[0],$files[2]]]],
 'cancelled'=>['cancelled',sample('personalizada',['status'=>'cancelled']),$cust,['note'=>'Cancelada a pedido del cliente.']],
 'update'=>['update',sample('personalizada',['status'=>'paid','production_stage'=>0]),$cust,['note'=>'Hola, necesitamos confirmar cómo se pronuncia el nombre de tu mamá.']],
 'recover'=>['recover',sample('full',['status'=>'in_production','production_stage'=>2]),$cust,[]],
 // adversarial inputs: HTML injection in every customer-controlled field, no name, very long unbroken strings
 'hostile-injection'=>['update',sample('full',['status'=>'in_production','production_stage'=>2,'brief'=>json_encode(array_merge($brief,['recipient'=>'<script>alert(1)</script>','occasion'=>'"><img src=x onerror=alert(2)>']))]),['name'=>'<img src=x onerror=alert(3)> Eva','email'=>'e@example.com','phone'=>'1'],['note'=>"</td></tr><script>alert(4)</script> & \"comillas\" 'simples' <b>negrita</b>\nlínea 2"]],
 'hostile-longstring'=>['update',sample('full',['status'=>'review','production_stage'=>4]),['name'=>'Maria de los Angeles Fernandez de la Torre Sotomayor','email'=>'m@example.com','phone'=>'1'],['note'=>str_repeat('Supercalifragilisticoespialidoso',12)]],
 'noname'=>['received',sample('full'),['name'=>'','email'=>'x@example.com','phone'=>'1'],[]],
 // business journey (6 steps) and product-aware copy (Dedicatoria is the essential package: no mix/master and no adjustment round promised)
 'paid-business'=>['paid',sample('jingle',['status'=>'paid']),$cust,['at'=>'2026-09-30 13:34:00','transaction'=>'11979929-1790775282-73584']],
 'production-business-2'=>['production',sample('jingle',['status'=>'in_production','production_stage'=>2]),$cust,[]],
 'review-business'=>['review',sample('campaign',['status'=>'review','production_stage'=>4]),$cust,[]],
 'completed-business'=>['completed',sample('jingle',['status'=>'completed','production_stage'=>5,'brief'=>json_encode(['brand'=>'Café Alborada','campaign'=>'Lanzamiento','channels'=>'Radio','license_scope'=>'x','story'=>'x','agreed_scope'=>"Jingle de 30 segundos con 2 adaptaciones (MP3 + WAV).\nLicencia comercial para Colombia, 12 meses."])]),$cust,['files'=>array_slice($files,0,2)]],
 'payment-failed-business'=>['payment_failed',sample('jingle',['status'=>'payment_pending']),$cust,['payment'=>'DECLINED']],
 'update-business-pending'=>['update',sample('jingle',['status'=>'payment_pending']),$cust,['note'=>'Recuerda completar el pago para empezar.']],
 'production-express-2'=>['production',sample('dedicatoria',['status'=>'in_production','production_stage'=>2]),$cust,[]],
 'production-express-4'=>['production',sample('dedicatoria',['status'=>'in_production','production_stage'=>4]),$cust,[]],
 'review-dedicatoria'=>['review',sample('dedicatoria',['status'=>'review','production_stage'=>4]),$cust,[]],
 'review-personalizada'=>['review',sample('personalizada',['status'=>'review','production_stage'=>4]),$cust,[]],
 'update-question'=>['update',sample('full',['status'=>'in_production','production_stage'=>1]),$cust,['note'=>'¿Cómo se pronuncia el nombre de tu mamá?']],
 'cancelled-nonote'=>['cancelled',sample('personalizada',['status'=>'cancelled']),$cust,[]],
 'received-nopay'=>['received',sample('full'),$cust,['_nopay'=>true]],
 'production-full-nosources'=>['production',sample('full',['status'=>'in_production','production_stage'=>1]),$cust,['sources'=>0]],
 'production-full-sources'=>['production',sample('full',['status'=>'in_production','production_stage'=>3]),$cust,['sources'=>4]],
 'review-full'=>['review',sample('full',['status'=>'review','production_stage'=>4]),$cust,['sources'=>4]],
 'update-question-prepay'=>['update',sample('personalizada',['status'=>'paid']),$cust,['note'=>'¿Nos confirmas la fecha del cumpleaños?']],
 'hostile-shout'=>['received',sample('full'),['name'=>'JUAN PABLO','email'=>'j@example.com','phone'=>'1'],[]],
 'hostile-punct'=>['received',sample('full'),['name'=>'---','email'=>'j@example.com','phone'=>'1'],[]],
 'hostile-invisible'=>['update',sample('full',['status'=>'in_production','production_stage'=>2,'brief'=>json_encode(['recipient'=>"Ma\u{2060}má\u{061C}\u{00AD} Luz",'occasion'=>'x','genre'=>'Bolero','mood'=>'Nostálgica','voice'=>'Femenina','language'=>'Español','story'=>'x'])]),['name'=>"Ana\u{200B}",'email'=>'a@example.com','phone'=>'1'],['note'=>"Hola\u{2060} \u{061C}mundo \u{0085}fin"]],
 'quote-nopay'=>['quote',sample('jingle',['status'=>'created','amount_in_cents'=>64500000]),$cust,['_nopay'=>true]],
 'update-cancelled'=>['update',sample('personalizada',['status'=>'cancelled']),$cust,['note'=>'Dejamos la sesión cancelada como pediste.']],
 'hostile-url'=>['received',sample('full',['brief'=>json_encode(['recipient'=>'http://evil.example/cobra-ya www.evil.com','occasion'=>'x','genre'=>'Bolero','mood'=>'Nostálgica','voice'=>'Femenina','language'=>'Español','story'=>'x'])]),$cust,[]],
 'hostile-casing'=>['received',sample('full'),['name'=>'JUAN-CARLOS','email'=>'j@example.com','phone'=>'1'],[]],
 'hostile-filler'=>['received',sample('full'),['name'=>"\u{3164}\u{2800}",'email'=>'j@example.com','phone'=>'1'],[]],
 // adversarial
 'hostile-manyfiles'=>['completed',sample('full',['status'=>'completed','production_stage'=>5]),$cust,['files'=>array_map(fn($i)=>['original_name'=>"Cancion-v$i-<b>x</b>.mp3",'mime'=>'audio/mpeg'],range(1,120)),'note'=>str_repeat('&',2000)]],
 'hostile-bidi'=>['received',sample('full'),['name'=>"\u{202E}evil Eva",'email'=>'e@example.com','phone'=>'1'],[]],
 'hostile-longname'=>['received',sample('full'),['name'=>str_repeat('Supercalifragilistico',20),'email'=>'e@example.com','phone'=>'1'],[]],
 'hostile-emoji'=>['update',sample('full',['status'=>'in_production','production_stage'=>2]),['name'=>'Ana 🎶','email'=>'a@example.com','phone'=>'1'],['note'=>"🎵 Gracias 🎵 --><!-- </style> {{x}} \u{202E}texto"]],
];
$gallery=[];
foreach($cases as $name=>[$kind,$o,$c,$ctx]){
 putenv('COMMERCE_READY='.(empty($ctx['_nopay'])?'true':'false'));
 if($kind==='completed'&&!isset($ctx['files']))$ctx['files']=[];
 $m=mailModel($kind,$o,$c,$ctx);$full=mailBuild($m);$p=mailParts($full);
 file_put_contents("$out/$name.html",$p['html']);file_put_contents("$out/$name.txt",$p['text']);$gallery[$name]=$m['subject'];
}
$t=mailTeamModel('Nuevo pedido','Entró una historia nueva. Queda pendiente el pago del cliente.',sample('full',['status'=>'created']),$cust);$p=mailParts(mailBuild($t));
file_put_contents("$out/team-new.html",$p['html']);file_put_contents("$out/team-new.txt",$p['text']);$gallery['team-new']=$t['subject'];
$t2=mailTeamModel('Novedad enviada al cliente',str_repeat('<script>x</script> ',200),sample('full',['status'=>'in_production','production_stage'=>2]),['name'=>'<b>Eva</b>','email'=>'e@example.com','phone'=>'1']);$p2=mailParts(mailBuild($t2));
file_put_contents("$out/hostile-team.html",$p2['html']);file_put_contents("$out/hostile-team.txt",$p2['text']);$gallery['hostile-team']=$t2['subject'];
$li='';foreach($gallery as $n=>$s)$li.='<li><a href="'.mh($n).'.html">'.mh($n).'</a> — '.mh($s).'</li>';
file_put_contents("$out/index.html",'<!doctype html><meta charset="utf-8"><title>Correos Fromheartbeat</title><body style="font:15px/1.7 Arial;background:#07040f;color:#f4eeff;padding:30px"><h1>Correos de Fromheartbeat</h1><ul>'.$li.'</ul></body>');
echo count($gallery)." correos escritos en $out\n";
