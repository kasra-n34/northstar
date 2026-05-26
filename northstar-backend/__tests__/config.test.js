import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs/promises";

// Mock fs/promises so no real files are touched
vi.mock("fs/promises");

// Import after the mock is set up
import { readConfig, writeConfig } from "../config.js";

describe("readConfig", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns empty object when config file does not exist", async () => {
    fs.readFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    const result = await readConfig();
    expect(result).toEqual({});
  });

  it("parses existing config file", async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ anthropicKey: "test-key" }));
    const result = await readConfig();
    expect(result.anthropicKey).toBe("test-key");
  });

  it("returns empty object on invalid JSON", async () => {
    fs.readFile.mockResolvedValue("not valid json {{{");
    const result = await readConfig();
    expect(result).toEqual({});
  });
});

describe("writeConfig", () => {
  beforeEach(() => vi.resetAllMocks());

  it("writes merged config to disk", async () => {
    fs.readFile.mockRejectedValue(new Error("ENOENT")); // no existing config
    fs.writeFile.mockResolvedValue(undefined);

    await writeConfig({ anthropicKey: "abc123" });

    expect(fs.writeFile).toHaveBeenCalledOnce();
    const written = JSON.parse(fs.writeFile.mock.calls[0][1]);
    expect(written.anthropicKey).toBe("abc123");
  });

  it("merges new values with existing config", async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ anthropicKey: "first" }));
    fs.writeFile.mockResolvedValue(undefined);

    await writeConfig({ localToken: "token-xyz" });

    const written = JSON.parse(fs.writeFile.mock.calls[0][1]);
    expect(written.anthropicKey).toBe("first");
    expect(written.localToken).toBe("token-xyz");
  });

  it("overwrites an existing key", async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ anthropicKey: "old" }));
    fs.writeFile.mockResolvedValue(undefined);

    await writeConfig({ anthropicKey: "new" });

    const written = JSON.parse(fs.writeFile.mock.calls[0][1]);
    expect(written.anthropicKey).toBe("new");
  });

  it("returns the merged config", async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ anthropicKey: "k1" }));
    fs.writeFile.mockResolvedValue(undefined);

    const result = await writeConfig({ localToken: "t1" });

    expect(result.anthropicKey).toBe("k1");
    expect(result.localToken).toBe("t1");
  });
});
