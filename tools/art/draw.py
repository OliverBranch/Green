from pal import *
class C:
    def __init__(s,w,h): s.w,s.h=w,h; s.g=[['.']*w for _ in range(h)]
    def px(s,x,y,c):
        x,y=int(round(x)),int(round(y))
        if 0<=x<s.w and 0<=y<s.h: s.g[y][x]=c
    def get(s,x,y): return s.g[y][x] if 0<=x<s.w and 0<=y<s.h else '.'
    def ell(s,cx,cy,rx,ry,c,only=None):
        for y in range(s.h):
            for x in range(s.w):
                if ((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1:
                    if only is None or s.g[y][x] in only: s.g[y][x]=c
    def rect(s,x0,y0,x1,y1,c):
        for y in range(y0,y1+1):
            for x in range(x0,x1+1): s.px(x,y,c)
    def poly(s,pts,c):
        for y in range(s.h):
            for x in range(s.w):
                X,Y=x+.5,y+.5; ins=False; j=len(pts)-1
                for i in range(len(pts)):
                    xi,yi=pts[i]; xj,yj=pts[j]
                    if (yi>Y)!=(yj>Y) and X < (xj-xi)*(Y-yi)/(yj-yi)+xi: ins=not ins
                    j=i
                if ins: s.g[y][x]=c
    def line(s,x0,y0,x1,y1,c):
        n=int(max(abs(x1-x0),abs(y1-y0)))+1
        for i in range(n+1):
            t=i/max(1,n); s.px(x0+(x1-x0)*t,y0+(y1-y0)*t,c)
    def mirror(s):
        for y in range(s.h):
            for x in range(s.w//2): s.g[y][s.w-1-x]=s.g[y][x]
    def outline(s,c='K'):
        add=[]
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x]=='.' and any(s.get(x+dx,y+dy) not in '.K' for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))): add.append((x,y))
        for x,y in add: s.g[y][x]=c
    def rows(s): return [''.join(r) for r in s.g]
