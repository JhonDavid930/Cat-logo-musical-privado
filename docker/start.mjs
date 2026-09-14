import { readFileSync } from 'node:fs';
for(const key of ['CATALOG_PASSWORD_HASH','CATALOG_SESSION_SECRET']){const file=process.env[key+'_FILE'];if(file)process.env[key]=readFileSync(file,'utf8').trim();}
await import('../server.js');
