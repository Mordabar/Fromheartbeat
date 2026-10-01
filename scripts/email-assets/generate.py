#!/usr/bin/env python3
"""Generates the v1 email imagery into assets/email/ (logo, footer icon, one hero per journey state).

Heroes are procedural: a glowing vinyl, sound waves and one white glyph per state, in the brand violet->pink palette.
They are placeholders that already look finished; docs/EMAIL-IMAGENES-PROMPTS.md has the prompts to replace them
with illustrated versions (keep the same file names and 1200x480 size, nothing in the code changes).

    pip install pillow numpy && python3 scripts/email-assets/generate.py
"""
import math
import random
import zlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'email'
OUT.mkdir(parents=True, exist_ok=True)
LOGO_SRC = Image.open(ROOT / 'assets' / 'images' / 'icono-logo-png-fromheartbeat.png').convert('RGBA')
MANROPE = str(ROOT / 'assets' / 'fonts' / 'Manrope.ttf')
W, H = 1200, 480

PALETTES = {  # glow A, glow B, rim colour, intensity
    'violet': ((123, 60, 255), (255, 79, 216), (198, 162, 255), 1.0),
    'warm': ((255, 79, 216), (123, 60, 255), (255, 150, 230), 0.9),
    'dim': ((92, 84, 128), (60, 52, 96), (150, 142, 180), 0.55),
    'bright': ((150, 90, 255), (255, 110, 225), (225, 200, 255), 1.25),
}


def background(pal):
    a, b, _, k = PALETTES[pal]
    X, Y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    t = (Y / H)[..., None]
    img = np.array([14, 6, 32], np.float32) * (1 - t) + np.array([7, 4, 15], np.float32) * t

    def glow(cx, cy, sx, sy, col, s):
        g = np.exp(-(((X - cx) ** 2) / (2 * sx * sx) + ((Y - cy) ** 2) / (2 * sy * sy)))[..., None]
        return g * np.array(col, np.float32) * s

    img = img + glow(W * .5, H * .5, 330, 200, a, .55 * k) + glow(W * .12, H * .95, 260, 150, b, .30 * k) + glow(W * .9, H * .1, 240, 140, b, .22 * k)
    return img


def waves(img, pal):
    """Three sound-wave lines that fade out toward the edges; drawn at 2x and downsampled for smooth strokes."""
    _, _, rim, k = PALETTES[pal]
    S = 2
    layer = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rnd = random.Random(7)
    for i, (amp, freq, ph, alpha) in enumerate([(104, 0.011, 0.3, 235), (68, 0.017, 1.7, 160), (40, 0.026, 3.1, 110)]):
        pts = []
        for x in range(0, W * S, 3):
            xn = x / (W * S)
            env = math.exp(-(((xn - .5) / .40) ** 2))
            y = H * S / 2 + math.sin(x / S * freq * 2 * math.pi / 3 + ph) * amp * S * env * (0.6 + 0.4 * math.sin(x / S * .02 + i))
            pts.append((x, y))
        # colour sweep violet -> pink along x
        for j in range(len(pts) - 1):
            xn = pts[j][0] / (W * S)
            r = int(150 + 105 * xn); g = int(100 - 20 * xn); bl = int(255 - 40 * xn)
            d.line([pts[j], pts[j + 1]], fill=(r, g, bl, int(alpha * min(1, k) * max(0.0, 1 - abs(xn - .5) * 1.8))), width=2 * S + 1)
    layer = layer.resize((W, H), Image.LANCZOS)
    base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert('RGBA')
    base.alpha_composite(layer)
    return np.asarray(base.convert('RGB'), np.float32)


def vinyl(img, pal, cx=W / 2, cy=H / 2, R=212, label_r=80):
    _, _, rim, k = PALETTES[pal]
    X, Y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    dx, dy = X - cx, Y - cy
    r = np.sqrt(dx * dx + dy * dy)
    th = np.arctan2(dy, dx)
    # soft halo rings around the disc
    for rr, al in [(R + 26, .20), (R + 58, .12), (R + 100, .07)]:
        ring = np.exp(-((r - rr) ** 2) / (2 * 1.6 ** 2))[..., None] * np.array(rim, np.float32) * al * k
        img = img + ring
    edge = np.clip((R - r) / 1.6 + .5, 0, 1)  # antialiased disc mask
    grooves = .5 + .5 * np.sin(r * 1.9)
    grooves *= np.clip((r - label_r - 6) / 8, 0, 1)
    base = np.array([13, 9, 24], np.float32)[None, None, :] + (grooves[..., None] * np.array([7, 5, 12], np.float32))
    sheen = (np.cos(2 * (th - .65)) ** 10) * np.clip((r - label_r) / 40, 0, 1) * np.clip(1.05 - r / R, 0, 1)
    base = base + sheen[..., None] * np.array([70, 40, 120], np.float32) * k
    sheen2 = (np.cos(2 * (th - 2.2)) ** 18) * np.clip((r - label_r) / 40, 0, 1)
    base = base + sheen2[..., None] * np.array([40, 20, 70], np.float32) * k
    rimline = np.exp(-((r - (R - 1)) ** 2) / (2 * 1.3 ** 2))[..., None] * np.array(rim, np.float32) * .55
    out = img * (1 - edge[..., None]) + base * edge[..., None] + rimline
    return out, (cx, cy, label_r)


