"""Generate Android launcher icons + web/store icons from public/icon-512.png (amber '?')."""
from PIL import Image, ImageDraw
import os
BG=(0x09,0x0D,0x15); AMBER=(0xF4,0xA9,0x3C)
src=Image.open('public/icon-512.png').convert('RGB')
# extract glyph as alpha mask
a=Image.new('L',src.size)
a.putdata([max(0,min(255,int((max(p)-70)*255/185))) for p in src.getdata()])
bb=a.point(lambda v:255 if v>8 else 0).getbbox()
glyph=a.crop(bb)
def render(size,frac,bg=True,round_=False,radius=0.0):
    im=Image.new('RGBA',(size,size),BG+(255,) if bg else (0,0,0,0))
    g=glyph.copy(); s=size*frac/max(g.size)
    g=g.resize((max(1,round(g.width*s)),max(1,round(g.height*s))),Image.LANCZOS)
    col=Image.new('RGBA',g.size,AMBER+(255,)); col.putalpha(g)
    im.alpha_composite(col,((size-g.width)//2,(size-g.height)//2))
    if round_ or radius:
        m=Image.new('L',(size*4,size*4),0); d=ImageDraw.Draw(m)
        if round_: d.ellipse((0,0,size*4-1,size*4-1),fill=255)
        else: d.rounded_rectangle((0,0,size*4-1,size*4-1),radius=int(size*4*radius),fill=255)
        im.putalpha(m.resize((size,size),Image.LANCZOS))
    return im
res='android/app/src/main/res'
for d,leg,fg in [('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),('xxhdpi',144,324),('xxxhdpi',192,432)]:
    p=f'{res}/mipmap-{d}/'
    render(fg,0.42,bg=False).save(p+'ic_launcher_foreground.png')
    render(leg,0.62,radius=0.18).save(p+'ic_launcher.png')
    render(leg,0.56,round_=True).save(p+'ic_launcher_round.png')
render(512,0.62,radius=0.0).convert('RGB').save('play-store-icon-512.png')
render(512,0.62).convert('RGB').save('public/icon-512.png') if False else None
render(192,0.62,radius=0).convert('RGB').save('public/icon-192.png')
render(512,0.46).convert('RGB').save('public/icon-maskable-512.png')
render(180,0.62).convert('RGB').save('public/apple-touch-icon.png')
render(64,0.7).convert('RGB').save('public/favicon.png')
