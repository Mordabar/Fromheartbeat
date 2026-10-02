<?php
declare(strict_types=1);
define('BASE', __DIR__);
$configFile = getenv('FHB_ENV_FILE') ?: BASE.'/config/.env';
if (is_file($configFile)) {
 foreach (file($configFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
  $line=trim(preg_replace('/^\xEF\xBB\xBF/','',$line)); if ($line==='' || $line[0]==='#' || !str_contains($line,'=')) continue;
  [$k,$v]=explode('=',$line,2); if (getenv(trim($k))===false) putenv(trim($k).'='.trim($v," \t\n\r\0\x0B\"'"));
 }
}
date_default_timezone_set('UTC');
function env(string $key, string $default=''): string { $v=getenv($key); return $v===false ? $default : $v; }
function db(): PDO {
 static $pdo; if (!$pdo) $pdo=new PDO('mysql:host='.env('DB_HOST','127.0.0.1').';port='.env('DB_PORT','3306').';dbname='.env('DB_DATABASE','fromheartbeat').';charset=utf8mb4',env('DB_USERNAME'),env('DB_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
 return $pdo;
}
function sql(string $query, array $params=[]): PDOStatement { $s=db()->prepare($query); $s->execute($params); return $s; }
class HttpError extends RuntimeException { public function __construct(public int $statusCode, string $message) { parent::__construct($message); } }
function need(bool $ok, string $message, int $code=422): void { if(!$ok) throw new HttpError($code,$message); }
function jsonResponse(mixed $data, int $status=200): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR); exit; }
function input(): array { need((int)($_SERVER['CONTENT_LENGTH']??0)<=65536,'Solicitud demasiado grande.',413); try{$data=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);}catch(JsonException){throw new HttpError(400,'JSON inválido.');} need(is_array($data),'Solicitud inválida.',400); return $data; }
function sessionBoot(): void {
 if(session_status()===PHP_SESSION_ACTIVE)return;
 $sessionPath=storage().'/sessions';if(!is_dir($sessionPath))mkdir($sessionPath,0700,true);session_save_path($sessionPath);
 session_name('fhb_session'); ini_set('session.use_strict_mode','1'); ini_set('session.gc_maxlifetime','7200');
 session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>env('SESSION_SECURE','true')==='true','httponly'=>true,'samesite'=>'Lax']); session_start();
 if(isset($_SESSION['last_seen']) && time()-$_SESSION['last_seen']>7200) {$_SESSION=[];session_regenerate_id(true);}
 $_SESSION['last_seen']=time(); $_SESSION['csrf']??=bin2hex(random_bytes(32));
}
function csrf(): void { sessionBoot(); need(hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''),'La sesión venció. Actualiza la página.',403); }
function admin(): int { sessionBoot(); need(isset($_SESSION['admin_id']),'Inicia sesión para continuar.',401); return (int)$_SESSION['admin_id']; }
function rate(string $name,int $max,int $seconds):void {
 $bucket=hash('sha256',$name.'|'.($_SERVER['REMOTE_ADDR']??'cli')); $now=time();
 sql('INSERT INTO rate_limits(bucket,hits,window_start) VALUES(?,1,?) ON DUPLICATE KEY UPDATE hits=IF(window_start < ?,1,hits+1), window_start=IF(window_start < ?,VALUES(window_start),window_start)',[$bucket,$now,$now-$seconds,$now-$seconds]);
 need((int)sql('SELECT hits FROM rate_limits WHERE bucket=?',[$bucket])->fetchColumn()<=$max,'Demasiados intentos. Inténtalo más tarde.',429);
}
function field(array $data,string $key,int $min,int $max):string { $v=$data[$key]??''; need(is_string($v),'Campo inválido: '.$key); $v=trim($v); need(mb_strlen($v)>=$min && mb_strlen($v)<=$max,'Revisa el campo '.$key.'.'); return $v; }
function appUrl(string $path=''):string { return rtrim(env('APP_URL','http://127.0.0.1:8088'),'/').$path; }
function storage():string { $path=env('STORAGE_PATH',BASE.'/storage'); if(!is_dir($path))mkdir($path,0700,true); return $path; }
require_once BASE.'/catalog.php';
require_once BASE.'/domain.php';
require_once BASE.'/mail.php';
require_once BASE.'/files.php';
