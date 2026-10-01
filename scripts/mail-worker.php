<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../private/bootstrap.php';
require __DIR__.'/../private/vendor/autoload.php';
// Opt in separately: do not resend a historic queue when updating an existing deployment.
need(env('MAIL_WORKER_ENABLED')==='true','Activa MAIL_WORKER_ENABLED sólo si no existe otro procesador de correo.');
$since=env('MAIL_WORKER_SINCE');need((bool)preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/D',$since),'Configura MAIL_WORKER_SINCE con la fecha UTC de activación.');
need(env('MAIL_TRANSPORT')==='smtp'&&env('SMTP_HOST')!==''&&env('MAIL_FROM')!=='','Completa la configuración SMTP.');
$lock=fopen(storage().'/mail-worker.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))exit;
// Separate state table keeps existing queue schemas intact.
sql('CREATE TABLE IF NOT EXISTS fhb_mail_dispatch (mail_id BIGINT UNSIGNED PRIMARY KEY,attempts INT NOT NULL DEFAULT 0,sent_at DATETIME NULL,last_error VARCHAR(500) NULL) ENGINE=InnoDB');
$rows=sql('SELECT m.* FROM mail_queue m LEFT JOIN fhb_mail_dispatch d ON d.mail_id=m.id WHERE m.created_at>=? AND d.sent_at IS NULL AND COALESCE(d.attempts,0)<5 ORDER BY m.id LIMIT 30',[$since])->fetchAll();
foreach($rows as $row){
 sql('INSERT INTO fhb_mail_dispatch(mail_id,attempts) VALUES(?,1) ON DUPLICATE KEY UPDATE attempts=attempts+1',[$row['id']]);
 try{
  $mail=new PHPMailer\PHPMailer\PHPMailer(true);$mail->isSMTP();$mail->Host=env('SMTP_HOST');$mail->Port=(int)env('SMTP_PORT','587');$mail->SMTPAuth=env('SMTP_USERNAME')!=='';$mail->Username=env('SMTP_USERNAME');$mail->Password=env('SMTP_PASSWORD');$mail->SMTPSecure=env('SMTP_ENCRYPTION','tls');$mail->Timeout=20;$mail->CharSet='UTF-8';$mail->setFrom(env('MAIL_FROM'),'Fromheartbeat');$mail->addAddress($row['recipient']);$mail->Subject=$row['subject'];mailFill($mail,$row['body']);$mail->send();
  sql('UPDATE fhb_mail_dispatch SET sent_at=UTC_TIMESTAMP(),last_error=NULL WHERE mail_id=?',[$row['id']]);
 }catch(Throwable $e){sql('UPDATE fhb_mail_dispatch SET last_error=? WHERE mail_id=?',[mb_substr($e->getMessage(),0,500),$row['id']]);fwrite(STDERR,'Error de correo #'.$row['id']."\n");}
}
flock($lock,LOCK_UN);fclose($lock);echo count($rows)." correos procesados.\n";
