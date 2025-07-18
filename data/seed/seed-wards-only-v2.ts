import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const dataPath = join(process.cwd(), "data", "seed");
const dbName = "nepal-locations";

// Helper to escape single quotes for SQL
const escapeSql = (str: string) => str.replace(/'/g, "''");

async function executeSql(sql: string) {
  const command = `wrangler d1 execute ${dbName} --remote --command="${sql}"`;
  try {
    await execAsync(command, { cwd: "./" });
  } catch (e) {
    console.error(`Error executing SQL for command: ${command}\n${e}`);
  }
}

async function clearWards() {
  console.log("Clearing existing wards...");
  const sql = "DELETE FROM wards;";
  await executeSql(sql);
  console.log("Wards table cleared.");
}

async function seedWards() {
  console.log("Seeding wards...");
  const wardPath = join(dataPath, "ward");
  const wardFiles = await readdir(wardPath);
  for (const file of wardFiles) {
    const municipalityId = file.replace(".json", "");
    if (isNaN(parseInt(municipalityId, 10))) continue;

    const wardFile = await readFile(join(wardPath, file), "utf-8");
    const wards = JSON.parse(wardFile);
    const wardNames = wards.map((w: { name: string }) => w.name);
    const wardNamesString = escapeSql(wardNames.join(","));

    const sql = `INSERT INTO wards (id, municipality_id, name) VALUES (${municipalityId}, ${municipalityId}, '${wardNamesString}');`;
    await executeSql(sql);
  }
  console.log("Wards seeded.");
}

async function run() {
  await clearWards();
  await seedWards();
  console.log("All ward data seeded successfully!");
}

run();
