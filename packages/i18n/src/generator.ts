import fs from 'fs';
import path from 'path';

// Get the directory of the current script
const currentDir: string = __dirname;

const files: string[] = fs.readdirSync(`${currentDir}/locales`);
const en: string = fs.readFileSync(
  `${currentDir}/locales/en.i18n.json`,
  'utf8',
);

const generateJson: (files: string[]) => string = (files) =>
  files
    .map((file) => {
      // Extract the json object and generate the js object later
      const lang: string = path.basename(file, '.i18n.json');
      const parsedJson: Record<string, string> = JSON.parse(
        fs.readFileSync(`${currentDir}/locales/${file}`, 'utf8'),
      );
      return `\n"${lang}": ${JSON.stringify(parsedJson, null, 2)}`;
    })
    .join(',');
const contents: string = generateJson(files);

// Simulate esm export
const esm = `export default {
	${contents}
}`;

// By default, en.i18n.json has the most complete translations.
const keys = Object.keys(JSON.parse(en) as Record<string, string>);

// Simulate ts declarations
const declarations = `export interface OceanchatI18n {
	${keys.map((key) => `${JSON.stringify(key)}: string;`).join('\n\t')}
}

const dict: {
	[language: string]: OceanchatI18n;
};

export type OceanchatI18nKeys = keyof OceanchatI18n;

export = dict;
`;

// write the files
if (fs.existsSync(`./dist`)) {
  fs.rmSync(`./dist`, { recursive: true });
}

fs.mkdirSync(`./dist`);

fs.writeFileSync(`./dist/index.js`, esm);
fs.writeFileSync(`./dist/index.d.ts`, declarations);
