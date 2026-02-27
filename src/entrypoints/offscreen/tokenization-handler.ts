import { Jieba } from '@node-rs/jieba'
import jiebaDictUrl from '@node-rs/jieba/dict.txt?url'
import { TOKENIZE_REQUEST, TOKENIZE_RESPONSE } from '@/utils/messages'
import cedict, { SearchResults } from 'cc-cedict'
import { WordAnnotation } from '@/utils/types'

async function* lineIterator(stream: ReadableStream): AsyncGenerator<string,void,void> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let leftover: string = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const lines = (leftover + value).split(/\r?\n/);
    leftover = lines.pop() || ''; // Keep the partial line for the next chunk
    for (const line of lines) {
      yield line;
    }
  }
  if (leftover) yield leftover; 
};

async function* filterDictionary(dict: AsyncGenerator<string>, filter: AsyncGenerator<string>) {
  let dictResult: IteratorResult<string> = await dict.next();
  let filterResult: IteratorResult<string> = await filter.next();

  while (!dictResult.done && !filterResult.done) {
    const dictKey = dictResult.value.split(' ')[0];
    const filterKey = filterResult.value;

    if (dictKey < filterKey) {
      dictResult = await dict.next();
    } else if (dictKey > filterKey) {
      //yield filterResult.value;
      filterResult = await filter.next();
    } else { // dictKey === filterKey
      yield dictResult.value;
      dictResult = await dict.next();
      filterResult = await filter.next();
    }
  }
}

async function* sortAg<T>(ag: AsyncGenerator<T>): AsyncGenerator<T> {
  let list: T[] = [];
  for await (const v of ag) {
    list.push(v);
  }
  list.sort();
  for (const v of list) {
    yield v;
  }
}

async function* agMap<T>(a: AsyncGenerator<T>, f: (arg: T) => T): AsyncGenerator<T> {
  for await (const v of a) {
    yield f(v);
  }
}

async function* agFilter<T>(a: AsyncGenerator<T>, f: (arg: T) => boolean): AsyncGenerator<T> {
  for await (const v of a) {
    if (f(v)) yield v;
  }
}

const logLines = <T>(ag: AsyncGenerator<T>, logList: T[]): AsyncGenerator<T> => agMap(
  ag, v => {
    logList.push(v);
    return v;
  },
);

const fetchFilteredDictionary = async (jiebaDictUrl: string, cedictUrl: string): Promise<Uint8Array> => {
  const jeibaDictResponse = await fetch(jiebaDictUrl);
  if (!jeibaDictResponse.ok) {
    throw Error('Failed to fetch jieba dictionary');
  }
  const jiebaDictLines = lineIterator(jeibaDictResponse.body!);

  const cedictResponse = await fetch(cedictUrl);
  if (!cedictResponse.ok) {
    throw Error('Failed to fetch cc-cedict');
  }
  const decompressedStream = cedictResponse.body!
    .pipeThrough(new DecompressionStream('gzip'));
  
  const cedictLines_ = agMap(
    agFilter(
      lineIterator(decompressedStream),
      line => line[0] != '#'
    ),
    line => line.split(' ')[1],
  );
  const cedictLines = sortAg(cedictLines_);
  
  const filteredJiebaLines = filterDictionary(jiebaDictLines, cedictLines);
  const textEncoder = new TextEncoder();
  let totalLength = 0;
  const encodedChunks: Uint8Array[] = [];
  for await (const line of filteredJiebaLines) {
    const encoded = textEncoder.encode(line + '\n');
    encodedChunks.push(encoded);
    totalLength += encoded.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of encodedChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

let jieba: Jieba | null = null;
let creatingJieba: Promise<void> | null = null;
const initJieba = async (): Promise<void> => {
  if (jieba) return;
  if (creatingJieba) {
    await creatingJieba;
  } else {
    creatingJieba = new Promise<void>(async () => {
      const cedictPath = '/cedict_1_0_ts_utf-8_mdbg.txt.gz'
      const filteredJiebaBytes = await fetchFilteredDictionary(
        jiebaDictUrl,
        browser.runtime.getURL(cedictPath),
      );

      // After filteredJiebaBytes is constructed, create a Blob and log its URL for debugging
      const blob = new Blob([filteredJiebaBytes], { type: 'text/plain' });
      console.log('Filtered Jieba blob:', blob);
      const url = URL.createObjectURL(blob);
      console.log('Filtered Jieba dictionary URL:', url); // You can open this URL in your browser to inspect the contents

      jieba = Jieba.withDict(filteredJiebaBytes);
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







