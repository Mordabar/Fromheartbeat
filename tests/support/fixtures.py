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
import subprocess
try:
    import imageio_ffmpeg;FF=imageio_ffmpeg.get_ffmpeg_exe()
    def ff(*a):subprocess.run([FF,'-y','-v','error',*a],check=True)
    if not os.path.exists(T+'/t.wav'):ff('-f','lavfi','-i','sine=frequency=330:duration=3','-ac','2',T+'/t.wav')
    if not os.path.exists(T+'/t.mp3'):ff('-i',T+'/t.wav','-b:a','128k',T+'/t.mp3')
    if not os.path.exists(T+'/t.mp4'):ff('-f','lavfi','-i','testsrc=size=320x240:rate=15:duration=2','-i',T+'/t.wav','-shortest','-c:v','mpeg4','-c:a','aac',T+'/t.mp4')
    if not os.path.exists(T+'/big.webm'):ff('-f','lavfi','-i','testsrc2=size=1920x1080:rate=30:duration=6','-f','lavfi','-i','sine=frequency=440:duration=6','-c:v','libvpx-vp9','-b:v','18M','-deadline','realtime','-cpu-used','8','-c:a','libopus',T+'/big.webm')
except Exception as e:print('sin ffmpeg:',e)
