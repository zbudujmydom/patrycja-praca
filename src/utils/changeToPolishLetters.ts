export function changeToPolishLetters(str?: string): string {
    if (!str) {
        return '';
    }

    const polish = [
        { letterOriginal: 'ך', letterPolish: 'ę' },
        { letterOriginal: 'ף', letterPolish: 'ó' },
        { letterOriginal: '¹', letterPolish: 'ą' },
        { letterOriginal: '\x9C', letterPolish: 'ś' },
        { letterOriginal: '³', letterPolish: 'ł' },
        { letterOriginal: '¿', letterPolish: 'ż' },
        { letterOriginal: '\x9F', letterPolish: 'ź' },
        { letterOriginal: 'ז', letterPolish: 'ć' },
        { letterOriginal: 'ס', letterPolish: 'ń' },
        { letterOriginal: 'ֺ', letterPolish: 'Ę' },
        { letterOriginal: '׃', letterPolish: 'Ó' },
        { letterOriginal: '¥', letterPolish: 'Ą' },
        { letterOriginal: '\x8C', letterPolish: 'Ś' },
        { letterOriginal: '£', letterPolish: 'Ł' },
        { letterOriginal: '¯', letterPolish: 'Ż' },
        { letterOriginal: '\x8F', letterPolish: 'Ź' },
        { letterOriginal: 'ֶ', letterPolish: 'Ć' },
        { letterOriginal: 'ׁ', letterPolish: 'Ń' },
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
