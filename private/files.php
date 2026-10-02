<?php
declare(strict_types=1);
/*
 * Archivos de la sesión: varios a la vez, muchos formatos y sin el tope de 50 MB del formulario clásico.
 * Los archivos viajan en fragmentos (por defecto 4 MB) que se reensamblan en private/storage/incoming/, así que
 * sobreviven a cortes de red y no dependen de upload_max_filesize ni de post_max_size.
 * El tipo se decide por el CONTENIDO (firma de los primeros bytes), nunca por la extensión ni por lo que diga el navegador.
 * No hay tablas nuevas: la subida en curso vive en un par de archivos .part/.json que se limpian solos.
 */

const FILE_TYPES=[
 'image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif','image/heic'=>'heic','image/avif'=>'avif',
 'video/mp4'=>'mp4','video/quicktime'=>'mov','video/webm'=>'webm','video/3gpp'=>'3gp',
 'audio/mpeg'=>'mp3','audio/wav'=>'wav','audio/mp4'=>'m4a','audio/aac'=>'aac','audio/ogg'=>'ogg','audio/flac'=>'flac','audio/aiff'=>'aif',
 'application/pdf'=>'pdf','text/plain'=>'txt','application/zip'=>'zip',
];
/** Lo que puede enviar un cliente. El ZIP (stems, paquetes) queda sólo para el estudio. */
const FILE_CUSTOMER_GROUPS=['image','video','audio','doc'];

function filesGroup(string $mime): string {
 return match(true){str_starts_with($mime,'image/')=>'image',str_starts_with($mime,'video/')=>'video',str_starts_with($mime,'audio/')=>'audio',$mime==='application/zip'=>'archive',default=>'doc'};
}
function filesLimits(): array {
 $mb=1048576;
 return ['file'=>max(1,(int)env('UPLOAD_MAX_FILE_MB','1024'))*$mb,'order'=>max(1,(int)env('UPLOAD_MAX_ORDER_MB','4096'))*$mb,'count'=>max(1,(int)env('UPLOAD_MAX_FILES','120')),'chunk'=>16*$mb];
}
/** Lo que el navegador necesita saber (va dentro de «bootstrap»). */
function filesPublicConfig(): array {
 $l=filesLimits();
 return ['maxFileBytes'=>$l['file'],'maxOrderBytes'=>$l['order'],'maxFiles'=>$l['count'],'chunkBytes'=>min(4*1048576,$l['chunk']),'types'=>FILE_TYPES];
}

