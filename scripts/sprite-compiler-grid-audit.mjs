import assert from 'node:assert/strict';
import {detectSpriteCompilerGrid,selectSpriteCompilerGrid} from '../src/creators/sprite-compiler/sprite-compiler-grid.mjs';

function sheet(cols,rows,cellW=32,cellH=32,{margin=6}={}){
  const width=cols*cellW,height=rows*cellH,data=new Uint8ClampedArray(width*height*4);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const wobble=((r+c)%3)-1;
    const x0=c*cellW+margin+wobble,y0=r*cellH+margin;
    const x1=(c+1)*cellW-margin-1+wobble,y1=(r+1)*cellH-margin-1-((r+c)%2);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const i=(y*width+x)*4;data[i]=40+r*2;data[i+1]=80+c*2;data[i+2]=120;data[i+3]=255;
    }
  }
  return{data,width,height};
}

for(const [cols,rows] of [[4,8],[8,4],[4,4],[6,4]]){
  const s=sheet(cols,rows),d=detectSpriteCompilerGrid(s.data,s.width,s.height);
  assert.equal(d.columns,cols,`${cols}x${rows} cols`);
  assert.equal(d.rows,rows,`${cols}x${rows} rows`);
  assert.equal(d.reviewRequired,false,`${cols}x${rows} should auto pass`);
  const picked=selectSpriteCompilerGrid(d);assert.equal(picked.source,'auto');
}

const width=128,height=128,solid=new Uint8ClampedArray(width*height*4);
for(let i=0;i<solid.length;i+=4){solid[i]=90;solid[i+1]=90;solid[i+2]=90;solid[i+3]=255;}
const uncertain=detectSpriteCompilerGrid(solid,width,height);
assert.equal(uncertain.reviewRequired,true,'solid illustration must not be silently guessed as a grid');
const fallback=selectSpriteCompilerGrid(uncertain,{fallbackColumns:4,fallbackRows:8});
assert.equal(fallback.source,'fallback-review');assert.equal(fallback.reviewRequired,true);

console.log(JSON.stringify({ok:true,detected:['4x8','8x4','4x4','6x4'],uncertainReason:uncertain.reason,uncertainConfidence:Number(uncertain.confidence.toFixed(3))}));
