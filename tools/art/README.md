# Arte em pixel

Os sprites do GREEN são desenhados em Python com primitivas simples (elipses, polígonos, linhas),
espelhados e contornados automaticamente. Cada script gera uma prévia em PNG e um JSON.

```bash
pip install pillow
cd tools/art
python moth.py && python rat.py && python lock.py && python op.py && python icons.py && python bestiary.py
python gen.py      # reescreve src/ui/pixel-data.js
```

A paleta fica em `pal.py` e precisa bater com `PALETTE` em `src/ui/pixel-data.js`.