/** Devuelve el tipo real a partir de la firma del archivo, o null si no es un formato admitido. */
/** Longitud de un cuadro MP3 en $i (MPEG-1 capa III), -1 si el encabezado es válido pero no se puede medir, null si no es un encabezado. */
function filesMp3Frame(string $h,int $i): ?int {
 if($i+4>strlen($h)||ord($h[$i])!==0xFF)return null;$b1=ord($h[$i+1]);$b2=ord($h[$i+2]);if(($b1&0xE0)!==0xE0)return null;
 $ver=($b1>>3)&3;$layer=($b1>>1)&3;$br=$b2>>4;$sr=($b2>>2)&3;if($ver===1||$layer===0||$br===0||$br===15||$sr===3)return null;
 if($ver===3&&$layer===1){$brs=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];$srs=[44100,48000,32000];return intdiv(144*$brs[$br]*1000,$srs[$sr])+(($b2>>1)&1);}
 return -1;
}
function filesSniff(string $path,string $name=''): ?string {
 $fp=@fopen($path,'rb'); if(!$fp)return null; $h=(string)fread($fp,8192); fclose($fp); $n=strlen($h); if($n===0)return null;
 $b0=ord($h[0]);$b1=$n>1?ord($h[1]):0;
 if(str_starts_with($h,"\xFF\xD8\xFF"))return 'image/jpeg';
 if(str_starts_with($h,"\x89PNG\r\n\x1A\n"))return 'image/png';
 if(str_starts_with($h,'GIF87a')||str_starts_with($h,'GIF89a'))return 'image/gif';
 if($n>=12&&str_starts_with($h,'RIFF')){$t=substr($h,8,4);if($t==='WEBP')return 'image/webp';if($t==='WAVE')return 'audio/wav';return null;}
 if($n>=12&&str_starts_with($h,'FORM')&&in_array(substr($h,8,4),['AIFF','AIFC'],true))return 'audio/aiff';
 if(str_starts_with($h,'fLaC'))return 'audio/flac';
 if(str_starts_with($h,'OggS'))return 'audio/ogg';
 if(str_starts_with($h,"\x1A\x45\xDF\xA3"))return 'video/webm';
 if(str_starts_with($h,'%PDF-'))return 'application/pdf';
 if(str_starts_with($h,"PK\x03\x04"))return 'application/zip';
 if($n>=12&&substr($h,4,4)==='ftyp'){
  $brand=substr($h,8,4);
  if(in_array($brand,['heic','heix','hevc','hevx','heim','heis','mif1','msf1'],true))return 'image/heic';
  if(in_array($brand,['avif','avis'],true))return 'image/avif';
  if($brand==='qt  ')return 'video/quicktime';
  if(in_array($brand,['M4A ','M4B ','M4P '],true))return 'audio/mp4';
  if(str_starts_with($brand,'3g'))return 'video/3gpp';
  return 'video/mp4';
 }
 if(str_starts_with($h,'ID3'))return 'audio/mpeg';
 if($b0===0xFF&&($b1&0xF6)===0xF0)return 'audio/aac';
 $txt=strtolower(pathinfo($name,PATHINFO_EXTENSION))==='txt';
 if($txt&&($b0===0xFF&&$b1===0xFE||$b0===0xFE&&$b1===0xFF)&&$n%2===0&&mb_check_encoding(substr($h,2),$b0===0xFF?'UTF-16LE':'UTF-16BE'))return 'text/plain'; // UTF-16 con BOM
 if(($f=filesMp3Frame($h,0))!==null&&($f<=0||$n<=$f+4||filesMp3Frame($h,$f)!==null))return 'audio/mpeg';
 // Texto plano: sólo con extensión .txt, UTF-8 válido y sin bytes nulos. El bloque leído puede cortar un carácter por la mitad: se prueba quitando hasta 3 bytes del final.
 if($txt&&!str_contains($h,"\0")){for($k=0;$k<=($n>=8192?3:0);$k++)if(mb_check_encoding(substr($h,0,$n-$k),'UTF-8'))return 'text/plain';}
 return null;
}

/** La extensión SIEMPRE sale del contenido detectado: un JPEG llamado «x.bat» se guarda como «x.bat.jpg». */
function filesNameFor(string $name,string $mime): string {
 $ext=FILE_TYPES[$mime];$alias=['jpg'=>['jpg','jpeg','jpe'],'mp4'=>['mp4','m4v'],'aif'=>['aif','aiff'],'m4a'=>['m4a','m4b'],'3gp'=>['3gp','3gpp'],'mp3'=>['mp3'],'heic'=>['heic','heif']][$ext]??[$ext];
 $cur=strtolower(pathinfo($name,PATHINFO_EXTENSION));
 return in_array($cur,$alias,true)?$name:rtrim($name,'. ').'.'.$ext;
}
function filesCleanName(string $name): string {
 $name=basename(str_replace('\\','/',$name));$name=preg_replace('/[^\pL\pN._ ()-]/u','_',$name)??'archivo';$name=trim($name,'. ');
 return mb_substr($name!==''?$name:'archivo',0,150);
}
/** Quién puede enviar material al estudio: cualquier sesión con el pago confirmado y todavía abierta. */
function filesCustomerMayUpload(array $o): bool { return in_array($o['status'],['paid','in_production','review','completed'],true); }

function filesIncoming(): string { $d=storage().'/incoming'; if(!is_dir($d))mkdir($d,0700,true); return $d; }
/** Una subida abandonada (sin fragmentos nuevos en 12 h) libera su reserva. La edad cuenta desde el último fragmento, no desde que empezó. */
function filesPurgeStale(): void {
 $d=filesIncoming();$old=time()-43200;
 foreach(glob($d.'/*.json')?:[] as $j){$p=substr($j,0,-5).'.part';$t=max((int)@filemtime($j),is_file($p)?(int)@filemtime($p):0);if($t<$old){@unlink($j);@unlink($p);}}
 foreach(glob($d.'/*.done')?:[] as $dn)if((int)@filemtime($dn)<time()-3600)@unlink($dn);
 foreach(glob($d.'/*.part')?:[] as $p)if(!is_file(substr($p,0,-5).'.json')&&(int)@filemtime($p)<$old)@unlink($p);
}
function filesMeta(string $id): array {
 need((bool)preg_match('/^[a-f0-9]{32}$/',$id),'La subida no existe o ya terminó.',404);
 $m=@json_decode((string)@file_get_contents(filesIncoming().'/'.$id.'.json'),true);need(is_array($m),'La subida no existe o ya terminó.',404);
 if(($m['by']??'')==='admin')admin();
 $o=accessOrder((string)$m['ref']);need((int)$o['id']===(int)$m['order'],'La subida no pertenece a esta sesión.',403);
 return [$m,$o];
}

