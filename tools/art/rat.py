from draw import *
c=C(52,46)
# capuz/corpo
c.poly([(4,45),(6,30),(12,22),(26,20),(26,45)],'L')
c.poly([(8,45),(9,32),(14,26),(26,25),(26,45)],'l')
c.ell(26,12,16,11,'L'); c.ell(26,13,14,9,'l')
# orelhas
c.ell(9,8,7,7,'m'); c.ell(9,8,4.6,4.6,'P'); c.ell(9.3,8.3,3,3,'r')
# cabeça
c.ell(26,16,11,9,'m')
c.poly([(13,15),(26,15),(26,36),(23,35)],'m')
c.poly([(14,17),(18,24),(23,33),(15,22)],'l')
c.ell(26,9.5,7,2.2,'L',only='m')
# olhos
c.poly([(15,16),(21,18),(21,21),(17,20)],'R')
c.px(19,18,'W'); c.px(18,18,'W'); c.px(20,20,'r'); c.px(19,20,'r'); c.px(20,19,'r')
c.line(14,14,21,16,'K')
# nariz e dentes
c.ell(26,34.5,3,1.8,'P')
c.rect(24,37,25,39,'W')
c.px(25,37,'K')
# bigodes
for y,dx in ((31,0),(33,1),(35,0)):
    c.line(19-dx,y,4,y-3+dx*2,'t' if y==33 else 'm')
# patas e plugue
c.ell(18,43,4,3,'m'); c.ell(18,42.5,2,1.2,'t',only='m')
c.rect(22,41,25,45,'A'); c.rect(22,41,22,45,'a'); c.rect(24,42,25,43,'G')
c.rect(23,44,25,45,'a')
c.mirror(); c.outline()
rows=c.rows(); render(rows,8,'rat.png'); import json; json.dump(rows,open('rat.json','w'))
