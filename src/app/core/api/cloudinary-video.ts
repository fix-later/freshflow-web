import { environment } from 'environments/environment';

/**
 * Cloudinary delivery URLs for video.
 *
 * The sibling `cloudinary-upload.ts` handles the *write* side, where the
 * backend mints a signature and the bytes go browser → Cloudinary. This is the
 * read side, and it needs no credentials at all: delivery URLs are public and
 * built from the cloud name plus the asset's `public_id`.
 *
 * Only `CLOUDINARY_CLOUD_NAME` is ever in the bundle. The API key and secret
 * stay on the server, where the upload signatures are minted — nothing here
 * signs anything.
 */

/** Delivery host. Same origin the upload helper's `secure_url` comes back on. */
const CLOUDINARY_BASE = 'https://res.cloudinary.com';

/**
 * The cloud FreshFlow's public media is served from.
 *
 * A cloud name is **not a credential** — it is the public path segment of every
 * delivery URL, visible in any `<img>` on the site. It is checked in as the
 * default precisely so the storefront's media works out of the box: a
 * contributor with no `.env`, a fork with no CI secrets, and the test runner
 * all render the same video the deployed site does.
 *
 * `CLOUDINARY_CLOUD_NAME` still overrides it, for a deployment serving media
 * from a different account. What never appears here — or anywhere in the bundle
 * — is the API key or secret: those live on the backend, which is what signs
 * uploads.
 */
const DEFAULT_CLOUD_NAME = 'dqpstirdk';

function cloudName(): string {
    return environment.cloudinaryCloudName?.trim() || DEFAULT_CLOUD_NAME;
}

/**
 * `public_id`s are path-like (`folder/name`), so each segment is encoded on its
 * own — encoding the whole thing would turn the separators into `%2F`.
 */
function encodePublicId(publicId: string): string {
    return publicId
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

/**
 * The adaptive-bitrate manifest for a video.
 *
 * `sp_auto` is Cloudinary's automatic streaming profile: it derives the ladder
 * of renditions itself and serves the manifest that points at them, so nothing
 * here has to be transcoded, uploaded or kept in sync — no `.m3u8` and no `.ts`
 * segments are ours to manage. The player asks for this one URL and Cloudinary
 * decides what the network and device can actually take.
 *
 * @example
 * cloudinaryHlsUrl('market-scene_x7lbcm')
 * // https://res.cloudinary.com/<cloud>/video/upload/sp_auto/market-scene_x7lbcm.m3u8
 */
export function cloudinaryHlsUrl(publicId: string): string | null {
    const cloud = cloudName();
    if (!cloud || !publicId) {
        return null;
    }
    return `${CLOUDINARY_BASE}/${cloud}/video/upload/sp_auto/${encodePublicId(publicId)}.m3u8`;
}

/**
 * The progressive MP4, used only when HLS is unavailable or has failed.
 *
 * `q_auto` and `f_auto` let Cloudinary pick the quality and container rather
 * than shipping the master file — a fallback should still not be the original
 * 32MB upload.
 */
export function cloudinaryMp4Url(publicId: string): string | null {
    const cloud = cloudName();
    if (!cloud || !publicId) {
        return null;
    }
    return `${CLOUDINARY_BASE}/${cloud}/video/upload/q_auto,f_auto/${encodePublicId(publicId)}.mp4`;
}

/**
 * A still from the video itself, shown until playback starts.
 *
 * `so_auto` asks Cloudinary to pick a representative frame instead of grabbing
 * whatever happens to be at 0s — the first frame of a market scene is often a
 * blur or a dark cut. Delivered as an auto-format, auto-quality image at a
 * sensible width, so the poster costs a fraction of a video segment.
 */
export function cloudinaryVideoPoster(
    publicId: string,
    width = 1280
): string | null {
    const cloud = cloudName();
    if (!cloud || !publicId) {
        return null;
    }
    return `${CLOUDINARY_BASE}/${cloud}/video/upload/so_auto,f_auto,q_auto,w_${width}/${encodePublicId(publicId)}.jpg`;
}
