// https://github.com/hobbyquaker/lgtv2

import express, { Request, Response } from 'express';
import tv, { IWrapper } from './tv';
import wol from 'node-wol';
import { spawnSync } from 'child_process';
import retry from 'async-retry';
import ping from 'ping';

// const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const runWol = () => {
  wol.wake('38:8C:50:53:C4:81', (error: any) => { });
};

const turnOn = async () => {
  await retry(async (bail, i) => {
    runWol();
    console.log(`[%%] sending wol + ping.. #${i}`);
    let res = await ping.promise.probe('lgwebostv', { timeout: 1 });
    if (!res.alive) {
      throw "offline";
    }
    return;
  }, {
    retries: 60, minTimeout: 100, factor: 1, randomize: false
  })

  return await retry(async (bail, i) => {
    console.log('[%%] connecting to ws.. #' + i);
    return await tv();
  }, {
    retries: 60, minTimeout: 250, factor: 1, randomize: false
  })
};

const app = express();

app.use((req, res, next) => {
  console.log(`[%%] ${req.socket.remoteAddress} ${req.method} ${req.originalUrl}`);
  next()
});

const appGet = (path: string, handler: (lgtv: IWrapper, request: Request<any>, response: Response<any>) => Promise<any>) => {
  app.get(path, async (request, response) => {
    try {
      const lgtv = await turnOn();
      try {
        const payload = await handler(lgtv, request, response);
        response.type('json').send(JSON.stringify({ type: 'ok', ...payload }, null, 2) + '\n');
      } finally {
        lgtv.disconnect();
      }
    } catch (error) {
      response.type('json').send(JSON.stringify({ type: 'error', ...error }, null, 2) + '\n');
    }
  });
}

app.get('/', async (request, response) => {
  response.send('ready to go');
});

app.get('/tv', async (request, response) => {
  response.send('ready to go');
});

app.get('/tv/update-full', async (request, response) => {
  const output = spawnSync('nohup', ['sh', './update.sh']);
  const stdout = (output.stdout as unknown as Buffer).toString();
  const stderr = (output.stderr as unknown as Buffer).toString();
  response.type('json').send(JSON.stringify({ stdout: stdout, stderr: stderr }, null, 2) + '\n');
});

app.get('/tv/update', async (request, response) => {
  const output = spawnSync('nohup', ['sh', './update-roll.sh']);
  const stdout = (output.stdout as unknown as Buffer).toString();
  const stderr = (output.stderr as unknown as Buffer).toString();
  response.type('json').send(JSON.stringify({ stdout: stdout, stderr: stderr }, null, 2) + '\n');
});

app.get('/tv/on', async (request, response) => {
  try {
    await turnOn();
    response.json({});
  }
  catch (e) {
    response.json(e);
  }
});

app.get('/tv/off', async (request, response) => {
  const lgtv = await tv();
  return response.json(await lgtv.request('ssap://system/turnOff'));
});

appGet('/tv/channels', async (lgtv, request, response) =>
  await lgtv.request('ssap://tv/getChannelList'));

appGet('/tv/channel', async (lgtv, request, response) =>
  await lgtv.request('ssap://tv/getCurrentChannel'));

appGet('/tv/channels/:channelNo', async (lgtv, request, response) => {
  await lgtv.request('ssap://system.launcher/launch', { id: 'com.webos.app.livetv' });
  await retry(async bail => {
    const res = await lgtv.request('ssap://tv/getCurrentChannel');
    if (!res.returnValue) {
      throw '[!!] not in tv mode yet';
    }
    return;
  }, {
    retries: 15, minTimeout: 100, factor: 1, randomize: false
  });
  await lgtv.request('ssap://tv/openChannel', { channelNumber: request.params.channelNo });
});

appGet('/tv/buttons/:button', async (lgtv, request, response) =>
  await lgtv.sendButton((request.params.button ?? '').toString().toUpperCase()));

appGet('/tv/inputs', async (lgtv, request, response) =>
  await lgtv.request('ssap://tv/getExternalInputList'));

appGet('/tv/inputs/:input', async (lgtv, request, response) =>
  await lgtv.request('ssap://tv/switchInput', { inputId: request.params.input }));

appGet('/tv/volume', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/getVolume'));

appGet('/tv/volume/down', async (lgtv, request, response) =>
  await changeVolume(lgtv, -3));

appGet('/tv/volume/up', async (lgtv, request, response) =>
  await changeVolume(lgtv, 3));

const getVolume = async (lgtv: any) => {
  const volume = await lgtv.request('ssap://audio/getVolume');
  return Number(volume?.volume ?? 0);
}
const changeVolume = async (lgtv: any, delta: number) => {
  const volume = await getVolume(lgtv);
  return await lgtv.request('ssap://audio/setVolume', { volume: volume + delta });
}

appGet('/tv/volume/up/:delta', async (lgtv, request, response) =>
  await changeVolume(lgtv, Number(request.params.delta)));

appGet('/tv/volume/down/:delta', async (lgtv, request, response) =>
  await changeVolume(lgtv, -Number(request.params.delta)));

appGet('/tv/mute', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/setMute', { 'mute': true }));

appGet('/tv/unmute', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/setMute', { 'mute': false }));

appGet('/tv/audio', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/getStatus'));

appGet('/tv/play', async (lgtv, request, response) =>
  await lgtv.request('ssap://media.controls/play'));

appGet('/tv/pause', async (lgtv, request, response) =>
  await lgtv.request('ssap://media.controls/pause'));

appGet('/tv/apps', async (lgtv, request, response) =>
  await lgtv.request('ssap://com.webos.applicationManager/listLaunchPoints'));

appGet('/tv/apps/state', async (lgtv, request, response) =>
  await lgtv.request('ssap://system.launcher/getAppState'));

appGet('/tv/netflix', async (lgtv, request, response) =>
  await lgtv.request('ssap://system.launcher/launch', { id: 'netflix' }));

appGet('/tv/youtube', async (lgtv, request, response) =>
  await lgtv.request('ssap://system.launcher/launch', { id: 'youtube.leanback.v4' }));

appGet('/tv/spotify', async (lgtv, request, response) =>
  await lgtv.request('ssap://system.launcher/launch', { id: 'spotify-beehive' }));

app.listen(3000, () => console.log('Listen'));
