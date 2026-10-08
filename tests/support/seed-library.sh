#!/bin/bash
# Fresh harness + test media + the orders the browser tests need (several songs of one email, one in review with files).
# Writes /tmp/s1..s8.json ({ref, link}). Then: BASE_URL=http://127.0.0.1:8199 node tests/e2e-library.mjs desktop
cd "$(dirname "$0")/../.."
bash tests/support/serve.sh >/dev/null 2>&1; sleep 1
PYTHONPATH=tests/support python3 - <<'PY'
import sys,os
src=open('tests/files.py').read().split("M=media()")[0]
exec(compile(src,'f','exec'))
m=media();open(T+'/captura.png','wb').write(m['png'])
PY
python3 tests/support/seed.py full completed rich > /tmp/s1.json && python3 tests/support/seed.py dedicatoria in_production > /tmp/s2.json && python3 tests/support/seed.py personalizada created > /tmp/s3.json && python3 tests/support/seed.py personalizada review rich > /tmp/s4.json
for i in 5 6 7 8; do python3 tests/support/seed.py dedicatoria paid > /tmp/s$i.json; done
