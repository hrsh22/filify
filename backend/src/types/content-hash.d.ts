declare module 'content-hash' {
  export function encode(codec: string, value: string): string;
  export function decode(value: string): string;
  export function fromIpfs(hash: string): string;
  export function fromSwarm(hash: string): string;
  export function fromEthereum(hash: string): string;
  export function getCodec(value: string): string;
}




