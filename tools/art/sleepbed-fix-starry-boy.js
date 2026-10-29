// starry_double_boy (owner, 30 Oct 2026; X0=300 Y0=262 X1=540 Y1=448): the girl's picture (clean outline, same bed in the same place) with the boy's farmer from his
// first picture pasted in. The paste covers where the two pictures differ (the farmer and her pigtails), away from the
// bed's edge (where the boy's picture has the extra outline), feathered at its border.
const fs=require('fs');const [REPO,BOY,GIRL,OUT,DBG]=process.argv.slice(2);const {chromium}=require(REPO+'/node_modules/playwright');
(async()=>{const b=await chromium.launch(),p=await b.newPage();
const r=await p.evaluate(async([bs,gs,rect])=>{const load=async s=>{const i=new Image();i.src=s;await i.decode();return i;};
 const B=await load(bs),G=await load(gs),W=B.width,H=B.height;const cv=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
 const bc=cv(),gc=cv();bc.getContext('2d').drawImage(B,0,0);gc.getContext('2d').drawImage(G,0,0);
 const bd=bc.getContext('2d').getImageData(0,0,W,H),gd=gc.getContext('2d').getImageData(0,0,W,H),BD=bd.data,GD=gd.data;
 // distance from the girl's silhouette edge (only pixels well inside count)
 const inside=new Uint8Array(W*H);for(let k=0;k<W*H;k++)inside[k]=GD[k*4+3]>=128?1:0;
 const M=28,deep=new Uint8Array(W*H);
 for(let y=M;y<H-M;y++)for(let x=M;x<W-M;x++){const k=y*W+x;if(!inside[k])continue;if(inside[k-M]&&inside[k+M]&&inside[k-M*W]&&inside[k+M*W]&&inside[k-M-M*W]&&inside[k+M+M*W]&&inside[k-M+M*W]&&inside[k+M-M*W])deep[k]=1;}
 // where they differ, deep inside
 let x0=W,y0=H,x1=0,y1=0,cnt=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=y*W+x;if(!deep[k])continue;const i=k*4,dd=Math.abs(BD[i]-GD[i])+Math.abs(BD[i+1]-GD[i+1])+Math.abs(BD[i+2]-GD[i+2]);if(dd>90){cnt++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
 // the farmer is in the top half on the left pillow: limit to that area to skip the quilt's little differences
 const box={x0,y0,x1,y1};[x0,y0,x1,y1]=rect;
 const out=cv(),og=out.getContext('2d');og.drawImage(G,0,0);
 const od=og.getImageData(0,0,W,H),OD=od.data,P=10,F=14;
 const fx0=Math.max(0,x0-P),fy0=Math.max(0,y0-P),fx1=Math.min(W-1,x1+P),fy1=Math.min(H-1,y1+P);
 for(let y=fy0;y<=fy1;y++)for(let x=fx0;x<=fx1;x++){const k=y*W+x;if(!inside[k])continue;
  const e=Math.min(x-fx0,fx1-x,y-fy0,fy1-y),a=Math.min(1,e/F);const i=k*4;
  for(let c=0;c<4;c++)OD[i+c]=Math.round(GD[i+c]*(1-a)+BD[i+c]*a);}
 og.putImageData(od,0,0);
 const dbg=cv(),dg=dbg.getContext('2d');dg.drawImage(out,0,0);dg.strokeStyle='#00ff00';dg.lineWidth=3;dg.strokeRect(fx0,fy0,fx1-fx0,fy1-fy0);
 return {box,cnt,png:out.toDataURL('image/png'),dbg:dbg.toDataURL('image/png')};},
 ['data:image/png;base64,'+fs.readFileSync(BOY).toString('base64'),'data:image/png;base64,'+fs.readFileSync(GIRL).toString('base64'),[+process.env.X0,+process.env.Y0,+process.env.X1,+process.env.Y1]]);
fs.writeFileSync(OUT,Buffer.from(r.png.split(',')[1],'base64'));fs.writeFileSync(DBG,Buffer.from(r.dbg.split(',')[1],'base64'));
console.log('diff box',JSON.stringify(r.box),'px',r.cnt);await b.close();})();