/** Serializa las comprobaciones de cupo de una sesión (init y finish de subidas simultáneas). */
function filesLocked(array $o,callable $fn): mixed {
 $fp=fopen(filesIncoming().'/order-'.(int)$o['id'].'.lock','c');need((bool)$fp,'No se pudo preparar la subida.',500);
 try{need(flock($fp,LOCK_EX),'No se pudo preparar la subida.',500);return $fn();}finally{flock($fp,LOCK_UN);fclose($fp);}
}
/** Cupo por TIPO: lo que sube el cliente nunca le quita espacio a la entrega del estudio. */
function filesUsage(array $o,string $kind): array {
 $row=sql('SELECT COUNT(*) AS n,COALESCE(SUM(size_bytes),0) AS b FROM deliverables WHERE order_id=? AND kind=?',[$o['id'],$kind])->fetch();$n=(int)$row['n'];$b=(int)$row['b'];
 foreach(glob(filesIncoming().'/*.json')?:[] as $mf){$pm=@json_decode((string)@file_get_contents($mf),true);if(is_array($pm)&&(int)($pm['order']??0)===(int)$o['id']&&($pm['kind']??'')===$kind){$n++;$b+=(int)$pm['size'];}}
 return [$n,$b];
}
/** Valida y registra un archivo ya completo. $store(destino) debe dejarlo en su sitio (move_uploaded_file o rename). */
function filesCommit(array $o,bool $isAdmin,string $kind,string $tmp,string $origName,callable $store,bool $reserved=false): array {
 need(in_array($kind,['delivery','source'],true),'Tipo inválido.');
 if(!$isAdmin){$kind='source';need(filesCustomerMayUpload($o),'Puedes enviar tus archivos cuando el pago está confirmado.',403);}
 $size=(int)filesize($tmp);$l=filesLimits();need($size>0,'El archivo está vacío.');need($size<=$l['file'],'El archivo supera el máximo de '.intdiv($l['file'],1048576).' MB.',413);
 $mime=filesSniff($tmp,$origName);need($mime!==null,'Ese formato no está admitido. Usa foto, video, audio, PDF o texto.',415);
 $group=filesGroup($mime);need($isAdmin||in_array($group,FILE_CUSTOMER_GROUPS,true),'Ese formato no está admitido. Usa foto, video, audio, PDF o texto.',415);
 $name=bin2hex(random_bytes(24)).'.'.FILE_TYPES[$mime];$original=filesNameFor(filesCleanName($origName),$mime);
 // Con $reserved el cupo ya se comprobó (y se reservó) en upload-init; aquí sólo se valida el contenido.
 $id=filesLocked($o,function()use($o,$kind,$size,$l,$reserved,$name,$original,$mime,$store){
  if(!$reserved){[$n,$b]=filesUsage($o,$kind);need($n<$l['count'],'Se alcanzó el límite de '.$l['count'].' archivos en esta sesión.',409);need($b+$size<=$l['order'],'Esta sesión alcanzó su espacio máximo ('.round($l['order']/1073741824,1).' GB).',413);}
  need($store(storage().'/'.$name),'No se pudo guardar el archivo.',500);
  try{sql('INSERT INTO deliverables(order_id,storage_name,original_name,mime,size_bytes,kind) VALUES(?,?,?,?,?,?)',[$o['id'],$name,$original,$mime,$size,$kind]);}catch(Throwable $e){@unlink(storage().'/'.$name);throw $e;}
  return (int)db()->lastInsertId();
 });
 if(!$isAdmin){ // el aviso sale en el servidor (no depende de que el navegador siga abierto): uno por ventana de 15 minutos
  sql('UPDATE orders SET requires_attention=1 WHERE id=?',[$o['id']]);
  try{notifyTeam($o,'Archivos nuevos del cliente','El cliente está subiendo archivos a su sesión (el primero: «'.$original.'»). Revísalos en el panel.','files:'.$o['reference'].':'.intdiv(time(),900));}catch(Throwable $e){error_log('FHB notify '.$e->getMessage());} // el archivo ya está guardado: un fallo del aviso no debe fingir que la subida falló
 }
 history($o,($kind==='delivery'?'Versión disponible: ':'Archivo añadido: ').$original,$isAdmin?'admin:'.(int)$_SESSION['admin_id']:'customer');
 return ['id'=>$id,'original_name'=>$original,'mime'=>$mime,'size_bytes'=>$size,'kind'=>$kind];
}

