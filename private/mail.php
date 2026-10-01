<?php
declare(strict_types=1);
// Transactional email engine.
// Every message is ONE structured model ($m) rendered twice: branded table-based HTML (600px, inline CSS,
// Outlook VML button, solid-colour fallbacks) and a plain-text alternative, so the two never drift apart.
// Stored in mail_queue.body as: MAIL_HTML_MARK . html . MAIL_TEXT_MARK . text  (see mailParts()).
const MAIL_HTML_MARK='<!--fhb:html-->';
const MAIL_TEXT_MARK="\n<!--fhb:text-->\n";
const MAIL_C=['bg'=>'#07040f','panel'=>'#0f0920','card'=>'#170e2e','card2'=>'#1e1239','line'=>'#2e2058','ink'=>'#f4eeff','body'=>'#d6cceb','muted'=>'#b5a8d2','dim'=>'#9a8ebd','neon'=>'#c6a2ff','violet'=>'#9b5cff','pink'=>'#ff4fd8','btn'=>'#c6a2ff','btnInk'=>'#1a0b3a','warn'=>'#ffb3ec'];
const MAIL_WRAP='word-break:break-word;overflow-wrap:anywhere;';
const MAIL_SERIF="'Cormorant Garamond',Georgia,'Times New Roman',serif";
const MAIL_SANS="Manrope,'Helvetica Neue',Helvetica,Arial,sans-serif";

