<?php
declare(strict_types=1);
// Transactional email engine.
// Every message is ONE structured model ($m) rendered twice: branded table-based HTML (600px, inline CSS,
// Outlook VML button, solid-colour fallbacks) and a plain-text alternative, so the two never drift apart.
// Stored in mail_queue.body as: MAIL_HTML_MARK . html . MAIL_TEXT_MARK . text  (see mailParts()).
const MAIL_HTML_MARK='<!--fhb:html-->';
const MAIL_TEXT_MARK="\n<!--fhb:text-->\n";
const MAIL_C=['bg'=>'#07040f','panel'=>'#0f0920','card'=>'#170e2e','card2'=>'#1e1239','line'=>'#2e2058','rail'=>'#6a56a8','ink'=>'#f4eeff','body'=>'#d6cceb','muted'=>'#b5a8d2','dim'=>'#9a8ebd','neon'=>'#c6a2ff','violet'=>'#9b5cff','pink'=>'#ff4fd8','btn'=>'#c6a2ff','btnInk'=>'#1a0b3a','warn'=>'#ffb3ec'];
const MAIL_WRAP='word-break:break-word;overflow-wrap:anywhere;';
const MAIL_SERIF="'Cormorant Garamond',Georgia,'Times New Roman',serif";
const MAIL_SANS="Manrope,'Helvetica Neue',Helvetica,Arial,sans-serif";