def glyph_layer(name, size, color=(255, 255, 255)):
    """White glyph on transparent square (size px), drawn at 4x then reduced."""
    S = 4
    n = size * S
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    u = n * .30  # unit: glyph occupies about +-1u
    c = n / 2
    col = color + (255,)

    def P(x, y):
        return (c + x * u, c + y * u)

    def line(pts, w):
        d.line([P(*p) for p in pts], fill=col, width=int(w * u), joint='curve')
        for p in (pts[0], pts[-1]):
            x, y = P(*p); r = w * u / 2
            d.ellipse([x - r, y - r, x + r, y + r], fill=col)

    def rrect(x0, y0, x1, y1, r, fill=True, w=.14):
        a, b = P(x0, y0), P(x1, y1)
        if fill:
            d.rounded_rectangle([a, b], radius=r * u, fill=col)
        else:
            d.rounded_rectangle([a, b], radius=r * u, outline=col, width=int(w * u))

    def disc(x, y, r):
        a = P(x, y); d.ellipse([a[0] - r * u, a[1] - r * u, a[0] + r * u, a[1] + r * u], fill=col)

    if name == 'note':  # the real logo, recoloured white
        a = LOGO_SRC.split()[3]
        bbox = a.getbbox(); a = a.crop(bbox)
        k = (n * .70) / max(a.size)
        a = a.resize((int(a.width * k), int(a.height * k)), Image.LANCZOS)
        white = Image.new('RGBA', a.size, color + (255,)); white.putalpha(a)
        im.alpha_composite(white, ((n - a.width) // 2, (n - a.height) // 2))
    elif name == 'check':
        line([(-.62, .05), (-.15, .52), (.68, -.5)], .30)
    elif name == 'bars':
        for i, h in enumerate([.45, .9, 1.25, .75, .5]):
            x = -.84 + i * .42
            rrect(x - .13, -h / 2 - .02, x + .13, h / 2 - .02, .13)
    elif name == 'headphones':
        d.arc([*P(-.85, -.95), *P(.85, .75)], 180, 360, fill=col, width=int(.2 * u))
        rrect(-1.02, -.05, -.58, .78, .2); rrect(.58, -.05, 1.02, .78, .2)
    elif name == 'play':
        d.polygon([P(-.38, -.7), P(.78, 0), P(-.38, .7)], fill=col)
        for (x, y, s) in [(.9, -.78, .2), (-.85, .72, .14)]:
            line([(x - s, y), (x + s, y)], .07); line([(x, y - s), (x, y + s)], .07)
    elif name == 'cross':
        line([(-.55, -.55), (.55, .55)], .24); line([(.55, -.55), (-.55, .55)], .24)
    elif name == 'alert':
        rrect(-.13, -.8, .13, .22, .13); disc(0, .62, .16)
    elif name == 'doc':
        rrect(-.6, -.82, .6, .82, .14, fill=False, w=.13)
        for i, wd in enumerate([.34, .34, .2]):
            line([(-wd, -.38 + i * .36), (wd, -.38 + i * .36)], .11)
    elif name == 'chat':
        rrect(-.82, -.62, .82, .42, .26)
        d.polygon([P(-.3, .38), P(-.5, .86), P(.1, .4)], fill=col)
        for x in (-.34, 0, .34):
            a = P(x, -.1)
            d.ellipse([a[0] - .09 * u, a[1] - .09 * u, a[0] + .09 * u, a[1] + .09 * u], fill=(139, 77, 255, 255))
    elif name == 'lock':
        d.arc([*P(-.42, -.95), *P(.42, .1)], 180, 360, fill=col, width=int(.16 * u))
        line([(-.42, -.42), (-.42, -.05)], .16); line([(.42, -.42), (.42, -.05)], .16)
        rrect(-.62, -.1, .62, .78, .18)
        a = P(0, .3); d.ellipse([a[0] - .1 * u, a[1] - .1 * u, a[0] + .1 * u, a[1] + .1 * u], fill=(139, 77, 255, 255))
    elif name == 'lines':  # lyrics
        for i, wd in enumerate([.8, .6, .85, .45]):
            line([(-wd, -.66 + i * .44), (wd, -.66 + i * .44)], .15)
    elif name == 'mic':
        rrect(-.3, -.88, .3, .1, .3)
        d.arc([*P(-.6, -.45), *P(.6, .62)], 0, 180, fill=col, width=int(.13 * u))
        line([(0, .62), (0, .9)], .13); line([(-.34, .92), (.34, .92)], .13)
    elif name == 'sliders':
        for x, ky in [(-.55, -.25), (0, .3), (.55, -.05)]:
            line([(x, -.85), (x, .85)], .1)
            rrect(x - .2, ky - .13, x + .2, ky + .13, .08)
    return im.resize((size, size), Image.LANCZOS)


def label(img, glyph, cx, cy, r, pal):
    """Violet->pink gradient label with a glow and a white glyph."""
    a, b, rim, k = PALETTES[pal]
    S = 2
    n = int(r * 2 * S)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    t = ((xx + yy) / (2 * n))[..., None]
    c1 = np.array([139, 77, 255], np.float32); c2 = np.array([255, 79, 216], np.float32)
    if pal == 'dim':
        c1 = np.array([96, 88, 130], np.float32); c2 = np.array([70, 62, 104], np.float32)
    col = c1 * (1 - t) + c2 * t
    rr = np.sqrt((xx - n / 2) ** 2 + (yy - n / 2) ** 2)
    col = col + np.clip(1 - rr / (n / 2), 0, 1)[..., None] * 38  # inner highlight
    mask = np.clip((n / 2 - rr) / 1.8 + .5, 0, 1)
    lab = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).convert('RGBA')
    lab.putalpha(Image.fromarray((mask * 255).astype(np.uint8)))
    lab = lab.resize((int(r * 2), int(r * 2)), Image.LANCZOS)
    # glow behind the label
    gl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    gd.ellipse([cx - r - 6, cy - r - 6, cx + r + 6, cy + r + 6], fill=a + (int(150 * min(1, k)),))
    gl = gl.filter(ImageFilter.GaussianBlur(34))
    base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert('RGBA')
    base.alpha_composite(gl)
    base.alpha_composite(lab, (int(cx - r), int(cy - r)))
    g = glyph_layer(glyph, int(r * 1.62))
    base.alpha_composite(g, (int(cx - g.width / 2), int(cy - g.height / 2)))
    return np.asarray(base.convert('RGB'), np.float32)



def tonearm(img, mode, pal, cx=W / 2, cy=H / 2, R=212):
    """Turntable arm: 'play' needle in the groove, 'lifted' hovering off the disc, 'rest' parked outside."""
    _, _, rim, _ = PALETTES[pal]
    S = 2
    layer = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    sh = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d, ds = ImageDraw.Draw(layer), ImageDraw.Draw(sh)
    P = (cx + 1.13 * R, cy - .78 * R)
    H_ = {'play': (cx + .50 * R, cy + .10 * R), 'lifted': (cx + .98 * R, cy + .46 * R), 'rest': (cx + 1.13 * R, cy + .30 * R)}[mode]
    mid = (P[0] - (P[0] - H_[0]) * .15, P[1] + (H_[1] - P[1]) * .55)  # slight elbow like an S-arm
    pts = [P, mid, H_]
    col = (222, 205, 255, 235) if pal != 'dim' else (170, 162, 195, 235)
    for dx, dy, dd, c, w in [(7, 10, ds, (0, 0, 0, 170), 9), (0, 0, d, col, 8)]:
        dd.line([((x + dx) * S, (y + dy) * S) for x, y in pts], fill=c, width=w * S, joint='curve')
        for x, y in (pts[0], pts[-1]):
            dd.ellipse([(x + dx - w * .5) * S, (y + dy - w * .5) * S, (x + dx + w * .5) * S, (y + dy + w * .5) * S], fill=c)
    # pivot base
    for r, c in [(22, (40, 26, 80, 255)), (13, col)]:
        d.ellipse([(P[0] - r) * S, (P[1] - r) * S, (P[0] + r) * S, (P[1] + r) * S], fill=c)
    # head shell
    hx, hy = H_
    d.rounded_rectangle([(hx - 17) * S, (hy - 8) * S, (hx + 17) * S, (hy + 12) * S], radius=5 * S, fill=(170, 120, 255, 255))
    d.ellipse([(hx - 3) * S, (hy + 9) * S, (hx + 3) * S, (hy + 15) * S], fill=(255, 255, 255, 255))
    sh = sh.filter(ImageFilter.GaussianBlur(7 * S)).resize((W, H), Image.LANCZOS)
    layer = layer.resize((W, H), Image.LANCZOS)
    base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert('RGBA')
    base.alpha_composite(sh)
    base.alpha_composite(layer)
    return np.asarray(base.convert('RGB'), np.float32)


def sparkles(img, n, seed, pal):
    _, _, rim, _ = PALETTES[pal]
    rnd = random.Random(seed)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        x = rnd.choice([rnd.uniform(40, 300), rnd.uniform(W - 300, W - 40)]); y = rnd.uniform(40, H - 40)
        s = rnd.uniform(4, 12); al = int(rnd.uniform(90, 230))
        d.line([(x - s, y), (x + s, y)], fill=rim + (al,), width=2); d.line([(x, y - s), (x, y + s)], fill=rim + (al,), width=2)
        d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=(255, 255, 255, al))
    layer = layer.filter(ImageFilter.GaussianBlur(.6))
    base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert('RGBA')
    base.alpha_composite(layer)
    return np.asarray(base.convert('RGB'), np.float32)


