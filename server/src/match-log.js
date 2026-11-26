import fs from "node:fs";
import path from "node:path";
import { PassThrough, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export class MatchLogStream {
  constructor(logsDir) {
    fs.mkdirSync(logsDir, { recursive: true });
    this.filePath = path.join(logsDir, "match-events.ndjson");
    this.input = new PassThrough({ objectMode: true });

    this.ndjsonTransform = new Transform({
      writableObjectMode: true,
      transform(chunk, _encoding, callback) {
        try {
          callback(null, `${JSON.stringify(chunk)}\n`);
        } catch (err) {
          callback(err);
        }
      },
    });

    this.fileStream = fs.createWriteStream(this.filePath, { flags: "a" });
    this.pipelinePromise = pipeline(
      this.input,
      this.ndjsonTransform,
      this.fileStream,
    ).catch((err) => {
      if (err?.code !== "ERR_STREAM_PREMATURE_CLOSE") {
        console.error("Match log pipeline error:", err.message);
      }
    });
  }

  writeEvent(payload) {
    if (this.input.writableEnded || this.input.destroyed) return;
    this.input.write(payload);
  }

  async streamReplay(res) {
    if (!fs.existsSync(this.filePath)) {
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
      });
      res.end("");
      return;
    }

    res.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
    });
    const readStream = fs.createReadStream(this.filePath, { encoding: "utf8" });
    await pipeline(readStream, res);
  }

  async close() {
    if (!this.input.writableEnded) {
      this.input.end();
    }
    await this.pipelinePromise;
  }
}
