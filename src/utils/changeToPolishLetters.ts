export function changeToPolishLetters(str?: string): string {
    if (!str) {
        return '';
    }

    const polish = [
        { letterOriginal: 'ך', letterPolish: 'e' },
        { letterOriginal: 'ף', letterPolish: 'o' },
        { letterOriginal: '¹', letterPolish: 'a' },
        { letterOriginal: '\x9C', letterPolish: 's' },
        { letterOriginal: '³', letterPolish: 'l' },
        { letterOriginal: '¿', letterPolish: 'z' },
        { letterOriginal: '\x9F', letterPolish: 'z' },
        { letterOriginal: 'ז', letterPolish: 'c' },
        { letterOriginal: 'ס', letterPolish: 'n' },
        { letterOriginal: 'ֺ', letterPolish: 'E' },
        { letterOriginal: '׃', letterPolish: 'O' },
        { letterOriginal: '¥', letterPolish: 'A' },
        { letterOriginal: '\x8C', letterPolish: 'S' },
        { letterOriginal: '£', letterPolish: 'L' },
        { letterOriginal: '¯', letterPolish: 'Z' },
        { letterOriginal: '\x8F', letterPolish: 'Z' },
        { letterOriginal: 'ֶ', letterPolish: 'C' },
        { letterOriginal: 'ׁ', letterPolish: 'N' },
    ];

    return [...str]
        .map((char) => {
            const letterToChange = polish.findIndex(
                (letter) => char === letter.letterOriginal
            );
            return letterToChange > -1
                ? polish[letterToChange].letterPolish
                : char;
        })
        .join('');
}
