import json, os
FONT = {
'A':["###","#.#","###","#.#","#.#"],'B':["##.","#.#","##.","#.#","##."],'C':["###","#..","#..","#..","###"],
'D':["##.","#.#","#.#","#.#","##."],'E':["###","#..","##.","#..","###"],'F':["###","#..","##.","#..","#.."],
'G':["###","#..","#.#","#.#","###"],'H':["#.#","#.#","###","#.#","#.#"],'I':["###",".#.",".#.",".#.","###"],
'J':["..#","..#","..#","#.#","###"],'K':["#.#","#.#","##.","#.#","#.#"],'L':["#..","#..","#..","#..","###"],
'M':["#.#","###","###","#.#","#.#"],'N':["##.","#.#","#.#","#.#","#.#"],'O':["###","#.#","#.#","#.#","###"],
'P':["###","#.#","###","#..","#.."],'Q':["###","#.#","#.#","###","..#"],'R':["##.","#.#","##.","#.#","#.#"],
'S':["###","#..","###","..#","###"],'T':["###",".#.",".#.",".#.",".#."],'U':["#.#","#.#","#.#","#.#","###"],
'V':["#.#","#.#","#.#","#.#",".#."],'W':["#.#","#.#","###","###","#.#"],'X':["#.#","#.#",".#.","#.#","#.#"],
'Y':["#.#","#.#",".#.",".#.",".#."],'Z':["###","..#",".#.","#..","###"],
'0':["###","#.#","#.#","#.#","###"],'1':[".#.","##.",".#.",".#.","###"],'2':["###","..#","###","#..","###"],
'3':["###","..#",".##","..#","###"],'4':["#.#","#.#","###","..#","..#"],'5':["###","#..","###","..#","###"],
'6':["###","#..","###","#.#","###"],'7':["###","..#",".#.",".#.",".#."],'8':["###","#.#","###","#.#","###"],
'9':["###","#.#","###","..#","###"],'+':["...",".#.","###",".#.","..."],'-':["...","...","###","...","..."],
'!':[".#.",".#.",".#.","...",".#."],'%':["#.#","..#",".#.","#..","#.#"],' ':["...","...","...","...","..."],
'.':["...","...","...","...",".#."],':':["...",".#.","...",".#.","..."],'?':["###","..#",".##","...",".#."],
}
moth=json.load(open('moth.json')); ratrows=json.load(open('rat.json'))
lock=json.load(open('lock.json')); op=json.load(open('op.json')); icons=json.load(open('icons.json'))
best=json.load(open('bestiary.json'))
def fmt(rows):
    return '[\n'+''.join(f"    '{r}',\n" for r in rows)+'  ]'
js = """// Pixel art do GREEN, desenhada como texto: cada caractere é um pixel e mapeia para a paleta de fósforo.
// Gerado por tools/art/gen.py a partir dos rascunhos em Python. Editar aqui também funciona.

export const PALETTE = {
  K: '#010a05', k: '#02160c', D: '#061e11', L: '#10331f', l: '#1a5232', m: '#548f6b',
  g: '#23c56c', G: '#43ff95', W: '#dbfff1', t: '#c6f8d8',
  A: '#ffbf47', a: '#966016', R: '#ff5c78', r: '#7a1f2e', P: '#ffaabe',
};

export const SPRITES = {
"""
js += f"  mothWings: {fmt(moth['wings'])},\n  mothBody: {fmt(moth['body'])},\n  rat: {fmt(ratrows)},\n  lockBody: {fmt(lock['body'])},\n  lockShackle: {fmt(lock['shackle'])},\n  operator: {fmt(op)},\n"
for k, v in best.items(): js += f"  {k}: {fmt(v)},\n"
js += "};\n\n// Ícones 9×9 monocromáticos, tingidos na hora de desenhar.\nexport const ICONS = {\n"
for k,v in icons.items(): js += f"  {k}: {json.dumps(v)},\n"
js += "};\n\n// Fonte de pixel 3×5 para números e avisos dentro da cena.\nexport const FONT = {\n"
for k,v in FONT.items(): js += f"  {json.dumps(k)}: {json.dumps(v)},\n"
js += "};\n"
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'ui', 'pixel-data.js'), 'w', encoding='utf-8').write(js)
print(len(js))
