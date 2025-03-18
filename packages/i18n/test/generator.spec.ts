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
    (fs.rmSync as jest.Mock).mockReturnValue(undefined); // 确保 rmSync 也被 mock
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined); // 确保 mkdirSync 也被 mock
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined); // 确保 writeFileSync 也被 mock
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should read files correctly', () => {
    jest.isolateModules(() => {
      // dynamically import generator.ts
      import('../src/generator')
        .then(() => {
          expect(fs.readdirSync).toHaveBeenCalledWith(
            expect.stringContaining('locales'),
          );
          expect(fs.readFileSync).toHaveBeenCalledTimes(3);
        })
        .catch((error) => {
          console.log(error);
        });
    });
  });
});
