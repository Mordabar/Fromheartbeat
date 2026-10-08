<?php
declare(strict_types=1);
// One-click unsubscribe (also the target of the List-Unsubscribe header). The signed link IS the authorisation: no login, no CSRF token to expire.
require __DIR__.'/private/bootstrap.php';
header('Cache-Control: no-store');header('Referrer-Policy: no-referrer');header('X-Robots-Tag: noindex');
$h=fn(string $s)=>htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
$id=(int)($_GET['c']??0);$ch=(string)($_GET['ch']??'email');$t=(string)($_GET['t']??'');$confirm=($_GET['a']??'')==='confirm';$state='ask';$msg='';
try{
 need($id>0&&($confirm?($ch==='email'&&hash_equals(optinToken($id),$t)):unsubValid($id,$ch,$t)),'Este enlace no es válido o está incompleto.',400);
 growthEnsure()||throw new HttpError(503,'El servicio no está disponible ahora. Inténtalo en unos minutos.');
 $c=sql('SELECT * FROM contacts WHERE id=?',[$id])->fetch();need((bool)$c,'Este enlace no es válido.',404);
 $self=$_SERVER['REQUEST_URI'];$base=preg_replace('/&r=\w+$/','',$self);
 if($_SERVER['REQUEST_METHOD']==='POST'){
  $do=(string)($_POST['do']??'');
  if($confirm){consentSet($id,'email',true,'double-optin');header('Location: '.$base.'&r=confirmed',true,303);exit;}
  if($do==='resub'){consentSet($id,$ch,true,'baja-page');header('Location: '.$base.'&r=resub',true,303);exit;}
  consentSet($id,$ch,false,'baja-link');   // the form, and also what mail apps send for List-Unsubscribe=One-Click
  if($do!==''){header('Location: '.$base.'&r=done',true,303);exit;}   // a browser: Post/Redirect/Get, so a refresh never re-posts
  $state='done';
 }else{
  $r=(string)($_GET['r']??'');
  $state=$confirm?(canMarket($c)||$r==='confirmed'?'confirmed':'confirm'):($r==='resub'?'resub':($c[$ch.'_unsub_at']!==null?'done':'ask'));
 }
}catch(HttpError $e){$state='error';$msg=$e->getMessage();http_response_code($e->statusCode);}
$what=$ch==='sms'?'mensajes de texto':'correos';
$title=['ask'=>'¿Dejar de recibir ofertas?','done'=>'Listo, ya no recibirás ofertas.','resub'=>'Volviste a suscribirte.','confirm'=>'Confirma tu suscripción','confirmed'=>'¡Listo, quedaste suscrito!','error'=>'No pudimos completar esto'][$state];
?><!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Fromheartbeat · Preferencias</title>
<style>@font-face{font-family:Manrope;src:url(assets/fonts/Manrope.woff2) format('woff2');font-weight:200 800;font-display:swap}@font-face{font-family:Editorial;src:url(assets/fonts/CormorantGaramond.woff2) format('woff2');font-weight:300 700;font-display:swap}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:radial-gradient(120% 80% at 50% 0,#2a1456,#07040f 60%);color:#f4eeff;font-family:Manrope,system-ui,sans-serif}
main{width:min(460px,100%);padding:28px 22px;border-radius:26px;background:#150d27;border:1px solid #c9a8ff33;box-shadow:0 30px 70px -30px #b05cff}
.brand{font-weight:800;letter-spacing:.2px;margin-bottom:18px}.brand b{background:linear-gradient(120deg,#8b4dff,#ff4fd8);-webkit-background-clip:text;background-clip:text;color:transparent}
h1{font:500 30px/1.1 Editorial,Georgia,serif;margin:0 0 10px}p{margin:0 0 18px;color:#d6cceb;line-height:1.55}
button,a.btn{display:flex;justify-content:center;align-items:center;width:100%;min-height:52px;border:0;border-radius:16px;font:800 16px Manrope,sans-serif;color:#fff;text-decoration:none;cursor:pointer;background:linear-gradient(100deg,#8e5bff,#ff4fd8);box-shadow:0 14px 30px -14px #ff4fd8}
a.btn.ghost,button.ghost{background:transparent;border:1px solid #c9a8ff55;box-shadow:none;margin-top:10px;color:#e6d6ff}</style></head><body><main>
<div class="brand">from<b>heart</b>beat</div><h1><?=$h($title)?></h1>
<?php if($state==='ask'): ?><p>Dejarás de recibir ofertas y novedades por <?=$h($what)?>. Los avisos de tus pedidos (pagos, entrega de tu canción) seguirán llegando.</p>
<form method="post"><input type="hidden" name="do" value="unsub"><button>Sí, dejar de recibirlos</button></form><a class="btn ghost" href="./">Mejor me quedo</a>
<?php elseif($state==='confirm'): ?><p>Recibirás ofertas y novedades de Fromheartbeat en tu correo. Puedes cancelar cuando quieras desde cualquier mensaje.</p>
<form method="post"><input type="hidden" name="do" value="confirm"><button>Sí, quiero recibirlas</button></form><a class="btn ghost" href="./">No, gracias</a>
<?php elseif($state==='confirmed'): ?><p>Gracias. Te escribiremos con ofertas y novedades, sin llenarte el correo. Cada mensaje trae un enlace para cancelar.</p><a class="btn" href="./">Ir al estudio</a>
<?php elseif($state==='done'): ?><p>No volverás a recibir ofertas ni novedades por <?=$h($what)?>. Solo seguirás recibiendo los avisos de tus pedidos (pago y entrega de tu canción).</p>
<form method="post"><input type="hidden" name="do" value="resub"><button class="ghost">Me equivoqué, volver a suscribirme</button></form><a class="btn ghost" href="./">Ir al estudio</a>
<?php elseif($state==='resub'): ?><p>Gracias. Volverás a recibir nuestras ofertas y novedades. Puedes cancelar cuando quieras desde cualquier correo.</p><a class="btn" href="./">Ir al estudio</a>
<?php else: ?><p><?=$h($msg)?></p><a class="btn ghost" href="./">Ir al estudio</a><?php endif; ?>
</main></body></html>
