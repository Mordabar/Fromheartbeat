<?php
// TEST HARNESS ONLY: PDO(sqlite) that accepts the MySQL dialect used by the app.
class SqliteStmtWrap extends PDOStatement {}
class SqlitePdo extends PDO {
 function prepare(string $q,array $o=[]): PDOStatement|false {
  $q=str_replace(['UTC_TIMESTAMP()','INSERT IGNORE','FOR UPDATE'],["datetime('now')",'INSERT OR IGNORE',''],$q);
  $q=preg_replace('/\bIF\(/','IIF(',$q);
  return parent::prepare($q,$o);
 }
}
function sqlite_boot(string $file): PDO {
 $new=!is_file($file);
 $p=new SqlitePdo('sqlite:'.$file);$p->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);$p->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE,PDO::FETCH_ASSOC);
 if($new){
  $p->exec("CREATE TABLE customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name,email,phone,created_at DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE admins(id INTEGER PRIMARY KEY AUTOINCREMENT,email UNIQUE,password_hash);
  CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,reference UNIQUE,customer_id INTEGER,product_code,product_name,amount_in_cents INTEGER,currency DEFAULT 'COP',audience,brief,consent_version,idempotency_key UNIQUE,request_hash,token_hash,token_expires_at,status DEFAULT 'created',production_stage INTEGER DEFAULT 0,requires_attention INTEGER DEFAULT 0,quoted_at,created_at DEFAULT CURRENT_TIMESTAMP,updated_at DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE order_history(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,status,stage INTEGER,note,actor,visible INTEGER DEFAULT 1,created_at DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE deliverables(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,storage_name,original_name,mime,size_bytes INTEGER,kind,created_at DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE payment_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,reference UNIQUE,transaction_id,status DEFAULT 'CREATED',amount_in_cents INTEGER,currency,created_at DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE webhook_events(checksum PRIMARY KEY,transaction_id,created_at DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE rate_limits(bucket PRIMARY KEY,hits,window_start);
  CREATE TABLE mail_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,dedupe_key UNIQUE,recipient,subject,body,created_at DEFAULT CURRENT_TIMESTAMP);");
 }
 return $p;
}
