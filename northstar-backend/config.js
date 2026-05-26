import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const CONFIG_FILE = process.env.NORTHSTAR_DATA_DIR
  ? path.join(process.env.NORTHSTAR_DATA_DIR, "config.json")
  : path.join(__dirname, "data", "config.json")

export async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function writeConfig(updates) {
  const config = await readConfig()
  const next = { ...config, ...updates }
  await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2))
  return next
}
