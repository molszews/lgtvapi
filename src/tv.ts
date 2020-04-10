import lgtv2 from 'lgtv2';
import retry from 'async-retry';

export interface IWrapper {
  request: (url: string, payload?: any) => Promise<any>
  disconnect: () => void;
}

const wrapper = (lgtv: any): IWrapper => {
  const _request = (url: string, payload?: any) => new Promise<any>(function (resolve, reject) {
    lgtv.request(url, payload, function (err: any, res: any) {
      if (err) { return reject(err); }
      resolve(res);
    })
  });

  return {
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