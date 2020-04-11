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
  response.send('');
});

app.get('/update-full', async (request, response) => {
  const output = spawnSync('nohup', ['sh', './update.sh']);
  const stdout = (output.stdout as unknown as Buffer).toString();
  const stderr = (output.stderr as unknown as Buffer).toString();
  response.type('json').send(JSON.stringify({ stdout: stdout, stderr: stderr }, null, 2) + '\n');
});

app.get('/update', async (request, response) => {
  const output = spawnSync('nohup', ['sh', './update-roll.sh']);
  const stdout = (output.stdout as unknown as Buffer).toString();
  const stderr = (output.stderr as unknown as Buffer).toString();
  response.type('json').send(JSON.stringify({ stdout: stdout, stderr: stderr }, null, 2) + '\n');
});

app.get('/system/turnOn', async (request, response) => {
  try {
    await turnOn();
    response.json({});
  }
  catch (e) {
    response.json(e);
  }
});

app.get('/system/turnOff', async (request, response) => {
  const lgtv = await tv();
  return response.json(await lgtv.request('ssap://system/turnOff'));
});

appGet('/tv/openChannel/:channelNo', async (lgtv, request, response) => {
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

appGet('/tv/sendButton/:button', async (lgtv, request, response) =>
  await lgtv.sendButton((request.params.button ?? '').toString().toUpperCase()));

appGet('/tv/switchInput/:input', async (lgtv, request, response) =>
  await lgtv.request('ssap://tv/switchInput', { inputId: request.params.input }));

appGet('/tv/getChannelList', async (lgtv, request, response) =>
  await lgtv.request('ssap://tv/getChannelList'));

appGet('/audio/getVolume', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/getVolume'));

appGet('/audio/volumeDown', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/volumeDown'));

appGet('/audio/volumeUp', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/volumeUp'));

const getVolume = async (lgtv: any) => {
  const volume = await lgtv.request('ssap://audio/getVolume');
  return Number(volume?.volume ?? 0);
}

appGet('/audio/volumeUp/:delta', async (lgtv, request, response) => {
  const volume = await getVolume(lgtv);
  const delta = Number(request.params.delta);
  return await lgtv.request('ssap://audio/setVolume', { volume: volume + delta });
});

appGet('/audio/volumeDown/:delta', async (lgtv, request, response) => {
  const volume = await getVolume(lgtv);
  const delta = Number(request.params.delta);
  return await lgtv.request('ssap://audio/setVolume', { volume: volume - delta });
});

appGet('/audio/setMuteOn', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/setMute', { 'mute': true }));

appGet('/audio/setMuteOff', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/setMute', { 'mute': false }));

appGet('/audio/getStatus', async (lgtv, request, response) =>
  await lgtv.request('ssap://audio/getStatus'));

appGet('/tv/getExternalInputList', async (lgtv, request, response) =>
  await lgtv.request('ssap://tv/getExternalInputList'));

appGet('/media.controls/play', async (lgtv, request, response) =>
  await lgtv.request('ssap://media.controls/play'));

appGet('/media.controls/pause', async (lgtv, request, response) =>
  await lgtv.request('ssap://media.controls/pause'));

appGet('/launch/netflix', async (lgtv, request, response) =>
  await lgtv.request('ssap://system.launcher/launch', { id: 'netflix' }));

appGet('/launch/youtube', async (lgtv, request, response) =>
  await lgtv.request('ssap://system.launcher/launch', { id: 'youtube.leanback.v4' }));

appGet('/launch/spotify', async (lgtv, request, response) =>
  await lgtv.request('ssap://system.launcher/launch', { id: 'spotify-beehive' }));

appGet('/listLaunchPoints', async (lgtv, request, response) =>
  await lgtv.request('ssap://com.webos.applicationManager/listLaunchPoints'));

appGet('/getAppState', async (lgtv, request, response) =>
  await lgtv.request('ssap://system.launcher/getAppState'));

appGet('/getCurrentChannel', async (lgtv, request, response) =>
  await lgtv.request('ssap://tv/getCurrentChannel'));

app.listen(3000, () => console.log('Listen'));