def finish(img, name):
    rnd = np.random.default_rng(3)
    img = img + rnd.normal(0, 2.2, img.shape).astype(np.float32)  # film grain hides banding in the gradients
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    out.save(OUT / f'{name}.jpg', quality=84, optimize=True, progressive=True)


ARM = {'hero-production': 'play', 'hero-production-1': 'play', 'hero-production-2': 'play', 'hero-production-3': 'play', 'hero-production-4': 'play',
       'hero-review': 'play', 'hero-completed': 'play', 'hero-payment_failed': 'lifted', 'hero-cancelled': 'rest'}

HEROES = {  # file -> (glyph, palette, sparkle count)
    'hero-received': ('note', 'violet', 14), 'hero-quote': ('doc', 'violet', 10), 'hero-payment_failed': ('alert', 'warm', 6),
    'hero-paid': ('check', 'violet', 18), 'hero-production': ('bars', 'violet', 12), 'hero-production-1': ('lines', 'violet', 10),
    'hero-production-2': ('mic', 'violet', 10), 'hero-production-3': ('bars', 'violet', 12), 'hero-production-4': ('sliders', 'violet', 10),
    'hero-review': ('headphones', 'violet', 14), 'hero-completed': ('play', 'bright', 34), 'hero-cancelled': ('cross', 'dim', 4),
    'hero-update': ('chat', 'violet', 10), 'hero-recover': ('lock', 'violet', 8),
}


