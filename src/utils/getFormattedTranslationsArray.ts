import { changeToPolishLetters } from './changeToPolishLetters';

export function getFormatterTranslationsArray(arr: Array<Array<string>>): {
    [key: string]: string;
} {
    const result: { [key: string]: string } = {};
    arr.forEach(([_, id, description]) => {
        if (Number(id) > 0) {
            result[id] = changeToPolishLetters(description);
        }
    });
    return result;
}
