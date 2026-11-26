export class HttpError extends Error {
  constructor(status, url, message) {
    super(message || `HTTP ${status} for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

function isAbortOrTimeout(err) {
  return (
    err?.name === "AbortError" ||
    err?.name === "TimeoutError" ||
    err?.code === "ABORT_ERR"
  );
}

function sleepWithSignal(ms, signal) {
  if (signal?.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException("Aborted", "AbortError"),
    );
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      cleanup();
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }

    function cleanup() {
      signal?.removeEventListener("abort", onAbort);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withRetry(
  fn,
  { signal, retries = 2, baseDelayMs = 150 } = {},
) {
  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }

    try {
      return await fn(attempt);
    } catch (err) {
      if (isAbortOrTimeout(err)) {
        throw err;
      }
      // 4xx — помилка клієнта/ресурсу (наприклад, 404): ретраїти немає сенсу
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) {
        throw err;
      }
      if (attempt >= retries) {
        throw err;
      }

      const expDelay = baseDelayMs * 2 ** attempt;
      const jitter = Math.random() * baseDelayMs;
      await sleepWithSignal(expDelay + jitter, signal);
      attempt += 1;
    }
  }
}

export async function fetchJson(url, { signal } = {}) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new HttpError(
      res.status,
      url,
      `Failed to fetch JSON ${url}: ${res.status}`,
    );
  }
  return res.json();
}

export function loadJson(url, { signal, retries = 2 } = {}) {
  return withRetry(() => fetchJson(url, { signal }), { signal, retries });
}

export function loadImage(url, { signal, retries = 2 } = {}) {
  return withRetry(
    () =>
      new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
          return;
        }

        const img = new Image();

        function cleanup() {
          img.onload = null;
          img.onerror = null;
          signal?.removeEventListener("abort", onAbort);
        }

        function onAbort() {
          cleanup();
          img.src = "";
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        }

        img.onload = () => {
          cleanup();
          resolve(img);
        };

        img.onerror = () => {
          cleanup();
          reject(new HttpError(404, url, `Failed to load image: ${url}`));
        };

        signal?.addEventListener("abort", onAbort, { once: true });
        img.src = url;
      }),
    { signal, retries },
  );
}

export function loadAudio(url, { signal, audioCtx = null, retries = 2 } = {}) {
  return withRetry(
    async () => {
      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new HttpError(res.status, url, `Failed to load audio: ${url}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      if (signal?.aborted) {
        throw signal.reason ?? new DOMException("Aborted", "AbortError");
      }
      if (audioCtx) {
        return audioCtx.decodeAudioData(arrayBuffer.slice(0));
      }
      return arrayBuffer;
    },
    { signal, retries },
  );
}

export async function loadAll({
  manifestUrl = "/manifest.json",
  audioCtx = null,
  signal,
  onProgress,
} = {}) {
  const manifest = await loadJson(manifestUrl, { signal, retries: 1 });

  const entries = [];
  for (const [key, url] of Object.entries(manifest.images ?? {})) {
    entries.push({ type: "image", key, url });
  }
  for (const [key, url] of Object.entries(manifest.audio ?? {})) {
    entries.push({ type: "audio", key, url });
  }

  const total = entries.length;
  let completed = 0;

  const report = (lastItem, status) => {
    if (onProgress) {
      onProgress({
        completed,
        total,
        ratio: total > 0 ? completed / total : 1,
        lastItem,
        status,
      });
    }
  };

  report(null, "start");

  const images = {};
  const audio = {};

  const tasks = entries.map(async (entry) => {
    const data =
      entry.type === "image"
        ? await loadImage(entry.url, { signal })
        : await loadAudio(entry.url, { signal, audioCtx });

    if (entry.type === "image") {
      images[entry.key] = data;
    } else {
      audio[entry.key] = data;
    }

    completed += 1;
    report(entry, "loaded");
  });

  await Promise.all(tasks);

  return { images, audio, manifest };
}
