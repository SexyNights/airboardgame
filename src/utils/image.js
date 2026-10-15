import pLimit from "p-limit";
import { itemTemplates } from "../gameComponents";

const imageCache = {};

export const getImageWithRetry = async (url, retry = 0) => {
  if (!url) {
    return null;
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      if (retry < 2) {
        getImageWithRetry(url, retry + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(new Error(`Failed to load: <${url}>`));
      }
    };
    img.src = url;
  });
};

export const getImage = (url, defaultImage = "/default.png") => {
  if (!url) {
    return null;
  }
  if (!imageCache[url]) {
    imageCache[url] = new Promise((resolve) => {
      getImageWithRetry(url)
        .then(resolve)
        .catch(async () => {
          console.log(`Missing image <${url}>`);
          resolve(await getImage(defaultImage));
        });
    });
  }
  return imageCache[url];
};

export class ItemMediaUploader {
  constructor(onFile) {
    this.onFile = onFile;
    this.queue = pLimit(4);
    this.cache = {};
  }

  async uploadMedia(media) {
    if (typeof media === "object" && media?.file) {
      if (!this.cache[media.file]) {
        this.cache[media.file] = this.queue(this.onFile, media.file);
      }
      return {
        type: "local",
        content: await this.cache[media.file],
      };
    } else {
      return media;
    }
  }

  async upload(item) {
    const template = itemTemplates[item.type];
    if (!template) {
      return item;
    }
    const itemCloned = JSON.parse(JSON.stringify(item));

    await template.mapMedia(itemCloned, async (media) => {
      return this.uploadMedia(media);
    });

    return itemCloned;
  }
}

export const imageAsBlob = async (image) => {
  const response = await fetch(image.src);
  return await response.blob();
};

export const URLAsBlob = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }
  return await response.blob();
};

export async function hashBlob(blob) {
  // Read the blob as an ArrayBuffer
  const blobBuffer = await readBlobAsArrayBuffer(blob);

  // crypto.subtle only exists in secure contexts (HTTPS or localhost). The
  // hash is only used to de-duplicate files in exports, so fall back to a
  // fast non-cryptographic hash on plain-HTTP setups.
  if (!globalThis.crypto?.subtle) {
    return fallbackHash(new Uint8Array(blobBuffer));
  }

  // Use the SubtleCrypto API to hash the content
  const hashBuffer = await crypto.subtle.digest("SHA-256", blobBuffer);

  // Convert the hash to a hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

// cyrb53-style 2x32-bit hash over the bytes, prefixed with the byte length.
function fallbackHash(bytes) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 2654435761);
    h2 = Math.imul(h2 ^ bytes[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return `${bytes.length.toString(16)}-${hex(h2)}${hex(h1)}`;
}

function readBlobAsArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsArrayBuffer(blob);
  });
}
