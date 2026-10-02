import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {handler as suno} from '../netlify/functions/suno.mjs';
import {handler as callback} from '../netlify/functions/callback.mjs';
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://localhost:8888').pathname;
  if(path.startsWith('/.netlify/functions/')) {
   let body='';for await(const chunk of req){body+=chunk;if(body.length>24000){res.writeHead(413);res.end();return;}}
   const fn=path.endsWith('/suno')?suno:path.endsWith('/callback')?callback:null;
   if(!fn){res.writeHead(404);res.end();return;}
   const r=await fn({httpMethod:req.method,headers:req.headers,body});res.writeHead(r.statusCode,r.headers);res.end(r.body);return;
  }
  const files=['/index.html','/styles.css','/app.js','/favicon.svg'];
  const file=path==='/'?'/index.html':path;
  if(!files.includes(file)){res.writeHead(404);res.end();return;}
  const ext=file.slice(file.lastIndexOf('.'));res.writeHead(200,{'Content-Type':types[ext]});res.end(await readFile(new URL('../public'+file,import.meta.url)));
 } catch {res.writeHead(500);res.end('Server error');}
}).listen(8888,'0.0.0.0',()=>console.log('FORMA ready at http://localhost:8888'));
