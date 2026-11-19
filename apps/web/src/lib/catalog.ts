export type Scene={id:string;date:string;cloud:number;sensor:string;thumbnail?:string;source:string;epsg:number;tile:string;assets:Record<string,any>;offsetApplied:boolean;baseline:string};
export function validateSearch(b:any){
 if(!b||typeof b!=='object')throw Error('Invalid search');
 const {lat,lon,start,end}=b; const cloud=b.cloud??25;
 const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>80||Math.abs(lon)>180)throw Error('Use latitude −80 to 80 and longitude −180 to 180');
 if(!date(start)||!date(end)||start>end)throw Error('Choose a valid date interval');
 if(!Number.isFinite(cloud)||cloud<0||cloud>100)throw Error('Cloud limit must be 0–100%');
 return {lat,lon,start,end,cloud};
}
export function normalizeScene(f:any):Scene{return {id:f.id,date:f.properties.datetime,cloud:f.properties['eo:cloud_cover'],sensor:f.properties.platform,thumbnail:f.assets.thumbnail?.href,source:f.links?.find((l:any)=>l.rel==='self')?.href,epsg:f.properties['proj:epsg'],tile:f.properties['grid:code']||f.properties['s2:mgrs_tile']||f.id.split('_')[1],assets:Object.fromEntries(['red','green','blue','nir','scl'].filter(k=>f.assets[k]).map(k=>[k,f.assets[k]])),offsetApplied:f.properties['earthsearch:boa_offset_applied']===true,baseline:f.properties['s2:processing_baseline']||'unknown'};}
export function pairIssues(a:Scene,b:Scene){const issues:string[]=[];if(a.id===b.id)issues.push('Choose two different observations');if(a.date>=b.date)issues.push('Baseline must precede comparison');if(!a.epsg||a.epsg!==b.epsg||a.tile!==b.tile)issues.push('Choose observations from the same tile and projection');return issues;}
