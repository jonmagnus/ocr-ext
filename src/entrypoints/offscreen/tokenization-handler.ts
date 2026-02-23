import { Jieba } from '@node-rs/jieba'
import dictUrl from '@node-rs/jieba/dict.txt?url'
import { TOKENIZE_REQUEST, TOKENIZE_RESPONSE } from '@/utils/messages'
import cedict, { SearchResults } from 'cc-cedict'
import { WordAnnotation } from '@/utils/types'

let jieba: Jieba | null = null;
let creatingJieba: Promise<void> | null = null;
const initJieba = async (): Promise<void> => {
  if (jieba) return;
  if (creatingJieba) {
    await creatingJieba;
  } else {
    creatingJieba = new Promise(async (_resolve, reject) => {
      const fetchResponse = await fetch(dictUrl);
      if (!fetchResponse.ok) {
        reject('Failed to fetch jieba dictionary');
      }
      const dictBytes = await fetchResponse.bytes();
      console.log('Fetched dictionary with response ', fetchResponse);
      jieba = Jieba.withDict(dictBytes);
    });
    await creatingJieba;
    creatingJieba = null;
  }
}
initJieba();

export const handleTokenizeRequest = async (message: TOKENIZE_REQUEST): Promise<TOKENIZE_RESPONSE> => {
  await initJieba();
  const cut = jieba!.cut(message.payload.text);
  const annotation: Array<WordAnnotation> = cut.map((key: string) => {
    const entry: SearchResults = cedict.getBySimplified(
      key, null, { asObject: false, allowVariants: false },
    );
    if (!entry) {
      return { key, entry: [] };
    } else {
      if (!Array.isArray(entry)) {
        throw Error('Did not receive array from dictionary');
      }
      return { key, entry };
    }
  })
  console.warn('TOKENIZE_RESPONSE with annotation: ', annotation);
  const tokenizeResponse: TOKENIZE_RESPONSE = {
    type: 'TOKENIZE_RESPONSE',
    payload: {
      cut,
      annotation,
    },
  };
  return tokenizeResponse;
}
