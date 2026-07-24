import { foldSearchText, includesFolded } from './text-search';

describe('foldSearchText', () => {
    it('strips Vietnamese diacritics and lowercases', () => {
        expect(foldSearchText('Hải sản')).toBe('hai san');
        expect(foldSearchText('Củ - Quả')).toBe('cu - qua');
        expect(foldSearchText('Đường')).toBe('duong');
    });
});

describe('includesFolded', () => {
    it('matches accented text with an unaccented query', () => {
        expect(includesFolded('Hải sản', 'hai san')).toBe(true);
        expect(includesFolded('Củ - Quả', 'cu')).toBe(true);
        expect(includesFolded('Đường phố', 'duong')).toBe(true);
    });

    it('still matches when both sides have accents', () => {
        expect(includesFolded('Hải sản', 'Hải')).toBe(true);
    });

    it('treats a blank needle as a match', () => {
        expect(includesFolded('anything', '  ')).toBe(true);
    });

    it('rejects non-matching terms', () => {
        expect(includesFolded('Rau củ', 'thit')).toBe(false);
    });
});
