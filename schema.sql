DROP TABLE IF EXISTS wards;
DROP TABLE IF EXISTS municipalities;
DROP TABLE IF EXISTS districts;
DROP TABLE IF EXISTS provinces;

CREATE TABLE provinces (
  id INTEGER PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_np TEXT NOT NULL,
  name_en_search TEXT NOT NULL,
  name_np_search TEXT NOT NULL
);
CREATE INDEX idx_provinces_name_en_search ON provinces(name_en_search);
CREATE INDEX idx_provinces_name_np_search ON provinces(name_np_search);

CREATE TABLE districts (
  id INTEGER PRIMARY KEY,
  province_id INTEGER NOT NULL,
  name_en TEXT NOT NULL,
  name_np TEXT NOT NULL,
  name_en_search TEXT NOT NULL,
  name_np_search TEXT NOT NULL,
  FOREIGN KEY (province_id) REFERENCES provinces(id)
);
CREATE INDEX idx_districts_province_id ON districts(province_id);
CREATE INDEX idx_districts_name_en_search ON districts(name_en_search);
CREATE INDEX idx_districts_name_np_search ON districts(name_np_search);

CREATE TABLE municipalities (
  id INTEGER PRIMARY KEY,
  district_id INTEGER NOT NULL,
  name_en TEXT NOT NULL,
  name_np TEXT NOT NULL,
  name_en_search TEXT NOT NULL,
  name_np_search TEXT NOT NULL,
  FOREIGN KEY (district_id) REFERENCES districts(id)
);
CREATE INDEX idx_municipalities_district_id ON municipalities(district_id);
CREATE INDEX idx_municipalities_name_en_search ON municipalities(name_en_search);
CREATE INDEX idx_municipalities_name_np_search ON municipalities(name_np_search);

CREATE TABLE wards (
  id INTEGER PRIMARY KEY,
  municipality_id INTEGER NOT NULL,
  name Text NOT NULL,
  FOREIGN KEY (municipality_id) REFERENCES municipalities(id)
);
CREATE INDEX idx_wards_municipality_id ON wards(municipality_id);
