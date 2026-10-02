<?php
declare(strict_types=1);
// Which email does the admin form send? It must follow the EVENT (a real change), never just the current state.
//   php tests/email-kind.php
// Pulls the two real expressions out of api.php and evaluates them over a matrix, so the test cannot drift from the code.
$src=file_get_contents(__DIR__.'/../api.php');
preg_match('/\$changed=([^;]+);/',$src,$c);
preg_match('/notifyJourney\(\$o,(\$changed\?\(.*?\):\'update\'),\[\'note\'=>\$note\]/s',$src,$k);
if(!$c||!$k){fwrite(STDERR,"No encuentro la lógica de admin-update en api.php\n");exit(1);}
$kind=function(string $prevStatus,int $prevStage,string $status,int $stage)use($c,$k):string{
 $changed=eval('return '.$c[1].';');
 return eval('return '.$k[1].';');
};
// [previous status, previous stage, new status, new stage] => expected email
$matrix=[
 'nota sin cambios en revisión'=>[['review',4,'review',4],'update'],
 'nota sin cambios en producción etapa 1'=>[['in_production',1,'in_production',1],'update'],
 'nota sin cambios, ya completado'=>[['completed',5,'completed',5],'update'],
 'nota sin cambios, pagado'=>[['paid',0,'paid',0],'update'],
 'nota sin cambios, creado'=>[['created',0,'created',0],'update'],
 'pagado -> producción'=>[['paid',0,'in_production',1],'production'],
 'producción etapa 1 -> 2'=>[['in_production',1,'in_production',2],'production'],
 'producción etapa 4 -> 5 (entrega)'=>[['in_production',4,'in_production',5],'production'],
 'producción -> completado (entrega directa)'=>[['in_production',5,'completed',5],'completed'],
 'producción -> revisión'=>[['in_production',4,'review',4],'review'],
 'revisión -> completado'=>[['review',4,'completed',5],'completed'],
 'completado -> revisión (reabrir)'=>[['completed',5,'review',4],'review'],
 'revisión -> producción'=>[['review',4,'in_production',3],'production'],
 'etapa que retrocede 3 -> 2 (no es avance)'=>[['in_production',3,'in_production',2],'update'],
 'creado -> cancelado'=>[['created',0,'cancelled',0],'cancelled'],
 'pago pendiente -> cancelado'=>[['payment_pending',0,'cancelled',0],'cancelled'],
 'cancelado sin cambios'=>[['cancelled',0,'cancelled',0],'update'],
];
$fail=[];
// order guards: the previous state must be captured BEFORE the UPDATE, the decision must happen BEFORE the call, and internal notes must never be mailed
$posPrev=strpos($src,'$prevStatus=$o[\'status\']');$posUpd=strpos($src,"UPDATE orders SET status=?,production_stage=?");$posChg=strpos($src,'$changed=');$posCall=strpos($src,'notifyJourney($o,$changed?');
if($posPrev===false||$posUpd===false||$posPrev>$posUpd)$fail[]='$prevStatus debe leerse antes del UPDATE de orders';
if($posChg===false||$posCall===false||$posChg>$posCall||$posChg<$posUpd)$fail[]='$changed debe calcularse después del UPDATE y antes de notifyJourney';
if(substr_count($src,'$changed=')!==1)$fail[]='$changed no debe reasignarse';
if(!str_contains($src,'$visible=($in[\'visible\']??true)===true;need(!(($in[\'notify\']??false)===true&&!$visible)'))$fail[]='falta la guarda: una nota interna (visible distinto de true) no puede enviarse al cliente';
if(!str_contains($src,'history($o,$note,\'admin:\'.$aid,$visible)'))$fail[]='history() y la guarda deben usar la misma variable $visible';
foreach($matrix as $name=>[$args,$want]){$got=$kind(...$args);if($got!==$want)$fail[]="$name: esperaba '$want' y salió '$got'";}
echo $fail?"FALLAS:\n - ".implode("\n - ",$fail)."\n":"OK: ".count($matrix)." combinaciones de estado/evento.\n";
exit($fail?1:0);
