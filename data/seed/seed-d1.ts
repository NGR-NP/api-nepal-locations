import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const dataPath = join(process.cwd(), "data", "seed");
const dbName = "nepal-locations";

// Helper to escape single quotes for SQL
const escapeSql = (str: string) => str.replace(/'/g, "''");
// Helper to normalize names for searching
const normalize = (str: string) => str.toLowerCase();

async function executeSql(sql: string) {
  const command = `wrangler d1 execute ${dbName} --remote --command="${sql} "`;
  try {
    // We run the command from the project root, so the cwd for wrangler is the api dir
    await execAsync(command, { cwd: "./" });
  } catch (e) {
    console.error(`Error executing SQL for command: ${command}\n${e}`);
  }
}

async function seedProvinces() {
  console.log("Seeding provinces...");
  const provinceFile = await readFile(join(dataPath, "province.json"), "utf-8");
  const provinces = JSON.parse(provinceFile);
  for (const p of provinces) {
    const sql = `INSERT INTO provinces (id, name_en, name_np) VALUES (${
      p.value
    }, '${normalize(escapeSql(p.label_en))}', '${normalize(
      escapeSql(p.label_np)
    )}');`;
    await executeSql(sql);
  }
  console.log("Provinces seeded.");
}

async function seedDistricts() {
  console.log("Seeding districts...");
  const districtPath = join(dataPath, "district");
  const districtFiles = await readdir(districtPath);
  for (const file of districtFiles) {
    const provinceId = file.replace(".json", "");
    const districtFile = await readFile(join(districtPath, file), "utf-8");
    const districts = JSON.parse(districtFile);
    for (const d of districts) {
      const sql = `INSERT INTO districts (id, province_id, name_en, name_np) VALUES (${
        d.id
      }, ${provinceId}, '${normalize(escapeSql(d.name_en))}', '${normalize(
        escapeSql(d.name)
      )}');`;
      await executeSql(sql);
    }
  }
  console.log("Districts seeded.");
}

async function seedMunicipalities() {
  console.log("Seeding municipalities...");
  const municipalityPath = join(dataPath, "municipality");
  const municipalityFiles = await readdir(municipalityPath);
  for (const file of municipalityFiles) {
    const districtId = file.replace(".json", "");
    const municipalityFile = await readFile(
      join(municipalityPath, file),
      "utf-8"
    );
    const municipalities = JSON.parse(municipalityFile);
    for (const m of municipalities) {
      const sql = `INSERT INTO municipalities (id, district_id, name_en, name_np, type_en, type_np) VALUES (${
        m.id
      }, ${districtId}, '${normalize(escapeSql(m.name_en))}', '${normalize(
        escapeSql(m.name)
      )}', '${normalize(escapeSql(m.type_en))}','${normalize(
        escapeSql(m.type)
      )}');`;
      await executeSql(sql);
    }
  }
  console.log("Municipalities seeded.");
}

async function run() {
  await seedProvinces();
  await seedDistricts();
  await seedMunicipalities();
  console.log("All data seeded successfully!");
}

run();
