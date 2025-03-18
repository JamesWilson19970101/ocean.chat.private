import '../src/generator';

import fs from 'fs';

jest.mock('fs');
describe('generator.ts', () => {
  const mockFiles = ['en.i18n.json', 'zh.i18n.json'];

  const mockEnContents = {
    greeting: 'Hello',
    farewell: 'Goodbye',
    welcome: 'Welcome',
  };

  const mockZhContent = {
    greeting: '你好',
    farewell: '再见',
  };

  const mockDistDir = './dist';

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods, similar to the state of just initializing the mock.
    jest.clearAllMocks();

    // Mock fs.readdirSync
    (fs.readdirSync as jest.Mock).mockReturnValue(mockFiles);

    // mock implementation
    (fs.readFileSync as jest.Mock).mockImplementation(
      (filePath: string): string => {
        if (filePath.endsWith('en.i18n.json')) {
          return JSON.stringify(mockEnContents);
        }
        if (filePath.endsWith('zh.i18n.json')) {
          return JSON.stringify(mockZhContent);
        }
        return '';
      },
    );

    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should read files correctly', () => {
    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('locales/'),
    );
    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('locales/en.i18n.json'),
      'utf8',
    );
    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringContaining('locales/zh.i18n.json'),
      'utf8',
    );
  });

  it('should remove the existing dist directory', () => {
    expect(fs.rmSync).toHaveBeenCalledWith(mockDistDir, { recursive: true });
  });
});