function filesInit(): never {
 $in=input();$o=accessOrder(field($in,'reference',1,40));$isAdmin=isset($_SESSION['admin_id']);
 need($isAdmin||filesCustomerMayUpload($o),'Puedes enviar tus archivos cuando el pago está confirmado.',403);
 rate('upload-init',400,3600);
 $kind=$isAdmin?field($in,'kind',1,20):'source';need(in_array($kind,['delivery','source'],true),'Tipo inválido.');
 $size=filter_var($in['size']??null,FILTER_VALIDATE_INT);$l=filesLimits();
 need($size!==false&&$size>0,'El archivo está vacío.');need($size<=$l['file'],'El archivo supera el máximo de '.intdiv($l['file'],1048576).' MB.',413);
 $name=filesCleanName(field($in,'name',1,300));
 $free=@disk_free_space(storage());need($free===false||$free>$size+64*1048576,'El estudio no tiene espacio libre ahora mismo. Inténtalo en unos minutos.',507);
 filesPurgeStale();$id=bin2hex(random_bytes(16));
 filesLocked($o,function()use($o,$kind,$size,$l,$name,$isAdmin,$id){
  [$n,$b]=filesUsage($o,$kind);
  need($n<$l['count'],'Se alcanzó el límite de '.$l['count'].' archivos en esta sesión.',409);
  need($b+$size<=$l['order'],'Esta sesión alcanzó su espacio máximo ('.round($l['order']/1073741824,1).' GB).',413);
  need(false!==file_put_contents(filesIncoming().'/'.$id.'.json',json_encode(['order'=>(int)$o['id'],'ref'=>$o['reference'],'by'=>$isAdmin?'admin':'customer','name'=>$name,'size'=>$size,'kind'=>$kind,'at'=>time()],JSON_UNESCAPED_UNICODE)),'No se pudo preparar la subida.',500);
 });
 touch(filesIncoming().'/'.$id.'.part');
 jsonResponse(['id'=>$id,'received'=>0,'chunk'=>filesPublicConfig()['chunkBytes']],201);
}

function filesStatus(): never {
 [$m]=filesMeta((string)($_GET['id']??''));clearstatcache();$p=filesIncoming().'/'.$_GET['id'].'.part';
 jsonResponse(['received'=>is_file($p)?(int)filesize($p):0,'size'=>(int)$m['size']]);
}

/** Cuerpo = bytes crudos del fragmento. Idempotente: repetir un fragmento ya recibido lo sobrescribe con los mismos datos. */
function filesChunk(): never {
 $id=(string)($_GET['id']??'');[$m]=filesMeta($id);session_write_close();
 $offset=filter_var($_GET['offset']??null,FILTER_VALIDATE_INT);$len=(int)($_SERVER['CONTENT_LENGTH']??0);$l=filesLimits();
 need($offset!==false&&$offset>=0,'Fragmento inválido.');need($len>0&&$len<=$l['chunk'],'Fragmento demasiado grande.',413);need($offset+$len<=(int)$m['size'],'El fragmento excede el tamaño anunciado.');
 $part=filesIncoming().'/'.$id.'.part';$fp=@fopen($part,'r+b');need((bool)$fp,'La subida no existe o ya terminó.',404);
 try{
  need(flock($fp,LOCK_EX),'No se pudo guardar el fragmento.',500);clearstatcache(true,$part);
  $a=fstat($fp);$b=@stat($part);need($b&&$a['ino']===$b['ino'],'La subida no existe o ya terminó.',404); // el archivo no fue cerrado ni cancelado mientras esperábamos el candado
  $have=(int)filesize($part);
  need($offset<=$have,'Fragmento fuera de orden.',409);
  fseek($fp,$offset);$in=fopen('php://input','rb');$written=(int)stream_copy_to_stream($in,$fp,$len);fclose($in);fflush($fp);
  need($written===$len,'El fragmento llegó incompleto. Se reintentará.',400);
  if($offset===0){ // el formato se rechaza con el primer fragmento, sin esperar a recibir 1 GB
   $mime=filesSniff($part,(string)$m['name']);
   if($mime===null||(($m['by']??'')!=='admin'&&!in_array(filesGroup($mime),FILE_CUSTOMER_GROUPS,true))){@unlink($part);@unlink(filesIncoming().'/'.$id.'.json');throw new HttpError(415,'Ese formato no está admitido. Usa foto, video, audio, PDF o texto.');}
  }
  jsonResponse(['received'=>max($have,$offset+$len)]);
 }finally{if(is_resource($fp)){flock($fp,LOCK_UN);fclose($fp);}}
}

