"""Cliente de pruebas contra tests/support/serve.sh (SOLO PRUEBAS)."""
import json,urllib.request,urllib.error,http.cookiejar,sqlite3,uuid,os
W=os.environ.get('FHB_WORK','/tmp/fhb-harness');DB=W+'/test.sqlite';PORT=os.environ.get('PORT','8199');B='http://127.0.0.1:%s/api.php'%PORT
class Cl:
    def __init__(s):
        s.cj=http.cookiejar.CookieJar();s.op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(s.cj));s.csrf=None;s.boot=s.get('bootstrap')
    def get(s,a,q=''):
        try:r=s.op.open(B+'?action='+a+q)
        except urllib.error.HTTPError as e:return json.loads(e.read() or b'{}')|{'_code':e.code}
        j=json.loads(r.read())
        if 'csrf' in j:s.csrf=j['csrf']
        return j
    def post(s,a,d,q=''):
        req=urllib.request.Request(B+'?action='+a+q,data=json.dumps(d).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':s.csrf or ''})
        return s._go(req)
    def raw(s,a,data,q='',ctype='application/octet-stream'):
        req=urllib.request.Request(B+'?action='+a+q,data=data,headers={'Content-Type':ctype,'X-CSRF-Token':s.csrf or ''})
        return s._go(req)
    def _go(s,req):
        try:
            r=s.op.open(req);return r.status,json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            return e.code,json.loads(e.read() or b'{}')
    def upload(s,ref,name,data,kind=None,chunk=1<<20,fail_after=None):
        """Sube por partes como el navegador. Devuelve (código, respuesta)."""
        d=dict(reference=ref,name=name,size=len(data))
        if kind:d['kind']=kind
        c,r=s.post('upload-init',d)
        if c!=201:return c,r
        i,off=r['id'],0
        while off<len(data):
            c,r2=s.raw('upload-chunk',data[off:off+chunk],'&id=%s&offset=%d'%(i,off))
            if c!=200:return c,r2
            off=r2['received']
        return s.post('upload-finish',dict(id=i))
def q(sql,*a):
    c=sqlite3.connect(DB);c.row_factory=sqlite3.Row;r=[dict(x) for x in c.execute(sql,a).fetchall()];c.commit();c.close();return r
def ex(sql,*a):
    c=sqlite3.connect(DB);c.execute(sql,a);c.commit();c.close()
def admin():
    cl=Cl();assert cl.post('login',dict(email='admin@x.co',password='pw12345678'))[0]==200;cl.get('bootstrap');return cl
def brief(**o):
    b=dict(genre='Pop',mood='Romántica',voice='Femenina',recipient='Mamá',occasion='Cumpleaños',story='x'*40,language='Español',tempo='A tu criterio',details='');b.update(o);return b
def mkorder(cl,product='full',name='Ana Pérez',email='ana@example.com'):
    bb=brief()
    if product in('jingle','campaign'):bb.update(brand='Marca',campaign='Camp',channels='TV',license_scope='Un año')
    c,r=cl.post('orders',dict(product=product,consent=True,name=name,email=email,phone='3001234567',brief=bb,idempotency_key=uuid.uuid4().hex+uuid.uuid4().hex))
    assert c==201,r;return r['order']
def customer_for(ref):
    """Cliente con sesión sobre una orden (misma cookie que la creó)."""
    return None
