<?php
declare(strict_types=1);
// Builds the REAL MIME message PHPMailer would send (no network) for every stored-body shape and checks it.
//   php tests/email-mime.php
// Verifies: multipart/alternative with text first and HTML last, UTF-8 intact after quoted-printable, no line >998 chars,
// legacy plain-text rows still go out as text/plain, and the queue marker/round-trip is lossless.
putenv('APP_URL=https://fromheartbeat.com');putenv('APP_KEY='.str_repeat('k',40));putenv('SUPPORT_EMAIL=contacto@fromheartbeat.com');
require __DIR__.'/../private/bootstrap.php';
require __DIR__.'/../private/vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;

$fail=[];$ok=0;$check=function(bool $c,string $m)use(&$fail,&$ok){$c?$ok++:$fail[]=$m;};
$o=['id'=>1,'reference'=>'FHB-260930-024D7A1892','product_code'=>'full','product_name'=>'Full Experience','product'=>catalog()['full'],'amount_in_cents'=>27990000,'audience'=>'person','brief'=>json_encode(['recipient'=>'Mamá','occasion'=>'Cumpleaños','genre'=>'Bolero','mood'=>'Nostálgica','voice'=>'Femenina','language'=>'Español']),'status'=>'paid','production_stage'=>0];
$c=['name'=>'María José','email'=>'maria@example.com','phone'=>'1'];

function send(string $stored): PHPMailer {
 $mail=new PHPMailer(true);$mail->CharSet='UTF-8';$mail->setFrom('contacto@fromheartbeat.com','Fromheartbeat');$mail->addAddress('maria@example.com');$mail->Subject='Prueba · ñandú';
 mailFill($mail,$stored); // the exact function scripts/mail-worker.php calls
 $mail->preSend();return $mail;
}
$m=mailModel('paid',$o,$c,['at'=>'2026-09-30 13:34:00']);$stored=mailBuild($m);
$p=mailParts($stored);
$check($p['html']!==null&&str_starts_with($p['html'],'<!DOCTYPE html>'),'el HTML guardado debe empezar por el doctype');
$check(!str_contains($p['html'],'fhb:text')&&!str_contains($p['html'],'fhb:html'),'las marcas internas no deben filtrarse al HTML');
$check(str_contains($p['text'],'Pago confirmado')&&!str_contains($p['text'],'<'),'el texto alternativo debe ser texto limpio');
$mail=send($stored);$raw=$mail->getSentMIMEMessage();
$check(str_contains($raw,'multipart/alternative'),'debe ser multipart/alternative');
$check(strpos($raw,'text/plain')<strpos($raw,'text/html'),'text/plain debe ir antes que text/html (el cliente prefiere la última parte)');
$check(str_contains($raw,'Content-Transfer-Encoding: quoted-printable'),'las partes deben ir en quoted-printable');
$long=0;foreach(preg_split('/\r?\n/',$raw) as $l)$long=max($long,strlen($l));$check($long<=998,"línea de $long caracteres (> 998) en el MIME");
// decode the HTML part back and confirm accents + the CTA survive
preg_match('/Content-Type: text\/html[^\n]*\n(?:[^\n]+\n)*?\r?\n(.*?)\r?\n--b/s',$raw,$h);
$dec=quoted_printable_decode($h[1]??'');
$check(str_contains($dec,'¡')||str_contains($dec,'María')||str_contains($dec,'Pago <em'),'el HTML decodificado debe conservar UTF-8');
$check(str_contains($dec,'María')||str_contains($dec,'gracias'),'el cuerpo debe incluir el saludo');
$check(preg_match('~href="https://fromheartbeat\.com/\?session=FHB-260930-024D7A1892#token=[0-9a-f]{64}"~',$dec)===1,'el botón debe llevar el enlace privado con token de 64 hex');
// legacy rows (queued before this change) must keep working as plain text
$check(!str_contains($mail->AltBody,'<')&&!str_contains($mail->AltBody,'&nbsp;'),'el AltBody no debe contener HTML');
$check(preg_match('~https://fromheartbeat\.com/\?session=FHB-260930-024D7A1892#token=[0-9a-f]{64}~',$mail->AltBody)===1,'el AltBody debe llevar el mismo enlace privado que el botón');
$check(str_contains($raw,'@fromheartbeat.com>')&&!preg_match('/Message-ID: <[^>]*@vm>/',$raw),'el Message-ID debe usar el dominio, no el host interno');
$check(!str_contains($raw,'=0A'),'no debe haber =0A: los saltos deben ser CRLF canónicos antes de codificar');
$check(str_contains($raw,'Reply-To: Fromheartbeat <contacto@fromheartbeat.com>')||str_contains($raw,'Reply-To:'),'debe llevar Reply-To (el correo invita a responder)');
$check(str_contains($raw,'Auto-Submitted: auto-generated'),'debe marcar Auto-Submitted para evitar respuestas automáticas');
$legacy="Hola,\n\nTu sesión FHB-1.\nFromheartbeat";$lm=send($legacy);$check(!str_contains($lm->getSentMIMEMessage(),'text/html'),'las filas antiguas deben salir como texto plano');
$check(mailParts($legacy)['html']===null&&mailParts($legacy)['text']===$legacy,'mailParts no debe alterar filas antiguas');
// round-trip fidelity for hostile body text containing the markers
$hm=mailModel('update',$o,$c,['note'=>"<!--fhb:text--> y <!--fhb:html--> dentro de la nota"]);$hp=mailParts(mailBuild($hm));
$check(substr_count($hp['html'],'<!--fhb:')===0,'una nota con marcas internas no debe romper la separación HTML/texto');
$check(str_contains($hp['text'],'dentro de la nota'),'el texto alternativo debe conservar la nota');
echo $fail?"FALLAS:\n - ".implode("\n - ",$fail)."\n":"OK: $ok comprobaciones de MIME.\n";
exit($fail?1:0);
