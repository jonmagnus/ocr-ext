import { WordAnnotation } from '@/utils/types'

const createWordContainer = (ann: WordAnnotation): HTMLSpanElement => {
  const wordWrapper = document.createElement('span');
  wordWrapper.className = 'word-wrapper';
  wordWrapper.textContent = ann.key;
  const wordPopup = document.createElement('div');
  wordPopup.className = 'word-popup';
  for (const e of ann.entry) {
    const entryDiv = document.createElement('div');
    entryDiv.innerHTML = `
<p>${e.simplified}</p>
<p>${e.pinyin}</p>
`;
    const translationUl = document.createElement('ul');
    for (const meaning of e.english) {
      const meaningLi = document.createElement('li');
      meaningLi.textContent = meaning;
      translationUl.appendChild(meaningLi);
    }
    entryDiv.appendChild(translationUl);
    wordPopup.appendChild(entryDiv);
  }
  wordWrapper.appendChild(wordPopup);
  return wordWrapper;
}

export const createTokenContainer = (annotation: Array<WordAnnotation>): HTMLDivElement => {
  const tokenContainer = document.createElement('div');
  const tokenP = document.createElement('p');
  for (const ann of annotation) {
    if (ann.entry.length) {
      tokenP.appendChild(createWordContainer(ann));
    } else {
      tokenP.innerHTML += ann.key;
    }
  }
  tokenContainer.appendChild(tokenP);
  return tokenContainer;
}
