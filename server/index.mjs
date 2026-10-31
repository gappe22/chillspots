import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const app = await createApp();
const server = app.listen(port, host, () => {
  console.log(`Chillspots demo app: http://${host}:${port}`);
});
server.on('error', error => {
  console.error(`Unable to start Chillspots: ${error.message}`);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => { process.exitCode = 0; }));
}
