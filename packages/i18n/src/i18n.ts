import i18next from 'i18next';

import translate from './translate';

i18next
  .init({
    lng: 'zh', // 默认语言
    fallbackLng: 'zh', // 当找不到对应翻译时的回退语言
    resources: {
      ...translate,
    },
  })
  .catch((error) => {
    console.error(error);
  });

export default i18next.t.bind(i18next);
