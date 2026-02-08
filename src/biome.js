/* Biome module extracted from game.js
   Exposes window.BIOME_MODULE.getCurBiome(dist) which returns a biome object
   compatible with the previous in-file representation. It also deterministically
   randomizes per-cycle weather flags (cloudy, starsOn, snowOn) so you can get
   cloudy/clear day/sunset/night/winter variations.
*/
function hexToRgb(h){const n=parseInt(h.slice(1),16);return[n>>16,(n>>8)&255,n&255];}
function lC(a,b,t){return'rgb('+(a[0]+(b[0]-a[0])*t|0)+','+(a[1]+(b[1]-a[1])*t|0)+','+(a[2]+(b[2]-a[2])*t|0)+')';}
function lN(a,b,t){return a+(b-a)*t}

// Define base place palettes
const PLACES = [
  {id:'temperate',name:'Temperate',
    // per-time skies: dawn, day, evening, night
    skyTimes: {
      dawn: ['#ffdca8','#dff0ff','#f6e7cf'],
      day:  ['#4a90d9','#8ec5e8','#e8cfa0'],
      evening: ['#2e3d6e','#d4726a','#f5b462'],
      night: ['#0a0e1a','#121832','#1a2040']
    },
    sun:1, moon:0, stars:0,
    // per-time mountain, ground, tree, trunk and cloud values (from legacy rows)
    mtnTimes: {
      day: ['#8da4b8','#7a9478','#5e7a4e'],
      evening: ['#6b5e80','#7a5a58','#5c4838'],
      night: ['#1a2238','#16203a','#121830']
    },
    gndTimes: {
      day: ['#7a5232','#5e3a1e','#3a2010'],
      evening: ['#6e4a30','#55351c','#352010'],
      night: ['#2a2030','#1e1620','#120e16']
    },
    treeTimes: {
      day: ['#1e3a1a','#2a4a22'],
      evening: ['#1a2e16','#243818'],
      night: ['#0a140e','#0e1a10']
    },
    trunkTimes: {
      day: '#2a4020',
      evening: '#22301a',
      night: '#10180e'
    },
    cloudTimes: { day: 0.13, evening: 0.10, night: 0.06 },
    mtn:['#6b8ea0','#5f7f88','#4a6168'],
    gnd:['#6d8b56','#5c7a46','#4b6936'],
    tree:['#174a19','#2a7a2a'], trunk:'#5a3d22', cloud:0.12, cactus:false
  },
  {id:'desert',name:'Desert',
    skyTimes: {
      dawn: ['#fde6b8','#fbe8c8','#faeed8'],
      day:  ['#f4d899','#f7e6c9','#fdeed8'],
      evening: ['#8b5a2e','#de8b5a','#f6d7a0'],
      night: ['#17120e','#241b14','#0f0b08']
    },
    sun:1, moon:0, stars:0,
    mtn:['#e0c7a0','#d8b78a','#c9a87a'],
    gnd:['#ead7b0','#e0c28a','#c9a06a'],
    tree:['#2f6032','#6fbf65'], trunk:'#b88a50', cloud:0.06, cactus:true
  },
  {id:'arctic',name:'Arctic',
    skyTimes: {
      dawn: ['#e6f7ff','#dbeeff','#eaf6ff'],
      day:  ['#d8efff','#bfe6ff','#eaf6ff'],
      evening: ['#3b4f6e','#92b0d0','#dbefff'],
      night: ['#041026','#0b1f33','#0f2436']
    },
    sun:0.9, moon:0.1, stars:0,
    mtn:['#cfe6f8','#b8d8ee','#9fbfdc'],
    gnd:['#e8f0f6','#d8e8f0','#c8d8e8'],
    tree:['#9fbfbf','#c0d0d0'], trunk:'#8899a0', cloud:0.08, cactus:false
  }
];

// Time-of-day modifiers
const TIMES = [
  {id:'dawn', name:'Dawn', skyShift:['#ffdca8','#dff0ff','#f6e7cf'], sun:0.6, moon:0, stars:0, starsAllowed:false},
  {id:'day', name:'Day', skyShift:null, sun:1, moon:0, stars:0, starsAllowed:false},
  {id:'evening', name:'Evening', skyShift:['#2e3d6e','#d4726a','#f5b462'], sun:0.6, moon:0.1, stars:0, starsAllowed:false},
  {id:'night', name:'Night', skyShift:['#0a0e1a','#121832','#1a2040'], sun:0, moon:1, stars:1, starsAllowed:true}
];