function filesFinish(): never {
 $in=input();$id=field($in,'id',32,32);
 // Idempotente: si la respuesta se perdió y el navegador repite el cierre, devuelve el mismo archivo en vez de duplicarlo.
 $dn=filesIncoming().'/'.$id.'.done';
 if(preg_match('/^[a-f0-9]{32}$/',$id)&&is_file($dn)){$dm=@json_decode((string)@file_get_contents($dn),true);if(is_array($dm)){if(($dm['by']??'')==='admin')admin();accessOrder((string)$dm['ref']);jsonResponse(['file'=>$dm['file']],200);}}
 [$m,$o]=filesMeta($id);$isAdmin=($m['by']??'')==='admin';
 $part=filesIncoming().'/'.$id.'.part';
 $fp=@fopen($part,'r+b');need((bool)$fp,'La subida no existe o ya terminó.',404);
 try{
  need(flock($fp,LOCK_EX),'No se pudo cerrar la subida.',500); // espera a que termine cualquier fragmento en curso
  clearstatcache(true,$part);need((int)filesize($part)===(int)$m['size'],'Faltan datos del archivo. Se reintentará.',409);
  try{$f=filesCommit($o,$isAdmin,(string)$m['kind'],$part,(string)$m['name'],fn(string $dest)=>rename($part,$dest),true);}
  catch(Throwable $e){@unlink($part);@unlink(filesIncoming().'/'.$id.'.json');throw $e;}
  @unlink(filesIncoming().'/'.$id.'.json');@file_put_contents($dn,json_encode(['ref'=>$m['ref'],'by'=>$m['by'],'file'=>$f],JSON_UNESCAPED_UNICODE));
 }finally{fclose($fp);}
 jsonResponse(['file'=>$f],201);
}

function filesCancel(): never {
 $in=input();$id=field($in,'id',32,32);filesMeta($id);@unlink(filesIncoming().'/'.$id.'.part');@unlink(filesIncoming().'/'.$id.'.json');jsonResponse(['ok'=>true]);
}

/** El cliente terminó una tanda: confirma cuántos archivos llegaron (el aviso al equipo ya salió al recibir el primero). */
function filesDone(): never {
 $in=input();$o=accessOrder(field($in,'reference',1,40));need(!isset($_SESSION['admin_id']),'Sólo lo envía el cliente.',403);
 $rows=sql("SELECT original_name FROM deliverables WHERE order_id=? AND kind='source' AND created_at>=? ORDER BY id",[$o['id'],gmdate('Y-m-d H:i:s',time()-900)])->fetchAll(PDO::FETCH_COLUMN);
 if($rows){
  sql('UPDATE orders SET requires_attention=1 WHERE id=?',[$o['id']]);
 }
 jsonResponse(['ok'=>true,'count'=>count($rows)]);
}

/** Retira un archivo. El estudio puede retirar cualquiera; el cliente, sólo lo que él subió y mientras la sesión sigue abierta. */
function filesDelete(): never {
 $in=input();$f=sql('SELECT d.*,o.reference FROM deliverables d JOIN orders o ON o.id=d.order_id WHERE d.id=?',[(int)($in['id']??0)])->fetch();need((bool)$f,'Archivo no encontrado.',404);
 $o=accessOrder($f['reference']);$isAdmin=isset($_SESSION['admin_id']);
 need($isAdmin||($f['kind']==='source'&&$o['status']!=='completed'),'No puedes retirar este archivo.',403);
 need(!($f['kind']==='delivery'&&$o['status']==='completed'),'Pasa la sesión a revisión antes de retirar un archivo entregado.',409);
 db()->beginTransaction();
 try{sql('DELETE FROM deliverables WHERE id=?',[$f['id']]);history($o,'Archivo retirado: '.$f['original_name'],$isAdmin?'admin:'.(int)$_SESSION['admin_id']:'customer',false);db()->commit();}
 catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
 @unlink(storage().'/'.$f['storage_name']);
 jsonResponse(['ok'=>true]);
}
