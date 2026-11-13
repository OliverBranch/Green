# Bestiário da operação: um sprite por monstro comum e os chefes novos.
# Uso: python bestiary.py  → bestiary.json + bestiary.png (prévia)
from draw import *
import json
S = {}

def fish():
    c = C(46, 34)
    c.poly([(4, 17), (14, 8), (30, 6), (40, 12), (44, 17), (40, 22), (30, 28), (14, 26)], 'l')
    c.poly([(8, 17), (16, 11), (30, 10), (38, 14), (40, 17), (38, 20), (30, 24), (16, 23)], 'm')
    c.poly([(0, 8), (8, 17), (0, 26)], 'g')
    for x in range(16, 36, 5):
        for y in range(12, 24, 4): c.px(x + (y // 4) % 2 * 2, y, 'l')
    c.ell(34, 14, 3.2, 3.2, 'W'); c.ell(34.6, 14.2, 1.6, 1.6, 'R')
    c.poly([(40, 19), (44, 17), (44, 21)], 'K')
    for i, x in enumerate((38, 41, 43)): c.px(x, 20, 'W')
    # anzol com isca (um e-mail)
    c.line(30, 0, 30, 6, 't'); c.rect(26, 0, 34, 0, 't')
    c.rect(22, 1, 28, 5, 'A'); c.line(22, 1, 25, 3, 'a'); c.line(28, 1, 25, 3, 'a')
    c.poly([(18, 26), (24, 32), (28, 26)], 'g')
    c.outline(); return c.rows()

def keys():
    c = C(44, 40)
    c.ell(22, 18, 15, 15, 'A'); c.ell(22, 18, 11, 11, '.')
    c.ell(22, 18, 15, 15, 'a', only='A') if False else None
    for ang in range(0, 360, 40):
        import math
        a = math.radians(ang)
        x, y = 22 + math.cos(a) * 15, 18 + math.sin(a) * 15
        x2, y2 = 22 + math.cos(a) * 21, 18 + math.sin(a) * 21
        c.line(x, y, x2, y2, 't'); c.ell(x2, y2, 2.2, 2.2, 't'); c.px(x2, y2, 'K')
    c.ell(22, 18, 9, 9, 'L'); c.ell(22, 19, 7, 7, 'l')
    c.ell(19, 17, 2, 2, 'R'); c.ell(25, 17, 2, 2, 'R'); c.px(19, 16, 'W'); c.px(25, 16, 'W')
    c.rect(19, 22, 25, 22, 'W'); c.px(20, 23, 'W'); c.px(24, 23, 'W')
    c.outline(); return c.rows()

def probe():
    c = C(44, 36)
    c.ell(22, 14, 12, 9, 'm'); c.ell(22, 13, 10, 7, 't'); c.ell(22, 12, 8, 5, 'm', only='t')
    c.rect(10, 13, 34, 15, 'l')
    c.ell(22, 15, 5, 5, 'K'); c.ell(22, 15, 3.4, 3.4, 'R'); c.px(21, 14, 'W')
    for x0, x1 in ((2, 10), (34, 42)):
        c.rect(x0, 9, x1, 10, 'm'); c.rect(x0 + 2, 7, x1 - 2, 7, 'g')
    for sx, ex in ((14, 6), (18, 14), (26, 30), (30, 38)):
        c.line(sx, 21, ex, 33, 'l'); c.px(ex, 34, 'G')
    c.line(22, 5, 22, 1, 'm'); c.px(22, 0, 'G')
    c.outline(); return c.rows()

def larva():
    c = C(46, 34)
    segs = [(8, 24, 6), (15, 22, 7), (22, 20, 8), (30, 18, 8), (37, 15, 7)]
    for i, (x, y, r) in enumerate(segs):
        c.ell(x, y, r, r - 1, 'g' if i % 2 else 'G')
        c.ell(x, y + 2, r - 2, r - 3, 'l', only='gG')
    c.ell(39, 13, 6, 6, 'G')
    c.ell(40, 11, 1.6, 1.6, 'K'); c.ell(36, 11, 1.6, 1.6, 'K'); c.px(40, 10, 'W'); c.px(36, 10, 'W')
    c.rect(36, 16, 41, 16, 'K'); c.px(37, 17, 'W'); c.px(40, 17, 'W')
    for x, y in ((8, 30), (15, 29), (22, 28), (30, 26)):
        c.line(x - 2, y, x - 3, y + 3, 'l'); c.line(x + 2, y, x + 3, y + 3, 'l')
    # pedacinhos de código no corpo
    for x, y in ((14, 21), (21, 18), (29, 16)): c.rect(x, y, x + 2, y, 'K')
    c.line(41, 7, 44, 2, 'G'); c.line(37, 7, 35, 2, 'G')
    c.outline(); return c.rows()

def drop():
    c = C(36, 40)
    c.poly([(18, 1), (30, 20), (32, 28), (26, 36), (10, 36), (4, 28), (6, 20)], 'g')
    c.ell(18, 27, 13, 10, 'g')
    c.ell(18, 27, 10, 8, 'G', only='g')
    c.poly([(12, 10), (16, 6), (14, 16)], 'W')
    c.ell(13, 25, 2.4, 3, 'K'); c.ell(23, 25, 2.4, 3, 'K'); c.px(13, 24, 'W'); c.px(23, 24, 'W')
    c.line(14, 32, 22, 32, 'K'); c.px(13, 31, 'K'); c.px(23, 31, 'K')
    # gotas de dados caindo
    for x, y in ((3, 33), (33, 30), (30, 38)): c.rect(x, y, x + 1, y + 1, 'G')
    c.outline(); return c.rows()

def ghost():
    c = C(40, 44)
    c.ell(20, 16, 14, 14, 't')
    c.rect(6, 16, 34, 36, 't')
    for i, x in enumerate(range(6, 34, 7)):
        c.poly([(x, 36), (x + 3.5, 42 - (i % 2) * 3), (x + 7, 36)], 't')
    c.ell(20, 22, 11, 12, 'W', only='t')
    c.ell(14, 17, 3, 4, 'K'); c.ell(26, 17, 3, 4, 'K'); c.px(14, 16, 'G'); c.px(26, 16, 'G')
    c.ell(20, 27, 3, 2, 'K')
    # crachá pendurado
    c.line(20, 30, 20, 33, 'r'); c.rect(16, 33, 24, 39, 'A'); c.rect(17, 34, 19, 36, 'l'); c.rect(20, 35, 23, 35, 'a'); c.rect(20, 37, 22, 37, 'a')
    c.outline(); return c.rows()

def penguin():
    c = C(38, 44)
    c.ell(19, 26, 14, 16, 'L')
    c.ell(19, 28, 9, 12, 't')
    c.ell(19, 10, 10, 9, 'L')
    c.ell(15, 9, 3, 3, 'W'); c.ell(23, 9, 3, 3, 'W'); c.ell(15, 9, 1.6, 1.6, 'R'); c.ell(23, 9, 1.6, 1.6, 'R')
    c.poly([(14, 13), (24, 13), (19, 18)], 'A')
    c.poly([(4, 22), (8, 20), (6, 34)], 'L'); c.poly([(34, 22), (30, 20), (32, 34)], 'L')
    c.rect(11, 41, 17, 43, 'A'); c.rect(21, 41, 27, 43, 'A')
    # costuras de zumbi e um terminal no peito
    c.line(10, 6, 14, 3, 'g'); c.px(11, 5, 'G'); c.px(13, 4, 'G')
    c.rect(14, 24, 24, 31, 'K'); c.rect(15, 25, 18, 25, 'G'); c.rect(15, 27, 21, 27, 'g'); c.rect(15, 29, 17, 29, 'G')
    c.rect(10, 34, 12, 35, 'g'); c.rect(25, 18, 28, 19, 'g')
    c.outline(); return c.rows()

def beetle():
    c = C(44, 38)
    c.ell(22, 22, 14, 12, 'a'); c.ell(22, 22, 12, 10, 'A')
    c.line(22, 12, 22, 34, 'a')
    c.ell(22, 9, 7, 5, 'a')
    c.ell(19, 8, 1.8, 1.8, 'R'); c.ell(25, 8, 1.8, 1.8, 'R')
    # mandíbulas em forma de chave
    c.line(18, 5, 13, 1, 't'); c.line(26, 5, 31, 1, 't')
    c.ell(12, 1, 2, 1.5, 't'); c.ell(32, 1, 2, 1.5, 't')
    for y in (16, 22, 28):
        c.line(9, y, 3, y + 3, 'a'); c.line(35, y, 41, y + 3, 'a')
    # padrões de cadeado e bits no casco
    for x, y in ((16, 18), (28, 18), (16, 26), (28, 26)):
        c.rect(x - 1, y, x + 1, y + 2, 'K'); c.px(x, y - 1, 'K')
    c.rect(20, 20, 20, 24, 'W'); c.rect(24, 20, 24, 24, 'W')
    c.outline(); return c.rows()

def cloudlet():
    c = C(46, 36)
    for x, y, r in ((12, 18, 9), (22, 13, 11), (33, 16, 10), (38, 22, 7), (8, 24, 6)):
        c.ell(x, y, r, r - 1, 't')
    c.rect(6, 20, 40, 28, 't')
    for x, y, r in ((12, 20, 7), (22, 16, 9), (33, 19, 8)):
        c.ell(x, y, r, r - 1, 'W', only='t')
    c.ell(17, 18, 2.4, 2.8, 'K'); c.ell(28, 18, 2.4, 2.8, 'K'); c.px(17, 17, 'W'); c.px(28, 17, 'W')
    c.line(19, 24, 26, 24, 'K')
    # chave pendurada (credencial vazando) e cadeado aberto
    c.line(14, 28, 14, 32, 'm'); c.rect(12, 32, 16, 34, 'A'); c.px(14, 33, 'a')
    c.line(32, 28, 33, 33, 'G'); c.line(33, 33, 30, 35, 'G')
    c.outline(); return c.rows()

def eraser():
    c = C(40, 42)
    c.poly([(8, 8), (32, 8), (34, 34), (6, 34)], 'P')
    c.poly([(8, 8), (32, 8), (33, 18), (7, 18)], 'm')
    c.rect(7, 18, 33, 19, 'l')
    # máscara
    c.rect(9, 22, 31, 27, 'K'); c.ell(15, 24.5, 3, 2, 'R'); c.ell(25, 24.5, 3, 2, 'R'); c.px(14, 24, 'W'); c.px(24, 24, 'W')
    c.line(9, 23, 4, 21, 'K'); c.line(31, 23, 36, 21, 'K')
    c.rect(14, 30, 26, 31, 'r')
    # rastro apagado embaixo
    for i, x in enumerate(range(2, 38, 3)): c.px(x, 38 + (i % 2), 'l')
    c.rect(4, 36, 36, 36, 'L')
    c.outline(); return c.rows()

def echo():
    c = C(42, 44)
    c.rect(8, 6, 34, 30, 'm'); c.rect(10, 8, 32, 28, 'K')
    for y in (11, 25):
        c.rect(12, y, 30, y, 'l')
    c.rect(13, 14, 18, 18, 'G'); c.rect(24, 14, 29, 18, 'G'); c.rect(14, 15, 15, 16, 'W'); c.rect(25, 15, 26, 16, 'W')
    for i, x in enumerate(range(13, 30, 2)): c.rect(x, 21 - (i % 3), x, 23 + (i % 3) - 1, 'G')
    c.line(21, 6, 21, 1, 'm'); c.ell(21, 1, 1.6, 1.6, 'R')
    c.rect(16, 30, 26, 32, 'l'); c.rect(12, 33, 30, 42, 'L'); c.rect(14, 35, 28, 40, 'l')
    c.rect(19, 36, 23, 38, 'G')
    # ondas de som saindo
    for k, r in enumerate((4, 7)):
        for a in range(-2, 3): c.px(37 + r - abs(a) // 2, 18 + a * 2, 'g' if k else 'G'); c.px(4 - r + abs(a) // 2, 18 + a * 2, 'g' if k else 'G')
    c.outline(); return c.rows()

def brute():
    c = C(48, 46)
    c.ell(24, 26, 18, 14, 'l'); c.ell(24, 25, 15, 11, 'm', only='l')
    c.ell(24, 11, 9, 8, 'm')
    c.rect(16, 9, 32, 12, 'K'); c.rect(18, 10, 21, 11, 'R'); c.rect(27, 10, 30, 11, 'R')
    c.rect(19, 15, 29, 16, 'W'); c.px(20, 17, 'W'); c.px(28, 17, 'W')
    # braços com aríete
    c.ell(6, 26, 6, 9, 'l'); c.ell(42, 26, 6, 9, 'l')
    c.rect(0, 32, 12, 40, 'a'); c.rect(1, 33, 11, 39, 'A'); c.rect(0, 35, 12, 36, 'a')
    c.rect(38, 32, 48, 40, 'a'); c.rect(39, 33, 47, 39, 'A'); c.rect(38, 35, 48, 36, 'a')
    # logo de janela no peito
    c.rect(19, 23, 23, 27, 'G'); c.rect(25, 23, 29, 27, 'G'); c.rect(19, 29, 23, 33, 'G'); c.rect(25, 29, 29, 33, 'G')
    c.rect(14, 39, 21, 45, 'L'); c.rect(27, 39, 34, 45, 'L')
    c.outline(); return c.rows()

def oracle():
    c = C(60, 62)
    c.rect(6, 4, 54, 44, 'm'); c.rect(9, 7, 51, 41, 'K')
    for y in range(9, 41, 3): c.rect(10, y, 50, y, 'k')
    c.ell(30, 24, 17, 12, 'W'); c.ell(30, 24, 15, 10.5, 't')
    c.ell(30, 24, 9, 9, 'R'); c.ell(30, 24, 6, 6, 'r'); c.ell(30, 24, 3.5, 3.5, 'K')
    c.rect(26, 19, 28, 21, 'W')
    c.poly([(13, 13), (22, 15), (14, 17)], 'R'); c.poly([(47, 13), (38, 15), (46, 17)], 'R')
    c.rect(24, 44, 36, 48, 'l'); c.rect(14, 48, 46, 52, 'L')
    # cabos como tentáculos
    for x0, x1 in ((16, 6), (24, 18), (36, 42), (44, 54)):
        c.line(x0, 52, x1, 61, 'g'); c.px(x1, 61, 'G')
    c.line(6, 30, 0, 40, 'g'); c.line(54, 30, 59, 40, 'g')
    c.outline(); return c.rows()

def storm():
    c = C(64, 52)
    for x, y, r in ((16, 22, 13), (30, 15, 15), (46, 19, 14), (54, 28, 9), (10, 30, 8)):
        c.ell(x, y, r, r - 1, 'L')
    c.rect(8, 26, 56, 36, 'L')
    for x, y, r in ((16, 24, 10), (30, 18, 12), (46, 22, 11)):
        c.ell(x, y, r, r - 1, 'l', only='L')
    c.poly([(16, 20), (26, 23), (26, 27), (18, 25)], 'A'); c.poly([(48, 20), (38, 23), (38, 27), (46, 25)], 'A')
    c.px(23, 24, 'W'); c.px(41, 24, 'W')
    c.poly([(24, 31), (40, 31), (36, 34), (28, 34)], 'K')
    for x in range(26, 39, 3): c.px(x, 31, 'W')
    # raios
    for x0 in (14, 32, 50):
        c.line(x0, 36, x0 - 3, 42, 'A'); c.line(x0 - 3, 42, x0 + 1, 43, 'A'); c.line(x0 + 1, 43, x0 - 3, 51, 'A')
    c.outline(); return c.rows()

def crown():
    c = C(22, 12)
    c.poly([(1, 11), (1, 3), (6, 7), (11, 1), (16, 7), (21, 3), (21, 11)], 'A')
    c.rect(1, 9, 21, 11, 'a')
    c.ell(11, 6, 1.5, 1.5, 'R'); c.px(5, 9, 'G'); c.px(17, 9, 'G')
    c.outline(); return c.rows()

for name, fn in [('fish', fish), ('keys', keys), ('probe', probe), ('larva', larva), ('drop', drop), ('ghost', ghost),
                 ('penguin', penguin), ('beetle', beetle), ('cloudlet', cloudlet), ('eraser', eraser), ('echo', echo),
                 ('brute', brute), ('oracle', oracle), ('storm', storm), ('crown', crown)]:
    S[name] = fn()

json.dump(S, open('bestiary.json', 'w'))
# prévia em grade
from PIL import Image
sc = 5
tiles = [render(v, sc, f'/tmp/{k}.png') for k, v in S.items()]
W = sum(t.width for t in tiles) + 10 * len(tiles)
H = max(t.height for t in tiles)
sheet = Image.new('RGB', (min(W, 1800), H * ((W // 1800) + 1) + 40), (2, 8, 5))
x = y = 0
for t in tiles:
    if x + t.width > 1800: x = 0; y += H + 10
    sheet.paste(t, (x, y)); x += t.width + 10
sheet.save('bestiary.png')
print({k: (len(v[0]), len(v)) for k, v in S.items()})
