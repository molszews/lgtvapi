import lgtv2 from 'lgtv2';
import retry from 'async-retry';

export interface IWrapper {
  request: (url: string, payload?: any) => Promise<any>;
  sendButton: (button: string) => Promise<any>;
  disconnect: () => void;
}

const wrapper = (lgtv: any): IWrapper => {

  const _request = (url: string, payload?: any) => new Promise<any>((resolve, reject) =>
    lgtv.request(url, payload, (err: any, res: any) => err ? reject(err) : resolve(res))
  );

  const _sendSocket = (type: string, payload?: any) => new Promise<any>((resolve, reject) =>
    lgtv.getSocket('ssap://com.webos.service.networkinput/getPointerInputSocket', (err: any, sock: any) =>
      err ? reject(err) : resolve(sock.send(type, payload))
    )
  );

  return {
    sendButton: async (button: string) =>
      await retry(async (bail, i) => {
        console.log(`[tv] Button ${button} #${i}`);
        return await _sendSocket('button', { name: button });
      }, {
        retries: 60, minTimeout: 250, factor: 1, randomize: false
      }),
    request: async (url: string, payload?: any) =>
      await retry(async (bail, i) => {
        console.log(`[tv] ${url} #${i}`);
        return await _request(url, payload);
      }, {
        retries: 60, minTimeout: 250, factor: 1, randomize: false
      }),
    disconnect: () => lgtv.disconnect()
  };
};

export default async () => new Promise<IWrapper>(function (resolve, reject) {
  var lgtv = lgtv2({ url: 'ws://lgwebostv:3000', timeout: 250, reconnect: null });
  lgtv.on('connect', () => resolve(wrapper(lgtv)));
  lgtv.on('error', (err: any) => reject(err));
  lgtv.on('close', (err: any) => reject(err));
});