function mh(string $s): string { return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
/** Splits a stored queue body into ['html'=>?string,'text'=>string]. Legacy plain-text rows have html=null. */
function mailParts(string $body): array {
 if(!str_starts_with($body,MAIL_HTML_MARK))return ['html'=>null,'text'=>$body];
 $rest=substr($body,strlen(MAIL_HTML_MARK));$i=strpos($rest,MAIL_TEXT_MARK);
 return $i===false?['html'=>$rest,'text'=>'']:['html'=>substr($rest,0,$i),'text'=>substr($rest,$i+strlen(MAIL_TEXT_MARK))];
}
/** Fills a PHPMailer message from a stored queue body: HTML + AltBody in CRLF/quoted-printable, or legacy plain text. */
function mailFill(object $mail,string $stored): void {
 $crlf=fn(string $s)=>(string)preg_replace('/\R/u',"\r\n",$s);$p=mailParts($stored);
 if(mailSupport()!=='')$mail->addReplyTo(mailSupport(),'Fromheartbeat');
 $h=parse_url(appUrl('/'),PHP_URL_HOST);if(is_string($h)&&$h!=='')$mail->Hostname=$h;
 $mail->addCustomHeader('Auto-Submitted','auto-generated');
 if($p['html']!==null){$mail->isHTML(true);$mail->Encoding='quoted-printable';$mail->Body=$crlf($p['html']);$mail->AltBody=$crlf($p['text']);}else $mail->Body=$crlf($p['text']);
}
function mailMoney(int $cents): string { return '$'.number_format($cents/100,0,',','.').' COP'; }
function mailDate(?string $utc=null): string {
 static $months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 $d=new DateTimeImmutable($utc??'now',new DateTimeZone('UTC'));$d=$d->setTimezone(new DateTimeZone('America/Bogota'));
 return $d->format('j').' de '.$months[(int)$d->format('n')-1].' de '.$d->format('Y');
}
/** Strips bidi overrides, zero-width and control characters (keeps \n and \t): customer text lands in emails sent under our brand. */
function mailClean(string $s): string { return preg_replace('/[\x{202A}-\x{202E}\x{2066}-\x{2069}\x{200B}\x{200E}\x{200F}\x{061C}\x{2060}-\x{2064}\x{206A}-\x{206F}\x{00AD}\x{180E}\x{FFF9}-\x{FFFB}\x{E0000}-\x{E007F}\x{3164}\x{2800}\x{115F}\x{1160}\x{2028}\x{2029}\x{FEFF}]|[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/u','',$s)??''; }
/** Customer text is repeated under our brand: stop mail clients from turning it into a clickable link (anti-phishing). */
function mailNoLink(string $s): string { return (string)preg_replace(['~(?<=[a-z]):(?=//)~i','~\bwww\.~i'],[":\u{200B}","www\u{200B}."],$s); }
function mailClip(string $s,int $n): string { $s=trim((string)preg_replace('/\s+/u',' ',mailClean($s))); return mb_strlen($s)>$n?rtrim(mb_substr($s,0,$n-1)).'…':$s; }
function mailAsset(string $file): string { return appUrl('/assets/email/'.$file); }
function mailHasAsset(string $file): bool { return is_file(dirname(BASE).'/assets/email/'.$file); }
function mailSupport(): string { $e=env('SUPPORT_EMAIL'); return filter_var($e,FILTER_VALIDATE_EMAIL)?$e:env('MAIL_FROM'); }
function mailSessionUrl(array $o): string { return appUrl('/?session='.$o['reference'].'#token='.privateLink($o)); }
/** First name only when it really looks like one (letters, up to 24): never echo arbitrary customer text as a greeting. */
function mailFirstName(array $c): string {
 $n=trim(explode(' ',trim(mailClean((string)($c['name']??''))))[0]);
 if(!preg_match('/^[\p{L}\p{M}\'’-]{1,24}$/u',$n)||!preg_match('/\p{L}/u',$n))return '';
 if(mb_strlen($n)>1&&mb_strtoupper($n,'UTF-8')===$n)return mb_convert_case($n,MB_CASE_TITLE,'UTF-8'); // "JUAN-CARLOS" -> "Juan-Carlos"
 return mb_strtoupper(mb_substr($n,0,1)).mb_substr($n,1);
}
/** "Tu historia *ya está aquí.*" -> [[text,false],[text,true]] ; the starred part becomes the italic accent. */
function mailTitleParts(string $t): array { $out=[];foreach(explode('*',$t) as $i=>$p)if($p!=='')$out[]=[$p,$i%2===1];return $out; }
/** Keeps the last two words together so a headline never ends with a one-word orphan line. */
function mailOrphan(string $escaped): string { return (string)preg_replace('/ (\S+)$/u','&nbsp;$1',$escaped); }
function mailThin(int $h): string { return 'font-size:1px;line-height:'.$h.'px;mso-line-height-rule:exactly;'; }

// ---------------------------------------------------------------- product knowledge (copy must never promise what the product does not include)
/** 'ai' = Dedicatoria Musical (digital/AI flow, no human singer, no master); 'studio' = singer + mix/master; 'business' = jingle/campaign. */
function mailProductKind(array $o): string { return $o['audience']==='business'?'business':(($o['product_code']??'')==='dedicatoria'?'ai':'studio'); }
/** Adjustment rounds the package really includes, read from the catalog text ("1 ronda de ajustes", "2 rondas…"). */
function mailRounds(array $o): int { foreach(($o['product']['features']??[]) as $f)if(preg_match('/(\d+)\s+rondas?\s+de\s+ajustes/iu',(string)$f,$m))return (int)$m[1];return 0; }
/** Full Experience inherits the song round of Canción Personalizada and adds one for the video (see catalog FAQ). */
function mailRoundsText(array $o): string {
 if(($o['product_code']??'')==='full')return '1 ronda de ajustes para la canción y 1 para el video';
 $n=mailRounds($o);return $n>0?$n.($n===1?' ronda':' rondas').' de ajustes':'';
}
function mailJourney(array $o): array {
 return $o['audience']==='business'?['Brief','Propuesta','Pago','Estudio','Revisión','Entrega']:['Historia','Pago','Producción','Revisión','Entrega'];
}
function mailStatusLabel(string $s): string { return ['created'=>'Sesión guardada','payment_pending'=>'Confirmando el pago','paid'=>'Pago confirmado','in_production'=>'En producción','review'=>'En revisión','completed'=>'Tu canción está lista','cancelled'=>'Sesión cancelada'][$s]??'En curso'; }
function mailStageNames(string $pk): array { return $pk==='ai'?[1=>'Letra',2=>'Composición',3=>'Pulido',4=>'Revisión final']:[1=>'Letra',2=>'Grabación',3=>'Arreglos',4=>'Mezcla y master']; }
function mailStageCopy(int $stage,string $pk): array { // [title, preheader, lead]
 $biz=$pk==='business';$ai=$pk==='ai';
 return match($stage){
  1=>$biz?['Estamos escribiendo *la letra.*','Concepto y letra a partir del brief de tu marca.','Leímos el brief de tu marca y lo estamos convirtiendo en el concepto y la letra de tu pieza.']
     :['Estamos escribiendo *tu letra.*','Cada verso nace de lo que nos contaste.','Leímos tu historia con calma y la estamos convirtiendo en versos que suenen a ustedes: sus palabras, sus detalles, su manera de decir las cosas.'],
  2=>$biz?['Tu pieza *está en cabina.*','Las voces y los instrumentos ya están sonando.','Estamos grabando las voces y los instrumentos de tu pieza.']
     :($ai?['Tu canción *empieza a sonar.*','Estamos componiendo la música y la voz.','Con tu letra lista, estamos componiendo la música y la voz de tu canción con nuestro flujo de creación digital con IA.']
     :['Tu canción *está en cabina.*','Las voces y los instrumentos ya están sonando.','Tu letra ya tiene melodía. Estamos grabando las voces y los instrumentos que le dan vida a tu historia.']),
  3=>$biz?['Tu pieza *toma forma.*','Arreglos, ritmo y capas alrededor de tu marca.','Estamos armando los arreglos, el ritmo y las capas que sostienen la identidad sonora de tu marca.']
     :($ai?['Tu canción *toma forma.*','Revisamos y ajustamos la composición.','Estamos revisando la composición y ajustándola para que se sienta completa y suene como la imaginaste.']
     :['Tu canción *toma forma.*','Ritmo, arreglos y capas alrededor de tu historia.','Estamos armando los arreglos, las capas y el ritmo que sostienen tu canción. Ya se empieza a sentir completa.']),
  4=>$biz?['Afinando *los últimos detalles.*','Mezcla, master y preparación de tus archivos.','Equilibramos cada voz y cada instrumento, damos el master final y preparamos los archivos de entrega.']
     :($ai?['Última *revisión de calidad.*','Antes de entregarte tu canción.','Hacemos una última revisión de calidad para que tu MP3 y tu portada lleguen listos para compartir.']
     :['Afinando *los últimos detalles.*','Mezcla y master: el pulido final.','Equilibramos cada voz y cada instrumento y damos el master final para que suene increíble en cualquier parlante.']),
  5=>$biz?['Preparando *tu entrega.*','Dejamos listos los archivos finales de tu pieza.','Estamos dejando listos los archivos finales de tu pieza para subirlos a tu sesión.']
     :($ai?['Preparando *tu entrega.*','Tu MP3 y tu portada están por llegar.','Estamos dejando listos tu MP3 y tu portada para subirlos a tu sesión.']
     :['Preparando *tu entrega.*','Tu canción ya casi está en tus manos.','Tu canción está terminada. Estamos dejando listos los archivos finales para subirlos a tu sesión.']),
  default=>[$biz?'Tu pieza *sigue en marcha.*':'Tu sesión *sigue en marcha.*','Seguimos trabajando en tu canción.','Tu sesión sigue avanzando en el estudio. Aquí tienes cómo va.']
 };
}
/** What happens after the current stage, so each production email carries information of its own (no timing promises). */
function mailStageNext(int $stage,string $pk): ?array {
 $t=[
  'studio'=>[1=>['Lo que sigue: grabación','Cuando la letra esté lista, pasa a cabina para grabar las voces. Si recuerdas un detalle que falte (un apodo, una fecha), cuéntalo desde tu sesión.'],2=>['Lo que sigue: arreglos','Con las voces grabadas, armamos los arreglos y las capas de producción.'],3=>['Lo que sigue: mezcla y master','Cuando la producción esté lista, equilibramos y masterizamos. Después podrás escuchar tu primera versión.'],4=>['Lo que sigue: tu primera escucha','Al terminar el master subimos una versión a tu sesión y te escribimos para que la escuches.']],
  'ai'=>[1=>['Lo que sigue: composición','Con tu letra lista, creamos la música y la voz con nuestro flujo de creación digital con IA. ¿Falta un detalle? Cuéntalo desde tu sesión.'],2=>['Lo que sigue: pulido','Revisamos la composición y la ajustamos para que suene como la imaginaste.'],3=>['Lo que sigue: revisión final','Hacemos una última revisión de calidad de tu MP3 y tu portada.'],4=>['Lo que sigue: tu entrega','Subimos tu MP3 y tu portada a tu sesión y te avisamos por correo.']],
  'business'=>[1=>['Lo que sigue: grabación','Cuando la letra esté lista, grabamos las voces y los instrumentos de tu pieza.'],2=>['Lo que sigue: arreglos','Con las grabaciones listas, armamos los arreglos y las capas.'],3=>['Lo que sigue: mezcla y master','Mezcla, master y preparación de tus adaptaciones.'],4=>['Lo que sigue: tu revisión','Subimos una versión a tu sesión para que la revises y nos cuentes qué ajustarías.'],5=>['Lo que sigue: tu entrega','Cuando los archivos estén listos, te avisamos por correo y los descargas desde tu sesión.']],
 ];
 foreach(['studio','ai'] as $k)$t[$k][5]=['Lo que sigue: tu entrega','Cuando los archivos estén listos, te avisamos por correo y los descargas desde tu sesión.'];
 return $t[$pk][$stage]??null;
}
function mailKindLabel(string $mime): string {
 return match(true){str_starts_with($mime,'audio/mpeg')=>'MP3',str_starts_with($mime,'audio/')=>'WAV',str_starts_with($mime,'video/')=>'VIDEO',str_starts_with($mime,'image/')=>'PORTADA',default=>'ARCHIVO'};
}

// ---------------------------------------------------------------- HTML blocks
function mbPara(string $text,bool $lead=false): string {
 $size=$lead?'18px':'16px';$lh=$lead?'30px':'26px';
 return '<tr><td class="px" style="padding:0 40px 18px 40px;font-family:'.MAIL_SANS.';font-size:'.$size.';line-height:'.$lh.';'.MAIL_WRAP.'color:'.($lead?MAIL_C['ink']:MAIL_C['body']).';">'.nl2br($lead&&!str_contains($text,"\n")?mailOrphan(mh($text)):mh($text),false).'</td></tr>';
}
function mbSeg(string $bg,int $h=5): string {
 return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td height="'.$h.'" bgcolor="'.$bg.'" style="height:'.$h.'px;'.mailThin($h).'background-color:'.$bg.';border-radius:3px;">&nbsp;</td></tr></table>';
}
/** One progress instrument for the whole journey: done=violet, current=pink (optionally split into sub-ticks for production stages), pending=rail. */
function mbTracker(array $t): string {
 $steps=$t['steps'];$active=$t['active'];$complete=!empty($t['complete']);$n=count($steps);$w=(int)floor(100/$n);$sub=$t['sub']??null;
 $bars='';$labels='';$lbl=$n>=6?'lbl lbl6':'lbl';
 foreach($steps as $i=>$label){
  $done=$i<$active||($complete&&$i===$active);$cur=$i===$active&&!$complete;
  $ink=$cur?MAIL_C['ink']:($done?MAIL_C['neon']:MAIL_C['dim']);
  $glyph=$done?'&#10003;':($cur?'&#9679;':'&#9675;');
  if($cur&&$sub){
   $cells='';for($k=0;$k<$sub['count'];$k++)$cells.='<td width="'.(int)floor(100/$sub['count']).'%" style="padding:0 1px;">'.mbSeg($k<$sub['at']?MAIL_C['violet']:($k===$sub['at']?MAIL_C['pink']:MAIL_C['rail'])).'</td>';
   $seg='<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>'.$cells.'</tr></table>';
  }else $seg=mbSeg($done?MAIL_C['violet']:($cur?MAIL_C['pink']:MAIL_C['rail']));
  $bars.='<td width="'.$w.'%" style="padding:0 3px;">'.$seg.'</td>';
  $labels.='<td width="'.$w.'%" align="center" class="'.$lbl.'" style="padding:9px 1px 0 1px;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:'.($cur?'800':'600').';letter-spacing:.2px;word-break:normal;overflow-wrap:normal;color:'.$ink.';">'.$glyph.'<br>'.mh($label).'</td>';
 }
 $cap=mh($t['caption']??'');
 return '<tr><td class="px" style="padding:6px 37px 26px 37px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'
  .($cap!==''?'<tr><td colspan="'.$n.'" style="padding:0 3px 12px 3px;font-family:'.MAIL_SANS.';font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;'.MAIL_WRAP.'color:'.MAIL_C['dim'].';">'.nl2br($cap,false).'</td></tr>':'')
  .'<tr>'.$bars.'</tr><tr>'.$labels.'</tr></table></td></tr>';
}
function mbRecap(array $r): string {
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.MAIL_C['card'].'" style="background-color:'.MAIL_C['card'].';border:1px solid '.MAIL_C['line'].';border-radius:16px;"><tr><td style="padding:16px 22px;">'
  .'<p style="margin:0 0 6px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['neon'].';">'.mh($r['label']).'</p>'
  .'<p style="margin:0;font-family:'.MAIL_SERIF.';font-size:22px;line-height:28px;font-style:italic;font-variant-numeric:lining-nums;'.MAIL_WRAP.'color:'.MAIL_C['ink'].';">'.mh($r['text']).'</p></td></tr></table></td></tr>';
}
function mbSummary(array $s): string {
 $rows='';$last=count($s['rows'])-1;
 foreach($s['rows'] as $i=>[$k,$v]){
  $b=$i<$last?'border-bottom:1px solid '.MAIL_C['line'].';':'';
  $rows.='<tr><td class="k" valign="top" width="36%" style="padding:11px 12px 11px 0;'.$b.'font-family:'.MAIL_SANS.';font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;word-break:normal;overflow-wrap:normal;color:'.MAIL_C['dim'].';">'.mh($k).'</td><td class="v" valign="top" align="right" style="padding:11px 0;'.$b.'font-family:'.MAIL_SANS.';font-size:15px;line-height:20px;'.MAIL_WRAP.'font-weight:700;color:'.MAIL_C['ink'].';text-align:right;">'.mh($v).'</td></tr>';
 }
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.MAIL_C['card'].'" style="background-color:'.MAIL_C['card'].';border:1px solid '.MAIL_C['line'].';border-radius:16px;"><tr><td style="padding:18px 22px 6px 22px;">'
  .'<p style="margin:0 0 4px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['neon'].';">'.mh($s['title']).'</p>'
  .'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'.$rows.'</table></td></tr></table></td></tr>';
}
function mbSteps(array $s): string {
 $rows='';
 foreach($s['items'] as $i=>[$t,$d]){
  $rows.='<tr><td width="44" valign="top" style="padding:0 0 18px 0;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="30" height="30" align="center" valign="middle" bgcolor="'.MAIL_C['card2'].'" style="width:30px;height:30px;background-color:'.MAIL_C['card2'].';border:1px solid '.MAIL_C['line'].';border-radius:15px;font-family:'.MAIL_SANS.';font-size:13px;line-height:30px;font-weight:800;color:'.MAIL_C['neon'].';">'.($i+1).'</td></tr></table></td>'
   .'<td valign="top" style="padding:0 0 18px 0;font-family:'.MAIL_SANS.';'.MAIL_WRAP.'"><p style="margin:0 0 3px 0;font-size:16px;line-height:22px;font-weight:800;color:'.MAIL_C['ink'].';">'.mh($t).'</p><p style="margin:0;font-size:14px;line-height:22px;color:'.MAIL_C['muted'].';">'.mh($d).'</p></td></tr>';
 }
 return '<tr><td class="px" style="padding:4px 40px 8px 40px;"><p style="margin:0 0 16px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['dim'].';">'.mh($s['title']).'</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'.$rows.'</table></td></tr>';
}
/** Studio message (serif italic) or, with 'plain', contractual text (sans, lining figures) such as scope and licence. */
function mbNote(array $n): string {
 $plain=!empty($n['plain']);
 $txt=$plain?'font-family:'.MAIL_SANS.';font-size:16px;line-height:26px;font-variant-numeric:lining-nums;color:'.MAIL_C['body'].';':'font-family:'.MAIL_SERIF.';font-size:21px;line-height:29px;font-style:italic;color:'.MAIL_C['ink'].';';
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="3" bgcolor="'.MAIL_C['neon'].'" style="width:3px;background-color:'.MAIL_C['neon'].';border-radius:2px;">&nbsp;</td><td style="padding:2px 0 2px 20px;">'
  .'<p style="margin:0 0 8px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['neon'].';">'.mh($n['label']).'</p>'
  .'<p style="margin:0;'.$txt.MAIL_WRAP.'">'.nl2br(mh($n['text']),false).'</p></td></tr></table></td></tr>';
}
function mbCallout(array $c): string {
 $tone=($c['tone']??'info')==='warn'?MAIL_C['warn']:MAIL_C['neon'];
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.MAIL_C['card2'].'" style="background-color:'.MAIL_C['card2'].';border:1px solid '.$tone.';border-radius:16px;"><tr><td style="padding:18px 22px;font-family:'.MAIL_SANS.';'.MAIL_WRAP.'">'
  .'<p style="margin:0 0 6px 0;font-size:16px;line-height:22px;font-weight:800;color:'.$tone.';">'.mh($c['title']).'</p><p style="margin:0;font-size:15px;line-height:24px;color:'.MAIL_C['body'].';">'.mh($c['text']).'</p></td></tr></table></td></tr>';
}
function mbFiles(array $f): string {
 $rows='';
 foreach($f['items'] as [$name,$kind])$rows.='<tr><td valign="middle" style="padding:11px 0;border-bottom:1px solid '.MAIL_C['line'].';font-family:'.MAIL_SANS.';font-size:15px;line-height:20px;'.MAIL_WRAP.'font-weight:700;color:'.MAIL_C['ink'].';">'.mh($name).'</td><td align="right" valign="middle" width="90" style="padding:11px 0;border-bottom:1px solid '.MAIL_C['line'].';"><span style="font-family:'.MAIL_SANS.';font-size:10px;line-height:14px;font-weight:800;letter-spacing:1.6px;color:'.MAIL_C['btnInk'].';background-color:'.MAIL_C['neon'].';padding:4px 9px;border-radius:9px;">'.mh($kind).'</span></td></tr>';
 if(!empty($f['more']))$rows.='<tr><td colspan="2" style="padding:11px 0 4px 0;font-family:'.MAIL_SANS.';font-size:14px;line-height:20px;color:'.MAIL_C['muted'].';">'.mh($f['more']).'</td></tr>';
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.MAIL_C['card'].'" style="background-color:'.MAIL_C['card'].';border:1px solid '.MAIL_C['line'].';border-radius:16px;"><tr><td style="padding:18px 22px 8px 22px;">'
  .'<p style="margin:0 0 2px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['neon'].';">'.mh($f['title']).'</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'.$rows.'</table></td></tr></table></td></tr>';
}
/** Reassurance strip shown before payment-related emails. */
function mbTrust(array $items): string {
 $w=(int)floor(100/count($items));$cells='';
 foreach($items as $t)$cells.='<td width="'.$w.'%" align="center" valign="top" style="padding:0 6px;font-family:'.MAIL_SANS.';font-size:12px;line-height:18px;font-weight:700;color:'.MAIL_C['muted'].';"><span style="color:'.MAIL_C['neon'].';">&#10003;</span><br>'.mh($t).'</td>';
 return '<tr><td class="px" style="padding:0 34px 30px 34px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>'.$cells.'</tr></table></td></tr>';
}
/** Bulletproof pill button: VML round-rect for Outlook desktop, padded <a> everywhere else. */
function mbCta(array $c): string {
 $label=mh($c['label']);$url=mh($c['url']);$w=max(240,min(360,mb_strlen($c['label'])*11+88));
 $hint=!empty($c['hint'])?'<p style="margin:14px 0 0 0;font-family:'.MAIL_SANS.';font-size:13px;line-height:20px;color:'.MAIL_C['dim'].';text-align:center;">'.mh($c['hint']).'</p>':'';
 $second=!empty($c['link'])?'<p style="margin:16px 0 0 0;font-family:'.MAIL_SANS.';font-size:14px;line-height:20px;text-align:center;"><a href="'.mh($c['link'][1]).'" style="color:'.MAIL_C['neon'].';font-weight:700;text-decoration:underline;">'.mh($c['link'][0]).'</a></p>':'';
 return '<tr><td class="px" align="center" style="padding:6px 40px 34px 40px;"><table role="presentation" class="btn-wrap" cellspacing="0" cellpadding="0" border="0" align="center"><tr>'
  .'<!--[if mso]><td align="center"><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="'.$url.'" style="height:54px;v-text-anchor:middle;width:'.$w.'px;" arcsize="50%" stroke="f" fillcolor="'.MAIL_C['btn'].'"><w:anchorlock/><center style="color:'.MAIL_C['btnInk'].';font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">'.$label.'</center></v:roundrect></td><![endif]-->'
  .'<!--[if !mso]><!--><td align="center" bgcolor="'.MAIL_C['btn'].'" style="background-color:'.MAIL_C['btn'].';background-image:linear-gradient(120deg,#e0c8ff,#b98cff);border-radius:999px;"><a class="btn-a" href="'.$url.'" target="_blank" style="display:inline-block;padding:17px 38px;font-family:'.MAIL_SANS.';font-size:16px;line-height:20px;font-weight:800;color:'.MAIL_C['btnInk'].';text-decoration:none;border-radius:999px;">'.$label.' &rarr;</a></td><!--<![endif]-->'
  .'</tr></table>'.$hint.$second.'</td></tr>';
}
function mbDivider(): string { return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td height="1" bgcolor="'.MAIL_C['line'].'" style="height:1px;'.mailThin(1).'background-color:'.MAIL_C['line'].';">&nbsp;</td></tr></table></td></tr>'; }

// ---------------------------------------------------------------- shell
function mailLayoutHtml(array $m): string {
 $C=MAIL_C;$team=($m['layout']??'')==='team';
 $body='';
 foreach($m['blocks'] as $b){
  $body.=match(true){
   isset($b['p'])=>mbPara($b['p']),isset($b['lead'])=>mbPara($b['lead'],true),isset($b['tracker'])=>mbTracker($b['tracker']),isset($b['recap'])=>mbRecap($b['recap']),
   isset($b['summary'])=>mbSummary($b['summary']),isset($b['steps'])=>mbSteps($b['steps']),isset($b['note'])=>mbNote($b['note']),isset($b['callout'])=>mbCallout($b['callout']),
   isset($b['files'])=>mbFiles($b['files']),isset($b['trust'])=>mbTrust($b['trust']),isset($b['cta'])=>mbCta($b['cta']),isset($b['divider'])=>mbDivider(),default=>''
  };
 }
 $titlePlain=str_replace('*','',$m['title']);$parts=mailTitleParts($m['title']);$title='';
 foreach($parts as $i=>[$t,$em]){$h=mh($t);if($i===count($parts)-1)$h=mailOrphan($h);$title.=$em?'<em style="font-style:italic;font-weight:500;color:'.$C['neon'].';">'.$h.'</em>':$h;}
 // decorative: alt is empty on purpose (the h1 right below names the state) and the cell has no fixed height, so blocked images collapse
 $hero=!empty($m['hero'])?'<tr><td bgcolor="'.$C['panel'].'" style="padding:0;background-color:'.$C['panel'].';font-size:0;line-height:0;"><img src="'.mh(mailAsset($m['hero'])).'" width="600" height="240" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>':'';
 $legal=array_filter([env('LEGAL_NAME'),env('LEGAL_TAX_ID')!==''?'NIT '.env('LEGAL_TAX_ID'):'',env('LEGAL_ADDRESS')]);
 $support=mailSupport();$home=appUrl('/');$host=(string)(parse_url($home,PHP_URL_HOST)?:'fromheartbeat.com');
 $a=fn(string $label,string $href)=>'<a href="'.mh($href).'" style="display:inline-block;padding:11px 12px;color:'.$C['neon'].';text-decoration:underline;">'.mh($label).'</a>';
 $links=[];if(!$team){if(!empty($m['sessionUrl']))$links[]=$a('Mi sesión',$m['sessionUrl']);$links[]=$a('Preguntas frecuentes',appUrl('/?ver=info'));$links[]=$a('Términos',appUrl('/?ver=terminos'));$links[]=$a('Privacidad',appUrl('/?ver=privacidad'));}
 else{$links[]=$a('Abrir el panel',appUrl('/admin.html'));}
 $help=[];foreach(array_chunk($links,2) as $row)$help[]=implode('',$row).'<br>';
 $mailto=$support!==''?$a($support,'mailto:'.$support):'';
 $foot=$team?'Aviso interno del estudio. No lo reenvíes fuera del equipo.':'Recibes este correo porque hiciste un pedido en Fromheartbeat. Tu enlace privado es personal: no lo compartas con nadie.';
 $fontCss='';if(mailHasAsset('fonts/cormorant-garamond.woff2')&&mailHasAsset('fonts/manrope.woff2')){
  $fu=str_replace(['"',')','\\',"'"],'',mailAsset('fonts/'));
  $fontCss='<!--[if !mso]><!--><style>@font-face{font-family:"Cormorant Garamond";src:url('.$fu.'cormorant-garamond.woff2) format("woff2");font-weight:300 700;font-style:normal;font-display:swap}@font-face{font-family:Manrope;src:url('.$fu.'manrope.woff2) format("woff2");font-weight:200 800;font-style:normal;font-display:swap}</style><!--<![endif]-->';
 }
 return '<!DOCTYPE html><html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>'.mh($m['subject']).'</title>'
  .'<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>td,p,a,span,div{font-family:Arial,Helvetica,sans-serif!important}h1,em{font-family:Georgia,\'Times New Roman\',serif!important}</style><![endif]-->'
  .$fontCss
  .'<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0;mso-table-rspace:0}img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}body{margin:0!important;padding:0!important;width:100%!important;background-color:'.$C['bg'].'}td,p,h1,a{overflow-wrap:anywhere;word-break:break-word}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}u+#body a{color:inherit}'
  .'@media only screen and (max-width:620px){.wrap{width:100%!important}.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:34px!important;line-height:39px!important}.btn-wrap{width:100%!important}.btn-a{display:block!important;padding:18px 14px!important}.lbl{font-size:10px!important;letter-spacing:0!important}.lbl6{font-size:10px!important}.logo{width:190px!important;height:auto!important}.hd{padding:18px 16px 16px!important}.k{width:36%!important;letter-spacing:.5px!important}.tag{font-size:19px!important;line-height:25px!important}}'
  .'@media only screen and (max-width:340px){.eb{letter-spacing:1.4px!important}.lbl{font-size:9px!important}.h1{font-size:30px!important;line-height:35px!important}}'
  .'</style></head><body id="body" bgcolor="'.$C['bg'].'" style="margin:0;padding:0;background-color:'.$C['bg'].';">'
  .'<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">'.mh($m['preheader']).implode("\n",array_fill(0,4,str_repeat('&#8199;&#847;',10))).'</div>'
  .'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.$C['bg'].'" style="background-color:'.$C['bg'].';"><tr><td align="center" style="padding:0;">'
  .'<!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->'
  .'<table role="presentation" class="wrap" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="'.$C['panel'].'" style="width:100%;max-width:600px;background-color:'.$C['panel'].';">'
  // header: brand rail + logo
  .'<tr><td height="4" bgcolor="'.$C['violet'].'" style="height:4px;'.mailThin(4).'background-color:'.$C['violet'].';background-image:linear-gradient(90deg,#8b4dff,#b05cff 55%,#ff4fd8);">&nbsp;</td></tr>'
  .'<tr><td class="hd" align="center" bgcolor="'.$C['bg'].'" style="padding:26px 20px 24px 20px;background-color:'.$C['bg'].';"><a href="'.mh($home).'" target="_blank" style="text-decoration:none;"><img class="logo" src="'.mh(mailAsset('logo-email.png')).'" width="261" height="48" alt="fromheartbeat" style="display:block;border:0;width:261px;height:auto;font-family:'.MAIL_SERIF.';font-size:24px;line-height:48px;color:'.$C['ink'].';"></a></td></tr>'
  .$hero
  .'<tr><td class="px" style="padding:'.($hero?'40px':'34px').' 40px 10px 40px;"><p class="eb" style="margin:0 0 14px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;'.MAIL_WRAP.'color:'.$C['neon'].';">'.mh($m['eyebrow']).'</p>'
  .'<h1 class="h1" style="margin:0 0 20px 0;font-family:'.MAIL_SERIF.';font-size:40px;line-height:44px;font-weight:500;color:'.$C['ink'].';">'.$title.'</h1></td></tr>'
  .$body
  // footer
  .'<tr><td height="1" bgcolor="'.$C['line'].'" style="height:1px;'.mailThin(1).'background-color:'.$C['line'].';">&nbsp;</td></tr>'
  .'<tr><td class="px tag" bgcolor="'.$C['bg'].'" align="center" style="padding:32px 40px 6px 40px;background-color:'.$C['bg'].';font-family:'.MAIL_SERIF.';font-size:22px;line-height:28px;font-style:italic;color:'.$C['ink'].';">'.mailOrphan(mh('Historias reales, convertidas en canciones.')).'</td></tr>'
  .'<tr><td class="px" bgcolor="'.$C['bg'].'" align="center" style="padding:12px 30px 4px 30px;background-color:'.$C['bg'].';font-family:'.MAIL_SANS.';font-size:13px;line-height:20px;color:'.$C['muted'].';">'.implode('',$help).$mailto.'</td></tr>'
  .'<tr><td class="px" bgcolor="'.$C['bg'].'" align="center" style="padding:14px 40px 34px 40px;background-color:'.$C['bg'].';font-family:'.MAIL_SANS.';font-size:12px;line-height:19px;color:'.$C['dim'].';">'.mh($foot).(!empty($m['reference'])?'<br>Referencia '.mh($m['reference']):'').($legal?'<br>'.mh(implode(' · ',$legal)):'').($team?'':'<br>'.mh($host)).'</td></tr>'
  .'</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>';
}

// ---------------------------------------------------------------- plain text
function mailLayoutText(array $m): string {
 $U=fn(string $s)=>mb_strtoupper($s,'UTF-8');
 $out=['FROMHEARTBEAT',str_repeat('-',40),$U($m['eyebrow']),'',str_replace('*','',$m['title']),''];
 foreach($m['blocks'] as $b){
  if(isset($b['p'])||isset($b['lead']))$out[]=($b['p']??$b['lead']).PHP_EOL;
  elseif(isset($b['tracker'])){$t=$b['tracker'];$p=[];foreach($t['steps'] as $i=>$l)$p[]=(($i<$t['active']||(!empty($t['complete'])&&$i===$t['active']))?'[x] ':($i===$t['active']?'[>] ':'[ ] ')).$l;$out[]=($t['caption']??'').PHP_EOL.implode('  ',$p).PHP_EOL;}
  elseif(isset($b['recap'])){$out[]=$U($b['recap']['label']).': '.$b['recap']['text'];$out[]='';}
  elseif(isset($b['summary'])){$out[]=$U($b['summary']['title']);foreach($b['summary']['rows'] as [$k,$v])$out[]=$k.': '.$v;$out[]='';}
  elseif(isset($b['steps'])){$out[]=$U($b['steps']['title']);foreach($b['steps']['items'] as $i=>[$t,$d])$out[]=($i+1).'. '.$t.' — '.$d;$out[]='';}
  elseif(isset($b['note'])){$out[]=$U($b['note']['label']);$out[]=!empty($b['note']['plain'])?$b['note']['text']:'"'.$b['note']['text'].'"';$out[]='';}
  elseif(isset($b['callout'])){$out[]=$U($b['callout']['title']);$out[]=$b['callout']['text'];$out[]='';}
  elseif(isset($b['files'])){$out[]=$U($b['files']['title']);foreach($b['files']['items'] as [$n,$k])$out[]='- '.$n.' ('.$k.')';if(!empty($b['files']['more']))$out[]=$b['files']['more'];$out[]='';}
  elseif(isset($b['trust'])){$out[]=implode(' · ',$b['trust']);$out[]='';}
  elseif(isset($b['cta'])){$out[]=$U($b['cta']['label']).':';$out[]=$b['cta']['url'];if(!empty($b['cta']['hint']))$out[]=$b['cta']['hint'];if(!empty($b['cta']['link']))$out[]=$b['cta']['link'][0].': '.$b['cta']['link'][1];$out[]='';}
 }
 $out[]=str_repeat('-',40);$out[]='Fromheartbeat · Historias reales, convertidas en canciones.';$out[]=appUrl('/');
 if(($m['layout']??'')!=='team'){$out[]='Preguntas frecuentes: '.appUrl('/?ver=info');$out[]='Términos: '.appUrl('/?ver=terminos');$out[]='Privacidad: '.appUrl('/?ver=privacidad');}
 $s=mailSupport();if($s!=='')$out[]='Escríbenos: '.$s;
 if(!empty($m['reference']))$out[]='Referencia '.$m['reference'];
 $out[]=($m['layout']??'')==='team'?'Aviso interno del estudio.':'Tu enlace privado es personal: no lo compartas con nadie.';
 return implode(PHP_EOL,$out).PHP_EOL;
}

// ---------------------------------------------------------------- content: customer journey
function mailBriefRows(array $o): array {
 $b=is_array($o['brief']??null)?$o['brief']:(json_decode((string)($o['brief']??''),true)?:[]);$rows=[];if(!is_array($b))return [];
 $take=fn($k)=>isset($b[$k])&&is_scalar($b[$k])&&trim((string)$b[$k])!==''?mailNoLink(mailClip((string)$b[$k],70)):null;
 if(($o['audience']??'')==='business'){foreach(['brand'=>'Marca','campaign'=>'Campaña','channels'=>'Canales','license_scope'=>'Licencia'] as $k=>$l)if(($v=$take($k))!==null)$rows[]=[$l,$v];return $rows;}
 foreach(['recipient'=>'Para','occasion'=>'Ocasión','genre'=>'Género','mood'=>'Emoción','voice'=>'Voz','language'=>'Idioma'] as $k=>$l)if(($v=$take($k))!==null)$rows[]=[$l,$v];
 return $rows;
}
function mailRecapLine(array $o): string {
 $b=is_array($o['brief']??null)?$o['brief']:(json_decode((string)($o['brief']??''),true)?:[]);if(!is_array($b))return '';
 $k=($o['audience']??'')==='business'?['brand','campaign']:['recipient','genre','mood'];$p=[];
 foreach($k as $f)if(isset($b[$f])&&is_scalar($b[$f])&&trim((string)$b[$f])!=='')$p[]=mailNoLink(mailClip((string)$b[$f],40));
 return implode(' · ',$p);
}
/** Builds the customer-facing model for one journey step. $kind: received|received_business|quote|payment_failed|paid|production|review|completed|cancelled|update|recover */
function mailModel(string $kind,array $o,array $c,array $ctx=[]): array {
 $ref=$o['reference'];$first=mailFirstName($c);$hi=$first!==''?$first.', ':'';$url=mailSessionUrl($o);$j=mailJourney($o);$biz=$o['audience']==='business';$pk=mailProductKind($o);
 $lead=function(string $t)use($hi):string{$t=mb_strtolower(mb_substr($t,0,1)).mb_substr($t,1);return $hi!==''?$hi.$t:mb_strtoupper(mb_substr($t,0,1)).mb_substr($t,1);};
 $support=mailSupport();$stage=(int)($o['production_stage']??0);$note=trim(mailClean((string)($ctx['note']??'')));
 $prod=$biz?3:2;$rev=$biz?4:3;$last=count($j)-1;$rounds=mailRounds($o);$listening=!empty($o['product']['listening']);
 $pay=env('COMMERCE_READY')==='true';
 $m=['kind'=>$kind,'reference'=>$ref,'sessionUrl'=>$url,'blocks'=>[],'eyebrow'=>'Tu sesión · '.$ref];
 $summary=fn(string $title,array $rows)=>['summary'=>['title'=>$title,'rows'=>$rows]];
 $tracker=function(int $i,bool $done=false,?array $sub=null,string $extra='')use($j){$cap='Paso '.($i+1).' de '.count($j).' · '.$j[$i];return ['tracker'=>['steps'=>$j,'active'=>$i,'complete'=>$done,'caption'=>$cap.($extra!==''?"\n".ltrim($extra,' ·'):''),'sub'=>$sub]];};
 $trust=['trust'=>['Pago seguro con Wompi','Sin cuenta ni contraseña','Enlace privado y personal']];
 switch($kind){
  case 'received':
   $craft=$pk==='ai'?'Letra y música con nuestro flujo de creación digital con IA.':'Letra, voces, producción y mezcla, con dirección humana en cada paso.';
   if(($o['product_code']??'')==='full')$craft.=' Para tu video emocional, sube tus fotos y clips desde tu sesión.';
   $step1=$pay?['Completa el pago seguro','Con Wompi: tarjeta, PSE, Nequi y más. Tu historia queda guardada mientras tanto.']:['Te avisamos cuando abramos los pagos','Tu historia queda guardada. Te escribiremos apenas puedas completar el pago.'];
   $m+=['subject'=>'Tu historia ya está en el estudio · '.$ref,'preheader'=>$pay?'Guardamos tu sesión. Completa el pago para empezar a producir tu canción.':'Guardamos tu sesión. Te avisaremos cuando puedas completar el pago.','title'=>'Tu historia ya *está en el estudio.*'];
   $m['blocks']=array_values(array_filter([['lead'=>$lead('recibimos tu historia y la guardamos en una sesión privada. Solo se abre con tu enlace personal.')],$tracker($pay?1:0),
    ['cta'=>$pay?['label'=>'Ir al pago seguro','url'=>$url,'hint'=>'Si ya pagaste, ignora este aviso: te confirmaremos en otro correo.']:['label'=>'Ver mi sesión','url'=>$url]],
    $summary('Lo que nos contaste',array_merge(mailBriefRows($o),[['Experiencia',$o['product_name']],['Total',mailMoney((int)$o['amount_in_cents'])]])),
    ['steps'=>['title'=>'Qué sigue','items'=>[$step1,['Empezamos a producir',$craft],['Sigue cada etapa','Ves el avance en tu sesión y recibes tu canción ahí, sin crear una cuenta.']]]],
    $pay?$trust:null]));
   break;
  case 'received_business':
   $m+=['subject'=>'Recibimos el brief de tu marca · '.$ref,'preheader'=>'Revisamos tu brief y te enviamos una propuesta con alcance, licencia y precio.','title'=>'Recibimos *el brief de tu marca.*','hero'=>'hero-received.jpg'];
   $m['blocks']=[['lead'=>$lead('gracias por confiarnos la voz de tu marca. Antes de cualquier pago, revisaremos tu brief y acordaremos contigo el alcance y la licencia.')],$tracker(0),
    $summary('Tu brief',array_merge(mailBriefRows($o),[['Experiencia',$o['product_name']]])),
    ['steps'=>['title'=>'Qué sigue','items'=>[['Revisamos tu brief','Nuestro equipo lo lee completo y puede escribirte con preguntas.'],['Recibes una propuesta','Con alcance, licencia comercial y precio final, en tu sesión privada.'],['Pagas y comenzamos','Solo cuando estés de acuerdo con la propuesta.']]]],
    ['trust'=>['Sin pago hasta aceptar la propuesta','Sin cuenta ni contraseña','Enlace privado y personal']],['cta'=>['label'=>'Abrir mi sesión','url'=>$url,'hint'=>'Te avisaremos por correo apenas tu propuesta esté lista.']]];
   break;
  case 'quote':
   $b=json_decode((string)($o['brief']??''),true);$scope=is_array($b)&&isset($b['agreed_scope'])&&is_scalar($b['agreed_scope'])?mailClean((string)$b['agreed_scope']):'Consulta el detalle completo en tu sesión privada.';
   $m+=['subject'=>'Tu propuesta musical está lista · '.$ref,'preheader'=>'Revisa el alcance, la licencia y el precio antes de pagar.','title'=>'Tu propuesta *está lista.*'];
   $m['blocks']=array_values(array_filter([['lead'=>$lead('preparamos una propuesta a la medida de tu marca. Léela con calma: el pago solo se habilita cuando tú decides avanzar.')],$tracker(1),
    $summary('Propuesta',[['Experiencia',$o['product_name']],['Total',mailMoney((int)$o['amount_in_cents'])]]),
    ['note'=>['label'=>'Alcance y licencia acordados','text'=>$scope,'plain'=>true]],
    $pay?$trust:null,['cta'=>['label'=>$pay?'Revisar y pagar':'Ver mi propuesta','url'=>$url,'link'=>['¿Quieres ajustar algo? Escríbenos','mailto:'.$support.'?subject='.rawurlencode('Sobre mi propuesta · '.$ref)],'hint'=>$pay?null:'Te avisaremos cuando puedas completar el pago.']]]));
   break;
  case 'payment_failed':
   $err=($ctx['payment']??'DECLINED')==='ERROR';
   $m+=['subject'=>'Tu pago no se completó · '.$ref,'preheader'=>$biz?'Tu propuesta sigue guardada. Puedes intentarlo de nuevo cuando quieras.':'Tu historia sigue guardada. Puedes intentarlo de nuevo cuando quieras.','title'=>'Tu pago *no se completó.*'];
   $m['blocks']=[['lead'=>$lead($biz?'tu propuesta sigue guardada y a salvo. Solo falta completar el pago para empezar a producir tu pieza.':'tu historia sigue guardada y a salvo. Solo falta completar el pago para empezar a producirla.')],
    ['callout'=>['tone'=>'warn','title'=>$err?'No pudimos procesar la transacción':'Tu medio de pago no aprobó la transacción','text'=>$err?'Si notas algún cargo en tu cuenta, escríbenos con tu referencia y lo revisamos de inmediato.':'No se realizó ningún cobro. Suele pasar por datos incorrectos, cupo insuficiente o una validación de seguridad.']],
    ['cta'=>['label'=>'Intentar el pago de nuevo','url'=>$url,'link'=>['Escribir al estudio','mailto:'.$support.'?subject='.rawurlencode('Ayuda con mi pago · '.$ref)]]],
    $tracker($biz?2:1),
    ['steps'=>['title'=>'Cómo resolverlo','items'=>[['Revisa los datos del medio de pago','Número, fecha, código de seguridad y cupo disponible.'],['Prueba con otro medio','Tarjeta, PSE o Nequi: todos están disponibles en el pago seguro.'],['¿Sigue sin pasar?','Escríbenos con tu referencia y te acompañamos.']]]],
    $trust];
   break;
  case 'paid':
   $full=($o['product_code']??'')==='full';
   $items=match($pk){
    'ai'=>[['Escribimos tu letra','Con lo que nos contaste, a tu medida.'],['Creamos tu canción','Con nuestro flujo de creación digital con IA.'],['Te la entregamos en tu sesión','Tu MP3 y tu portada llegan ahí, y te avisamos por correo.']],
    'business'=>[['Concepto y letra','A partir del brief de tu marca y la propuesta acordada.'],['Producción','Voces, arreglos, mezcla y master.'],['Revisión y entrega','Escuchas, nos cuentas y te entregamos los archivos con su licencia.']],
    default=>array_merge($full?[['Sube tus fotos y clips','Desde tu sesión, para que armemos el video emocional de tu Full Experience.']]:[],[['Escribimos tu letra','Con lo que nos contaste, a tu medida.'],['Producimos tu canción','Voces, arreglos, mezcla y master, con dirección humana.'],['Te avisamos en cada etapa','Y cuando esté lista para escuchar, te escribimos aquí.']])
   };
   $rows=[['Referencia',$ref],['Experiencia',$o['product_name']],['Total pagado',mailMoney((int)$o['amount_in_cents'])],['Fecha',mailDate($ctx['at']??null)]];if(!empty($ctx['transaction']))$rows[]=['Transacción',mailClip((string)$ctx['transaction'],40)];
   $m+=['subject'=>'Pago confirmado: empezamos con '.($biz?'tu pieza':'tu canción').' · '.$ref,'preheader'=>$biz?'Confirmamos tu pago. Comenzamos a trabajar con el brief de tu marca.':'Confirmamos tu pago. Comenzamos a trabajar con tu historia.','title'=>'Pago *confirmado.*'];
   $m['blocks']=[['lead'=>$lead($biz?'gracias. Recibimos tu pago y el brief de tu marca ya está en manos del estudio.':'gracias. Recibimos tu pago y tu historia ya está en manos del estudio.')],$tracker($prod),$summary('Resumen del pago',$rows),
    ['steps'=>['title'=>'Lo que viene ahora','items'=>$items]],
    ['cta'=>['label'=>$full?'Subir mis fotos y clips':'Seguir mi sesión','url'=>$url,'hint'=>$biz?'Los plazos se coordinan con el equipo según el alcance acordado y la agenda de producción.':'Los plazos se coordinan con el equipo según tu historia y la agenda de producción.']]];
   break;
  case 'production':
   [$title,$pre,$text]=mailStageCopy($stage,$pk);$staged=$stage>=1&&$stage<=5;$names=mailStageNames($pk)+[5=>'Entrega'];
   $m+=['subject'=>($staged?rtrim(strip_tags(str_replace('*','',$title)),'. '):'Novedades de tu canción').' · '.$ref,'preheader'=>$pre,'title'=>$title,'hero'=>'hero-production.jpg'];
   if($staged&&($pk!=='ai'||$stage===1)&&mailHasAsset('hero-production-'.$stage.'.jpg'))$m['hero']='hero-production-'.$stage.'.jpg';
   $recap=mailRecapLine($o);$next=$staged?mailStageNext($stage,$pk):null;
   $isFull=($o['product_code']??'')==='full';$needsMaterial=$isFull&&isset($ctx['sources'])&&(int)$ctx['sources']===0;$gotMaterial=$isFull&&isset($ctx['sources'])&&(int)$ctx['sources']>0;
   $m['blocks']=array_values(array_filter([['lead'=>$lead($text)],$tracker($prod,false,$staged&&$stage<=4?['at'=>$stage-1,'count'=>4]:null,$staged?' · '.$names[$stage].($stage<=4?' ('.$stage.' de 4)':''):''),
    $recap!==''?['recap'=>['label'=>$biz?'Tu marca':'Tu canción para','text'=>$recap]]:null,
    $gotMaterial&&!$needsMaterial?['p'=>'Ya recibimos tu material para el video ('.(int)$ctx['sources'].' '.((int)$ctx['sources']===1?'archivo':'archivos').'). ¡Gracias!']:null,
    $needsMaterial?['callout'=>['tone'=>'warn','title'=>'Aún falta tu material para el video','text'=>'Sube tus fotos y clips desde tu sesión para que podamos armar tu video emocional.']]:null,
    $note!==''?['note'=>['label'=>'Mensaje del estudio','text'=>$note]]:null,
    $next?['callout'=>['tone'=>'info','title'=>$next[0],'text'=>$next[1]]]:null,
    ['cta'=>['label'=>$needsMaterial?'Subir mis fotos y clips':'Ver mi sesión','url'=>$url,'hint'=>$staged&&!$next?'Te escribiremos de nuevo en la siguiente etapa.':null]]]));
   break;
  case 'review':
   $rt=mailRoundsText($o);
   $adj=$rt!==''?'Tu paquete incluye '.$rt.': reúne todos tus comentarios y envíalos juntos.':'Escríbenos y lo revisamos contigo.';
   if($pk==='ai'){
    $m+=['subject'=>'Tu canción ya se puede escuchar · '.$ref,'preheader'=>'Tu canción está en tu sesión, lista para escucharla con calma.','title'=>'Tu canción *ya se puede escuchar.*'];
    $intro=$lead('subimos tu canción a tu sesión privada. Escúchala con calma, mejor con audífonos.');
    $items=[['Abre tu sesión y dale play','Escúchala completa, sin prisa.'],['Si algo no te cuadra',$adj]];$cta='Escuchar mi canción';$rhint='No necesitas responder si todo suena bien.';
   }else{
    $m+=['subject'=>'Es tu turno de escuchar · '.$ref,'preheader'=>$biz?'Tu pieza está lista para que la revises.':'Tu canción está lista para que la escuches y nos cuentes qué sientes.','title'=>'Es tu turno *de escuchar.*'];
    $intro=$lead($biz?'subimos una versión de tu pieza a tu sesión privada. Escúchala con calma y cuéntanos qué ajustarías.':'subimos una versión de tu canción a tu sesión privada. Escúchala con calma, mejor con audífonos, y cuéntanos qué sientes.');
    $items=[['Abre tu sesión y dale play','Si hay varias versiones, las encuentras todas ordenadas (v1, v2…).'],['Déjanos tus comentarios','Qué te encantó y qué cambiarías. Llegan directo al estudio.'],['Nosotros hacemos el resto',$adj]];$cta='Escuchar y comentar';$rhint='Tus comentarios se envían desde tu sesión, no hace falta responder este correo.';
   }
   $m['blocks']=array_values(array_filter([['lead'=>$intro],$tracker($rev),$note!==''?['note'=>['label'=>'Mensaje del estudio','text'=>$note]]:null,['steps'=>['title'=>'Cómo revisarla','items'=>$items]],
    ['cta'=>['label'=>$cta,'url'=>$url,'hint'=>$rhint]]]));
   break;
  case 'completed':
   $files=[];foreach($ctx['files']??[] as $f)$files[]=[mailClean((string)$f['original_name']),mailKindLabel((string)$f['mime'])];
   $more=count($files)>8?'y '.(count($files)-8).' archivo'.(count($files)-8===1?'':'s').' más en tu sesión':'';$files=array_slice($files,0,8);
   $b=json_decode((string)($o['brief']??''),true);$scope=$biz&&is_array($b)&&isset($b['agreed_scope'])&&is_scalar($b['agreed_scope'])?mailClip((string)$b['agreed_scope'],400):'';
   $where=($listening?'Tu Listening Room privado ya tiene '.($biz?'tu pieza':'tu canción').': está dentro de tu sesión.':'Tu entrega ya está en tu sesión.').' Escúchala y descarga tus archivos; guárdalos en un lugar seguro, porque tu enlace privado puede vencer.';
   $m+=['subject'=>($biz?'Tu pieza está lista · ':'Tu canción está lista · ').$ref,'preheader'=>'Ya puedes escucharla y descargarla desde tu sesión.','title'=>$biz?'Tu pieza *está lista.*':'Tu canción *está lista.*'];
   $isFull=($o['product_code']??'')==='full';$cLabel=$biz?'Escuchar y descargar mi pieza':($isFull?'Ver y descargar mi Full Experience':'Escuchar y descargar mi canción');
   $m['blocks']=array_values(array_filter([['lead'=>$lead($biz?'tu pieza ya está terminada. Aquí tienes tus archivos y la licencia acordada.':($pk==='ai'?'tu canción ya está terminada: tu MP3 y tu portada están listos para compartir.':($isFull?'tu canción y tu video ya están terminados. Gracias por confiarnos una historia tan tuya: ahora es de ustedes.':'tu canción ya está terminada. Gracias por confiarnos una historia tan tuya: ahora es de ustedes.')))],$tracker($last,true),
    ['cta'=>['label'=>$cLabel,'url'=>$url,'link'=>[$pk==='ai'?'¿Dudas con tu entrega? Escríbenos':'¿Algo que ajustar? Escríbenos','mailto:'.$support.'?subject='.rawurlencode('Sobre mi entrega · '.$ref)]]],
    $files?['files'=>['title'=>'Tu entrega','items'=>$files,'more'=>$more]]:null,
    $scope!==''?['note'=>['label'=>'Licencia acordada','text'=>$scope,'plain'=>true]]:null,
    $note!==''?['note'=>['label'=>'Mensaje del estudio','text'=>$note]]:null,['p'=>$where]]));
   break;
  case 'cancelled':
   $m+=['subject'=>'Tu sesión fue cancelada · '.$ref,'preheader'=>'Cancelamos tu sesión. Si fue un error, la retomamos contigo.','title'=>'Tu sesión *fue cancelada.*'];unset($m['sessionUrl']);
   $m['blocks']=array_values(array_filter([['lead'=>$lead('tu sesión quedó cancelada. Si tú lo pediste, no tienes que hacer nada más.')],$note!==''?['note'=>['label'=>'Motivo','text'=>$note,'plain'=>true]]:null,
    ['steps'=>['title'=>'Si esto no era lo que esperabas','items'=>[['Escríbenos con tu referencia','Lo revisamos y, si fue un error, retomamos tu sesión.'],['Si ya habías pagado','Cuéntanos y revisamos el estado del cobro contigo.'],['Cuando quieras volver','Tu historia puede empezar de nuevo desde nuestra página, cuando tú quieras.']]]],
    ['cta'=>['label'=>'Escribir al estudio','url'=>'mailto:'.$support.'?subject='.rawurlencode('Sobre mi sesión cancelada · '.$ref)]]]));
   break;
  case 'recover':
   $m+=['subject'=>'Vuelve a tu sesión · '.$ref,'preheader'=>'Aquí tienes tu acceso privado al estudio.','title'=>'Tu acceso *privado.*'];
   $m['blocks']=[['lead'=>$lead('pediste volver a tu sesión. Con este botón entras directo, sin contraseña ni cuenta.')],
    $summary('Tu sesión',[['Referencia',$ref],['Experiencia',$o['product_name']],['Estado',mailStatusLabel((string)$o['status'])]]),
    ['cta'=>['label'=>'Abrir mi sesión','url'=>$url,'hint'=>'Si no fuiste tú, ignora este correo. Nadie puede entrar sin este enlace, así que no lo compartas.']]];
   break;
  default: // update
   $bq=json_decode((string)($o['brief']??''),true);$scoped=is_array($bq)&&!empty($bq['agreed_scope']);$canReply=in_array($o['status'],['in_production','review','completed'],true);
   $pos=match($o['status']){'created'=>$scoped?1:0,'payment_pending'=>$biz?2:1,'paid','in_production'=>$prod,'review'=>$rev,'completed'=>$last,default=>$prod};
   $q=str_contains($note,'?');
   $m+=['subject'=>($q?'El estudio tiene una pregunta · ':'Novedades de tu canción · ').$ref,'preheader'=>(mb_strlen($pn=$note!==''?mailClip($note,110):'')<40?trim($pn.' Hay novedades en tu sesión de Fromheartbeat.'):$pn),'title'=>$q?'El estudio *tiene una pregunta.*':'Novedades *de tu sesión.*','hero'=>'hero-update.jpg'];
   $m['blocks']=array_values(array_filter([['lead'=>$lead($q?'el estudio te dejó una pregunta. Respóndela y llega directo al equipo.':'el estudio dejó una novedad en tu sesión.')],$o['status']==='cancelled'?null:$tracker($pos,$o['status']==='completed'),$note!==''?['note'=>['label'=>'Mensaje del estudio','text'=>$note]]:null,
    ['cta'=>['label'=>$q&&$canReply?'Responder en mi sesión':'Abrir mi sesión','url'=>$url,'hint'=>$q?($canReply?'Tu respuesta se envía desde tu sesión.':'También puedes responder a este correo.'):null]]]));
 }
 $m['hero']??='hero-'.$kind.'.jpg';
 if(!mailHasAsset($m['hero']))$m['hero']='';
 return $m;
}

// ---------------------------------------------------------------- content: internal team notice
function mailTeamModel(string $headline,string $message,array $o,array $c): array {
 $ref=$o['reference'];$labels=['created'=>'Creado','payment_pending'=>'Pago pendiente','paid'=>'Pagado','in_production'=>'En producción','review'=>'En revisión','completed'=>'Completado','cancelled'=>'Cancelado'];
 $stages=['Historia recibida','Letra','Grabación','Producción','Mezcla y master','Entrega'];
 $rows=[['Cliente',mailClip((string)($c['name']??''),80)],['Correo',mailClip((string)($c['email']??''),80)],['Teléfono',mailClip((string)($c['phone']??''),40)],['Experiencia',$o['product_name']],['Importe',mailMoney((int)$o['amount_in_cents'])],['Estado',$labels[$o['status']]??$o['status']],['Etapa',$stages[(int)$o['production_stage']]??'—']];
 $brief=mailBriefRows($o);$message=mailClean($message);
 return ['kind'=>'team','layout'=>'team','subject'=>$headline.' · '.$ref,'preheader'=>mb_strlen($pm=mailClip($message,120))<30?trim($pm.' — aviso interno del estudio'):$pm,'eyebrow'=>'Equipo · '.$ref,'title'=>$headline,'hero'=>'','reference'=>$ref,
  'blocks'=>array_values(array_filter([['lead'=>$message],['summary'=>['title'=>'Pedido','rows'=>$rows]],$brief?['summary'=>['title'=>'Brief','rows'=>$brief]]:null,['cta'=>['label'=>'Abrir en el panel','url'=>appUrl('/admin.html')]]]))];
}

/** Lines are broken after cells/rows to keep them short (harmless in table layouts). Customer text can still make a long line; mailFill() forces quoted-printable, so the MIME never exceeds 76 chars per line. */
function mailBuild(array $m): string {
 $html=preg_replace_callback('~<style>.*?</style>~s',fn($x)=>str_replace(['}','{'],["}\n",'{'],$x[0]),mailLayoutHtml($m));
 $html=str_replace(['</tr>','</td>','</table>','</p>','</h1>','</div>','</style>','-->','</title>','</head>'],["</tr>\n","</td>\n","</table>\n","</p>\n","</h1>\n","</div>\n","</style>\n","-->\n","</title>\n","</head>\n"],$html);
 return MAIL_HTML_MARK.$html.MAIL_TEXT_MARK.mailLayoutText($m);
}

/**
 * Queues the customer email for a journey step (and, unless $teamHeadline is null, the internal notice).
 * Both bodies are rendered BEFORE anything is queued, so a rendering failure can never leave a half-sent pair.
 * Rendering errors fall back to the legacy plain-text notice; database errors are re-thrown so the caller's
 * transaction handling stays exactly as it was.
 */
function notifyJourney(array $o,string $kind,array $ctx,string $key,?string $teamHeadline=null,string $teamMessage=''): void {
 try {
  $o=sql('SELECT * FROM orders WHERE id=?',[$o['id']])->fetch()?:$o;$o['product']=catalog()[$o['product_code']]??[];$c=customerFor($o);
  if($kind==='completed'&&!isset($ctx['files']))$ctx['files']=sql("SELECT original_name,mime FROM deliverables WHERE order_id=? AND kind='delivery' ORDER BY id",[$o['id']])->fetchAll();
  if(($o['product_code']??'')==='full'&&in_array($kind,['production','review'],true))$ctx['sources']=(int)sql("SELECT COUNT(*) FROM deliverables WHERE order_id=? AND kind='source'",[$o['id']])->fetchColumn();
  $m=mailModel($kind,$o,$c,$ctx);$custBody=mailBuild($m);$teamBody=null;$t=null;
  if($teamHeadline!==null){$t=mailTeamModel($teamHeadline,$teamMessage!==''?$teamMessage:$m['preheader'],$o,$c);$teamBody=mailBuild($t);}
 }catch(PDOException $e){
  throw $e;
 }catch(Throwable $e){
  error_log('FHB mail '.get_class($e).' '.$e->getMessage());
  notifyOrder($o,'Novedades de tu sesión · '.$o['reference'],trim((string)($ctx['note']??''))?:'Hay novedades en tu sesión.',$key.':fallback');
  return;
 }
 enqueue($key.':customer',$c['email'],$m['subject'],$custBody);
 if($teamBody!==null)enqueue($key.':team',env('TEAM_EMAIL'),$t['subject'],$teamBody);
}

/** Aviso sólo para el equipo (por ejemplo, el cliente subió archivos). Un fallo de render nunca rompe la acción que lo originó. */
function notifyTeam(array $o,string $headline,string $message,string $key): void {
 try{
  $o=sql('SELECT * FROM orders WHERE id=?',[$o['id']])->fetch()?:$o;$o['product']=catalog()[$o['product_code']]??[];
  $t=mailTeamModel($headline,$message,$o,customerFor($o));$body=mailBuild($t);
 }catch(PDOException $e){throw $e;}
 catch(Throwable $e){error_log('FHB mail '.get_class($e).' '.$e->getMessage());return;}
 enqueue($key.':team',env('TEAM_EMAIL'),$t['subject'],$body);
}
