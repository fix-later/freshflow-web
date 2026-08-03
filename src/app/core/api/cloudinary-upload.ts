import { parseJson, unwrapData } from './envelope';

/**
 * Signed Cloudinary upload params minted by the backend's
 * `POST .../upload-signature` endpoints (products, categories, markets,
 * avatars, business licences, proof of delivery, procurement exceptions).
 *
 * Every one of those endpoints returns this same shape: the signature is
 * computed over `folder` + `timestamp`, so those exact params must be
 * forwarded to Cloudinary alongside the file or the upload is rejected.
 */
export interface UploadSignature {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
}

/** Minimal shape of a generated `*Raw` call — just the piece we read. */
type SignatureResponse = { raw: Response };

/**
 * Uploads `file` straight to Cloudinary using a short-lived signature minted
 * by `sign`, and resolves to the hosted `secure_url`.
 *
 * The image never passes through our backend: `sign` only mints credentials,
 * the bytes go browser → Cloudinary, and the caller persists the returned URL
 * on whatever record it belongs to. Backend validators accept only
 * `https://res.cloudinary.com/...` URLs of at most 512 characters, which is
 * exactly what `secure_url` is — so the result can be saved as-is.
 *
 * @example
 * const url = await uploadSignedImage(file, () =>
 *     productsApi.apiV1ProductsImageUploadSignaturePostRaw()
 * );
 */
export async function uploadSignedImage(
    file: File,
    sign: () => Promise<SignatureResponse>
): Promise<string> {
    const res = await sign();
    const signature = unwrapData<UploadSignature>(await parseJson(res.raw));
    if (!signature?.signature) {
        throw new Error('Could not obtain an upload signature.');
    }

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', signature.apiKey);
    form.append('timestamp', String(signature.timestamp));
    form.append('signature', signature.signature);
    form.append('folder', signature.folder);

    const upload = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
        { method: 'POST', body: form }
    );
    const body = (await upload.json()) as { secure_url?: string };
    if (!upload.ok || !body.secure_url) {
        throw new Error('Image upload failed.');
    }
    return body.secure_url;
}
