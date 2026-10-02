"""Pruebas funcionales del cargador de archivos contra el servidor de pruebas (tests/support/serve.sh).
Uso:  bash tests/support/serve.sh && python3 tests/files.py"""
import os,sys,subprocess,wave,struct,math,io,json,hashlib,glob
sys.path.insert(0,os.path.join(os.path.dirname(__file__),'support'))
from drv import *
from PIL import Image
FF=None
try:
    import imageio_ffmpeg;FF=imageio_ffmpeg.get_ffmpeg_exe()
except Exception:pass
T=os.path.join(W,'media');os.makedirs(T,exist_ok=True)
def media():
    m={}
    b=io.BytesIO();Image.effect_noise((320,240),60).convert('RGB').save(b,'JPEG');m['jpg']=b.getvalue()
    b=io.BytesIO();Image.new('RGB',(64,64),'#c24').save(b,'PNG');m['png']=b.getvalue()
    b=io.BytesIO();Image.new('RGB',(64,64),'#2c4').save(b,'WEBP');m['webp']=b.getvalue()
    p=T+'/t.wav'
    with wave.open(p,'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(44100);w.writeframes(b''.join(struct.pack('<hh',int(8000*math.sin(i/20)),int(8000*math.sin(i/21))) for i in range(44100)))
    m['wav']=open(p,'rb').read()
    if FF:
        for name,args in {'mp3':['-i',p,'-b:a','128k','t.mp3'],'m4a':['-i',p,'-c:a','aac','t.m4a'],'mp4':['-f','lavfi','-i','testsrc=size=320x240:rate=15:duration=2','-i',p,'-shortest','-c:v','mpeg4','-c:a','aac','t.mp4'],'mov':['-f','lavfi','-i','testsrc=size=160x120:rate=10:duration=1','-c:v','mpeg4','t.mov'],'webm':['-f','lavfi','-i','testsrc=size=160x120:rate=10:duration=1','-c:v','libvpx','t.webm'],'flac':['-i',p,'t.flac'],'ogg':['-i',p,'-c:a','libvorbis','t.ogg'],'aac':['-i',p,'-c:a','aac','-f','adts','t.aac']}.items():
            if not os.path.exists(T+'/t.'+name):subprocess.run([FF,'-y','-v','error']+args,cwd=T,check=False)
            if os.path.exists(T+'/t.'+name):m[name]=open(T+'/t.'+name,'rb').read()
    m['pdf']=b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n';m['txt']='Letra: «ñandú»\n'.encode();m['zip']=b'PK\x03\x04'+b'\0'*40
    return m
M=media();ok=fail=0
def t(name,cond,extra=''):
    global ok,fail
    if cond:ok+=1;print('  ok  ',name)
    else:fail+=1;print('  FAIL',name,extra)
def paid(ref,status='in_production',stage=2):
    ex("update orders set status=?,production_stage=? where reference=?",status,stage,ref)

print('== cliente: formatos y reglas')
c=Cl();o=mkorder(c,'full');ref=o['reference']
code,r=c.upload(ref,'a.jpg',M['jpg']);t('antes del pago se rechaza',code==403,(code,r))
paid(ref)
for ext in ['jpg','png','webp','mp4','mov','webm','m4a','mp3','wav','flac','ogg','aac','pdf','txt']:
    if ext not in M:print('  skip',ext);continue
    code,r=c.upload(ref,'mi archivo.'+ext,M[ext],chunk=60000)
    t('acepta '+ext,code==201 and r['file']['mime'].split('/')[0] in('image','video','audio','application','text'),(code,r))
code,r=c.upload(ref,'plan.zip',M['zip']);t('cliente no envía zip',code==415,(code,r))
code,r=c.upload(ref,'virus.jpg',b'MZ\x90\x00'+b'\0'*200);t('extensión falsa se rechaza por contenido',code==415,(code,r))
code,r=c.upload(ref,'vacio.jpg',b'');t('vacío',code in(422,400),(code,r))
code,r=c.upload(ref,'../../x.png',M['png']);t('nombre con ruta se sanea',code==201 and '/' not in r['file']['original_name'],(code,r))
code,r=c.upload(ref,'foto.jpg',M['mp4'] if 'mp4' in M else M['png']);t('contenido manda sobre la extensión',code==201 and r['file']['mime'].split('/')[0]!='image' or 'mp4' not in M,(code,r))
files=c.get('order','&reference='+ref)['order']['files'];t('lista de archivos del pedido',len(files)>=10,len(files))
t('en disco con nombre aleatorio',all(os.path.exists(W+'/storage/'+d['storage_name']) for d in q('select storage_name from deliverables')))
t('el cliente no puede marcar «entrega»',all(f['kind']=='source' for f in files if f['original_name'].startswith('mi')))
code,r=c.post('upload-init',dict(reference=ref,name='x.jpg',size=len(M['jpg']),kind='delivery'));
code2,r2=c.raw('upload-chunk',M['jpg'],'&id=%s&offset=0'%r['id']);code3,r3=c.post('upload-finish',dict(id=r['id']))
t('kind=delivery del cliente se fuerza a source',code3==201 and r3['file']['kind']=='source',(code3,r3))

print('== reanudación y robustez')
data=M['wav'];code,r=c.post('upload-init',dict(reference=ref,name='r.wav',size=len(data)));i=r['id']
a=c.raw('upload-chunk',data[:50000],'&id=%s&offset=0'%i);b=c.raw('upload-chunk',data[:50000],'&id=%s&offset=0'%i)
t('repetir un fragmento es idempotente',a[1]['received']==50000 and b[1]['received']==50000,(a,b))
s=c.get('upload-status','&id='+i);t('status devuelve lo recibido',s['received']==50000,s)
code,r2=c.raw('upload-chunk',data[60000:70000],'&id=%s&offset=60000'%i);t('hueco = 409',code==409,(code,r2))
code,r2=c.post('upload-finish',dict(id=i));t('finish incompleto = 409 y conserva lo subido',code==409 and c.get('upload-status','&id='+i)['received']==50000,(code,r2))
c.raw('upload-chunk',data[50000:],'&id=%s&offset=50000'%i);code,r2=c.post('upload-finish',dict(id=i))
t('reanudar y terminar',code==201 and hashlib.sha256(open(W+'/storage/'+q('select storage_name from deliverables order by id desc limit 1')[0]['storage_name'],'rb').read()).hexdigest()==hashlib.sha256(data).hexdigest(),(code,r2))
code,r2=c.raw('upload-chunk',b'x',  '&id=%s&offset=0'%i);t('id ya terminado no existe',code==404,(code,r2))
r2=c.get('upload-status','&id=../../etc/passwd');t('id con ruta es inválido',r2.get('_code')==404,r2)
code,r=c.post('upload-init',dict(reference=ref,name='g.jpg',size=10));code2,r2=c.raw('upload-chunk',b'x'*11,'&id=%s&offset=0'%r['id']);t('fragmento mayor al anunciado',code2==422,(code2,r2))
code,r=c.post('upload-init',dict(reference=ref,name='g.jpg',size=1<<40));t('archivo gigante rechazado',code==413,(code,r))
other=Cl();code,r=other.post('upload-init',dict(reference=ref,name='x.jpg',size=10));t('otra persona no puede subir a mi sesión',code in(403,404),(code,r))
code,r=c.post('upload-init',dict(reference=ref,name='y.jpg',size=10));i2=r['id'];code,r=other.raw('upload-chunk',b'x'*10,'&id=%s&offset=0'%i2);t('ni usar mi subida',code in(403,404),(code,r))
c.post('upload-cancel',dict(id=i2));t('cancelar borra la parte',not glob.glob(W+'/storage/incoming/%s*'%i2))
c2=Cl();code,r=c2.raw('upload-chunk',b'x','&id=%s&offset=0'%i2);
bad=Cl();bad.csrf='no';code,r=bad.raw('upload-chunk',b'x','&id=%s&offset=0'%i2);t('sin CSRF = 403',code==403,(code,r))

print('== límites por sesión')
ex("update orders set status='created' where reference=?",ref);code,r=c.upload(ref,'a.jpg',M['jpg']);t('pedido sin pagar no sube',code==403)
paid(ref);n=q('select count(*) n from deliverables')[0]['n']
code,r=c.upload(ref,'a.jpg',M['jpg']);t('subida normal tras volver a pagado',code==201)
code,r=c.post('upload-done',dict(reference=ref));t('upload-done avisa al equipo',code==200 and r['count']>=1 and any(m['dedupe_key'].startswith('files:'+ref) for m in q('select dedupe_key from mail_queue')),(code,r))
code,r=c.post('upload-done',dict(reference=ref));t('no duplica el aviso en 15 min',len([m for m in q('select dedupe_key from mail_queue') if m['dedupe_key'].startswith('files:')])==1)
t('marca la sesión para atención',q('select requires_attention a from orders where reference=?',ref)[0]['a']==1)
tm=[m for m in q("select body from mail_queue where dedupe_key like 'files:%'")][0]['body'];t('el aviso al equipo es HTML con marca',tm.startswith('<!--fhb:html-->') and 'archivo' in tm)

print('== retirar archivos')
fid=q("select id from deliverables where kind='source' order by id desc limit 1")[0]['id']
code,r=c.post('file-delete',dict(id=fid));t('el cliente retira lo suyo',code==200)
a=admin();ex("insert into deliverables(order_id,storage_name,original_name,mime,size_bytes,kind) select id,'zz.mp3','x.mp3','audio/mpeg',1,'delivery' from orders where reference=?",ref)
did=q("select id from deliverables where kind='delivery' order by id desc limit 1")[0]['id'];code,r=c.post('file-delete',dict(id=did));t('el cliente NO retira entregas',code==403,(code,r))
code,r=other.post('file-delete',dict(id=fid));t('un extraño no retira nada',code in(403,404))

print('== administrador')
code,r=a.upload(ref,'master.wav',M['wav'],kind='delivery');t('admin sube WAV como entrega',code==201 and r['file']['kind']=='delivery' and r['file']['mime']=='audio/wav',(code,r))
for ext in ['mp3','mp4','jpg','zip']:
    if ext in M:code,r=a.upload(ref,'x.'+ext,M[ext],kind='delivery');t('admin sube '+ext,code==201,(code,r))
code,r=a.upload(ref,'x.jpg',M['jpg'],kind='nada');t('kind inválido',code in(400,422),(code,r))
code,r=a.post('file-delete',dict(id=did));t('admin retira una entrega',code==200)
ex("update orders set status='completed' where reference=?",ref);did2=q("select id from deliverables where kind='delivery' order by id desc limit 1")[0]['id']
code,r=a.post('file-delete',dict(id=did2));t('no retira entregas de una sesión completada',code==409,(code,r))
ex("update orders set status='in_production' where reference=?",ref)

print('== flujo de entrega por estados')
c3=Cl();o3=mkorder(c3,'full',email='bea@example.com');r3=o3['reference'];paid(r3,'in_production',5)
for ext,k in [('mp3','delivery'),('wav','delivery'),('jpg','delivery'),('mp4','delivery')]:
    if ext in M:a.upload(r3,'e.'+ext,M[ext],kind=k)
ex("delete from mail_queue")
code,r=a.post('admin-update',dict(reference=r3,status='completed',stage=5,note='Tu canción está lista.',notify=True,visible=True))
t('in_production→completed ya es posible',code==200,(code,r))
mq=q("select recipient,subject from mail_queue order by id");t('sale el correo de entrega al cliente y el aviso al equipo',len(mq)==2 and any('lista' in m['subject'].lower() for m in mq),mq)
c4=Cl();o4=mkorder(c4,'full',email='cy@example.com');r4=o4['reference'];paid(r4,'in_production',4);ex("delete from mail_queue")
code,r=a.post('admin-update',dict(reference=r4,status='completed',stage=5,note='x entrega',notify=True,visible=True));t('sin archivos no se puede completar',code==422,(code,r))
code,r=a.post('admin-update',dict(reference=r4,status='in_production',stage=5,note='Preparando la entrega',notify=True,visible=True))
mq=q("select subject from mail_queue order by id");t('etapa 5: asunto propio sin punto final',code==200 and any(m['subject'].startswith('Preparando tu entrega ·') for m in mq),mq)
print('\n%d bien, %d mal'%(ok,fail));sys.exit(1 if fail else 0)
