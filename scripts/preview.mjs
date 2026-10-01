import { preview } from 'vite';
import desktop from '../vite.config.js';
import mobile from '../vite.config.mobile.js';
const config=process.argv.includes('--mobile')?mobile:desktop;
const i=process.argv.indexOf('--port');
await preview({...config,configFile:false,preview:{port:i>=0?Number(process.argv[i+1]):4173,strictPort:true}});
