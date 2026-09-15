from pathlib import Path

p = Path(__file__).resolve().parents[1] / 'src/environment/prop-contract.js'
text = p.read_text(encoding='utf-8')
needle = "    plazaFountainKelo:Object.freeze({id:'plazaFountainKelo',src:'assets/fuentekelo-runtime.PNG?art=401',width:1312,height:1199,frameWidth:1312,frameHeight:1199,columns:1}),"
lines = text.splitlines()
out = []
seen = False
for line in lines:
    if line == needle:
        if seen:
            continue
        seen = True
    out.append(line)
if not seen:
    raise RuntimeError('plazaFountainKelo asset entry missing')
text = '\n'.join(out) + '\n'
p.write_text(text, encoding='utf-8')
print('PASS plazaFountainKelo appears exactly once')
