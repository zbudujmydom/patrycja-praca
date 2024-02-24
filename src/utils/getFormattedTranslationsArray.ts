import { changeToPolishLetters } from './changeToPolishLetters';

export function getFormatterTranslationsArray(arr: Array<Array<string>>): {
    [key: string]: string;
} {
    const result: { [key: string]: string } = {};
    arr.forEach(([_, id, description]) => {
        if (id?.length > 0) {
            result[id] = changeToPolishLetters(description);
        }
    });
    return result;
}
