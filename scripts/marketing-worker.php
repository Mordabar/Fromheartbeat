<?php
declare(strict_types=1);
// Cron (every 10–15 minutes):  php scripts/marketing-worker.php
// Queues scheduled campaigns, runs the automations (unpaid orders, thank-you, re-order, win-back) and flushes the SMS outbox.
// Emails themselves are sent by scripts/mail-worker.php (this script only puts them in the queue, same as every other email).
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../private/bootstrap.php';
$lock=fopen(storage().'/marketing-worker.lock','c');if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))exit;
if(!growthEnsure()){fwrite(STDERR,"No se pudo preparar la base de datos de crecimiento.\n");exit(1);}
$campaigns=campaignsDue();$auto=automationsRun();$sms=smsFlush();
flock($lock,LOCK_UN);fclose($lock);
echo "Campañas: $campaigns · Automatizaciones: ".json_encode($auto)." · SMS: $sms\n";
