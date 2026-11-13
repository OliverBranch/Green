from draw import *
W=60
c=C(W,42)
c.rect(5,3,29,40,'A')
c.ell(8,6,4,4,'A'); 
c.rect(5,3,9,40,'a'); c.rect(5,3,29,4,'t'); c.rect(10,5,29,5,'W')
c.rect(5,38,29,40,'a')
for y in (8,34): c.px(7,y,'t')
# keyhole testa
c.ell(30,10,3.2,3.2,'K'); c.poly([(28,11),(30,11),(30,17),(27,17)],'K')
c.ell(30,10,1.6,1.6,'R'); c.rect(29,12,29,15,'r')
# olhos
c.poly([(13,15),(25,19),(25,22),(15,21)],'K')
c.poly([(14,16),(24,19),(24,21),(16,20.5)],'R'); c.px(21,19,'W'); c.px(20,19,'W'); c.px(20,20,'P')
# boca
c.ell(30,30,16,5.6,'K')
c.ell(30,30.5,13,3.6,'r',only='K')
c.ell(30,31,9,2,'R',only='r')
for x in range(15,30,4): c.poly([(x,25.6),(x+4,25.6),(x+2,29.5)],'W')
for x in range(17,30,4): c.poly([(x,35),(x+4,35),(x+2,31.5)],'W')
# rachaduras de cifra
c.line(10,24,13,27,'r'); c.line(13,27,12,31,'r'); c.line(24,36,27,38,'r')
c.mirror(); c.outline()
body=c.rows()
s=C(W,24)
s.ell(30,24,18,22,'m'); s.ell(30,24,12,17,'.')
s.ell(30,24,17,21,'t',only='m'); s.ell(30,24,16,20,'W',only='t'); s.ell(30,24,14,18.6,'t',only='W'); s.ell(30,24,13,18,'m',only='t')
s.mirror(); s.outline()
sh=s.rows()
full=sh[:-1]+body
render(full,8,'lock.png'); print(len(full))
import json; json.dump({'body':body,'shackle':sh},open('lock.json','w'))
