PAL = {
 '.': None,
 'K': (1,10,5), 'k': (2,22,12),
 'D': (6,30,17), 'L': (16,51,31), 'l': (26,82,50), 'm': (84,143,107),
 'g': (35,197,108), 'G': (67,255,149), 'W': (219,255,241), 't': (198,248,216),
 'A': (255,191,71), 'a': (150,96,22), 'R': (255,92,120), 'r': (122,31,46), 'P': (255,170,190),
}
from PIL import Image
def grid(rows, mirror=False):
    if mirror: rows=[r + r[::-1] for r in rows]
    return rows
def render(rows, scale=8, path='out.png', bg=(2,8,5)):
    h=len(rows); w=max(len(r) for r in rows)
    im=Image.new('RGB',(w*scale,h*scale),bg)
    px=im.load()
    for y,r in enumerate(rows):
        for x,c in enumerate(r):
            col=PAL.get(c)
            if col:
                for dy in range(scale):
                    for dx in range(scale): px[x*scale+dx,y*scale+dy]=col
    im.save(path); return im
