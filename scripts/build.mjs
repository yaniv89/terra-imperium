import { build } from 'vite';
import desktop from '../vite.config.js';
import mobile from '../vite.config.mobile.js';
const config=process.argv.includes('--mobile')?mobile:desktop;
const i=process.argv.indexOf('--outDir');
await build({ ...config, configFile: false, build:{...config.build,...(i>=0?{outDir:process.argv[i+1]}:{})} });
