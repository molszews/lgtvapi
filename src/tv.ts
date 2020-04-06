import lgtv2 from 'lgtv2';

export interface IWrapper{
  request: (url: string, payload?: any) => Promise<any>
  disconnect: () => void;
}

const wrapper = (lgtv: any): IWrapper => {
  return {
    request: (url: string, payload?: any) => new Promise<any>(function (resolve, reject) {
      lgtv.request(url, payload, function (err: any, res: any) {
        if (err) { return reject(err); }
        resolve(res);
      })
    }),
    disconnect: () => lgtv.disconnect()
  };
};

export default async () => new Promise<IWrapper>(function (resolve, reject) {
  var lgtv = lgtv2({ url: 'ws://lgwebostv:3000' });
  lgtv.on('connect', () => resolve(wrapper(lgtv)));
  lgtv.on('error', (err: any) => reject(err));
});