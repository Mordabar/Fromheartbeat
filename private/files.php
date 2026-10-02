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
 if($b0===0xFF&&($b1&0xE0)===0xE0&&(($b1>>1)&3)!==0&&(($b1>>3)&3)!==1)return 'audio/mpeg';
 // Texto plano: sólo con extensión .txt, UTF-8 válido y sin bytes nulos.
 if(strtolower(pathinfo($name,PATHINFO_EXTENSION))==='txt'&&!str_contains($h,"\0")&&mb_check_encoding($h,'UTF-8'))return 'text/plain';
 return null;
}

function filesCleanName(string $name): string {
 $name=basename(str_replace('\\','/',$name));$name=preg_replace('/[^\pL\pN._ ()-]/u','_',$name)??'archivo';$name=trim($name,'. ');
 return mb_substr($name!==''?$name:'archivo',0,150);
}
/** Quién puede enviar material al estudio: cualquier sesión con el pago confirmado y todavía abierta. */
function filesCustomerMayUpload(array $o): bool { return in_array($o['status'],['paid','in_production','review','completed'],true); }

function filesIncoming(): string { $d=storage().'/incoming'; if(!is_dir($d))mkdir($d,0700,true); return $d; }
function filesPurgeStale(): void {
 foreach(glob(filesIncoming().'/*')?:[] as $f)if(is_file($f)&&filemtime($f)<time()-172800)@unlink($f);
}
function filesMeta(string $id): array {
 need((bool)preg_match('/^[a-f0-9]{32}$/',$id),'La subida no existe o ya terminó.',404);
 $m=@json_decode((string)@file_get_contents(filesIncoming().'/'.$id.'.json'),true);need(is_array($m),'La subida no existe o ya terminó.',404);
 if(($m['by']??'')==='admin')admin();
 $o=accessOrder((string)$m['ref']);need((int)$o['id']===(int)$m['order'],'La subida no pertenece a esta sesión.',403);
 return [$m,$o];
}

/** Valida y registra un archivo ya completo. $store(destino) debe dejarlo en su sitio (move_uploaded_file o rename). */
function filesCommit(array $o,bool $isAdmin,string $kind,string $tmp,string $origName,callable $store): array {
 need(in_array($kind,['delivery','source'],true),'Tipo inválido.');
 if(!$isAdmin){$kind='source';need(filesCustomerMayUpload($o),'Puedes enviar tus archivos cuando el pago está confirmado.',403);}
 $size=(int)filesize($tmp);$l=filesLimits();need($size>0,'El archivo está vacío.');need($size<=$l['file'],'El archivo supera el máximo de '.intdiv($l['file'],1048576).' MB.',413);
 $mime=filesSniff($tmp,$origName);need($mime!==null,'Ese formato no está admitido. Usa foto, video, audio, PDF o texto.',415);
 $group=filesGroup($mime);need($isAdmin||in_array($group,FILE_CUSTOMER_GROUPS,true),'Ese formato no está admitido. Usa foto, video, audio, PDF o texto.',415);
 $row=sql('SELECT COUNT(*) AS n,COALESCE(SUM(size_bytes),0) AS b FROM deliverables WHERE order_id=?',[$o['id']])->fetch();
 need((int)$row['n']<$l['count'],'Se alcanzó el límite de '.$l['count'].' archivos en esta sesión.',409);
 need((int)$row['b']+$size<=$l['order'],'Esta sesión alcanzó su espacio máximo ('.round($l['order']/1073741824,1).' GB).',413);
 $name=bin2hex(random_bytes(24)).'.'.FILE_TYPES[$mime];$original=filesCleanName($origName);
 need($store(storage().'/'.$name),'No se pudo guardar el archivo.',500);
 try{sql('INSERT INTO deliverables(order_id,storage_name,original_name,mime,size_bytes,kind) VALUES(?,?,?,?,?,?)',[$o['id'],$name,$original,$mime,$size,$kind]);}catch(Throwable $e){@unlink(storage().'/'.$name);throw $e;}
 $id=(int)db()->lastInsertId();
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
 $row=sql('SELECT COUNT(*) AS n,COALESCE(SUM(size_bytes),0) AS b FROM deliverables WHERE order_id=?',[$o['id']])->fetch();
 filesPurgeStale();$pending=0;$pendingN=0;
 foreach(glob(filesIncoming().'/*.json')?:[] as $mf){$pm=@json_decode((string)@file_get_contents($mf),true);if(is_array($pm)&&(int)($pm['order']??0)===(int)$o['id']){$pending+=(int)$pm['size'];$pendingN++;}}
 need((int)$row['n']+$pendingN<$l['count'],'Se alcanzó el límite de '.$l['count'].' archivos en esta sesión.',409);
 need((int)$row['b']+$pending+$size<=$l['order'],'Esta sesión alcanzó su espacio máximo ('.round($l['order']/1073741824,1).' GB).',413);
 $free=@disk_free_space(storage());need($free===false||$free>$size+64*1048576,'El estudio no tiene espacio libre ahora mismo. Inténtalo en unos minutos.',507);
 $id=bin2hex(random_bytes(16));
 need(false!==file_put_contents(filesIncoming().'/'.$id.'.json',json_encode(['order'=>(int)$o['id'],'ref'=>$o['reference'],'by'=>$isAdmin?'admin':'customer','name'=>$name,'size'=>$size,'kind'=>$kind,'at'=>time()],JSON_UNESCAPED_UNICODE)),'No se pudo preparar la subida.',500);
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
 $part=filesIncoming().'/'.$id.'.part';$fp=fopen($part,'c+b');need((bool)$fp,'No se pudo guardar el fragmento.',500);
 try{
  need(flock($fp,LOCK_EX),'No se pudo guardar el fragmento.',500);clearstatcache(true,$part);$have=(int)filesize($part);
  need($offset<=$have,'Fragmento fuera de orden.',409);
  fseek($fp,$offset);$in=fopen('php://input','rb');$written=(int)stream_copy_to_stream($in,$fp,$len);fclose($in);fflush($fp);
  need($written===$len,'El fragmento llegó incompleto. Se reintentará.',400);
  jsonResponse(['received'=>max($have,$offset+$len)]);
 }finally{if(is_resource($fp)){flock($fp,LOCK_UN);fclose($fp);}}
}

