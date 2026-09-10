const uuid = "uuid NOT NULL DEFAULT gen_random_uuid()";
const timestamps = "created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()";

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE products (
      id ${uuid} PRIMARY KEY, sku text NOT NULL UNIQUE, slug text NOT NULL UNIQUE,
      unit_price integer NOT NULL, currency char(3) NOT NULL DEFAULT 'VND',
      accepting_orders boolean NOT NULL DEFAULT false, fulfillment_blocked boolean NOT NULL DEFAULT false,
      price_version integer NOT NULL DEFAULT 1, archived_at timestamptz, ${timestamps},
      CONSTRAINT products_sku_not_blank CHECK (length(trim(sku)) > 0),
      CONSTRAINT products_slug_not_blank CHECK (length(trim(slug)) > 0),
      CONSTRAINT products_unit_price_check CHECK (unit_price >= 0),
      CONSTRAINT products_currency_check CHECK (currency = 'VND'),
      CONSTRAINT products_price_version_check CHECK (price_version > 0),
      CONSTRAINT products_archived_accepting_check CHECK (archived_at IS NULL OR accepting_orders = false)
    );
    CREATE TABLE product_translations (
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      locale text NOT NULL, name text NOT NULL, description text NOT NULL, ${timestamps},
      PRIMARY KEY (product_id, locale),
      CONSTRAINT product_translations_locale_not_blank CHECK (length(trim(locale)) > 0),
      CONSTRAINT product_translations_name_not_blank CHECK (length(trim(name)) > 0)
    );
    CREATE TABLE customer_accounts (
      id ${uuid} PRIMARY KEY, customer_id uuid NOT NULL UNIQUE REFERENCES customers(id) ON DELETE RESTRICT,
      normalized_email text, email_verified_at timestamptz, password_hash text,
      status text NOT NULL DEFAULT 'ACTIVE', ${timestamps},
      CONSTRAINT customer_accounts_email_not_blank CHECK (normalized_email IS NULL OR length(trim(normalized_email)) > 0),
      CONSTRAINT customer_accounts_status_check CHECK (status IN ('ACTIVE', 'DISABLED')),
      CONSTRAINT customer_accounts_password_email_check CHECK (password_hash IS NULL OR normalized_email IS NOT NULL)
    );
    CREATE UNIQUE INDEX idx_customer_accounts_normalized_email ON customer_accounts(normalized_email) WHERE normalized_email IS NOT NULL;
    CREATE TABLE customer_identities (
      id ${uuid} PRIMARY KEY, account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
      provider text NOT NULL, provider_subject text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(provider, provider_subject),
      CONSTRAINT customer_identities_provider_check CHECK (provider IN ('GOOGLE', 'FACEBOOK')),
      CONSTRAINT customer_identities_subject_not_blank CHECK (length(trim(provider_subject)) > 0)
    );
    CREATE INDEX idx_customer_identities_account_id ON customer_identities(account_id);
    CREATE TABLE customer_sessions (
      id ${uuid} PRIMARY KEY, account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
      token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT customer_sessions_token_not_blank CHECK (length(trim(token_hash)) > 0),
      CONSTRAINT customer_sessions_expiry_check CHECK (expires_at > created_at)
    );
    CREATE INDEX idx_customer_sessions_account_id ON customer_sessions(account_id);
    CREATE INDEX idx_customer_sessions_expires_at ON customer_sessions(expires_at);
    CREATE TABLE customer_auth_tokens (
      id ${uuid} PRIMARY KEY, account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE RESTRICT,
      purpose text NOT NULL, token_hash text NOT NULL UNIQUE, target_email text, expires_at timestamptz NOT NULL,
      consumed_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT customer_auth_tokens_purpose_check CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD')),
      CONSTRAINT customer_auth_tokens_hash_not_blank CHECK (length(trim(token_hash)) > 0),
      CONSTRAINT customer_auth_tokens_verify_target_check CHECK (purpose <> 'VERIFY_EMAIL' OR target_email IS NOT NULL),
      CONSTRAINT customer_auth_tokens_expiry_check CHECK (expires_at > created_at)
    );
    CREATE INDEX idx_customer_auth_tokens_account_id ON customer_auth_tokens(account_id);
    CREATE INDEX idx_customer_auth_tokens_expires_at ON customer_auth_tokens(expires_at);
    CREATE TABLE customer_addresses (
      id ${uuid} PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      recipient_name text NOT NULL, phone text NOT NULL, address_line text NOT NULL, ward text, district text,
      city text NOT NULL, is_default boolean NOT NULL DEFAULT false, ${timestamps},
      CONSTRAINT customer_addresses_required_not_blank CHECK (length(trim(recipient_name)) > 0 AND length(trim(phone)) > 0 AND length(trim(address_line)) > 0 AND length(trim(city)) > 0)
    );
    CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);
    CREATE UNIQUE INDEX idx_customer_addresses_default ON customer_addresses(customer_id) WHERE is_default;
    CREATE TABLE fulfillment_slots (
      slot_key text PRIMARY KEY, label text NOT NULL, start_local_time time NOT NULL, end_local_time time NOT NULL,
      timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh', cutoff_minutes integer NOT NULL DEFAULT 120,
      enabled boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0, ${timestamps},
      CONSTRAINT fulfillment_slots_key_not_blank CHECK (length(trim(slot_key)) > 0),
      CONSTRAINT fulfillment_slots_label_not_blank CHECK (length(trim(label)) > 0),
      CONSTRAINT fulfillment_slots_time_check CHECK (start_local_time < end_local_time),
      CONSTRAINT fulfillment_slots_timezone_check CHECK (timezone = 'Asia/Ho_Chi_Minh'),
      CONSTRAINT fulfillment_slots_cutoff_check CHECK (cutoff_minutes >= 0)
    );
    CREATE INDEX idx_fulfillment_slots_enabled_sort ON fulfillment_slots(enabled, sort_order, slot_key);
    CREATE TABLE inventory_slots (
      id ${uuid} PRIMARY KEY, product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      business_date date NOT NULL, slot_key text NOT NULL REFERENCES fulfillment_slots(slot_key) ON DELETE RESTRICT,
      capacity integer NOT NULL, reserved integer NOT NULL DEFAULT 0, committed integer NOT NULL DEFAULT 0,
      version integer NOT NULL DEFAULT 1, ${timestamps}, UNIQUE(product_id, business_date, slot_key),
      CONSTRAINT inventory_slots_counters_check CHECK (capacity >= 0 AND reserved >= 0 AND committed >= 0 AND (reserved::bigint + committed::bigint) <= capacity::bigint),
      CONSTRAINT inventory_slots_version_check CHECK (version > 0)
    );
    CREATE INDEX idx_inventory_slots_business_date_slot ON inventory_slots(business_date, slot_key, id);
    CREATE INDEX idx_inventory_slots_slot_key ON inventory_slots(slot_key);
    CREATE TABLE carts (
      id ${uuid} PRIMARY KEY, account_id uuid REFERENCES customer_accounts(id) ON DELETE RESTRICT,
      guest_token_hash text, business_date date, slot_key text REFERENCES fulfillment_slots(slot_key) ON DELETE RESTRICT,
      status text NOT NULL DEFAULT 'ACTIVE', expires_at timestamptz, version integer NOT NULL DEFAULT 1, ${timestamps},
      CONSTRAINT carts_owner_check CHECK ((account_id IS NOT NULL) <> (guest_token_hash IS NOT NULL)),
      CONSTRAINT carts_guest_token_not_blank CHECK (guest_token_hash IS NULL OR length(trim(guest_token_hash)) > 0),
      CONSTRAINT carts_fulfillment_pair_check CHECK ((business_date IS NULL) = (slot_key IS NULL)),
      CONSTRAINT carts_status_check CHECK (status IN ('ACTIVE', 'CHECKED_OUT', 'MERGED', 'EXPIRED')),
      CONSTRAINT carts_version_check CHECK (version > 0)
    );
    CREATE UNIQUE INDEX idx_carts_guest_token_hash ON carts(guest_token_hash) WHERE guest_token_hash IS NOT NULL;
    CREATE UNIQUE INDEX idx_carts_active_account ON carts(account_id) WHERE status = 'ACTIVE' AND account_id IS NOT NULL;
    CREATE INDEX idx_carts_account_id ON carts(account_id);
    CREATE INDEX idx_carts_slot_key ON carts(slot_key);
    CREATE INDEX idx_carts_active_expires_at ON carts(expires_at) WHERE status = 'ACTIVE';
    CREATE TABLE cart_items (
      id ${uuid} PRIMARY KEY, cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE RESTRICT,
      product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT, quantity integer NOT NULL, ${timestamps},
      UNIQUE(cart_id, product_id), CONSTRAINT cart_items_quantity_check CHECK (quantity > 0)
    );
    CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
    CREATE INDEX idx_products_accepting_orders ON products(accepting_orders, id);
    CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER trg_product_translations_updated_at BEFORE UPDATE ON product_translations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER trg_customer_accounts_updated_at BEFORE UPDATE ON customer_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER trg_customer_addresses_updated_at BEFORE UPDATE ON customer_addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER trg_fulfillment_slots_updated_at BEFORE UPDATE ON fulfillment_slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER trg_inventory_slots_updated_at BEFORE UPDATE ON inventory_slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM products LIMIT 1) OR EXISTS (SELECT 1 FROM product_translations LIMIT 1)
        OR EXISTS (SELECT 1 FROM customer_accounts LIMIT 1) OR EXISTS (SELECT 1 FROM customer_identities LIMIT 1)
        OR EXISTS (SELECT 1 FROM customer_sessions LIMIT 1) OR EXISTS (SELECT 1 FROM customer_auth_tokens LIMIT 1)
        OR EXISTS (SELECT 1 FROM customer_addresses LIMIT 1) OR EXISTS (SELECT 1 FROM fulfillment_slots LIMIT 1)
        OR EXISTS (SELECT 1 FROM inventory_slots LIMIT 1) OR EXISTS (SELECT 1 FROM carts LIMIT 1)
        OR EXISTS (SELECT 1 FROM cart_items LIMIT 1) THEN
        RAISE EXCEPTION 'Refusing commerce foundation rollback: populated commerce foundation tables exist.'
          USING HINT = 'Disable commerce writers, export dependent records, then remove only the disposable verification fixture before retrying down.';
      END IF;
    END $$;
    DROP TABLE IF EXISTS cart_items; DROP TABLE IF EXISTS carts; DROP TABLE IF EXISTS inventory_slots;
    DROP TABLE IF EXISTS fulfillment_slots; DROP TABLE IF EXISTS customer_addresses;
    DROP TABLE IF EXISTS customer_auth_tokens; DROP TABLE IF EXISTS customer_sessions;
    DROP TABLE IF EXISTS customer_identities; DROP TABLE IF EXISTS customer_accounts;
    DROP TABLE IF EXISTS product_translations; DROP TABLE IF EXISTS products;
  `);
};
