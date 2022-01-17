export declare enum Version {
    WebGL1 = 100,
    WebGL2 = 300
}
export declare function compile(data: ArrayBuffer, version: Version): string;
