exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE location_datasets (
      id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{40}$'),
      source_url text NOT NULL, checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
      imported_at timestamptz NOT NULL DEFAULT now(), active boolean NOT NULL DEFAULT false
    );
    CREATE UNIQUE INDEX location_datasets_one_active ON location_datasets(active) WHERE active;
    CREATE TABLE location_provinces (
      dataset_id text NOT NULL REFERENCES location_datasets(id) ON DELETE RESTRICT,
      code text NOT NULL CHECK (code ~ '^[0-9]{2}$'),
      name_vi text NOT NULL CHECK (length(trim(name_vi)) > 0),
      name_en text NOT NULL CHECK (length(trim(name_en)) > 0),
      PRIMARY KEY(dataset_id,code)
    );
    CREATE TABLE location_wards (
      dataset_id text NOT NULL, province_code text NOT NULL, code text NOT NULL CHECK (code ~ '^[0-9]{5}$'),
      name_vi text NOT NULL CHECK (length(trim(name_vi)) > 0),
      name_en text NOT NULL CHECK (length(trim(name_en)) > 0),
      PRIMARY KEY(dataset_id,code), UNIQUE(dataset_id,province_code,code),
      FOREIGN KEY(dataset_id,province_code) REFERENCES location_provinces(dataset_id,code) ON DELETE RESTRICT
    );
    ALTER TABLE customer_addresses ADD COLUMN location_dataset_id text, ADD COLUMN province_code text,
      ADD COLUMN ward_code text, ADD COLUMN province_name_en text, ADD COLUMN ward_name_en text;
    ALTER TABLE customer_addresses ADD CONSTRAINT customer_addresses_location_fk
      FOREIGN KEY(location_dataset_id,province_code,ward_code)
      REFERENCES location_wards(dataset_id,province_code,code) MATCH FULL ON DELETE RESTRICT;
    ALTER TABLE customer_addresses ADD CONSTRAINT customer_addresses_location_snapshot_check CHECK (
      location_dataset_id IS NULL OR (ward IS NOT NULL AND length(trim(ward))>0
      AND province_name_en IS NOT NULL AND length(trim(province_name_en))>0
      AND ward_name_en IS NOT NULL AND length(trim(ward_name_en))>0 AND district IS NULL));
    CREATE INDEX customer_addresses_location_idx ON customer_addresses(location_dataset_id,province_code,ward_code);

    CREATE FUNCTION resolve_vn_location(p_code text, w_code text) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE snapshot jsonb;
    BEGIN
      SELECT jsonb_build_object('location_dataset_id',d.id,'province_code',p.code,'ward_code',w.code,
        'city',p.name_vi,'ward',w.name_vi,'province_name_en',p.name_en,'ward_name_en',w.name_en,'district',NULL)
        INTO snapshot FROM location_datasets d JOIN location_provinces p ON p.dataset_id=d.id
        JOIN location_wards w ON w.dataset_id=p.dataset_id AND w.province_code=p.code
        WHERE d.active AND p.code=p_code AND w.code=w_code;
      IF snapshot IS NULL THEN
        IF NOT EXISTS(SELECT 1 FROM location_datasets WHERE active) THEN
          RAISE EXCEPTION 'Location data is not ready' USING ERRCODE='55000';
        END IF;
        RAISE EXCEPTION 'Invalid administrative location' USING ERRCODE='22023';
      END IF;
      RETURN snapshot;
    END $$;

    CREATE FUNCTION snapshot_customer_address_location() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE snapshot jsonb;
    BEGIN
      IF TG_OP='UPDATE' AND (NEW.province_code,NEW.ward_code,NEW.city,NEW.ward,NEW.district,
        NEW.location_dataset_id,NEW.province_name_en,NEW.ward_name_en) IS NOT DISTINCT FROM
        (OLD.province_code,OLD.ward_code,OLD.city,OLD.ward,OLD.district,
        OLD.location_dataset_id,OLD.province_name_en,OLD.ward_name_en) THEN RETURN NEW; END IF;
      snapshot := resolve_vn_location(NEW.province_code,NEW.ward_code);
      NEW.location_dataset_id := snapshot->>'location_dataset_id';
      NEW.city := snapshot->>'city'; NEW.ward := snapshot->>'ward'; NEW.district := NULL;
      NEW.province_name_en := snapshot->>'province_name_en'; NEW.ward_name_en := snapshot->>'ward_name_en';
      RETURN NEW;
    END $$;
    CREATE TRIGGER customer_address_location_snapshot BEFORE INSERT OR UPDATE ON customer_addresses
      FOR EACH ROW EXECUTE FUNCTION snapshot_customer_address_location();

    CREATE FUNCTION snapshot_order_location() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP='INSERT' AND NEW.origin='COMMERCE' AND NEW.fulfillment_type='DELIVERY' THEN
        NEW.recipient_snapshot := NEW.recipient_snapshot || resolve_vn_location(
          NEW.recipient_snapshot->>'province_code', NEW.recipient_snapshot->>'ward_code');
      ELSIF TG_OP='UPDATE' AND OLD.origin='COMMERCE' AND OLD.accepted_at IS NOT NULL
        AND NEW.recipient_snapshot IS DISTINCT FROM OLD.recipient_snapshot THEN
        RAISE EXCEPTION 'Accepted order recipient snapshot is immutable' USING ERRCODE='23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER order_location_snapshot BEFORE INSERT OR UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION snapshot_order_location();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    LOCK TABLE customer_addresses, orders IN ACCESS EXCLUSIVE MODE;
    DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM customer_addresses WHERE location_dataset_id IS NOT NULL)
        OR EXISTS(SELECT 1 FROM orders WHERE recipient_snapshot ? 'location_dataset_id') THEN
        RAISE EXCEPTION 'Rollback refused: administrative snapshots are in use';
      END IF;
    END $$;
    DROP TRIGGER order_location_snapshot ON orders;
    DROP FUNCTION snapshot_order_location();
    DROP TRIGGER customer_address_location_snapshot ON customer_addresses;
    DROP FUNCTION snapshot_customer_address_location();
    DROP FUNCTION resolve_vn_location(text,text);
    ALTER TABLE customer_addresses DROP COLUMN location_dataset_id, DROP COLUMN province_code,
      DROP COLUMN ward_code, DROP COLUMN province_name_en, DROP COLUMN ward_name_en;
    DROP TABLE location_wards; DROP TABLE location_provinces; DROP TABLE location_datasets;
  `);
};
