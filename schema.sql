DROP TABLE IF EXISTS wards;
DROP TABLE IF EXISTS municipalities;
DROP TABLE IF EXISTS districts;
DROP TABLE IF EXISTS provinces;

CREATE TABLE provinces (
  id INTEGER PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_np TEXT NOT NULL
);
CREATE INDEX idx_provinces_search_en ON provinces(name_en);
CREATE INDEX idx_provinces_np ON provinces(name_np);


CREATE TABLE districts (
  id INTEGER PRIMARY KEY,
  province_id INTEGER NOT NULL,
  name_en TEXT NOT NULL,
  name_np TEXT NOT NULL,
  FOREIGN KEY (province_id) REFERENCES provinces(id)
);
CREATE INDEX idx_districts_province_id ON districts(province_id);
CREATE INDEX idx_districts_search_en ON districts(name_en);
CREATE INDEX idx_districts_np ON districts(name_np);

CREATE TABLE municipalities (
  id INTEGER PRIMARY KEY,
  district_id INTEGER NOT NULL,
  name_en TEXT NOT NULL,
  name_np TEXT NOT NULL,
  type_en TEXT NOT NULL,
  type_np TEXT NOT NULL,
  FOREIGN KEY (district_id) REFERENCES districts(id)
);
CREATE INDEX idx_municipalities_district_id ON municipalities(district_id);
CREATE INDEX idx_municipalities_search_en ON municipalities(name_en);
CREATE INDEX idx_municipalities_np ON municipalities(name_np);

CREATE TABLE wards (
  id INTEGER PRIMARY KEY,
  municipality_id INTEGER NOT NULL,
  name Text NOT NULL,
  FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
);
CREATE INDEX idx_wards_municipality_id ON wards(municipality_id);