function filesFinish(): never {
 $in=input();$id=field($in,'id',32,32);[$m,$o]=filesMeta($id);$isAdmin=($m['by']??'')==='admin';
 $part=filesIncoming().'/'.$id.'.part';clearstatcache();need(is_file($part)&&(int)filesize($part)===(int)$m['size'],'Faltan datos del archivo. Se reintentará.',409);
 try{$f=filesCommit($o,$isAdmin,(string)$m['kind'],$part,(string)$m['name'],fn(string $dest)=>rename($part,$dest));}
 catch(Throwable $e){@unlink($part);@unlink(filesIncoming().'/'.$id.'.json');throw $e;}
 @unlink(filesIncoming().'/'.$id.'.json');
 jsonResponse(['file'=>$f],201);
}

function filesCancel(): never {
 $in=input();$id=field($in,'id',32,32);filesMeta($id);@unlink(filesIncoming().'/'.$id.'.part');@unlink(filesIncoming().'/'.$id.'.json');jsonResponse(['ok'=>true]);
}

/** El cliente terminó una tanda: marca la sesión para atención y avisa al estudio una sola vez por ventana de 15 minutos. */
function filesDone(): never {
 $in=input();$o=accessOrder(field($in,'reference',1,40));need(!isset($_SESSION['admin_id']),'Sólo lo envía el cliente.',403);
 $rows=sql("SELECT original_name FROM deliverables WHERE order_id=? AND kind='source' AND created_at>=? ORDER BY id",[$o['id'],gmdate('Y-m-d H:i:s',time()-900)])->fetchAll(PDO::FETCH_COLUMN);
 if($rows){
  sql('UPDATE orders SET requires_attention=1 WHERE id=?',[$o['id']]);
  $n=count($rows);notifyTeam($o,$n===1?'Un archivo nuevo del cliente':$n.' archivos nuevos del cliente',$n===1?'El cliente subió «'.$rows[0].'» a su sesión.':'El cliente subió '.$n.' archivos a su sesión, entre ellos «'.$rows[0].'».','files:'.$o['reference'].':'.intdiv(time(),900));
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
