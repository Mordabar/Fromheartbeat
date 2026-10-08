"""Datos de crecimiento para las pruebas de navegador: temporada, cupones, compradores con origen, suscriptores y una campaña enviada."""
import sys,os,json,uuid
sys.path.insert(0,os.path.dirname(__file__))
from drv import *
A=admin()
A.post('admin-promo-save',dict(name='Mes de la madre',kind='percent',value=20,badge='-20%',banner='Mes de la madre: 20 % en todas las canciones',active=True))
A.post('admin-coupon-save',dict(code='GRACIAS30',kind='percent',value=30,label='Prueba de navegador'))
def buy(email,name,src,camp,optin=True,product='personalizada'):
    cl=Cl();c,r=cl.post('orders',dict(product=product,consent=True,name=name,email=email,phone='3001234567',brief=brief(),idempotency_key=uuid.uuid4().hex+uuid.uuid4().hex,optin_email=optin,attr=dict(v='v_'+uuid.uuid4().hex[:20],ft=dict(s=src,c=camp),lt=dict(s=src,c=camp))))
    assert c==201,r;return r['order']
for i,(src,camp) in enumerate([('instagram','madres'),('instagram','madres'),('email','mes-madre'),('google','marca'),('directo',None)]):
    o=buy('cliente%d@example.com'%i,'Cliente %d'%i,src,camp or '')
    if i<4:
        ex("update orders set status='completed',production_stage=5,paid_at=datetime('now') where id=(select id from orders where reference=?)",o['reference'])
        ex("update contacts set orders_paid=%d,spent_in_cents=%d,last_order_at=datetime('now','-%d day'),first_paid_at=datetime('now','-%d day') where email=?"%(1+(i==0),o['amount_in_cents'],i*40,i*40),'cliente%d@example.com'%i)
for i in range(6):
    cl=Cl();cl.get('bootstrap');cl.post('track',dict(v='visita_demo_%014d'%i,e=[dict(n='view',us='instagram',uc='madres'),dict(n='select_product',d={'product':'full'})]+([dict(n='begin_checkout')] if i<3 else [])))
c,r=A.post('admin-campaign-save',dict(name='Día de la madre',channel='email',subject='{nombre}, una canción para mamá',title='Para *mamá*, con música',body='Hola {nombre}.\n\nEste mes dedicamos canciones con 20 % menos.',cta_label='Crear mi canción',cta_path='/',segment={},personal_coupon=dict(kind='percent',value=15,valid_days=20)))
A.post('admin-campaign-send',dict(id=r['id'],confirm=True))
print(json.dumps({'ok':True}))