// Build combined BIOMES array (place x time)
const BIOMES = [];
const SEG_LEN = 480; // length of each (place,time) segment
for(let p=0;p<PLACES.length;p++){
  for(let t=0;t<TIMES.length;t++){
    const P = PLACES[p], T = TIMES[t];
  // choose sky: prefer place-specific per-time palette if present; fall back to T.skyShift or P.skyTimes.day
  const sky = (P.skyTimes && P.skyTimes[T.id]) ? [P.skyTimes[T.id][0], P.skyTimes[T.id][1], P.skyTimes[T.id][2]]
        : (T.skyShift ? [T.skyShift[0], T.skyShift[1], T.skyShift[2]] : [P.skyTimes.day[0],P.skyTimes.day[1],P.skyTimes.day[2]]);
  const mtn = (P.mtnTimes && P.mtnTimes[T.id]) ? P.mtnTimes[T.id].slice() : P.mtn.slice();
  const gnd = (P.gndTimes && P.gndTimes[T.id]) ? P.gndTimes[T.id].slice() : P.gnd.slice();
  const tree = (P.treeTimes && P.treeTimes[T.id]) ? P.treeTimes[T.id].slice() : P.tree.slice();
  const trunk = (P.trunkTimes && P.trunkTimes[T.id]) ? P.trunkTimes[T.id] : P.trunk;
  const cloudVal = (P.cloudTimes && P.cloudTimes[T.id] != null) ? P.cloudTimes[T.id] : P.cloud;
    const name = P.name + ' — ' + T.name;
    BIOMES.push({len:SEG_LEN, sky:sky, sun:T.sun, moon:T.moon, stars:T.stars, mtn:mtn, gnd:gnd, tree:tree, trunk:trunk, cloud:cloudVal, place:P.id, time:T.id, name:name, cactus:P.cactus});
  }
}

const _BC = BIOMES.reduce((s,b)=>s+b.len,0);

function seededRand(n){ return Math.abs(Math.sin(n)*43758.5453123)%1; }

// getCurBiome: returns blended biome and deterministic weather flags
function getCurBiome(dist){
  let d = ((dist%_BC)+_BC)%_BC, acc=0;
  const cycleNum = Math.floor(dist/_BC);
  for(let i=0;i<BIOMES.length;i++){
    const b = BIOMES[i];
    const nx = BIOMES[(i+1)%BIOMES.length];
    if(d < acc + b.len){
      const ib = d-acc, fs = b.len - 120; // blend last 120 units
      let outB = null;
      if(ib < fs){ outB = Object.assign({}, b); }
      else {
        const t = (ib - fs)/120;
        // blend colors
        const blendArr = (a1,a2) => a1.map((c,j)=>{
          const c1 = hexToRgb(c); const c2 = hexToRgb(a2[j]); return lC(c1,c2,t);
        });
        outB = {
          len: b.len,
          sky: blendArr(b.sky, nx.sky),
          sun: lN(b.sun, nx.sun, t), moon: lN(b.moon, nx.moon, t), stars: lN(b.stars, nx.stars, t),
          mtn: blendArr(b.mtn, nx.mtn), gnd: blendArr(b.gnd, nx.gnd), tree: blendArr(b.tree, nx.tree),
          trunk: lC(hexToRgb(b.trunk), hexToRgb(nx.trunk), t), cloud: lN(b.cloud, nx.cloud, t), place: b.place, time: b.time, name: b.name, cactus: b.cactus
        };
      }
      // deterministic weather picks per-cycle & biome
      const seedBase = cycleNum*1009 + i*7919;
      const rCloud = seededRand(seedBase + 11);
      const rRain = seededRand(seedBase + 23);
      const rStars = seededRand(seedBase + 37);
      const rSand = seededRand(seedBase + 53);
      const rSnow = seededRand(seedBase + 67);
      // cloud probability influenced by cloud numeric
      const cloudProb = Math.min(0.95, (outB.cloud||b.cloud)*2.5);
      const cloudy = rCloud < cloudProb;
      const rain = rRain < 0.08; // small chance any biome/time can have rain
      const starsOn = ( (b.time==='night' || outB.time==='night') && rStars < 0.85 );
      const sandOn = (b.place==='desert') && (rSand < 0.22);
      const snowOn = (b.place==='arctic') && (rSnow < 0.18);

      const out = Object.assign({}, outB);
      out._biomeIndex = i; out._cycle = cycleNum;
      out.cloud = cloudy ? (out.cloud||b.cloud) : 0;
      out.stars = starsOn ? (out.stars||b.stars) : 0;
      out.weather = {cloudy:cloudy, rain:rain, starsOn:starsOn, sandstormOn:sandOn, snowOn:snowOn};
      return out;
    }
    acc += b.len;
  }
  return BIOMES[0];
}

window.BIOME_MODULE = {PLACES, TIMES, BIOMES, _BC, getCurBiome};



