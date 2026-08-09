import { TAG_VARIANTS, tagClass, tagVariant } from './tag-visual';

/**
 * The colour is derived, not stored, so what has to hold is that the derivation
 * is *stable*: a tag keeps its colour across surfaces, sessions and casing.
 * These pin that down — the specific colour a given name lands on is not part
 * of the contract and is free to change with the palette.
 */
describe('tagVisual', () => {
    it('gives the same name the same variant every time', () => {
        expect(tagVariant('hàng đà lạt')).toBe(tagVariant('hàng đà lạt'));
    });

    it('ignores casing and surrounding space, as the server does', () => {
        const canonical = tagVariant('size lớn');
        expect(tagVariant('  SIZE LỚN ')).toBe(canonical);
        expect(tagVariant('Size Lớn')).toBe(canonical);
    });

    it('always lands inside the palette', () => {
        const names = [
            'rau sạch',
            'giá sốc',
            'hàng mới',
            'đặc sản',
            'nhập khẩu',
            'organic',
            '',
            'x',
        ];
        for (const name of names) {
            expect(TAG_VARIANTS).toContain(tagVariant(name));
        }
    });

    it('spreads a realistic tag set over more than one colour', () => {
        // A palette that collapsed everything onto one entry would satisfy
        // every test above while defeating the whole point.
        const names = [
            'rau sạch',
            'giá sốc',
            'hàng mới',
            'đặc sản',
            'nhập khẩu',
            'organic',
            'size lớn',
            'hàng đà lạt',
        ];
        const used = new Set(names.map((name) => tagVariant(name)));
        expect(used.size).toBeGreaterThan(1);
    });

    it('builds a class list carrying both the base and the variant', () => {
        const classes = tagClass('rau sạch').split(' ');
        expect(classes).toContain('ff-tag');
        expect(classes).toContain(`ff-tag--${tagVariant('rau sạch')}`);
    });

    it('treats a missing name as empty rather than throwing', () => {
        expect(() => tagVariant(null)).not.toThrow();
        expect(() => tagVariant(undefined)).not.toThrow();
        expect(tagVariant(null)).toBe(tagVariant(''));
    });
});
