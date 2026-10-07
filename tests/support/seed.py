"""Crea una sesión pagada y escribe {ref,link} en JSON.
Uso: python3 tests/support/seed.py [producto] [estado] [rich]
  rich = archivos de entrega (MP3, WAV, portada), material del cliente y una conversación."""
import sys,os,json
sys.path.insert(0,os.path.dirname(__file__))
from drv import *
prod=sys.argv[1] if len(sys.argv)>1 else 'full';status=sys.argv[2] if len(sys.argv)>2 else 'in_production';rich='rich' in sys.argv[3:]
c=Cl();o=mkorder(c,prod);ref=o['reference'];ex("update orders set status=?,production_stage=2 where reference=?",status,ref)
a=admin()
if rich:
    M=os.path.join(W,'media')
    rd=lambda n:open(os.path.join(M,n),'rb').read()
    ex("update orders set status='in_production',production_stage=3 where reference=?",ref)
    c.upload(ref,'foto-1.jpg',rd('foto-pesada.jpg')[:200000] if False else rd('captura.png'));c.upload(ref,'clip-fiesta.mp4',rd('t.mp4'))
    a.post('admin-update',dict(reference=ref,status='in_production',stage=3,note='¡Hola! Ya grabamos la voz principal. ¿Cómo se pronuncia el nombre de tu mamá?',visible=True,notify=False))
    c.post('feedback',dict(reference=ref,message='Se pronuncia Luz Marina, con énfasis en la ú. ¡Gracias!'))
    a.post('admin-update',dict(reference=ref,status='in_production',stage=3,note='Perfecto, lo tenemos. Ahora vamos con arreglos y mezcla.',visible=True,notify=False))
    for n,k in [('cancion.mp3','t.mp3'),('master.wav','t.wav'),('portada.png','captura.png'),('video-vertical.mp4','t.mp4')]:
        a.upload(ref,n,rd(k),kind='delivery')
    ex("update orders set status=?,production_stage=? where reference=?",status,{'review':5,'completed':5}.get(status,3),ref)
d=a.get('admin-order','&reference='+ref)['order']
print(json.dumps({'ref':ref,'link':d['testLink'].replace('http://127.0.0.1:%s'%PORT,'')}))
