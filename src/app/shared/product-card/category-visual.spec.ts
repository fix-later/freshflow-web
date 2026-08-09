import { categoryVisual } from './category-visual';

/**
 * The stand-in picture is what a guest's whole catalogue looks like — the real
 * photos live behind `GET /products`, which needs a role. So what matters is
 * that it always returns something renderable and never mislabels a category.
 */
describe('categoryVisual', () => {
    it('matches a category by keyword', () => {
        expect(categoryVisual('Trái cây nhập').emoji).toBe('🍊');
        expect(categoryVisual('Hải sản tươi').emoji).toBe('🐟');
        expect(categoryVisual('Rau ăn lá').emoji).toBe('🥬');
    });

    it('matches without diacritics, the way the category may be typed', () => {
        expect(categoryVisual('trai cay').emoji).toBe(
            categoryVisual('Trái cây').emoji
        );
    });

    it('prefers the narrower rule when two could match', () => {
        expect(categoryVisual('Trái cây nhập khẩu').emoji).toBe('🍊');
        expect(categoryVisual('Hải sản đông lạnh').emoji).toBe('🐟');
    });

    it('splits on punctuation, so "Củ - Quả" reads as two words', () => {
        expect(categoryVisual('Củ - Quả').emoji).toBe('🥕');
        expect(categoryVisual('Củ, Quả').emoji).toBe('🥕');
    });

    it('matches whole words only, so folded near-homographs do not collide', () => {
        // "lạ" (strange) folds to the same "la" as "lá" (leaf). Matching on
        // substrings — or on a bare `la` keyword — painted this as a vegetable.
        expect(categoryVisual('Ngành hàng lạ').emoji).toBe('🧺');
        // "cao" contains "ca"; it must not read as seafood.
        expect(categoryVisual('Cao cấp').emoji).toBe('🧺');
    });

    it('falls back to a neutral basket rather than guessing', () => {
        const unknown = categoryVisual('Đồ dùng một lần');
        expect(unknown.emoji).toBe('🧺');
        expect(unknown.thumbTint).toContain('gradient');
    });

    it('always returns a tint, including for an absent category', () => {
        for (const value of ['', null, undefined]) {
            const visual = categoryVisual(value);
            expect(visual.emoji).toBeTruthy();
            expect(visual.thumbTint).toBeTruthy();
        }
    });
});
