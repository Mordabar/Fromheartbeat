<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../private/bootstrap.php';
$email=trim($argv[1]??'');if(!filter_var($email,FILTER_VALIDATE_EMAIL)){fwrite(STDERR,"Uso: php scripts/create-admin.php correo@dominio.com < archivo-clave-temporal\n");exit(1);}
$password=trim(stream_get_contents(STDIN));need(strlen($password)>=12,'La contraseña debe tener al menos 12 caracteres.');
need(!sql('SELECT id FROM admins WHERE email=?',[$email])->fetch(),'El administrador ya existe. No se cambió su contraseña.');
sql('INSERT INTO admins(email,password_hash) VALUES(?,?)',[$email,password_hash($password,PASSWORD_DEFAULT)]);echo "Administrador creado. Elimina el archivo temporal de contraseña.\n";
