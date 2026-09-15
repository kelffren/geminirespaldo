from pathlib import Path

p=Path('src/environment/tile-registry.js')
s=p.read_text(encoding='utf-8')
start=s.index('  const plazaNatureProps = Object.freeze([')
end=s.index('  ]);', start)+len('  ]);')
new="""  const plazaNatureProps = Object.freeze([
    Object.freeze({id:'plaza-tree-nw',frame:'tree_large',x:1096,y:1196,w:144,h:192,baseY:1388}),
    Object.freeze({id:'plaza-tree-ne',frame:'tree_pink',x:1640,y:1208,w:144,h:180,baseY:1388}),
    Object.freeze({id:'plaza-tree-sw',frame:'tree_medium',x:1100,y:1560,w:136,h:180,baseY:1740}),
    Object.freeze({id:'plaza-tree-se',frame:'tree_large',x:1640,y:1548,w:144,h:192,baseY:1740}),
    Object.freeze({id:'plaza-tree-west-1',frame:'tree_small',x:1018,y:1368,w:112,h:144,baseY:1512}),
    Object.freeze({id:'plaza-tree-west-2',frame:'tree_cypress',x:1030,y:1452,w:88,h:228,baseY:1680}),
    Object.freeze({id:'plaza-tree-east-1',frame:'tree_pink',x:1740,y:1340,w:132,h:172,baseY:1512}),
    Object.freeze({id:'plaza-tree-east-2',frame:'tree_medium',x:1746,y:1510,w:126,h:170,baseY:1680}),
    Object.freeze({id:'plaza-tree-north-west',frame:'tree_small',x:1244,y:1144,w:104,h:138,baseY:1282}),
    Object.freeze({id:'plaza-tree-north-east',frame:'tree_cypress',x:1540,y:1086,w:88,h:196,baseY:1282}),
    Object.freeze({id:'plaza-tree-south-west',frame:'tree_pink',x:1228,y:1730,w:140,h:176,baseY:1906}),
    Object.freeze({id:'plaza-tree-south-east',frame:'tree_medium',x:1524,y:1736,w:132,h:170,baseY:1906}),
    Object.freeze({id:'plaza-grove-west-large',frame:'tree_large',x:880,y:1160,w:132,h:176,baseY:1336}),
    Object.freeze({id:'plaza-grove-west-pink',frame:'tree_pink',x:850,y:1584,w:126,h:160,baseY:1744}),
    Object.freeze({id:'plaza-grove-east-large',frame:'tree_large',x:1880,y:1170,w:132,h:176,baseY:1346}),
    Object.freeze({id:'plaza-grove-east-small',frame:'tree_small',x:1900,y:1576,w:106,h:142,baseY:1718}),
    Object.freeze({id:'plaza-grove-north-medium',frame:'tree_medium',x:1370,y:1000,w:118,h:154,baseY:1154}),
    Object.freeze({id:'plaza-grove-north-cypress',frame:'tree_cypress',x:1448,y:944,w:82,h:210,baseY:1154}),
    Object.freeze({id:'plaza-grove-south-pink',frame:'tree_pink',x:1370,y:1900,w:128,h:160,baseY:2060}),
    Object.freeze({id:'plaza-grove-south-small',frame:'tree_small',x:1508,y:1918,w:106,h:142,baseY:2060})
  ]);"""
s=s[:start]+new+s[end:]
s=s.replace("version:'1.11.0'", "version:'1.11.1'", 1)
p.write_text(s,encoding='utf-8')
print('POPULATE_OK 20 irregular-atlas vegetation props using 5 named frames')
