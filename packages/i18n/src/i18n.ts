import i18next from 'i18next';

import translate from './translate';

i18next
  .init({
    lng: 'zh', // default language
    fallbackLng: 'en', // Choice when no corresponding language is found
    resources: {
      ...translate,
    },
  })
  .catch((error) => {
    console.error(error);
  });

export default i18next.t.bind(i18next);
