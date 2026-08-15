import { environment } from 'environments/environment';
import {
    cloudinaryHlsUrl,
    cloudinaryMp4Url,
    cloudinaryVideoPoster,
} from './cloudinary-video';

/**
 * These URLs are the whole contract with Cloudinary: get a transformation
 * segment wrong and the asset 404s at play time, which is exactly when it is
 * least visible in development.
 */
describe('Cloudinary video URLs', () => {
    const cloud = environment.cloudinaryCloudName?.trim() || 'dqpstirdk';

    it('builds an adaptive-bitrate manifest from the public id', () => {
        // `sp_auto` is what makes Cloudinary generate and serve the ladder, so
        // nothing here has to produce or host `.m3u8` / `.ts` files.
        expect(cloudinaryHlsUrl('market-scene_x7lbcm')).toBe(
            `https://res.cloudinary.com/${cloud}/video/upload/sp_auto/market-scene_x7lbcm.m3u8`
        );
    });

    it('builds a transformed MP4 for the fallback, not the master upload', () => {
        const url = cloudinaryMp4Url('market-scene_x7lbcm') ?? '';

        expect(url.endsWith('/market-scene_x7lbcm.mp4')).toBeTrue();
        // The point of the fallback is that it is still not the 32MB original.
        expect(url).toContain('q_auto,f_auto');
    });

    it('asks Cloudinary to choose the poster frame', () => {
        const url = cloudinaryVideoPoster('market-scene_x7lbcm') ?? '';

        // `so_auto` picks a representative frame; frame 0 of a market scene is
        // often a blur or a dark cut.
        expect(url).toContain('so_auto');
        expect(url).toContain('w_1280');
        expect(url.endsWith('.jpg')).toBeTrue();
    });

    it('keeps folder separators in a path-like public id', () => {
        const url = cloudinaryHlsUrl('home/hero/market scene') ?? '';

        // Encoded per segment: encoding the whole id would turn the folder
        // separators into `%2F` and address a different asset.
        expect(url).toContain('/home/hero/market%20scene.m3u8');
    });

    it('returns null for an empty public id rather than a broken URL', () => {
        expect(cloudinaryHlsUrl('')).toBeNull();
        expect(cloudinaryMp4Url('')).toBeNull();
        expect(cloudinaryVideoPoster('')).toBeNull();
    });
});
