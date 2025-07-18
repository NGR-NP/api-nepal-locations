# Nepal Location API

A fast, read-only REST API for Nepal’s administrative locations (provinces, districts, municipalities, wards) built with Bun, Hono, Cloudflare Workers, D1 (SQLite), and KV for rate limiting.

---

## Features

- **Read-only**: No create, update, or delete endpoints.
- **Language support**: English (`en`) and Nepali (`np`) for all location names.
- **Search**: Fast, indexed search for all resources.
- **Pagination**: Limit and offset support (default 20, max 50; for search, max 20, default 10).
- **Rate limiting**: 60 requests/minute per IP using Cloudflare KV.
- **Production-ready**: Deployed on Cloudflare Workers.

---

## Project Structure

```
.
├── README.md
├── wrangler.toml
├── schema.sql           # Database schema (D1/SQLite)
├── seed.sql             # (Optional) SQL seed file for direct seeding
├── src/
│   └── index.ts         # Main API (Hono app, all endpoints)
├── data/
│   └── seed/
│       ├── seed-d1.ts   # Script to seed provinces, districts, municipalities
│       ├── seed-wards-only-v2.ts # Script to seed wards
│       ├── province.json
│       ├── district/
│       │   └── <province_id>.json
│       ├── municipality/
│       │   └── <district_id>.json
│       └── ward/
│           └── <municipality_id>.json
```

---

## API Endpoints

### Health Check

```
GET /
```

### Provinces

```
GET /{lang}/provinces
```

- `lang`: `en` or `np`
- **Query params**:
  - `s`: search by name (max 15 chars)
  - `limit`, `offset`: pagination (default 20, max 50; for search, max 20, default 10)
- **Example:**  
  `/en/provinces?s=koshi`

### Districts

```
GET /{lang}/districts?of-p={province_id}
```

- `of-p`: filter by province id
- `s`: search by name
- `limit`, `offset`: pagination (default 20, max 50; for search, max 20, default 10)
- **Example:**  
  `/en/districts?of-p=1&s=koshi`

### Municipalities

```
GET /{lang}/municipalities?of-d={district_id}
```

- `of-d`: filter by district id
- `s`: search by name
- `limit`, `offset`: pagination (default 20, max 50; for search, max 20, default 10)
- **Example:**  
  `/en/municipalities?of-d=14&s=city`

### Wards

```
GET /{lang}/wards?of-m={municipality_id}
```

- `of-m`: filter by municipality id
- `s`: search by name
- `limit`, `offset`: pagination (default 20, max 50; for search, max 20, default 10)
- **Example:**  
  `/en/wards?of-m=5001&s=1`

### Wards by Municipality (No Language)

```
GET /ward/{id}
```

- Returns all wards for a given municipality as an array of numbers.
- **Example response:**
  ```json
  [{ "id": 5001, "name": [1, 2, 3, 4, 5] }]
  ```

---

## Rate Limiting

- 60 requests per minute per IP.
- Exceeding the limit returns HTTP 429.

---

## Setup & Deployment

### 1. Clone the repo

```sh
git clone https://github.com/NGR-NP/api-nepal-locations
cd api-nepal-locations
```

### 2. Install dependencies

```sh
bun install
```

### 3. Configure Cloudflare

- Set up D1 and KV in your Cloudflare dashboard.

**or**

### Using Wrangler CLI

1. **Create D1 database**

   ```sh
   wrangler d1 create nepal-locations
   ```

   - Note the database ID output by this command.

2. **Create KV namespace**

   ```sh
   wrangler kv:namespace create nepal-locations
   ```

   - Note the namespace ID output by this command.

3. **Update `wrangler.toml` with your bindings:**

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "nepal-locations"
   database_id = "<your-d1-database-id>"

   [[kv_namespaces]]
   binding = "RATE_LIMIT_KV"
   id = "<your-kv-namespace-id>"
   ```

## Data & Seeding Workflow

### 1. **Schema Migration**

- Before seeding, ensure your D1 database schema is up to date:
  ```sh
  wrangler d1 execute nepal-locations --remote --file=./schema.sql
  ```

### 2. **Data Files**

- All seed data is in `data/seed/` as JSON files:
  - `province.json`: List of provinces
  - `district/<province_id>.json`: Districts for each province
  - `municipality/<district_id>.json`: Municipalities for each district
  - `ward/<municipality_id>.json`: Wards for each municipality

#### **Example Formats**

- **province.json**
  ```json
  [{ "value": "1", "label_np": "कोशी", "label_en": "Koshi" }]
  ```
- **district/1.json**
  ```json
  [{ "id": "3", "name": "इलाम", "name_en": "Ilam" }]
  ```
- **municipality/1.json**
  ```json
  [
    {
      "id": "5001",
      "name": "आठराई त्रिवेणी गाउँपालिका",
      "name_en": "Aathrai Triveni Rural Municipality"
    }
  ]
  ```
- **ward/5001.json**
  ```json
  [
    { "id": "1", "name": "1" },
    { "id": "2", "name": "2" }
  ]
  ```

### 3. **Seeding Scripts**

#### **Provinces, Districts, Municipalities**

- Script: `data/seed/seed-d1.ts`
- Usage:
  ```sh
  bun run data/seed/seed-d1.ts
  ```
- This script reads the JSON files and inserts data into D1 using `wrangler d1 execute`.

#### **Wards**

- Script: `data/seed/seed-wards-only-v2.ts`
- Usage:
  ```sh
  bun run data/seed/seed-wards-only-v2.ts
  ```
- This script reads all `ward/<municipality_id>.json` files and inserts ward data into D1.

#### **Direct SQL Seeding (Optional)**

- You can also use a single `seed.sql` file with all your `INSERT` statements:
  ```sh
  wrangler d1 execute nepal-locations --remote --file=./seed.sql
  ```

### 4. **How to Add or Update Data**

- Edit the relevant JSON file(s) in `data/seed/`.
- Rerun the appropriate seed script(s) to update the D1 database.
- If you want to clear and reload data, add `DELETE FROM ...` or `TRUNCATE TABLE ...` statements at the top of your seed script or SQL.

### 5. **Verify the Data**

- After seeding, check your data:
  ```sh
  wrangler d1 execute nepal-locations --remote --command="SELECT * FROM provinces LIMIT 5;"
  ```

### 6. **Troubleshooting Seeding**

- **Error: no such table ...**: Run the schema migration first.
- **Duplicate key errors**: Clear the table before reseeding, or use `INSERT OR REPLACE`.
- **No data returned by API**: Check that your JSON and seed scripts are correct and executed on the right database.

### 7. test

```sh
wrangler dev
```

### 8. Deploy

```sh
wrangler deploy
```

---

## Example Usage

```sh
curl "https://nepal-location-api.<your-domain>.workers.dev/en/provinces"
curl "https://nepal-location-api.<your-domain>.workers.dev/en/districts?of-p=1"
curl "https://nepal-location-api.<your-domain>.workers.dev/en/municipalities?of-d=14"
curl "https://nepal-location-api.<your-domain>.workers.dev/en/wards?of-m=5001"
curl "https://nepal-location-api.<your-domain>.workers.dev/ward/5001"
```

---

## License

[MIT](https://github.com/NGR-NP/api-nepal-locations/tree/main?tab=MIT-1-ov-file)

---

## Author

- [NGR](https://github.com/ngr-np)
