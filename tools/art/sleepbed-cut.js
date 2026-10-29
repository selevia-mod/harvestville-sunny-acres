// Fits each owner's sleeping-bed picture (art-src/sleeping-beds/<style>_<single|double>_<boy|girl>.png) onto its bed's
// frame: the picture's bed box is laid exactly over the original bed's box in furn_<v>.png, at 192 px a tile
// (single 384x384, double 576x384, like the classic sleepbed_* pictures). Writes props/sleepbed[2]_v<v>_<who>.png/.webp.
// node tools/art/sleepbed-cut.js <repo> [quality, 0.68 used] [skip-name ...]
const fs=require('fs'),path=require('path');const [REPO,Q,...SKIP]=process.argv.slice(2);const {chromium}=require(REPO+'/node_modules/playwright');
const styles={rustic:1,cottage:2,modern:3,royal:4,flower:5,fireworks:6,harvest:7,cowfest:8,starry:9};
const IN=path.join(REPO,'art-src/sleeping-beds'),OUT=path.join(REPO,'assets/props');
const d=(f)=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
(async()=>{const b=await chromium.launch(),p=await b.newPage();let total=0;
for(const f of fs.readdirSync(IN).filter(x=>x.endsWith('.png')).sort()){
 const m=f.match(/^([a-z]+)_(single|double)_(boy|girl)\.png$/);if(!m||SKIP.includes(f.replace('.png','')))continue;
 const v=styles[m[1]],dbl=m[2]==='double';
 const r=await p.evaluate(async([src,furn,dbl,q])=>{
  const load=async s=>{const i=new Image();i.src=s;await i.decode();return i;};
  const box=(img,sx,sy,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,sx,sy,w,h,0,0,w,h);const D=c.getContext('2d').getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(D[(y*w+x)*4+3]>=128){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return {x0,y0,w:x1-x0+1,h:y1-y0+1};};
  const im=await load(src),F=await load(furn);
  const FW=dbl?384:256,ob=box(F,dbl?408:8,136,FW,256),nb=box(im,0,0,im.width,im.height),k=1.5;
  const o=document.createElement('canvas');o.width=FW*k;o.height=256*k;const g=o.getContext('2d');g.imageSmoothingQuality='high';
  // the same 0.5-alpha box edges: stretch the picture's box onto the bed's box
  g.drawImage(im,nb.x0,nb.y0,nb.w,nb.h,ob.x0*k,ob.y0*k,ob.w*k,ob.h*k);
  return {png:o.toDataURL('image/png'),webp:o.toDataURL('image/webp',q),sx:(ob.w/nb.w*k).toFixed(3),sy:(ob.h/nb.h*k).toFixed(3)};
 },[d(path.join(IN,f)),d(path.join(REPO,'assets','furn_'+v+'.png')),dbl,+(Q||0.8)]);
 const key=(dbl?'sleepbed2':'sleepbed')+'_v'+v+'_'+m[3];
 fs.writeFileSync(path.join(OUT,key+'.png'),Buffer.from(r.png.split(',')[1],'base64'));
 const wb=Buffer.from(r.webp.split(',')[1],'base64');fs.writeFileSync(path.join(OUT,key+'.webp'),wb);total+=wb.length;
 console.log(key.padEnd(22),'scale',r.sx,r.sy,(wb.length/1024).toFixed(1)+' KB');}
console.log('total webp',(total/1024).toFixed(0)+' KB');await b.close();})();
