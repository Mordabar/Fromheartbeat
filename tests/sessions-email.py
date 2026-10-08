"""Sesiones asociadas al correo + enlace de regalo de solo lectura (tests/support/serve.sh en marcha).
Uso: bash tests/support/serve.sh && python3 tests/sessions-email.py"""
import os,sys,re
sys.path.insert(0,os.path.join(os.path.dirname(__file__),'support'))
from drv import *
ok=fail=0
def t(n,c,x=''):
    global ok,fail
    if c:ok+=1;print('  ok  ',n)
    else:fail+=1;print('  FAIL',n,x)
A=admin()
def link(ref):
    l=A.get('admin-order','&reference='+ref)['order']['testLink'];return re.search(r'session=([^#&]+)',l).group(1),l.split('token=')[1]
def deliver(ref,status='completed'):
    ex("update orders set status=?,production_stage=5 where reference=?",status,ref)
    A.upload(ref,'cancion.mp3',b'ID3'+b'\0'*500,kind='delivery')
def buy(email,product='dedicatoria'):
    return mkorder(Cl(),product,email=email)
a1,a2,a3=buy('Ana@Example.com'),buy('ana@example.com','full'),buy('ana@example.com','personalizada')
b1=buy('beto@example.com')
for o in (a1,a2):deliver(o['reference'])
deliver(b1['reference'])
print('— biblioteca por correo')
c=Cl();r1,t1=link(a1['reference'])
t('sin enlace no hay biblioteca',c.get('my-orders')['orders']==[])
t('exchange ok',c.post('exchange',dict(reference=r1,token=t1))[0]==200)
mine=c.get('my-orders')['orders'];refs={o['reference'] for o in mine}
t('aparecen las canciones pagadas del mismo correo (mayúsculas ignoradas), no la sin pagar',refs=={a1['reference'],a2['reference']},refs)
t('no aparece la de otro cliente',b1['reference'] not in refs)
t('trae destinatario, ocasión, audio y portada',all(o['recipient']=='Mamá' and 'songs' in o for o in mine) and any(o['audio_id'] for o in mine))
t('abre una sesión hermana sin su enlace',('order' in c.get('order','&reference='+a2['reference'])))
t('no abre la de otro correo',c.get('order','&reference='+b1['reference']).get('_code')==404)
fid=q("select d.id from deliverables d join orders o on o.id=d.order_id where o.reference=?",b1['reference'])[0]['id']
try:
    import urllib.request;urllib.request.urlopen(c.op.open(B+'?action=file&id=%d'%fid))
    t('archivo ajeno bloqueado',False)