function mh(string $s): string { return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
/** Splits a stored queue body into ['html'=>?string,'text'=>string]. Legacy plain-text rows have html=null. */
function mailParts(string $body): array {
 if(!str_starts_with($body,MAIL_HTML_MARK))return ['html'=>null,'text'=>$body];
 [$html,$text]=array_pad(explode(MAIL_TEXT_MARK,substr($body,strlen(MAIL_HTML_MARK)),2),2,'');
 return ['html'=>$html,'text'=>$text];
}
function mailMoney(int $cents): string { return '$'.number_format($cents/100,0,',','.').' COP'; }
function mailDate(?string $utc=null): string {
 static $months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 $d=new DateTimeImmutable($utc??'now',new DateTimeZone('UTC'));$d=$d->setTimezone(new DateTimeZone('America/Bogota'));
 return $d->format('j').' de '.$months[(int)$d->format('n')-1].' de '.$d->format('Y');
}
function mailClip(string $s,int $n): string { $s=trim(preg_replace('/\s+/u',' ',$s)); return mb_strlen($s)>$n?rtrim(mb_substr($s,0,$n-1)).'…':$s; }
function mailAsset(string $file): string { return appUrl('/assets/email/'.$file); }
function mailHasAsset(string $file): bool { return is_file(dirname(BASE).'/assets/email/'.$file); }
function mailSupport(): string { $e=env('SUPPORT_EMAIL'); return filter_var($e,FILTER_VALIDATE_EMAIL)?$e:env('MAIL_FROM'); }
function mailSessionUrl(array $o): string { return appUrl('/?session='.$o['reference'].'#token='.privateLink($o)); }
function mailFirstName(array $c): string { $n=trim(explode(' ',trim($c['name']))[0]??''); return $n===''?'':mb_strtoupper(mb_substr($n,0,1)).mb_substr($n,1); }
/** "Tu historia *ya está aquí.*" -> [[text,false],[text,true]] ; the starred part becomes the italic accent. */
function mailTitleParts(string $t): array { $out=[];foreach(explode('*',$t) as $i=>$p)if($p!=='')$out[]=[$p,$i%2===1];return $out; }

// ---------------------------------------------------------------- journeys
function mailJourney(array $o): array {
 return $o['audience']==='business'?['Brief','Propuesta','Pago','Producción','Entrega']:['Historia','Pago','Producción','Revisión','Entrega'];
}
function mailStatusLabel(string $s): string { return ['created'=>'Sesión guardada','payment_pending'=>'Confirmando el pago','paid'=>'Pago confirmado','in_production'=>'En producción','review'=>'En revisión','completed'=>'Tu canción está lista','cancelled'=>'Sesión cancelada'][$s]??'En curso'; }
function mailRoomName(array $o): string { return !empty($o['product']['listening'])?'Listening Room':'entrega'; }

// ---------------------------------------------------------------- HTML blocks
function mbPara(string $text,bool $lead=false): string {
 $size=$lead?'18px':'16px';$lh=$lead?'30px':'26px';
 return '<tr><td class="px" style="padding:0 40px 18px 40px;font-family:'.MAIL_SANS.';font-size:'.$size.';line-height:'.$lh.';color:'.($lead?MAIL_C['ink']:MAIL_C['body']).';">'.nl2br(mh($text),false).'</td></tr>';
}
function mbSpacer(int $h): string { return '<tr><td height="'.$h.'" style="height:'.$h.'px;line-height:'.$h.'px;font-size:0;">&nbsp;</td></tr>'; }
function mbTracker(array $t): string {
 $steps=$t['steps'];$active=$t['active'];$complete=!empty($t['complete']);$n=count($steps);$w=(int)floor(100/$n);
 $bars='';$labels='';
 foreach($steps as $i=>$label){
  $done=$i<$active||($complete&&$i===$active);$cur=$i===$active&&!$complete;
  $bg=$done?MAIL_C['violet']:($cur?MAIL_C['neon']:MAIL_C['line']);
  $ink=$cur?MAIL_C['ink']:($done?MAIL_C['neon']:MAIL_C['dim']);
  $glyph=$done?'&#10003;':($cur?'&#9679;':'&#9675;');
  $bars.='<td width="'.$w.'%" style="padding:0 3px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td height="5" bgcolor="'.$bg.'" style="height:5px;line-height:5px;font-size:0;background-color:'.$bg.';border-radius:3px;">&nbsp;</td></tr></table></td>';
  $labels.='<td width="'.$w.'%" align="center" class="lbl" style="padding:9px 1px 0 1px;font-family:'.MAIL_SANS.';font-size:10px;line-height:14px;font-weight:'.($cur?'800':'600').';letter-spacing:.3px;color:'.$ink.';">'.$glyph.'<br>'.mh($label).'</td>';
 }
 $cap=mh($t['caption']??'');
 return '<tr><td class="px" style="padding:6px 37px 26px 37px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'
  .($cap!==''?'<tr><td colspan="'.$n.'" style="padding:0 3px 12px 3px;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['dim'].';">'.$cap.'</td></tr>':'')
  .'<tr>'.$bars.'</tr><tr>'.$labels.'</tr></table></td></tr>';
}
function mbLadder(array $l): string {
 $rows='';
 foreach($l['items'] as $i=>$label){
  $state=$i<$l['active']?'done':($i===$l['active']?'now':'next');
  $glyph=['done'=>'&#10003;','now'=>'&#9679;','next'=>'&#9675;'][$state];
  $gc=['done'=>MAIL_C['violet'],'now'=>MAIL_C['neon'],'next'=>MAIL_C['dim']][$state];
  $tc=['done'=>MAIL_C['muted'],'now'=>MAIL_C['ink'],'next'=>MAIL_C['dim']][$state];
  $tag=$state==='now'?' <span style="font-size:10px;font-weight:800;letter-spacing:1.6px;color:'.MAIL_C['btnInk'].';background-color:'.MAIL_C['neon'].';padding:3px 8px;border-radius:9px;">AHORA</span>':'';
  $rows.='<tr><td width="30" valign="top" style="padding:7px 0;font-family:'.MAIL_SANS.';font-size:15px;line-height:20px;color:'.$gc.';">'.$glyph.'</td><td valign="top" style="padding:7px 0;font-family:'.MAIL_SANS.';font-size:15px;line-height:20px;font-weight:'.($state==='now'?'800':'600').';color:'.$tc.';">'.mh($label).$tag.'</td></tr>';
 }
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.MAIL_C['card'].'" style="background-color:'.MAIL_C['card'].';border:1px solid '.MAIL_C['line'].';border-radius:16px;"><tr><td style="padding:16px 22px 12px 22px;">'
  .'<p style="margin:0 0 6px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['neon'].';">'.mh($l['title']).'</p>'
  .'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'.$rows.'</table></td></tr></table></td></tr>';
}
function mbSummary(array $s): string {
 $rows='';$last=count($s['rows'])-1;
 foreach($s['rows'] as $i=>[$k,$v]){
  $b=$i<$last?'border-bottom:1px solid '.MAIL_C['line'].';':'';
  $rows.='<tr><td class="k" valign="top" width="38%" style="padding:12px 0;'.$b.'font-family:'.MAIL_SANS.';font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:'.MAIL_C['dim'].';">'.mh($k).'</td><td class="v" valign="top" align="right" style="padding:12px 0;'.$b.'font-family:'.MAIL_SANS.';font-size:15px;line-height:20px;'.MAIL_WRAP.'font-weight:700;color:'.MAIL_C['ink'].';text-align:right;">'.mh($v).'</td></tr>';
 }
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.MAIL_C['card'].'" style="background-color:'.MAIL_C['card'].';border:1px solid '.MAIL_C['line'].';border-radius:16px;"><tr><td style="padding:18px 22px 6px 22px;">'
  .'<p style="margin:0 0 4px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['neon'].';">'.mh($s['title']).'</p>'
  .'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'.$rows.'</table></td></tr></table></td></tr>';
}
function mbSteps(array $s): string {
 $rows='';
 foreach($s['items'] as $i=>[$t,$d]){
  $rows.='<tr><td width="44" valign="top" style="padding:0 0 18px 0;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td width="30" height="30" align="center" valign="middle" bgcolor="'.MAIL_C['card2'].'" style="width:30px;height:30px;background-color:'.MAIL_C['card2'].';border:1px solid '.MAIL_C['line'].';border-radius:15px;font-family:'.MAIL_SANS.';font-size:13px;line-height:30px;font-weight:800;color:'.MAIL_C['neon'].';">'.($i+1).'</td></tr></table></td>'
   .'<td valign="top" style="padding:0 0 18px 0;font-family:'.MAIL_SANS.';"><p style="margin:0 0 3px 0;font-size:16px;line-height:22px;font-weight:800;color:'.MAIL_C['ink'].';">'.mh($t).'</p><p style="margin:0;font-size:14px;line-height:22px;color:'.MAIL_C['muted'].';">'.mh($d).'</p></td></tr>';
 }
 return '<tr><td class="px" style="padding:4px 40px 8px 40px;"><p style="margin:0 0 16px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['dim'].';">'.mh($s['title']).'</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'.$rows.'</table></td></tr>';
}
function mbNote(array $n): string {
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="3" bgcolor="'.MAIL_C['neon'].'" style="width:3px;background-color:'.MAIL_C['neon'].';border-radius:2px;">&nbsp;</td><td style="padding:2px 0 2px 20px;">'
  .'<p style="margin:0 0 8px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['neon'].';">'.mh($n['label']).'</p>'
  .'<p style="margin:0;font-family:'.MAIL_SERIF.';font-size:21px;line-height:29px;'.MAIL_WRAP.'font-style:italic;color:'.MAIL_C['ink'].';">'.nl2br(mh($n['text']),false).'</p></td></tr></table></td></tr>';
}
function mbCallout(array $c): string {
 $tone=($c['tone']??'info')==='warn'?MAIL_C['warn']:MAIL_C['neon'];
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.MAIL_C['card2'].'" style="background-color:'.MAIL_C['card2'].';border:1px solid '.$tone.';border-radius:16px;"><tr><td style="padding:18px 22px;font-family:'.MAIL_SANS.';">'
  .'<p style="margin:0 0 6px 0;font-size:16px;line-height:22px;font-weight:800;color:'.$tone.';">'.mh($c['title']).'</p><p style="margin:0;font-size:15px;line-height:24px;'.MAIL_WRAP.'color:'.MAIL_C['body'].';">'.mh($c['text']).'</p></td></tr></table></td></tr>';
}
function mbFiles(array $f): string {
 $rows='';
 foreach($f['items'] as [$name,$kind])$rows.='<tr><td valign="middle" style="padding:11px 0;border-bottom:1px solid '.MAIL_C['line'].';font-family:'.MAIL_SANS.';font-size:15px;line-height:20px;font-weight:700;color:'.MAIL_C['ink'].';">'.mh($name).'</td><td align="right" valign="middle" width="90" style="padding:11px 0;border-bottom:1px solid '.MAIL_C['line'].';"><span style="font-family:'.MAIL_SANS.';font-size:10px;line-height:14px;font-weight:800;letter-spacing:1.6px;color:'.MAIL_C['btnInk'].';background-color:'.MAIL_C['neon'].';padding:4px 9px;border-radius:9px;">'.mh($kind).'</span></td></tr>';
 return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.MAIL_C['card'].'" style="background-color:'.MAIL_C['card'].';border:1px solid '.MAIL_C['line'].';border-radius:16px;"><tr><td style="padding:18px 22px 8px 22px;">'
  .'<p style="margin:0 0 2px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'.MAIL_C['neon'].';">'.mh($f['title']).'</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">'.$rows.'</table></td></tr></table></td></tr>';
}
/** Bulletproof pill button: VML round-rect for Outlook desktop, padded <a> everywhere else. */
function mbCta(array $c): string {
 $label=mh($c['label']);$url=mh($c['url']);$w=max(240,min(360,mb_strlen($c['label'])*11+88));
 $hint=!empty($c['hint'])?'<p style="margin:14px 0 0 0;font-family:'.MAIL_SANS.';font-size:13px;line-height:20px;color:'.MAIL_C['dim'].';text-align:center;">'.mh($c['hint']).'</p>':'';
 $second=!empty($c['link'])?'<p style="margin:16px 0 0 0;font-family:'.MAIL_SANS.';font-size:14px;line-height:20px;text-align:center;"><a href="'.mh($c['link'][1]).'" style="color:'.MAIL_C['neon'].';font-weight:700;text-decoration:underline;">'.mh($c['link'][0]).'</a></p>':'';
 return '<tr><td class="px" align="center" style="padding:6px 40px 34px 40px;"><table role="presentation" class="btn-wrap" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td align="center" bgcolor="'.MAIL_C['btn'].'" style="background-color:'.MAIL_C['btn'].';background-image:linear-gradient(120deg,#e0c8ff,#b98cff);border-radius:999px;mso-padding-alt:0;">'
  .'<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="'.$url.'" style="height:54px;v-text-anchor:middle;width:'.$w.'px;" arcsize="50%" stroke="f" fillcolor="'.MAIL_C['btn'].'"><w:anchorlock/><center style="color:'.MAIL_C['btnInk'].';font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">'.$label.'</center></v:roundrect><![endif]-->'
  .'<!--[if !mso]><!--><a class="btn-a" href="'.$url.'" target="_blank" style="display:inline-block;padding:17px 38px;font-family:'.MAIL_SANS.';font-size:16px;line-height:20px;font-weight:800;color:'.MAIL_C['btnInk'].';text-decoration:none;border-radius:999px;">'.$label.' &rarr;</a><!--<![endif]-->'
  .'</td></tr></table>'.$hint.$second.'</td></tr>';
}
function mbDivider(): string { return '<tr><td class="px" style="padding:0 40px 26px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td height="1" bgcolor="'.MAIL_C['line'].'" style="height:1px;line-height:1px;font-size:0;background-color:'.MAIL_C['line'].';">&nbsp;</td></tr></table></td></tr>'; }

// ---------------------------------------------------------------- shell
function mailLayoutHtml(array $m): string {
 $C=MAIL_C;$team=($m['layout']??'')==='team';$font=appUrl('/assets/fonts/');
 $body='';
 foreach($m['blocks'] as $b){
  $body.=match(true){
   isset($b['p'])=>mbPara($b['p']),isset($b['lead'])=>mbPara($b['lead'],true),isset($b['tracker'])=>mbTracker($b['tracker']),isset($b['ladder'])=>mbLadder($b['ladder']),
   isset($b['summary'])=>mbSummary($b['summary']),isset($b['steps'])=>mbSteps($b['steps']),isset($b['note'])=>mbNote($b['note']),isset($b['callout'])=>mbCallout($b['callout']),
   isset($b['files'])=>mbFiles($b['files']),isset($b['cta'])=>mbCta($b['cta']),isset($b['divider'])=>mbDivider(),default=>''
  };
 }
 $title='';foreach(mailTitleParts($m['title']) as [$t,$em])$title.=$em?'<em style="font-style:italic;font-weight:500;color:'.$C['neon'].';">'.mh($t).'</em>':mh($t);
 $hero=!empty($m['hero'])?'<tr><td bgcolor="'.$C['panel'].'" style="padding:0;background-color:'.$C['panel'].';font-size:0;line-height:0;"><img src="'.mh(mailAsset($m['hero'])).'" width="600" height="240" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>':'';
 $legal=array_filter([env('LEGAL_NAME'),env('LEGAL_TAX_ID')!==''?'NIT '.env('LEGAL_TAX_ID'):'',env('LEGAL_ADDRESS')]);
 $support=mailSupport();$home=appUrl('/');
 $links=[];if(!empty($m['sessionUrl']))$links[]='<a href="'.mh($m['sessionUrl']).'" style="color:'.$C['neon'].';text-decoration:underline;">Mi sesión</a>';
 $links[]='<a href="'.mh($home).'" style="color:'.$C['neon'].';text-decoration:underline;">fromheartbeat.com</a>';
 $mailto=$support!==''?'<br><a href="mailto:'.mh($support).'" style="color:'.$C['neon'].';text-decoration:underline;">'.mh($support).'</a>':'';
 $foot=$team?'Aviso interno del estudio · No lo reenvíes fuera del equipo.':'Recibes este correo porque hiciste un pedido en Fromheartbeat. Tu enlace privado es personal: no lo compartas con nadie.';
 return '<!DOCTYPE html><html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark light"><title>'.mh($m['subject']).'</title>'
  .'<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->'
  .'<!--[if !mso]><!--><style>@font-face{font-family:"Cormorant Garamond";src:url('.mh($font).'CormorantGaramond.ttf) format("truetype");font-weight:300 700;font-style:normal}@font-face{font-family:Manrope;src:url('.mh($font).'Manrope.ttf) format("truetype");font-weight:200 800;font-style:normal}</style><!--<![endif]-->'
  .'<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table,td{mso-table-lspace:0;mso-table-rspace:0}img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}body{margin:0!important;padding:0!important;width:100%!important;background-color:'.$C['bg'].'}td,p,h1,a{overflow-wrap:anywhere;word-break:break-word}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}u+#body a{color:inherit}'
  .'@media only screen and (max-width:620px){.wrap{width:100%!important}.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:34px!important;line-height:39px!important}.btn-wrap{width:100%!important}.btn-a{display:block!important;padding:18px 14px!important}.lbl{font-size:9px!important;letter-spacing:0!important}.k,.v{display:block!important;width:100%!important;text-align:left!important;padding-top:10px!important;padding-bottom:0!important;border-bottom:0!important}.v{padding-bottom:12px!important;border-bottom:1px solid '.$C['line'].'!important}.logo{width:214px!important;height:auto!important}}'
  .'</style></head><body id="body" bgcolor="'.$C['bg'].'" style="margin:0;padding:0;background-color:'.$C['bg'].';">'
  .'<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">'.mh($m['preheader']).implode("\n",array_fill(0,4,str_repeat('&#8199;&#847;',10))).'</div>'
  .'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="'.$C['bg'].'" style="background-color:'.$C['bg'].';"><tr><td align="center" style="padding:0;">'
  .'<!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->'
  .'<table role="presentation" class="wrap" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="'.$C['panel'].'" style="width:100%;max-width:600px;background-color:'.$C['panel'].';">'
  // header: brand rail + logo
  .'<tr><td height="4" bgcolor="'.$C['violet'].'" style="height:4px;line-height:4px;font-size:0;background-color:'.$C['violet'].';background-image:linear-gradient(90deg,#8b4dff,#b05cff 55%,#ff4fd8);">&nbsp;</td></tr>'
  .'<tr><td align="center" bgcolor="'.$C['bg'].'" style="padding:26px 20px 24px 20px;background-color:'.$C['bg'].';"><a href="'.mh($home).'" target="_blank" style="text-decoration:none;"><img class="logo" src="'.mh(mailAsset('logo-email.png')).'" width="261" height="48" alt="fromheartbeat" style="display:block;border:0;width:261px;height:auto;font-family:'.MAIL_SERIF.';font-size:24px;line-height:48px;color:'.$C['ink'].';"></a></td></tr>'
  .$hero
  .'<tr><td class="px" style="padding:'.($hero?'40px':'34px').' 40px 10px 40px;"><p style="margin:0 0 14px 0;font-family:'.MAIL_SANS.';font-size:11px;line-height:14px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:'.$C['neon'].';">'.mh($m['eyebrow']).'</p>'
  .'<h1 class="h1" style="margin:0 0 20px 0;font-family:'.MAIL_SERIF.';font-size:40px;line-height:44px;font-weight:500;color:'.$C['ink'].';">'.$title.'</h1></td></tr>'
  .$body
  // footer
  .'<tr><td bgcolor="'.$C['bg'].'" align="center" style="padding:34px 40px 8px 40px;background-color:'.$C['bg'].';border-top:1px solid '.$C['line'].';"><img src="'.mh(mailAsset('icon-email.png')).'" width="44" height="44" alt="" style="display:block;border:0;"></td></tr>'
  .'<tr><td class="px" bgcolor="'.$C['bg'].'" align="center" style="padding:10px 40px 6px 40px;background-color:'.$C['bg'].';font-family:'.MAIL_SERIF.';font-size:22px;line-height:28px;font-style:italic;color:'.$C['ink'].';">Historias reales, convertidas en canciones.</td></tr>'
  .'<tr><td class="px" bgcolor="'.$C['bg'].'" align="center" style="padding:14px 40px 4px 40px;background-color:'.$C['bg'].';font-family:'.MAIL_SANS.';font-size:13px;line-height:24px;color:'.$C['muted'].';">'.implode(' &nbsp;·&nbsp; ',$links).$mailto.'</td></tr>'
  .'<tr><td class="px" bgcolor="'.$C['bg'].'" align="center" style="padding:16px 40px 34px 40px;background-color:'.$C['bg'].';font-family:'.MAIL_SANS.';font-size:12px;line-height:19px;color:'.$C['dim'].';">'.mh($foot).(!empty($m['reference'])?'<br>Referencia '.mh($m['reference']):'').($legal?'<br>'.mh(implode(' · ',$legal)):'').'</td></tr>'
  .'</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>';
}

// ---------------------------------------------------------------- plain text
function mailLayoutText(array $m): string {
 $out=['FROMHEARTBEAT',str_repeat('-',40),strtoupper($m['eyebrow']),'',str_replace('*','',$m['title']),''];
 foreach($m['blocks'] as $b){
  if(isset($b['p'])||isset($b['lead']))$out[]=($b['p']??$b['lead']).PHP_EOL;
  elseif(isset($b['tracker'])){$t=$b['tracker'];$p=[];foreach($t['steps'] as $i=>$l)$p[]=(($i<$t['active']||(!empty($t['complete'])&&$i===$t['active']))?'[x] ':($i===$t['active']?'[>] ':'[ ] ')).$l;$out[]=($t['caption']??'').PHP_EOL.implode('  ',$p).PHP_EOL;}
  elseif(isset($b['ladder'])){$out[]=strtoupper($b['ladder']['title']);foreach($b['ladder']['items'] as $i=>$l)$out[]=($i<$b['ladder']['active']?'[x] ':($i===$b['ladder']['active']?'[>] ':'[ ] ')).$l.($i===$b['ladder']['active']?'  <- ahora':'');$out[]='';}
  elseif(isset($b['summary'])){$out[]=strtoupper($b['summary']['title']);foreach($b['summary']['rows'] as [$k,$v])$out[]=$k.': '.$v;$out[]='';}
  elseif(isset($b['steps'])){$out[]=strtoupper($b['steps']['title']);foreach($b['steps']['items'] as $i=>[$t,$d])$out[]=($i+1).'. '.$t.' — '.$d;$out[]='';}
  elseif(isset($b['note'])){$out[]=strtoupper($b['note']['label']);$out[]='"'.$b['note']['text'].'"';$out[]='';}
  elseif(isset($b['callout'])){$out[]=strtoupper($b['callout']['title']);$out[]=$b['callout']['text'];$out[]='';}
  elseif(isset($b['files'])){$out[]=strtoupper($b['files']['title']);foreach($b['files']['items'] as [$n,$k])$out[]='- '.$n.' ('.$k.')';$out[]='';}
  elseif(isset($b['cta'])){$out[]=strtoupper($b['cta']['label']).':';$out[]=$b['cta']['url'];if(!empty($b['cta']['hint']))$out[]=$b['cta']['hint'];if(!empty($b['cta']['link']))$out[]=$b['cta']['link'][0].': '.$b['cta']['link'][1];$out[]='';}
 }
 $out[]=str_repeat('-',40);$out[]='Fromheartbeat · Historias reales, convertidas en canciones.';$out[]=appUrl('/');
 $s=mailSupport();if($s!=='')$out[]='Escríbenos: '.$s;
 if(!empty($m['reference']))$out[]='Referencia '.$m['reference'];
 $out[]=($m['layout']??'')==='team'?'Aviso interno del estudio.':'Tu enlace privado es personal: no lo compartas con nadie.';
 return implode(PHP_EOL,$out).PHP_EOL;
}

// ---------------------------------------------------------------- content: customer journey
function mailBriefRows(array $o): array {
 $b=is_array($o['brief'])?$o['brief']:(json_decode((string)$o['brief'],true)?:[]);$rows=[];
 if($o['audience']==='business'){foreach(['brand'=>'Marca','campaign'=>'Campaña','channels'=>'Canales','license_scope'=>'Licencia'] as $k=>$l)if(!empty($b[$k]))$rows[]=[$l,mailClip((string)$b[$k],70)];return $rows;}
 foreach(['recipient'=>'Para','occasion'=>'Ocasión','genre'=>'Género','mood'=>'Emoción','voice'=>'Voz','language'=>'Idioma'] as $k=>$l)if(!empty($b[$k]))$rows[]=[$l,mailClip((string)$b[$k],60)];
 return $rows;
}
function mailStageCopy(int $stage): array {
 return match($stage){
  1=>['Estamos escribiendo *tu letra.*','Cada verso nace de lo que nos contaste.','Leímos tu historia con calma. Ahora la convertimos en versos que suenen a ustedes: sus palabras, sus detalles, su manera de decir las cosas.'],
  2=>['Tu canción *está en cabina.*','Las voces y los instrumentos ya están sonando.','Tu letra ya tiene melodía. Estamos grabando las voces y los instrumentos que le dan vida a tu historia.'],
  3=>['Tu canción *toma forma.*','Ritmo, arreglos y capas alrededor de tu historia.','Estamos armando los arreglos, las capas y el ritmo que sostienen tu canción. Ya se empieza a sentir completa.'],
  4=>['Afinando *los últimos detalles.*','Mezcla y master: el pulido final.','Equilibramos cada voz y cada instrumento, y damos el master final para que suene increíble en cualquier parlante.'],
  default=>['Tu sesión *sigue en marcha.*','Seguimos trabajando en tu canción.','Tu canción sigue avanzando en el estudio. Aquí tienes cómo va.']
 };
}
function mailKindLabel(string $mime): string {
 return match(true){str_starts_with($mime,'audio/mpeg')=>'MP3',str_starts_with($mime,'audio/')=>'WAV',str_starts_with($mime,'video/')=>'VIDEO',str_starts_with($mime,'image/')=>'PORTADA',default=>'ARCHIVO'};
}
/** Builds the customer-facing model for one journey step. $kind: received|received_business|quote|payment_failed|paid|production|review|completed|cancelled|update|recover */
function mailModel(string $kind,array $o,array $c,array $ctx=[]): array {
 $ref=$o['reference'];$first=mailFirstName($c);$hi=$first!==''?$first.', ':'';$lead=function(string $t)use($hi):string{$t=mb_strtolower(mb_substr($t,0,1)).mb_substr($t,1);return $hi!==''?$hi.$t:mb_strtoupper(mb_substr($t,0,1)).mb_substr($t,1);};$url=mailSessionUrl($o);$j=mailJourney($o);$biz=$o['audience']==='business';
 $room=mailRoomName($o);$support=mailSupport();$stages=['Historia recibida','Letra','Grabación','Producción','Mezcla y master','Entrega'];
 $stage=(int)($o['production_stage']??0);$note=trim((string)($ctx['note']??''));
 $prod=$biz?3:2;$rev=$biz?3:3;$cap=fn(int $i)=>'Paso '.($i+1).' de '.count($j);
 $m=['kind'=>$kind,'reference'=>$ref,'sessionUrl'=>$url,'blocks'=>[],'eyebrow'=>'Tu sesión · '.$ref];
 $summary=fn(string $title,array $rows)=>['summary'=>['title'=>$title,'rows'=>$rows]];
 $tracker=fn(int $i,bool $done=false)=>['tracker'=>['steps'=>$j,'active'=>$i,'complete'=>$done,'caption'=>$cap($i)]];
 switch($kind){
  case 'received':
   $m+=['subject'=>'Tu historia ya está en el estudio · '.$ref,'preheader'=>'Guardamos tu sesión. Completa el pago para empezar a producir tu canción.','title'=>'Tu historia ya *está en el estudio.*'];
   $m['blocks']=[['lead'=>$lead('recibimos tu historia y la guardamos en una sesión privada. Es tuya: nadie más puede abrirla sin tu enlace.')],$tracker(0),
    $summary('Lo que nos contaste',array_merge(mailBriefRows($o),[['Experiencia',$o['product_name']],['Total',mailMoney((int)$o['amount_in_cents'])]])),
    ['steps'=>['title'=>'Qué sigue','items'=>[['Completa el pago seguro','Con Wompi: tarjeta, PSE, Nequi y más. Tu historia queda guardada mientras tanto.'],['Empezamos a producir','Letra, voces, producción y mezcla, con dirección humana en cada paso.'],['Sigue cada etapa','Ves el avance en tu sesión y recibes tu canción ahí, sin crear una cuenta.']]]],
    ['cta'=>['label'=>'Ir al pago seguro','url'=>$url,'hint'=>'Si ya pagaste, ignora este aviso: te confirmaremos en otro correo.']]];
   break;
  case 'received_business':
   $m+=['subject'=>'Recibimos el brief de tu marca · '.$ref,'preheader'=>'Revisamos tu brief y te enviamos una propuesta con alcance, licencia y precio.','title'=>'Recibimos *el brief de tu marca.*','hero'=>'hero-received.jpg'];
   $m['blocks']=[['lead'=>$lead('gracias por confiarnos la voz de tu marca. Antes de cualquier pago, revisaremos tu brief y acordaremos contigo el alcance y la licencia.')],$tracker(0),
    $summary('Tu brief',array_merge(mailBriefRows($o),[['Experiencia',$o['product_name']]])),
    ['steps'=>['title'=>'Qué sigue','items'=>[['Revisamos tu brief','Nuestro equipo lo lee completo y puede escribirte con preguntas.'],['Recibes una propuesta','Con alcance, licencia comercial y precio final, en tu sesión privada.'],['Pagas y comenzamos','Solo cuando estés de acuerdo con la propuesta.']]]],
    ['cta'=>['label'=>'Abrir mi sesión','url'=>$url,'hint'=>'Te avisaremos por correo apenas tu propuesta esté lista.']]];
   break;
  case 'quote':
   $b=json_decode((string)$o['brief'],true)?:[];
   $m+=['subject'=>'Tu propuesta musical está lista · '.$ref,'preheader'=>'Revisa el alcance, la licencia y el precio antes de pagar.','title'=>'Tu propuesta *está lista.*'];
   $m['blocks']=[['lead'=>$lead('preparamos una propuesta a la medida de tu marca. Léela con calma: el pago solo se habilita cuando tú decides avanzar.')],$tracker(1),
    $summary('Propuesta',[['Experiencia',$o['product_name']],['Total',mailMoney((int)$o['amount_in_cents'])]]),
    ['note'=>['label'=>'Alcance y licencia acordados','text'=>(string)($b['agreed_scope']??'Consulta el detalle completo en tu sesión privada.')]],
    ['cta'=>['label'=>'Revisar y pagar','url'=>$url,'hint'=>'¿Quieres ajustar algo? Responde este correo y lo conversamos.']]];
   break;
  case 'payment_failed':
   $err=($ctx['payment']??'DECLINED')==='ERROR';
   $m+=['subject'=>'Tu pago no se completó · '.$ref,'preheader'=>'Tu historia sigue guardada. Puedes intentarlo de nuevo cuando quieras.','title'=>'Tu pago *no se completó.*'];
   $m['blocks']=[['lead'=>$lead('tu historia sigue guardada y a salvo. Solo falta completar el pago para empezar a producirla.')],
    ['callout'=>['tone'=>'warn','title'=>$err?'No pudimos procesar la transacción':'Tu banco no aprobó la transacción','text'=>$err?'Si notas algún cargo en tu cuenta, escríbenos con tu referencia y lo revisamos de inmediato.':'No se realizó ningún cobro. Suele pasar por datos incorrectos, cupo insuficiente o una validación de seguridad del banco.']],
    $tracker($biz?2:1),
    ['steps'=>['title'=>'Cómo resolverlo','items'=>[['Revisa los datos del medio de pago','Número, fecha, código de seguridad y cupo disponible.'],['Prueba con otro medio','Tarjeta, PSE o Nequi: todos están disponibles en el pago seguro.'],['¿Sigue sin pasar?','Escríbenos con tu referencia y te acompañamos.']]]],
    ['cta'=>['label'=>'Intentar el pago de nuevo','url'=>$url,'link'=>['Escribir al estudio','mailto:'.$support.'?subject='.rawurlencode('Ayuda con mi pago · '.$ref)]]]];
   break;
  case 'paid':
   $full=($o['product_code']??'')==='full';
   $items=array_merge($full?[['Sube tus fotos y clips','Desde tu sesión, para que armemos el video emocional de tu Full Experience.']]:[],[['Escribimos tu letra','Con lo que nos contaste, sin plantillas.'],['Producimos tu canción','Voces, arreglos, mezcla y master.'],['Te avisamos en cada etapa','Y cuando esté lista para escuchar, te escribimos aquí.']]);
   $m+=['subject'=>'Tu canción ya está en camino · '.$ref,'preheader'=>'Confirmamos tu pago. Comenzamos a trabajar con tu historia.','title'=>'Pago *confirmado.*'];
   $m['blocks']=[['lead'=>$lead('gracias. Recibimos tu pago y tu historia ya está en manos del estudio.')],$tracker($prod),
    $summary('Recibo',[['Referencia',$ref],['Experiencia',$o['product_name']],['Total pagado',mailMoney((int)$o['amount_in_cents'])],['Fecha',mailDate($ctx['at']??null)]]),
    ['steps'=>['title'=>'Lo que viene ahora','items'=>$items]],
    ['cta'=>['label'=>'Seguir mi sesión','url'=>$url,'hint'=>'Los plazos se coordinan con el equipo según tu historia y la agenda de producción.']]];
   break;
  case 'production':
   [$title,$pre,$text]=mailStageCopy($stage);$ladder=$stage>=1&&$stage<=4;
   $m+=['subject'=>match($stage){1=>'Estamos escribiendo tu letra',2=>'Tu canción está en cabina',3=>'Tu canción está tomando forma',4=>'Últimos detalles de tu canción',default=>'Novedades de tu canción'}.' · '.$ref,'preheader'=>$pre,'title'=>$title,'hero'=>'hero-production.jpg'];
   if($ladder&&mailHasAsset('hero-production-'.$stage.'.jpg'))$m['hero']='hero-production-'.$stage.'.jpg';
   $m['blocks']=array_values(array_filter([['lead'=>$lead($text)],$tracker($prod),$ladder?['ladder'=>['title'=>'Etapas de tu canción','items'=>$stages,'active'=>$stage]]:null,$note!==''?['note'=>['label'=>'Mensaje del estudio','text'=>$note]]:null,['cta'=>['label'=>'Ver mi sesión','url'=>$url,'hint'=>'Te escribiremos de nuevo en la siguiente etapa.']]]));
   break;
  case 'review':
   $m+=['subject'=>'Es tu turno de escuchar · '.$ref,'preheader'=>'Tu canción está lista para que la escuches y nos cuentes qué sientes.','title'=>'Es tu turno *de escuchar.*'];
   $m['blocks']=array_values(array_filter([['lead'=>$lead('subimos una versión de tu canción a tu sesión privada. Escúchala con calma, mejor con audífonos, y cuéntanos qué sientes.')],$tracker($rev),
    $note!==''?['note'=>['label'=>'Mensaje del estudio','text'=>$note]]:null,
    ['steps'=>['title'=>'Cómo revisarla','items'=>[['Abre tu sesión y dale play','Si hay varias versiones, las encuentras todas ordenadas (v1, v2…).'],['Déjanos tus comentarios','Qué te encantó y qué cambiarías. Llegan directo al estudio.'],['Nosotros hacemos el resto','Aplicamos los ajustes que incluya tu paquete y te avisamos.']]]],
    ['cta'=>['label'=>'Escuchar mi canción','url'=>$url,'hint'=>'Tus comentarios se envían desde tu sesión, no hace falta responder este correo.']]]));
   break;
  case 'completed':
   $files=[];foreach($ctx['files']??[] as $f)$files[]=[(string)$f['original_name'],mailKindLabel((string)$f['mime'])];
   $m+=['subject'=>'Tu canción está lista · '.$ref,'preheader'=>'Ya puedes escucharla, descargarla y guardarla para siempre.','title'=>'Tu canción *está lista.*'];
   $m['blocks']=array_values(array_filter([['lead'=>$lead('tu canción ya está terminada. Gracias por confiarnos una historia tan tuya: ahora es de ustedes.')],$tracker(count($j)-1,true),
    $files?['files'=>['title'=>'Tu entrega','items'=>$files]]:null,
    $note!==''?['note'=>['label'=>'Mensaje del estudio','text'=>$note]]:null,
    ['p'=>'Entra a tu '.($room==='entrega'?'entrega':$room).' para escucharla y descargar los archivos. Guárdalos en un lugar seguro: tu enlace privado puede vencer.'],
    ['cta'=>['label'=>'Abrir mi '.($room==='entrega'?'entrega':$room),'url'=>$url,'link'=>['¿Algo que ajustar? Escríbenos','mailto:'.$support.'?subject='.rawurlencode('Sobre mi canción · '.$ref)]]]]));
   break;
  case 'cancelled':
   $m+=['subject'=>'Tu sesión fue cancelada · '.$ref,'preheader'=>'Cancelamos tu sesión. Si fue un error, la retomamos contigo.','title'=>'Tu sesión *fue cancelada.*'];
   $m['blocks']=array_values(array_filter([['lead'=>$lead('cancelamos tu sesión '.$ref.'.')],$note!==''?['note'=>['label'=>'Motivo','text'=>$note]]:null,
    ['steps'=>['title'=>'Si esto no era lo que esperabas','items'=>[['Escríbenos con tu referencia','Respondiendo este correo. Lo revisamos y, si fue un error, retomamos tu sesión.'],['Si ya habías pagado','Cuéntanos y revisamos el estado del cobro contigo.'],['Cuando quieras volver','Tu historia puede empezar de nuevo en fromheartbeat.com.']]]],
    ['cta'=>['label'=>'Escribir al estudio','url'=>'mailto:'.$support.'?subject='.rawurlencode('Sobre mi sesión cancelada · '.$ref)]]]));
   break;
  case 'recover':
   $m+=['subject'=>'Vuelve a tu sesión · '.$ref,'preheader'=>'Aquí tienes tu acceso privado al estudio.','title'=>'Tu acceso *privado.*'];
   $m['blocks']=[['lead'=>$lead('pediste volver a tu sesión. Con este botón entras directo, sin contraseña ni cuenta.')],
    $summary('Tu sesión',[['Referencia',$ref],['Experiencia',$o['product_name']],['Estado',mailStatusLabel((string)$o['status'])]]),
    ['cta'=>['label'=>'Abrir mi sesión','url'=>$url,'hint'=>'Si no fuiste tú, ignora este correo. Nadie puede entrar sin este enlace, así que no lo compartas.']]];
   break;
  default: // update
   $pos=match($o['status']){'created'=>0,'payment_pending'=>1,'paid'=>$prod,'in_production'=>$prod,'review'=>$rev,'completed'=>count($j)-1,default=>$prod};
   $m+=['subject'=>'Novedades de tu canción · '.$ref,'preheader'=>$note!==''?mailClip($note,110):'Hay novedades en tu sesión.','title'=>'Novedades *de tu sesión.*','hero'=>'hero-update.jpg'];
   $m['blocks']=array_values(array_filter([['lead'=>$lead('el estudio dejó una novedad en tu sesión.')],$tracker($pos,$o['status']==='completed'),$note!==''?['note'=>['label'=>'Mensaje del estudio','text'=>$note]]:null,['cta'=>['label'=>'Ver mi sesión','url'=>$url]]]));
 }
 $m['hero']??='hero-'.$kind.'.jpg';
 if(!mailHasAsset($m['hero']))$m['hero']='';
 return $m;
}

// ---------------------------------------------------------------- content: internal team notice
function mailTeamModel(string $headline,string $message,array $o,array $c): array {
 $ref=$o['reference'];$labels=['created'=>'Creado','payment_pending'=>'Pago pendiente','paid'=>'Pagado','in_production'=>'En producción','review'=>'En revisión','completed'=>'Completado','cancelled'=>'Cancelado'];
 $stages=['Historia recibida','Letra','Grabación','Producción','Mezcla y master','Entrega'];
 $rows=[['Cliente',$c['name']],['Correo',$c['email']],['Teléfono',$c['phone']],['Experiencia',$o['product_name']],['Importe',mailMoney((int)$o['amount_in_cents'])],['Estado',$labels[$o['status']]??$o['status']],['Etapa',$stages[(int)$o['production_stage']]??'—']];
 $brief=mailBriefRows($o);
 return ['kind'=>'team','layout'=>'team','subject'=>$headline.' · '.$ref,'preheader'=>$message,'eyebrow'=>'Equipo · '.$ref,'title'=>$headline,'hero'=>'','reference'=>$ref,
  'blocks'=>array_values(array_filter([['lead'=>$message],['summary'=>['title'=>'Pedido','rows'=>$rows]],$brief?['summary'=>['title'=>'Brief','rows'=>$brief]]:null,['cta'=>['label'=>'Abrir en el panel','url'=>appUrl('/admin.html')]]]))];
}

function mailBuild(array $m): string {
 $html=preg_replace_callback('~<style>.*?</style>~s',fn($x)=>str_replace(['}','{'],["}\n","{"],$x[0]),mailLayoutHtml($m));
 $html=str_replace(['</tr>','</td>','</table>','</p>','</h1>','</div>','</style>','-->','</title>','</head>'],["</tr>\n","</td>\n","</table>\n","</p>\n","</h1>\n","</div>\n","</style>\n","-->\n","</title>\n","</head>\n"],$html);
 return MAIL_HTML_MARK.$html.MAIL_TEXT_MARK.mailLayoutText($m);
}

/**
 * Queues the customer email for a journey step (and, unless $team is null, the internal notice).
 * Never throws: if rendering fails the legacy plain-text notice is queued instead so an order is never lost.
 */
function notifyJourney(array $o,string $kind,array $ctx,string $key,?string $teamHeadline=null,string $teamMessage=''): void {
 try {
  $o=sql('SELECT * FROM orders WHERE id=?',[$o['id']])->fetch()?:$o;$o['product']=catalog()[$o['product_code']]??[];$c=customerFor($o);
  if($kind==='completed'&&!isset($ctx['files']))$ctx['files']=sql("SELECT original_name,mime FROM deliverables WHERE order_id=? AND kind='delivery' ORDER BY id",[$o['id']])->fetchAll();
  $m=mailModel($kind,$o,$c,$ctx);
  enqueue($key.':customer',$c['email'],$m['subject'],mailBuild($m));
  if($teamHeadline!==null){$t=mailTeamModel($teamHeadline,$teamMessage!==''?$teamMessage:$m['preheader'],$o,$c);enqueue($key.':team',env('TEAM_EMAIL'),$t['subject'],mailBuild($t));}
 }catch(Throwable $e){
  error_log('FHB mail '.get_class($e).' '.$e->getMessage());
  notifyOrder($o,'Novedades de tu sesión · '.$o['reference'],trim((string)($ctx['note']??'')?:'Hay novedades en tu sesión.'),$key.':fallback');
 }
}
