from pal import *
wing = [
"..............K......",
".............KgK.....",
"............KgmgK....",
"...........KmgKgK....",
"............KgmgK....",
".............KgmgK...",
"..............KgmK...",
"...............KmgK..",
"................KmgK.",
".KK..............KmK.",
"KlLKK.............KmK",
"KlGlLKKK...........Km",
"KlGGllLLKKK.........K",
"KllGllllLLLKK........",
".KlgllRRRllLLKK......",
".KlgllRrWRRlLLLKK....",
".KlglRrWWRRgllLLLK...",
".KllgRrRRRRglLLGLLK..",
"..KlgRRRRRglLLGLLLLK.",
"..KllgRRRglLLGLLLLLLK",
"..KlllgggllLGLLLLLLLL",
"...KllllllLGLLLLLLLLL",
"...KKllllLGLLLLLLLLKK",
".....KKllGLLLLLLKKK..",
".......KKKKKKKKK.....",
".......KlllllLLKK....",
"......KlllgllLLLLK...",
".....KllgRRgllLLLLK..",
".....KlgRrWRgllLLLLK.",
".....KlgRRRRglLGLLLK.",
"......KlgRRglLGLLLLK.",
"......KllgglLGLLLLK..",
".......KllllGLLLLK...",
"........KKllLLLKK....",
"..........KKKKK......",
".....................",
]
body = [
".......",".......",".......",".......",".......",".......",".......",".......",".......",".......",
".......",".......",".m.....",
"..mKKKK",
"..KGGkk",
".KGWWGk",
".KGWGGk",
".KGGGkk",
"LKKkkaA",
"LKaAAAA",
"LKaAaAA",
"LLKaAAa",
"LLKAaAA",
"..KaAaA",
"...KaAa",
"...KAaA",
"...KaAa",
"....KaA",
"....KAa",
"....Kaa",
".....Ka",
".....KK",
".......",".......",".......",".......",
]
def merge(w,b):
    out=[]
    for x,y in zip(w,b):
        row=list(x+y.rjust(7,'.')[:0]) if False else None
        # superpõe: corpo ocupa as 7 últimas colunas de 28
        full=list(x+'.......')
        for i,c in enumerate(y):
            if c!='.': full[21+i]=c
        out.append(''.join(full))
    return out
half=merge(wing,body)
rows = grid(half, True)
render(rows, 8, 'moth.png')
import json
def place(part):
    out=[]
    for y in range(len(wing)):
        full=['.']*28
        src = part[y]
        off = 0 if part is wing else 21
        for i,ch in enumerate(src):
            if ch!='.': full[off+i]=ch
        out.append(''.join(full))
    return grid(out,True)
json.dump({'wings':place(wing),'body':place(body)},open('moth.json','w'))