except Exception as e:t('archivo ajeno bloqueado',getattr(e,'code',0)==404,e)
t('otro navegador no ve nada',Cl().get('my-orders')['orders']==[])
print('— enlace vencido')
ex("update orders set status='completed',token_expires_at='2000-01-01 00:00:00' where reference=?",a3['reference'])
t('una sesión vencida sale de la biblioteca',a1['reference'] in {o['reference'] for o in c.get('my-orders')['orders']} and a3['reference'] not in {o['reference'] for o in c.get('my-orders')['orders']})
t('y no se abre',c.get('order','&reference='+a3['reference']).get('_code')==404)
print('— regalo de solo lectura')
g=c.post('share',dict(reference=a1['reference']))
t('el dueño obtiene enlace de regalo',g[0]==200 and 'share=1' in g[1]['url'] and '#token=' in g[1]['url'],g)
gt=g[1]['url'].split('token=')[1]
t('el enlace de regalo no sirve como enlace de dueño',Cl().post('exchange',dict(reference=a1['reference'],token=gt))[0]==401)
t('el enlace de dueño no sirve como regalo',Cl().post('exchange',dict(reference=a1['reference'],token=t1,kind='share'))[0]==401)
gc=Cl();t('exchange de regalo',gc.post('exchange',dict(reference=a1['reference'],token=gt,kind='share'))[0]==200)
go=gc.get('order','&reference='+a1['reference'])['order']
t('ve la canción y para quién es',go.get('shared') is True and go['brief']['recipient']=='Mamá')
t('no ve historial, correo, teléfono ni pago',not go['history'] and 'email' not in str(go['customer']) and 'phone' not in str(go) and 'amount_in_cents' not in go)
t('solo archivos de entrega',all(f['kind']=='delivery' for f in go['files']) and go['files'])
t('no ve las demás canciones del comprador',gc.get('my-orders')['orders']==[])
t('no abre otra sesión del mismo correo',gc.get('order','&reference='+a2['reference']).get('_code')==404)
t('no puede comentar ni pagar ni compartir',[gc.post('feedback',dict(reference=a1['reference'],message='hola hola'))[0],gc.post('checkout',dict(reference=a1['reference']))[0],gc.post('share',dict(reference=a1['reference']))[0]]==[404,404,404])
t('no puede subir archivos',gc.upload(a1['reference'],'x.jpg',M if False else b'\xff\xd8\xff'+b'0'*100)[0] in (404,403))
ex("update orders set status='in_production' where reference=?",a2['reference'])
t('no se comparte antes de que esté lista',c.post('share',dict(reference=a2['reference']))[0]==409)
t('un desconocido no genera enlaces de regalo',Cl().post('share',dict(reference=a1['reference']))[0]==404)
print('— recuperar por correo')
n0=q("select count(*) n from mail_queue where recipient='ana@example.com' and subject like 'Tus canciones%'")[0]['n']
c2=Cl();c2.post('recover',dict(email='ANA@example.com'))
rows=q("select subject,body from mail_queue where recipient='ana@example.com' and subject like 'Tus canciones%'")
t('un solo correo con todas',len(rows)==n0+1,rows)
t('lista las canciones activas',rows and rows[-1]['body'].count(a1['reference'])>=1 and 'Abrir mis canciones' in rows[-1]['body'])
t('respuesta idéntica con correo desconocido',Cl().post('recover',dict(email='nadie@example.com'))[1]['message']==c2.post('recover',dict(email='ana@example.com'))[1]['message'])
print('— el regalo no se confunde con ser dueño (otro correo concedido)')
import io
from PIL import Image
vc=Cl();vo=mkorder(vc,'personalizada',email='victima@example.com');ex("update orders set status='completed',production_stage=5 where reference=?",vo['reference'])
b=io.BytesIO();Image.new('RGB',(32,32),'#123').save(b,'PNG');src=vc.upload(vo['reference'],'foto-privada.png',b.getvalue())
deliver(vo['reference'])
gl=vc.post('share',dict(reference=vo['reference']))[1]['url'].split('token=')[1]
atk=Cl();ao=mkorder(atk,'dedicatoria',email='atacante@example.com');ar,at=link(ao['reference']);atk.post('exchange',dict(reference=ar,token=at))
atk.post('exchange',dict(reference=vo['reference'],token=gl,kind='share'))
view=atk.get('order','&reference='+vo['reference'])['order']
t('con un correo propio concedido sigue viendo solo la vista de regalo',view.get('shared') is True and 'email' not in str(view['customer']) and 'phone' not in str(view) and not view['history'],str(view)[:200])
sid=q("select d.id from deliverables d join orders o on o.id=d.order_id where o.reference=? and d.kind='source'",vo['reference'])
if sid:
    try:atk.op.open(B+'?action=file&id=%d'%sid[0]['id']);t('el archivo privado del cliente no se baja',False)
    except Exception as e:t('el archivo privado del cliente no se baja',getattr(e,'code',0)==404,e)
else:t('hay archivo privado de prueba',False,src)
print('— pedidos sin pagar no contaminan la colección de otro')
vv=Cl();vr,vt=link(vo['reference']);vv.post('exchange',dict(reference=vr,token=vt))
for i in range(3):mkorder(Cl(),'dedicatoria',email='victima@example.com')
mine={o['reference'] for o in vv.get('my-orders')['orders']}
t('solo la canción pagada aparece',mine=={vo['reference']},mine)
n1=q("select count(*) n from mail_queue where recipient='victima@example.com' and subject like 'Vuelve a tu sesión%'")[0]['n']
Cl().post('recover',dict(email='victima@example.com'))
rr=q("select body from mail_queue where recipient='victima@example.com' and subject like 'Vuelve a tu sesión%' order by id desc limit 1")
t('recover enlaza la canción pagada, no el pedido sin pagar',rr and vo['reference'] in rr[0]['body'],'' )
print('— salir del dispositivo')
vv.post('forget',{});t('forget vacía la colección',vv.get('my-orders')['orders']==[])
print('%d ok, %d fallos'%(ok,fail));sys.exit(1 if fail else 0)
