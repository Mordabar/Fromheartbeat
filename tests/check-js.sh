#!/bin/bash
# Syntax check of every browser module (node --check alone does not catch ES-module errors)
cd "$(dirname "$0")/../assets" && rc=0; for f in *.js; do out=$(node --input-type=module --check < "$f" 2>&1) || { echo "$f: $out" | head -3; rc=1; }; done; [ $rc = 0 ] && echo "JS ok"; exit $rc
