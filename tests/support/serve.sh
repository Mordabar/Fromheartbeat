#!/bin/bash
# Levanta una copia de la app con SQLite en lugar de MySQL (SOLO PRUEBAS) en 127.0.0.1:${PORT:-8199}.
# Uso: tests/support/serve.sh   ->  imprime la carpeta de trabajo; admin: admin@x.co / pw12345678
set -e
R=$(cd "$(dirname "$0")/../.." && pwd); W=${FHB_WORK:-/tmp/fhb-harness}; PORT=${PORT:-8199}
pkill -f "^php -d upload_max_filesize=50M .*:$PORT"  2>/dev/null || true; sleep 0.3
rm -rf "$W"; mkdir -p "$W/app/private/config"; cp "$R/api.php" "$W/app/"; ln -s "$R/admin.html" "$R/index.html" "$W/app/"; ln -s "$R/assets" "$W/app/assets"
cp -r "$R/private/"*.php "$R/private/vendor" "$W/app/private/"; cp "$R/tests/support/sqlitedb.php" "$W/app/private/"
python3 - "$W/app/private/bootstrap.php" <<'PY'
import re,sys
p=sys.argv[1];s=open(p,encoding='utf-8').read()
s=re.sub(r"function db\(\): PDO \{.*?\n\}\n","require_once __DIR__.'/sqlitedb.php';function db(): PDO { static $pdo; if(!$pdo)$pdo=sqlite_boot(getenv('FHB_SQLITE')?:'/tmp/fhb-test.sqlite'); return $pdo; }\n",s,count=1,flags=re.S)
s=s.replace("function rate(string $name,int $max,int $seconds):void {","function rate(string $name,int $max,int $seconds):void { return;",1)
open(p,'w',encoding='utf-8').write(s)
PY
cat > "$W/app/private/config/.env" <<ENV
APP_ENV=staging
APP_URL=http://127.0.0.1:$PORT
APP_KEY=0123456789abcdef0123456789abcdef0123456789abcdef
SESSION_SECURE=false
LINK_DAYS=30
WOMPI_ENV=test
TEAM_EMAIL=team@example.com
SUPPORT_EMAIL=hola@example.com
MAIL_FROM=no-reply@example.com
COMMERCE_READY=true
$FHB_EXTRA_ENV
ENV
export FHB_SQLITE="$W/test.sqlite" FHB_ENV_FILE="$W/app/private/config/.env" STORAGE_PATH="$W/storage"
(cd "$W" && nohup php -d upload_max_filesize=50M -d post_max_size=58M -S 127.0.0.1:$PORT -t "$W/app" > "$W/php.log" 2>&1 &)
sleep 1
HASH=$(php -r 'echo password_hash("pw12345678",PASSWORD_DEFAULT);')
php -r 'require $argv[1]; sqlite_boot($argv[2]);' "$W/app/private/sqlitedb.php" "$FHB_SQLITE"
python3 - "$FHB_SQLITE" "$HASH" <<'PY'
import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);c.execute("insert into admins(email,password_hash) values('admin@x.co',?)",(sys.argv[2],));c.commit()
PY
echo "$W"
