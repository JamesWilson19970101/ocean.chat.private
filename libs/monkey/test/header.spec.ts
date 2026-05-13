import { MonkeyHeader } from '../src/codec/header';

describe('MonkeyHeader', () => {
  it('should successfully encode and decode header data', () => {
    const payloadLength = 1024;
    const reqId = 123456;
    const cmd = 0x05;
    const flags = 0x01;

    const buffer = MonkeyHeader.encode({
      cmd,
      flags,
      reqId,
      length: payloadLength,
    });

    expect(buffer.length).toBe(MonkeyHeader.SIZE);

    const decoded = MonkeyHeader.decode(buffer);

    expect(decoded.magic).toBe(MonkeyHeader.MAGIC);
    expect(decoded.version).toBe(MonkeyHeader.VERSION);
    expect(decoded.cmd).toBe(cmd);
    expect(decoded.flags).toBe(flags);
    expect(decoded.reqId).toBe(reqId);
    expect(decoded.length).toBe(payloadLength);
  });

  it('should correctly handle reqId boundaries (0 and 16777215)', () => {
    const minBuffer = MonkeyHeader.encode({
      cmd: 1,
      flags: 0,
      reqId: 0,
      length: 0,
    });
    const maxBuffer = MonkeyHeader.encode({
      cmd: 1,
      flags: 0,
      reqId: 0xffffff,
      length: 0,
    });

    expect(MonkeyHeader.decode(minBuffer).reqId).toBe(0);
    expect(MonkeyHeader.decode(maxBuffer).reqId).toBe(16777215);
  });

  it('should throw when reqId is out of bounds', () => {
    expect(() => {
      MonkeyHeader.encode({ cmd: 1, flags: 0, reqId: -1, length: 0 });
    }).toThrow();

    expect(() => {
      MonkeyHeader.encode({ cmd: 1, flags: 0, reqId: 0xffffff + 1, length: 0 });
    }).toThrow();
  });

  it('should throw when decoding a buffer smaller than 12 bytes', () => {
    const smallBuffer = Buffer.alloc(11);
    expect(() => {
      MonkeyHeader.decode(smallBuffer);
    }).toThrow(/Buffer too small/);
  });
});
