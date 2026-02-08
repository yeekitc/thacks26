/* Biome module extracted from game.js
   Exposes window.BIOME_MODULE.getCurBiome(dist) which returns a biome object
   compatible with the previous in-file representation. It also deterministically
   randomizes per-cycle weather flags (cloudy, starsOn, snowOn) so you can get
   cloudy/clear day/sunset/night/winter variations.
*/
(function(){
function hexToRgb(h){const n=parseInt(h.slice(1),16);return[n>>16,(n>>8)&255,n&255]}
function lC(a,b,t){return'rgb('+(a[0]+(b[0]-a[0])*t|0)+','+(a[1]+(b[1]-a[1])*t|0)+','+(a[2]+(b[2]-a[2])*t|0)+')'}
function lN(a,b,t){return a+(b-a)*t}
const _B=[
  [500,'#4a90d9','#8ec5e8','#e8cfa0',1,0,0,'#8da4b8','#7a9478','#5e7a4e','#7a5232','#5e3a1e','#3a2010','#1e3a1a','#2a4a22','#2a4020',.13,0],
  [400,'#2e3d6e','#d4726a','#f5b462',1,0,0,'#6b5e80','#7a5a58','#5c4838','#6e4a30','#55351c','#352010','#1a2e16','#243818','#22301a',.10,0],
  [500,'#0a0e1a','#121832','#1a2040',0,1,1,'#1a2238','#16203a','#121830','#2a2030','#1e1620','#120e16','#0a140e','#0e1a10','#10180e',.06,0],
  [500,'#8eaabe','#b8ccd8','#d8dde0',1,0,0,'#a8b8c8','#98aab8','#b0bcc8','#c8c0b8','#b0a8a0','#989088','#6a7a80','#8090a0','#606868',.18,1],
  // Desert biome: uses cactus shapes instead of trees and supports sandstorms
  // entries: len, sky1,sky2,sky3, sun,moon,stars, mtn1,mtn2,mtn3, gnd1,gnd2,gnd3, treeDark,treeLight, trunk, cloud, cactusFlag, sandProb
  [500,'#f4d899','#f7e6c9','#fdeed8',1,0,0,'#e0c7a0','#d8b78a','#c9a87a','#ead7b0','#e0c28a','#c9a06a','#2f6032','#6fbf65','#b88a50',.08,1,0.22,0]
];
function _bObj(a){
  return{
    len:a[0],
    sky:[a[1],a[2],a[3]],
    sun:a[4],moon:a[5],stars:a[6],
    mtn:[a[7],a[8],a[9]],
    gnd:[a[10],a[11],a[12]],
    tree:[a[13],a[14]],
    trunk:a[15],
    cloud:a[16],
    cactus:!!a[17],
    sandProb:(a[18]||0),
    winter:!!a[19]
  };
}
const BIOMES=_B.map(_bObj);
const _BC=BIOMES.reduce((s,b)=>s+b.len,0);

function seededRand(n){ // deterministic pseudo-random in [0,1)
  return Math.abs(Math.sin(n)*43758.5453123)%1;
}

// getCurBiome mirrors the old calcBiome but RETURNS the biome object
// and attaches weather flags (cloudy/starsOn,snowOn). It deterministically
// decides weather per-cycle so behavior is repeatable for the same dist.
function getCurBiome(dist){
  let d=((dist%_BC)+_BC)%_BC,acc=0;
  const cycleNum = Math.floor(dist/_BC);
  for(let i=0;i<BIOMES.length;i++){
    const b=BIOMES[i],nx=BIOMES[(i+1)%BIOMES.length];
    if(d<acc+b.len){
      const ib=d-acc,fs=b.len-150;
      let B=null;
      if(ib<fs){
        // stable
        B=Object.assign({},b);
      } else {
        const t=(ib-fs)/150;
        const sl=k=>b[k].map((c,j)=>lC(hexToRgb(c),hexToRgb(nx[k][j]),t));
        B={sky:sl('sky'),sun:lN(b.sun,nx.sun,t),moon:lN(b.moon,nx.moon,t),stars:lN(b.stars,nx.stars,t),
          mtn:sl('mtn'),gnd:sl('gnd'),tree:sl('tree'),trunk:lC(hexToRgb(b.trunk),hexToRgb(nx.trunk),t),cloud:lN(b.cloud,nx.cloud,t)};
      }
      // deterministic weather: use cycleNum & biome index as seed
      const seedBase = cycleNum*1013 + i*7919;
  const r1 = seededRand(seedBase + 13);
  const r2 = seededRand(seedBase + 29);
  const r3 = seededRand(seedBase + 47);
  const r4 = seededRand(seedBase + 61);
      // cloud probability driven by b.cloud but scaled so small b.cloud still sometimes clouds
      const cloudProb = Math.min(0.9, b.cloud*3.0);
      const cloudy = r1 < cloudProb;
    const starsOn = (b.stars>0.01) && (r2 < 0.7); // sometimes visible
    // snow only for biomes flagged as winter
  const snowOn = (b.winter) && (r3 < 0.5);
  // sandstorm for desert-like biomes (b.cactus indicates desert here)
  const sandOn = b.cactus && (r4 < (b.sandProb||0));
      // apply flags into a copy of B
      const out = Object.assign({}, B);
      out._biomeIndex = i;
      out._cycle = cycleNum;
      out.cloud = cloudy? (out.cloud||b.cloud) : 0; // keep numeric cloud value for existing drawing code
      out.stars = starsOn? (out.stars||b.stars) : 0;
  out.weather = {cloudy:cloudy,starsOn:starsOn,snowOn:snowOn,sandstormOn:sandOn};
  out.cactus = !!b.cactus;
      return out;
    }
    acc+=b.len;
  }
  return BIOMES[0];
}

window.BIOME_MODULE = {BIOMES, _BC, getCurBiome};
})();
