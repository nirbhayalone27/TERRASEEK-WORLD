import {fromUrl} from 'geotiff';
import proj4 from 'proj4';
import {Scene,pairIssues} from './catalog';
import {spectralDifference} from './spectral';
const N=128,RES=20;
export async function analyzePair(a:Scene,b:Scene,lat:number,lon:number,threshold:number,progress:(s:string)=>void,signal:AbortSignal){
 const issues=pairIssues(a,b);if(issues.length)throw Error(issues.join('. '));
 const zone=a.epsg%100;if(![326,327].includes(Math.floor(a.epsg/100))||zone<1||zone>60)throw Error('Only matching UTM Sentinel-2 scenes are supported');
 const crs=`+proj=utm +zone=${zone} ${a.epsg>=32700?'+south':''} +datum=WGS84 +units=m +no_defs`;
 const xy=proj4('EPSG:4326',crs,[lon,lat]);const x=Math.floor(xy[0]/RES)*RES-N*RES/2,y=Math.floor(xy[1]/RES)*RES-N*RES/2;
 const bounds=[x,y,x+N*RES,y+N*RES];
 async function read(scene:Scene,label:string){const out:Record<string,number[]>={};
 for(const k of ['red','green','blue','nir','scl']){signal.throwIfAborted();progress(`${label}: reading ${k==='scl'?'cloud / shadow mask':k+' band'}…`);const asset=scene.assets[k];if(!asset?.href?.startsWith('https://'))throw Error('Missing '+k+' raster');
 async function attempt(url:string){const tiff=await fromUrl(url,{allowFullFile:false},signal);try{const im=await tiff.getImage();const origin=im.getOrigin(),res=im.getResolution();const window=[Math.round((bounds[0]-origin[0])/res[0]),Math.round((bounds[3]-origin[1])/res[1]),Math.round((bounds[2]-origin[0])/res[0]),Math.round((bounds[1]-origin[1])/res[1])];
 if(window[0]<0||window[1]<0||window[2]>im.getWidth()||window[3]>im.getHeight())throw Error('Area crosses the scene edge. Move the center inside this tile.');
 const arr:any=await im.readRasters({window,width:N,height:N,resampleMethod:'nearest',samples:[0],signal});
 const meta=asset['raster:bands']?.[0];if(k!=='scl'&&(!Number.isFinite(meta?.scale)||!Number.isFinite(meta?.offset)))throw Error('Reflectance calibration metadata is missing');
 const scale=k==='scl'?1:meta.scale,offset=k==='scl'||scene.offsetApplied?0:meta.offset;
 out[k]=Array.from(arr[0] as ArrayLike<number>,v=>k!=='scl'&&v===(meta?.nodata??0)?NaN:v*scale+offset);
 }finally{await tiff.close()}}
 try{await attempt(asset.href)}catch(first){signal.throwIfAborted();if(typeof window==='undefined')throw first;progress(`${label}: retrying ${k} through the app…`);try{await attempt('/api/raster?url='+encodeURIComponent(asset.href))}catch{signal.throwIfAborted();throw Error(`${label} ${k} band could not be downloaded from the satellite source or app proxy. Try a different acquisition date or upload a pair of images.`)}}}
 return out as {red:number[];green:number[];blue:number[];nir:number[];scl:number[]};}
 const before=await read(a,'Baseline'),after=await read(b,'Comparison');progress('Computing valid-pixel vegetation and water differences…');
 const stats=spectralDifference(before,after,threshold);if(!stats.valid)throw Error('No comparable clear pixels in this pair. Choose clearer observations or move the study area.');
 function png(bands:typeof before){const canvas=document.createElement('canvas');canvas.width=N;canvas.height=N;const ctx=canvas.getContext('2d')!;const image=ctx.createImageData(N,N);for(let i=0;i<N*N;i++){const valid=[4,5,6].includes(bands.scl[i]);for(let c=0;c<3;c++)image.data[i*4+c]=Math.round(Math.pow(Math.max(0,Math.min(1,bands[['red','green','blue'][c] as 'red'][i]/.3)),1/2.2)*255);image.data[i*4+3]=valid?255:65}ctx.putImageData(image,0,0);return canvas.toDataURL('image/png')}
 function derived(bands:typeof before,kind:'ndvi'|'false'){const canvas=document.createElement('canvas');canvas.width=N;canvas.height=N;const ctx=canvas.getContext('2d')!;const img=ctx.createImageData(N,N);for(let i=0;i<N*N;i++){if(![4,5,6].includes(bands.scl[i])||!Number.isFinite(bands.nir[i])||!Number.isFinite(bands.red[i]))continue;if(kind==='ndvi'){const sum=bands.nir[i]+bands.red[i];if(sum<=.01)continue;const v=Math.max(-1,Math.min(1,(bands.nir[i]-bands.red[i])/sum));const t=(v+1)/2;img.data.set([Math.round(220*(1-t)),Math.round(70+150*t),Math.round(80*(1-t)),255],i*4)}else{for(let c=0;c<3;c++)img.data[i*4+c]=Math.round(Math.pow(Math.max(0,Math.min(1,bands[['nir','red','green'][c] as 'nir'][i]/.4)),1/2.2)*255);img.data[i*4+3]=255}}ctx.putImageData(img,0,0);return canvas.toDataURL('image/png')}
 const canvas=document.createElement('canvas');canvas.width=N;canvas.height=N;const ctx=canvas.getContext('2d')!;const md=ctx.createImageData(N,N);md.data.set(stats.mask);ctx.putImageData(md,0,0);
 const {mask,waterMask,...numbers}=stats;const waterImage=ctx.createImageData(N,N);waterImage.data.set(waterMask);const vegetationMask=canvas.toDataURL();ctx.putImageData(waterImage,0,0);const waterPNG=canvas.toDataURL();return {stats:numbers,ndviBefore:derived(before,'ndvi'),ndviAfter:derived(after,'ndvi'),falseBefore:derived(before,'false'),falseAfter:derived(after,'false'),before:png(before),after:png(after),mask:vegetationMask,waterMask:waterPNG,bounds,epsg:a.epsg,resolution:RES,width:N,height:N,threshold,method:'Sentinel-2 L2A: metadata scale/offset; applied BOA offset respected; common 20 m UTM grid; nearest resampling; valid SCL 4/5/6 intersection; ΔNDVI and ΔNDWI. No semantic model or local co-registration.',warnings:['Exploratory spectral screening; not validated land-use classification.','Season, moisture, shadows and registration error can mimic change.','Provider calibration metadata is used; known provider offset inconsistencies may affect results.','Cloud-free percentage is based on SCL and does not guarantee cloud-free pixels.']};
}
