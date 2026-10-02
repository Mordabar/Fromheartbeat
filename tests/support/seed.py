"""Crea una sesión pagada (producto indicado) y escribe {ref,link} en JSON. Uso: python3 tests/support/seed.py [producto] [estado]"""
import sys,os,json
sys.path.insert(0,os.path.dirname(__file__))
from drv import *
prod=sys.argv[1] if len(sys.argv)>1 else 'full';status=sys.argv[2] if len(sys.argv)>2 else 'in_production'
c=Cl();o=mkorder(c,prod);ex("update orders set status=?,production_stage=2 where reference=?",status,o['reference'])
a=admin();d=a.get('admin-order','&reference='+o['reference'])['order']
print(json.dumps({'ref':o['reference'],'link':d['testLink'].replace('http://127.0.0.1:%s'%PORT,'')}))
