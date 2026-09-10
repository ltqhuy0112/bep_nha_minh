exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE orders
      ADD COLUMN origin text,
      ADD COLUMN cart_id uuid REFERENCES carts(id) ON DELETE RESTRICT,
      ADD COLUMN business_date date,
      ADD COLUMN slot_key text REFERENCES fulfillment_slots(slot_key) ON DELETE RESTRICT,
      ADD COLUMN accepted_at timestamptz,
      ADD COLUMN recipient_snapshot jsonb,
      ADD COLUMN fulfillment_snapshot jsonb,
      ADD COLUMN pricing_snapshot jsonb,
      ADD COLUMN quantity_policy_snapshot jsonb,
      ADD COLUMN snapshot_provenance text,
      ADD COLUMN payment_method text,
      ADD COLUMN review_status text,
      ADD COLUMN review_attempts integer NOT NULL DEFAULT 0,
      ADD COLUMN next_review_at timestamptz,
      ADD COLUMN last_reviewed_at timestamptz,
      ADD COLUMN approval_source text,
      ADD COLUMN version integer NOT NULL DEFAULT 1;
    CREATE UNIQUE INDEX idx_orders_cart_id ON orders(cart_id) WHERE cart_id IS NOT NULL;
    ALTER TABLE orders DROP CONSTRAINT orders_total_amount_check,
      ADD CONSTRAINT orders_total_amount_check CHECK (total_amount::bigint = subtotal_amount::bigint + delivery_fee::bigint - discount_amount::bigint);
    ALTER TABLE order_items ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE RESTRICT, ADD COLUMN inventory_slot_id uuid REFERENCES inventory_slots(id) ON DELETE RESTRICT;
    ALTER TABLE order_items DROP CONSTRAINT order_items_order_id_fkey, ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
    ALTER TABLE order_items DROP CONSTRAINT order_items_line_total_check, ADD CONSTRAINT order_items_line_total_check CHECK (line_total = (quantity::bigint * unit_price::bigint));
    ALTER TABLE order_status_history
      ADD COLUMN actor_type text,
      ADD COLUMN actor_customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
      ADD COLUMN system_name text,
      ADD COLUMN actor_snapshot jsonb,
      ADD COLUMN validation_run_id uuid;
    ALTER TABLE order_status_history DROP CONSTRAINT order_status_history_order_id_fkey, ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;
    ALTER TABLE audit_logs
      ADD COLUMN actor_type text,
      ADD COLUMN actor_customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
      ADD COLUMN system_name text,
      ADD COLUMN actor_snapshot jsonb,
      ADD COLUMN correlation_id uuid;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM orders WHERE origin = 'COMMERCE' OR cart_id IS NOT NULL OR business_date IS NOT NULL OR slot_key IS NOT NULL
          OR accepted_at IS NOT NULL OR (recipient_snapshot IS NOT NULL AND snapshot_provenance IS DISTINCT FROM 'LEGACY_PROFILE_BACKFILL') OR fulfillment_snapshot IS NOT NULL OR pricing_snapshot IS NOT NULL
          OR quantity_policy_snapshot IS NOT NULL OR payment_method IS NOT NULL OR review_status IS NOT NULL OR review_attempts <> 0
          OR next_review_at IS NOT NULL OR last_reviewed_at IS NOT NULL OR approval_source IS NOT NULL OR version <> 1 LIMIT 1)
        OR EXISTS (SELECT 1 FROM order_items WHERE product_id IS NOT NULL OR inventory_slot_id IS NOT NULL LIMIT 1)
        OR EXISTS (SELECT 1 FROM order_status_history WHERE (
          (actor_type IS NULL AND actor_customer_id IS NULL AND system_name IS NULL AND actor_snapshot IS NULL AND validation_run_id IS NULL)
          OR (actor_type = 'LEGACY' AND actor_customer_id IS NULL AND system_name IS NULL AND validation_run_id IS NULL AND actor_snapshot = jsonb_build_object('source', 'legacy_unknown'))
          OR (actor_type = 'ADMIN' AND actor_customer_id IS NULL AND system_name IS NULL AND validation_run_id IS NULL AND actor_snapshot = jsonb_build_object('source', 'legacy_admin_reference'))
        ) IS NOT TRUE LIMIT 1)
        OR EXISTS (SELECT 1 FROM audit_logs WHERE (
          (actor_type IS NULL AND actor_customer_id IS NULL AND system_name IS NULL AND actor_snapshot IS NULL AND correlation_id IS NULL)
          OR (actor_type = 'LEGACY' AND actor_customer_id IS NULL AND system_name IS NULL AND correlation_id IS NULL AND actor_snapshot = jsonb_build_object('source', 'legacy_unknown'))
          OR (actor_type = 'ADMIN' AND actor_customer_id IS NULL AND system_name IS NULL AND correlation_id IS NULL AND actor_snapshot = jsonb_build_object('source', 'legacy_admin_reference'))
          OR (actor_type = 'SYSTEM' AND actor_admin_id IS NULL AND actor_customer_id IS NULL AND correlation_id IS NULL AND system_name = 'commerce-migration-20260910000400000' AND actor_snapshot = jsonb_build_object('source', 'commerce_legacy_backfill'))
        ) IS NOT TRUE LIMIT 1) THEN
        RAISE EXCEPTION 'Refusing legacy order extension rollback: populated commerce extension fields exist.'
          USING HINT = 'Disable commerce writers and workers, export affected records, then remove only the disposable verification fixture before retrying down.';
      END IF;
    END $$;
    ALTER TABLE audit_logs DROP COLUMN correlation_id, DROP COLUMN actor_snapshot, DROP COLUMN system_name, DROP COLUMN actor_customer_id, DROP COLUMN actor_type;
    ALTER TABLE order_status_history DROP CONSTRAINT order_status_history_order_id_fkey, ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    ALTER TABLE order_status_history DROP COLUMN validation_run_id, DROP COLUMN actor_snapshot, DROP COLUMN system_name, DROP COLUMN actor_customer_id, DROP COLUMN actor_type;
    ALTER TABLE order_items DROP CONSTRAINT order_items_order_id_fkey, ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
    ALTER TABLE order_items DROP CONSTRAINT order_items_line_total_check, ADD CONSTRAINT order_items_line_total_check CHECK (line_total = quantity * unit_price);
    ALTER TABLE order_items DROP COLUMN inventory_slot_id, DROP COLUMN product_id;
    DROP INDEX IF EXISTS idx_orders_cart_id;
    ALTER TABLE orders DROP CONSTRAINT orders_total_amount_check,
      ADD CONSTRAINT orders_total_amount_check CHECK (total_amount = subtotal_amount + delivery_fee - discount_amount);
    ALTER TABLE orders DROP COLUMN version, DROP COLUMN approval_source, DROP COLUMN last_reviewed_at, DROP COLUMN next_review_at, DROP COLUMN review_attempts, DROP COLUMN review_status, DROP COLUMN payment_method, DROP COLUMN snapshot_provenance, DROP COLUMN quantity_policy_snapshot, DROP COLUMN pricing_snapshot, DROP COLUMN fulfillment_snapshot, DROP COLUMN recipient_snapshot, DROP COLUMN accepted_at, DROP COLUMN slot_key, DROP COLUMN business_date, DROP COLUMN cart_id, DROP COLUMN origin;
  `);
};
