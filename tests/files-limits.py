"""Cupos, concurrencia y extensión forzada. Levanta su propio servidor (puerto 8198) con límites bajos.  python3 tests/files-limits.py"""
import os,sys,subprocess,threading,io
os.environ.update(WORKERS='8',PORT='8198',FHB_WORK='/tmp/fhb-limits',FHB_EXTRA_ENV='UPLOAD_MAX_FILES=3')
here=os.path.dirname(os.path.abspath(__file__))
subprocess.run(['bash',here+'/support/serve.sh'],check=True,stdout=subprocess.DEVNULL)
sys.path.insert(0,here+'/support')
from drv import *
from PIL import Image
b=io.BytesIO();Image.new('RGB',(40,40),'#c24').save(b,'JPEG');JPG=b.getvalue()
ok=fail=0
def t(n,c,x=''):
    global ok,fail
    if c:ok+=1;print('  ok  ',n)
    else:fail+=1;print('  FAIL',n,x)
c=Cl();o=mkorder(c,'full');ref=o['reference'];ex("update orders set status='in_production' where reference=?",ref);a=admin()
print('== cupo por tipo (H1)')
for i in range(3):c.upload(ref,'f%d.jpg'%i,JPG)
code,r=c.upload(ref,'f4.jpg',JPG);t('el cliente agota su cupo',code==409,(code,r))
code,r=a.upload(ref,'master.wav',open('/tmp/fhb-harness/media/t.wav','rb').read() if os.path.exists('/tmp/fhb-harness/media/t.wav') else b'RIFF\x24\0\0\0WAVEfmt \x10\0\0\0\x01\0\x01\0\x40\x1f\0\0\x80\x3e\0\0\x02\0\x10\0data\0\0\0\0',kind='delivery')
t('...y el estudio puede entregar igual',code==201,(code,r))
print('== extensión forzada por contenido (H2)')
for k,name in enumerate(['run.bat','x.html','a.hta','sin-extension','foto.JPEG']):
    a2=Cl();o2=mkorder(a2,'full',email='z%d@example.com'%k);r2=o2['reference'];ex("update orders set status='in_production' where reference=?",r2)
    code,r=a2.upload(r2,name,JPG);n=r['file']['original_name'] if code==201 else ''
    t('«%s» → «%s»'%(name,n),code==201 and n.lower().endswith(('.jpg','.jpeg')) and not n.lower().endswith(('.bat','.html','.hta')),(code,r))
print('== concurrencia sobre el cupo (M2)')
a2=Cl();o2=mkorder(a2,'full',email='conc@example.com');r2=o2['reference'];ex("update orders set status='in_production' where reference=?",r2)
res=[]
def go(i):
    cl=Cl();cl.cj=a2.cj;cl.op=a2.op;cl.csrf=a2.csrf
    res.append(cl.post('upload-init',dict(reference=r2,name='c%d.jpg'%i,size=len(JPG)))[0])
for rnd in range(6):
    ex("delete from deliverables where order_id=(select id from orders where reference=?)",r2)
    for f in os.listdir(W+'/storage/incoming'):os.remove(W+'/storage/incoming/'+f) if f.endswith(('.json','.part')) else None
    res.clear();ts=[threading.Thread(target=go,args=(i,)) for i in range(10)];[x.start() for x in ts];[x.join() for x in ts]
    if res.count(201)!=3:break
t('nunca más de 3 reservas con 10 inits a la vez (6 rondas)',res.count(201)==3,res)
print('== formato rechazado en el primer fragmento (M4)')
c5=Cl();o5=mkorder(c5,'full',email='y@example.com');r5=o5['reference'];ex("update orders set status='in_production' where reference=?",r5)
code,r=c5.post('upload-init',dict(reference=r5,name='x.jpg',size=50_000_000));i=r['id']
code,r=c5.raw('upload-chunk',b'MZ\x90\x00'+b'\0'*2000,'&id=%s&offset=0'%i);t('415 con el primer fragmento',code==415,(code,r))
t('y la reserva se libera',not os.path.exists(W+'/storage/incoming/%s.json'%i))
print('== texto: carácter partido en el byte 8192 (M3)')
txt=('a'*8191+'ñ'+' fin').encode();code,r=c5.upload(r5,'letra.txt',txt);t('.txt con ñ en el límite',code==201,(code,r))
code,r=c5.upload(r5,'u16.txt','hola'.encode('utf-16'));t('.txt UTF-16 no se confunde con MP3',code!=201 or r['file']['mime']!='audio/mpeg',(code,r))
code,r=c5.upload(r5,'u16le.txt','Úrsula Øster ß'.encode('utf-16'));t('.txt UTF-16LE con Ú/Ø/ß queda como texto',code==201 and r['file']['mime']=='text/plain',(code,r))
print('== aviso al equipo desde el servidor y caché de imágenes')
c6=Cl();o6=mkorder(c6,'full',email='w@example.com');r6=o6['reference'];ex("update orders set status='in_production' where reference=?",r6);ex("delete from mail_queue")
code,r=c6.upload(r6,'a.jpg',JPG);t('el aviso sale al terminar el archivo, sin upload-done',any(m['dedupe_key'].startswith('files:'+r6) for m in q('select dedupe_key from mail_queue')))
import urllib.request
rq=c6.op.open(B+'?action=file&id=%d'%r['file']['id']);t('las imágenes se pueden cachear (private, 1 h)','max-age=3600' in rq.headers.get('Cache-Control',''),rq.headers.get('Cache-Control'))
print('== cancelar libera la reserva y el cupo')
code,r=c6.post('upload-init',dict(reference=r6,name='b.jpg',size=100));c6.post('upload-cancel',dict(id=r['id']))
code,r=c6.raw('upload-chunk',b'x'*100,'&id=%s&offset=0'%r['id']);t('un fragmento tardío tras cancelar da 404',code==404,(code,r))
print('== cierre idempotente')
code,r=c6.post('upload-init',dict(reference=r6,name='idem.jpg',size=len(JPG)));i=r['id'];c6.raw('upload-chunk',JPG,'&id=%s&offset=0'%i)
c1,f1=c6.post('upload-finish',dict(id=i));c2,f2=c6.post('upload-finish',dict(id=i))
t('repetir el cierre devuelve el mismo archivo',c1==201 and c2==200 and f1['file']['id']==f2['file']['id'],(c1,c2))
t('y no duplica filas',len([x for x in q("select id from deliverables where original_name='idem.jpg'")])==1)
other=Cl();code,r=other.post('upload-finish',dict(id=i));t('otra persona no puede reclamar el cierre',code in(403,404),(code,r))
print('\n%d bien, %d mal'%(ok,fail));sys.exit(1 if fail else 0)
