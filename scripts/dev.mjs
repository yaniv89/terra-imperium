import {createServer} from 'vite';
import config from '../vite.config.js';
const server=await createServer({...config,configFile:false});await server.listen();server.printUrls();
