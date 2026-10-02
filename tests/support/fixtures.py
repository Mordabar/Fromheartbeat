"""Genera archivos de prueba en $FHB_WORK/media (fotos pesadas, WAV, PDF)."""
import os,io,wave,struct,math
from PIL import Image
T=os.path.join(os.environ.get('FHB_WORK','/tmp/fhb-harness'),'media');os.makedirs(T,exist_ok=True)
im=Image.effect_noise((3000,2000),70).convert('RGB');im.save(T+'/foto-pesada.jpg','JPEG',quality=92)
Image.effect_noise((1200,900),40).convert('RGB').save(T+'/captura.png')
with wave.open(T+'/voz.wav','wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(44100)
    w.writeframes(b''.join(struct.pack('<hh',int(9000*math.sin(i/18)*math.sin(i/9000)),int(9000*math.sin(i/19))) for i in range(44100*20)))
open(T+'/letra.pdf','wb').write(b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
print(sorted((f,os.path.getsize(T+'/'+f)) for f in os.listdir(T)))