def hero(name, glyph, pal, spark):
    img = background(pal)
    img = waves(img, pal)
    img, (cx, cy, lr) = vinyl(img, pal)
    img = label(img, glyph, cx, cy, lr, pal)
    if name in ARM:
        img = tonearm(img, ARM[name], pal)
    img = sparkles(img, spark, zlib.crc32(name.encode()) % 1000, pal)
    finish(img, name)


def logo():
    """Header wordmark: icon + 'from' (light) 'heart' (violet) 'beat' (bold), 2x for retina, transparent."""
    S = 4
    h = 96 * S
    f_light = ImageFont.truetype(MANROPE, 64 * S); f_light.set_variation_by_axes([300])
    f_bold = ImageFont.truetype(MANROPE, 64 * S); f_bold.set_variation_by_axes([800])
    f_mid = ImageFont.truetype(MANROPE, 64 * S); f_mid.set_variation_by_axes([600])
    parts = [('from', f_light, (244, 238, 255)), ('heart', f_mid, (198, 162, 255)), ('beat', f_bold, (244, 238, 255))]
    icon = LOGO_SRC.crop(LOGO_SRC.getbbox()); k = (h * .92) / icon.height
    icon = icon.resize((int(icon.width * k), int(icon.height * k)), Image.LANCZOS)
    widths = [f.getlength(t) for t, f, _ in parts]
    gap = 22 * S
    wtot = int(icon.width + gap + sum(widths))
    im = Image.new('RGBA', (wtot, h), (0, 0, 0, 0))
    im.alpha_composite(icon, (0, (h - icon.height) // 2))
    d = ImageDraw.Draw(im)
    x = icon.width + gap
    for (t, f, c), w in zip(parts, widths):
        d.text((x, h / 2 + 4 * S), t, font=f, fill=c + (255,), anchor='lm')
        x += w
    final_h = 96
    final = im.resize((int(wtot / S), final_h), Image.LANCZOS)
    final.save(OUT / 'logo-email.png', optimize=True)
    return final.size


def icon():
    ic = LOGO_SRC.crop(LOGO_SRC.getbbox())
    k = 88 / max(ic.size)
    ic = ic.resize((int(ic.width * k), int(ic.height * k)), Image.LANCZOS)
    out = Image.new('RGBA', (120, 120), (0, 0, 0, 0))
    out.alpha_composite(ic, ((120 - ic.width) // 2, (120 - ic.height) // 2))
    out.save(OUT / 'icon-email.png', optimize=True)


if __name__ == '__main__':
    print('logo-email.png', logo())
    icon()
    for n, (g, p, s) in HEROES.items():
        hero(n, g, p, s)
        print(n, (OUT / f'{n}.jpg').stat().st_size // 1024, 'KB')
