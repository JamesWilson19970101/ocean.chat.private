import t from '../src/i18n';
describe('i18n.ts', () => {
  it('should translate to zh', () => {
    console.log(t('HELLO', { name: '小明' }));
    expect(t('HELLO', { name: '小明' })).toBe('你好！小明');
  });
});
