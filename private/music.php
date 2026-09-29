<?php
declare(strict_types=1);
// Small public music catalogue. Private customer deliveries never enter this catalogue.
function musicDefaults(): array {
 $rows=[['quedate','Quédate','Pop · Amor','Hay personas que se vuelven hogar.'],['ey-mor','Ey, mor','Afrobeat · Conexión','Ese encuentro que lo cambia todo.'],['ando-tumbao','Ando tumbao','Trap · Actitud','Una historia con su propio ritmo.'],['country','A country story','Country · En inglés','Los recuerdos también cruzan fronteras.'],['perreo','Perreo en la disco','Reggaetón · Energía','Para los que celebran a todo volumen.'],['danilo','¡Feliz cumpleaños, Danilo!','Celebración · Dedicatoria','Un cumpleaños que merece su canción.']];
 return array_map(fn($r,$i)=>['id'=>$r[0],'name'=>$r[1],'genre'=>$r[2],'dedication'=>$r[3],'audio'=>'assets/audio/'.$r[0].'.mp3','cover'=>'assets/images/covers/'.$r[0].'.webp','published'=>true,'position'=>$i],$rows,array_keys($rows));
}
function musicRead(): array {
 $p=storage().'/music.json';if(!is_file($p))return musicDefaults();
 $rows=json_decode((string)file_get_contents($p),true,32,JSON_THROW_ON_ERROR);need(is_array($rows),'Catálogo no disponible.',500);return $rows;
}
function musicPublic(): array {
 $rows=array_values(array_filter(musicRead(),fn($t)=>$t['published']===true));
 usort($rows,fn($a,$b)=>($a['position']<=>$b['position'])?:strcmp($a['id'],$b['id']));
 return array_map(fn($t)=>array_intersect_key($t,array_flip(['id','name','genre','dedication','audio','cover'])),$rows);
}
function musicUpload(string $key,array $types,int $limit): ?array {
 $f=$_FILES[$key]??null;if(!$f||$f['error']===UPLOAD_ERR_NO_FILE)return null;
 need($f['error']===UPLOAD_ERR_OK&&$f['size']>0&&$f['size']<=$limit,'Revisa el archivo '.$key.' y su tamaño.');
 $mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);need(isset($types[$mime]),'Formato no permitido para '.$key.'.');
 if($key==='cover'){ $size=getimagesize($f['tmp_name']);need($size!==false&&$size[0]<=8000&&$size[1]<=8000,'Portada inválida o demasiado grande.'); }
 $name='music-'.bin2hex(random_bytes(20)).'.'.$types[$mime];need(move_uploaded_file($f['tmp_name'],storage().'/'.$name),'No se pudo guardar el archivo.',500);
 return ['storage'=>$name,'mime'=>$mime,'url'=>'api.php?action=music-media&name='.$name];
}
function musicSave(): void {
 admin();$id=trim((string)($_POST['track_id']??''));$name=field($_POST,'name',1,120);$genre=field($_POST,'genre',1,120);$dedication=field($_POST,'dedication',0,300);
 $pos=filter_var($_POST['position']??0,FILTER_VALIDATE_INT);need($pos!==false&&$pos>=0&&$pos<=10000,'Orden inválido.');
 $lock=fopen(storage().'/music.lock','c');need($lock!==false&&flock($lock,LOCK_EX),'El catálogo está ocupado.',503);$added=[];
 try{
  $rows=musicRead();$index=null;foreach($rows as $i=>$t)if($t['id']===$id)$index=$i;
  need($id===''||$index!==null,'Canción no encontrada.',404);need($index!==null||count($rows)<500,'Límite de catálogo alcanzado.');
  $row=$index===null?['id'=>bin2hex(random_bytes(12))]:$rows[$index];
  foreach(['audio'=>[['audio/mpeg'=>'mp3','audio/wav'=>'wav','audio/x-wav'=>'wav'],50*1024*1024],'cover'=>[['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'],5*1024*1024]] as $key=>$spec){
   $upload=musicUpload($key,$spec[0],$spec[1]);if($upload){$added[]=$upload['storage'];$row[$key]=$upload['url'];$row[$key.'_storage']=$upload['storage'];$row[$key.'_mime']=$upload['mime'];}
  }
  need(isset($row['audio'],$row['cover']),'Añade un audio y una portada.');
  $row=array_merge($row,['name'=>$name,'genre'=>$genre,'dedication'=>$dedication,'position'=>$pos,'published'=>($_POST['published']??'')==='1']);
  if($index===null)$rows[]=$row;else $rows[$index]=$row;
  $temp=tempnam(storage(),'music-tmp-');need($temp!==false,'No se pudo guardar el catálogo.',500);
  try{need(file_put_contents($temp,json_encode($rows,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR))!==false&&rename($temp,storage().'/music.json'),'No se pudo guardar el catálogo.',500);}finally{if(is_file($temp))unlink($temp);}
 }catch(Throwable $e){foreach($added as $name)if(is_file(storage().'/'.$name))unlink(storage().'/'.$name);throw $e;}finally{flock($lock,LOCK_UN);fclose($lock);}
 jsonResponse(['ok'=>true],201);
}
function musicStream(): never {
 $name=(string)($_GET['name']??'');need((bool)preg_match('/^music-[a-f0-9]{40}\.(mp3|wav|jpg|png|webp)$/D',$name),'Archivo no encontrado.',404);
 $mime=null;foreach(musicRead() as $t){if(!$t['published']&&!isset($_SESSION['admin_id']))continue;foreach(['audio','cover'] as $key)if(($t[$key.'_storage']??'')===$name)$mime=$t[$key.'_mime'];}
 need($mime!==null,'Archivo no disponible.',404);$path=storage().'/'.$name;need(is_file($path),'Archivo no disponible.',404);
 session_write_close();header('Content-Type: '.$mime);header('Accept-Ranges: bytes');$size=filesize($path);$start=0;$end=$size-1;
 if(isset($_SERVER['HTTP_RANGE'])){need((bool)preg_match('/^bytes=(\d*)-(\d*)$/D',$_SERVER['HTTP_RANGE'],$m)&&($m[1]!==''||$m[2]!==''),'Rango inválido.',416);if($m[1]==='')$start=max(0,$size-(int)$m[2]);else{$start=(int)$m[1];if($m[2]!=='')$end=min($end,(int)$m[2]);}need($start<=$end&&$start<$size,'Rango inválido.',416);http_response_code(206);header("Content-Range: bytes $start-$end/$size");}
 header('Content-Length: '.($end-$start+1));$f=fopen($path,'rb');fseek($f,$start);$left=$end-$start+1;while($left>0&&!feof($f)){$chunk=fread($f,min(65536,$left));echo $chunk;$left-=strlen($chunk);}fclose($f);exit;
}
