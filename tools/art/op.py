from draw import *
c=C(72,46)
# monitores
for x0 in (1,37):
    c.rect(x0,1,x0+33,23,'L'); c.rect(x0+2,3,x0+31,21,'D')
    c.rect(x0+14,24,x0+19,28,'L')
import random; random.seed(4)
for x0 in (1,37):
    y=5
    while y<20:
        ind=random.choice([0,2,4]); ln=random.randint(5,18)
        col=random.choice('gggGmA' if x0==1 else 'gGgRmg')
        c.rect(x0+4+ind,y,x0+4+ind+ln,y,col); y+=2
# mesa
c.rect(0,29,71,32,'l'); c.rect(0,33,71,45,'L'); c.rect(0,29,71,29,'m')
# cadeira
c.poly([(22,45),(24,26),(48,26),(50,45)],'k')
c.rect(62,25,66,29,'A'); c.rect(62,25,62,29,'a'); c.rect(67,26,68,28,'A'); c.px(67,27,'.')
c.px(63,23,'m'); c.px(64,22,'m'); c.px(65,23,'m'); c.px(64,20,'m')
c.rect(4,27,20,28,'m'); c.rect(5,27,19,27,'t')
# operador (costas)
c.ell(36,40,15,9,'l'); c.ell(36,41,13,8,'L')
c.ell(36,24,8,9,'l'); c.ell(36,25,6.5,7.5,'L')
c.poly([(30,32),(42,32),(40,36),(32,36)],'L')
# fone
c.ell(36,22,8.8,9.6,'m',only='.' ) if False else None
c.line(28,22,30,16,'m'); c.line(30,16,36,14,'m'); c.line(36,14,42,16,'m'); c.line(42,16,44,22,'m')
c.rect(26,22,28,27,'t'); c.rect(44,22,46,27,'t')
# brilho das telas na borda do capuz
for y in range(18,30): 
    for x in range(72):
        if c.get(x,y)=='l' and c.get(x-1,y) in 'kDLm.' and x<36: c.px(x,y,'g')
        if c.get(x,y)=='l' and c.get(x+1,y) in 'kDLm.' and x>36: c.px(x,y,'g')
c.outline()
rows=c.rows(); render(rows,6,'op.png'); print(len(rows),len(rows[0]))
import json; json.dump(rows,open('op.json','w'))
