import { MonkeyFramer } from '../src/codec/framer';
import { MonkeyHeader } from '../src/codec/header';

describe('MonkeyFramer', () => {
  it('should successfully frame and unframe a WS message', () => {
    const payload = Buffer.from('hello world');
    const headerData = {
      cmd: 0x05,
      flags: 0x01,
      reqId: 123456,
    };

    const framedBuffer = MonkeyFramer.frameWSMessage(headerData, payload);

    expect(framedBuffer.length).toBe(MonkeyHeader.SIZE + payload.length);

    const unframed = MonkeyFramer.unframeWSMessage(framedBuffer);

    expect(unframed.header.cmd).toBe(headerData.cmd);
    expect(unframed.header.flags).toBe(headerData.flags);
    expect(unframed.header.reqId).toBe(headerData.reqId);
    expect(unframed.header.length).toBe(payload.length);
    expect(unframed.payload.toString()).toBe('hello world');
  });

  it('should throw when unframing a buffer smaller than header size', () => {
    const smallBuffer = Buffer.alloc(MonkeyHeader.SIZE - 1);
    expect(() => MonkeyFramer.unframeWSMessage(smallBuffer)).toThrow(
      'Buffer too small to contain Monkey Header',
    );
  });

  it('should throw when magic number is invalid', () => {
    const payload = Buffer.from('test');
    const headerData = {
      cmd: 1,
      flags: 0,
      reqId: 1,
    };
    const framedBuffer = MonkeyFramer.frameWSMessage(headerData, payload);

    // Corrupt magic number
    framedBuffer.writeUInt16BE(0x0000, 0);

    expect(() => MonkeyFramer.unframeWSMessage(framedBuffer)).toThrow(
      'Invalid Magic Number',
    );
  });

  it('should throw when payload length does not match header length', () => {
    const payload = Buffer.from('test');
    const headerData = {
      cmd: 1,
      flags: 0,
      reqId: 1,
    };
    const framedBuffer = MonkeyFramer.frameWSMessage(headerData, payload);

    // Corrupt length field
    framedBuffer.writeUInt32BE(payload.length + 1, 8);

    expect(() => MonkeyFramer.unframeWSMessage(framedBuffer)).toThrow(
      /Payload length mismatch/,
    );
  });

  it('should throw when actual buffer length is smaller than header specifies', () => {
    const payload = Buffer.from('test');
    const headerData = {
      cmd: 1,
      flags: 0,
      reqId: 1,
    };
    const framedBuffer = MonkeyFramer.frameWSMessage(headerData, payload);

    // Truncate buffer
    const truncatedBuffer = framedBuffer.subarray(
      0,
      MonkeyHeader.SIZE + payload.length - 1,
    );

    expect(() => MonkeyFramer.unframeWSMessage(truncatedBuffer)).toThrow(
      /Payload length mismatch/,
    );
  });

  it('should throw when payload length exceeds 16KB during framing', () => {
    const payload = Buffer.alloc(16385);
    const headerData = { cmd: 1, flags: 0, reqId: 1 };
    expect(() => MonkeyFramer.frameWSMessage(headerData, payload)).toThrow(
      /protocol hard limit of 16KB/,
    );
  });

  it('should throw when payload length exceeds 16KB during unframing', () => {
    const payload = Buffer.alloc(16385);
    const headerBuffer = Buffer.alloc(MonkeyHeader.SIZE);
    headerBuffer.writeUInt16BE(MonkeyHeader.MAGIC, 0);
    headerBuffer.writeUInt8(MonkeyHeader.VERSION, 2);
    headerBuffer.writeUInt8(1, 3);
    headerBuffer.writeUInt8(0, 4);
    headerBuffer.writeUIntBE(1, 5, 3);
    headerBuffer.writeUInt32BE(16385, 8);

    const framedBuffer = Buffer.concat([headerBuffer, payload]);

    expect(() => MonkeyFramer.unframeWSMessage(framedBuffer)).toThrow(
      /protocol hard limit of 16KB/,
    );
  });
});
