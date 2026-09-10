// Rollback procedure: disable commerce writers/workers, export COMMERCE orders and their dependent records,
// remove the disposable verification fixture, then run down. This migration deliberately refuses live commerce data.
exports.up = (pgm) => {
  pgm.sql(`
    UPDATE orders SET origin = 'LEGACY', snapshot_provenance = 'LEGACY_UNKNOWN' WHERE origin IS NULL;
    UPDATE orders o SET recipient_snapshot = jsonb_strip_nulls(jsonb_build_object(
      'full_name', c.full_name, 'phone', c.phone, 'email', c.email, 'address_line', c.address_line,
      'ward', c.ward, 'district', c.district, 'city', c.city
    )), snapshot_provenance = 'LEGACY_PROFILE_BACKFILL'
    FROM customers c
    WHERE o.origin = 'LEGACY' AND o.customer_id = c.id AND o.recipient_snapshot IS NULL
      AND c.full_name IS NOT NULL AND c.phone IS NOT NULL AND c.address_line IS NOT NULL AND c.city IS NOT NULL;
    INSERT INTO audit_logs (action, entity_type, metadata, actor_type, system_name, actor_snapshot)
    SELECT 'commerce.legacy_backfill', 'commerce_schema', jsonb_build_object('orders_backfilled', count(*)), 'SYSTEM', 'commerce-migration-20260910000400000', jsonb_build_object('source', 'commerce_legacy_backfill')
    FROM orders WHERE origin = 'LEGACY' HAVING count(*) > 0;
    UPDATE order_status_history
    SET actor_type = CASE WHEN changed_by IS NULL THEN 'LEGACY' ELSE 'ADMIN' END,
        actor_snapshot = CASE WHEN changed_by IS NULL THEN jsonb_build_object('source', 'legacy_unknown') ELSE jsonb_build_object('source', 'legacy_admin_reference') END
    WHERE actor_type IS NULL;
    UPDATE audit_logs
    SET actor_type = CASE WHEN actor_admin_id IS NULL THEN 'LEGACY' ELSE 'ADMIN' END,
        actor_snapshot = CASE WHEN actor_admin_id IS NULL THEN jsonb_build_object('source', 'legacy_unknown') ELSE jsonb_build_object('source', 'legacy_admin_reference') END
    WHERE actor_type IS NULL;
    ALTER TABLE orders ALTER COLUMN origin SET DEFAULT 'LEGACY', ALTER COLUMN origin SET NOT NULL;
    ALTER TABLE orders ADD CONSTRAINT orders_origin_check CHECK (origin IN ('LEGACY', 'COMMERCE')),
      ADD CONSTRAINT orders_snapshot_provenance_check CHECK (snapshot_provenance IS NULL OR snapshot_provenance IN ('CHECKOUT', 'LEGACY_PROFILE_BACKFILL', 'LEGACY_UNKNOWN')),
      ADD CONSTRAINT orders_review_status_check CHECK (review_status IS NULL OR review_status IN ('QUEUED', 'RETRY', 'NEEDS_ATTENTION', 'PASSED')),
      ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IS NULL OR payment_method = 'COD'),
      ADD CONSTRAINT orders_approval_source_check CHECK (approval_source IS NULL OR approval_source IN ('ADMIN', 'SYSTEM', 'LEGACY')),
      ADD CONSTRAINT orders_review_attempts_check CHECK (review_attempts >= 0), ADD CONSTRAINT orders_version_check CHECK (version > 0),
      ADD CONSTRAINT orders_commerce_required_check CHECK (origin <> 'COMMERCE' OR (
        cart_id IS NOT NULL AND business_date IS NOT NULL AND slot_key IS NOT NULL AND accepted_at IS NOT NULL AND
        recipient_snapshot IS NOT NULL AND fulfillment_snapshot IS NOT NULL AND pricing_snapshot IS NOT NULL AND
        quantity_policy_snapshot IS NOT NULL AND snapshot_provenance IS NOT NULL AND snapshot_provenance = 'CHECKOUT' AND
        payment_method IS NOT NULL AND payment_method = 'COD' AND
        review_status IS NOT NULL AND jsonb_typeof(recipient_snapshot) = 'object' AND jsonb_typeof(fulfillment_snapshot) = 'object' AND
        jsonb_typeof(pricing_snapshot) = 'object' AND jsonb_typeof(quantity_policy_snapshot) = 'object'
      ));
    ALTER TABLE order_items ADD CONSTRAINT order_items_item_snapshot_object_check CHECK (item_snapshot IS NULL OR jsonb_typeof(item_snapshot) = 'object');
    ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_actor_check CHECK (actor_type IS NULL OR (
      actor_type IN ('ADMIN', 'CUSTOMER', 'SYSTEM', 'GUEST', 'LEGACY') AND
      (actor_snapshot IS NULL OR jsonb_typeof(actor_snapshot) = 'object') AND
      (actor_type <> 'ADMIN' OR (actor_customer_id IS NULL AND system_name IS NULL AND actor_snapshot IS NOT NULL)) AND
      (actor_type <> 'CUSTOMER' OR (changed_by IS NULL AND actor_customer_id IS NOT NULL AND system_name IS NULL)) AND
      (actor_type <> 'SYSTEM' OR (changed_by IS NULL AND actor_customer_id IS NULL AND system_name IS NOT NULL)) AND
      (actor_type <> 'GUEST' OR (changed_by IS NULL AND actor_customer_id IS NULL AND system_name IS NULL))
    ));
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_check CHECK (actor_type IS NULL OR (
      actor_type IN ('ADMIN', 'CUSTOMER', 'SYSTEM', 'GUEST', 'LEGACY') AND
      (actor_snapshot IS NULL OR jsonb_typeof(actor_snapshot) = 'object') AND
      (actor_type <> 'ADMIN' OR (actor_customer_id IS NULL AND system_name IS NULL AND actor_snapshot IS NOT NULL)) AND
      (actor_type <> 'CUSTOMER' OR (actor_admin_id IS NULL AND actor_customer_id IS NOT NULL AND system_name IS NULL)) AND
      (actor_type <> 'SYSTEM' OR (actor_admin_id IS NULL AND actor_customer_id IS NULL AND system_name IS NOT NULL)) AND
      (actor_type <> 'GUEST' OR (actor_admin_id IS NULL AND actor_customer_id IS NULL AND system_name IS NULL))
    ));
    CREATE INDEX idx_orders_business_date_slot_key ON orders(business_date, slot_key) WHERE business_date IS NOT NULL AND slot_key IS NOT NULL;
    CREATE INDEX idx_orders_slot_key ON orders(slot_key) WHERE slot_key IS NOT NULL;
    CREATE INDEX idx_orders_commerce_review_due ON orders(next_review_at, id) WHERE origin = 'COMMERCE' AND status = 'PENDING' AND review_status IN ('QUEUED', 'RETRY');
    CREATE INDEX idx_orders_commerce_pending_created ON orders(created_at, id) WHERE origin = 'COMMERCE' AND status = 'PENDING';
    CREATE INDEX idx_order_items_product_id ON order_items(product_id) WHERE product_id IS NOT NULL;
    CREATE INDEX idx_order_items_inventory_slot_id ON order_items(inventory_slot_id) WHERE inventory_slot_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM orders WHERE origin = 'COMMERCE' LIMIT 1) THEN
        RAISE EXCEPTION 'Refusing commerce schema rollback: COMMERCE orders exist; commerce data exists.'
          USING HINT = 'Disable commerce writers and workers, export COMMERCE orders and dependent records, then remove only the disposable verification fixture before retrying down.';
      END IF;
      IF EXISTS (SELECT 1 FROM products LIMIT 1) OR EXISTS (SELECT 1 FROM product_translations LIMIT 1)
        OR EXISTS (SELECT 1 FROM customer_accounts LIMIT 1) OR EXISTS (SELECT 1 FROM customer_identities LIMIT 1)
        OR EXISTS (SELECT 1 FROM customer_sessions LIMIT 1) OR EXISTS (SELECT 1 FROM customer_auth_tokens LIMIT 1)
        OR EXISTS (SELECT 1 FROM customer_addresses LIMIT 1) OR EXISTS (SELECT 1 FROM fulfillment_slots LIMIT 1)
        OR EXISTS (SELECT 1 FROM inventory_slots LIMIT 1) OR EXISTS (SELECT 1 FROM carts LIMIT 1)
        OR EXISTS (SELECT 1 FROM cart_items LIMIT 1) OR EXISTS (SELECT 1 FROM inventory_reservations LIMIT 1)
        OR EXISTS (SELECT 1 FROM payments LIMIT 1) OR EXISTS (SELECT 1 FROM order_access_tokens LIMIT 1)
        OR EXISTS (SELECT 1 FROM idempotency_requests LIMIT 1) OR EXISTS (SELECT 1 FROM order_validation_runs LIMIT 1)
        OR EXISTS (SELECT 1 FROM admin_alerts LIMIT 1) OR EXISTS (SELECT 1 FROM outbox_events LIMIT 1)
        OR EXISTS (SELECT 1 FROM processed_events LIMIT 1) THEN
        RAISE EXCEPTION 'Refusing commerce schema rollback: commerce data exists.'
          USING HINT = 'Disable commerce writers and workers, export commerce records, then remove only the disposable verification fixture before retrying down.';
      END IF;
    END $$;
    DROP INDEX IF EXISTS idx_order_items_inventory_slot_id; DROP INDEX IF EXISTS idx_order_items_product_id;
    DROP INDEX IF EXISTS idx_orders_commerce_pending_created; DROP INDEX IF EXISTS idx_orders_commerce_review_due;
    DROP INDEX IF EXISTS idx_orders_slot_key; DROP INDEX IF EXISTS idx_orders_business_date_slot_key;
    ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_check;
    ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_actor_check;
    ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_item_snapshot_object_check;
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_commerce_required_check, DROP CONSTRAINT IF EXISTS orders_version_check,
      DROP CONSTRAINT IF EXISTS orders_review_attempts_check, DROP CONSTRAINT IF EXISTS orders_payment_method_check,
      DROP CONSTRAINT IF EXISTS orders_review_status_check, DROP CONSTRAINT IF EXISTS orders_approval_source_check, DROP CONSTRAINT IF EXISTS orders_snapshot_provenance_check,
      DROP CONSTRAINT IF EXISTS orders_origin_check;
    ALTER TABLE orders ALTER COLUMN origin DROP NOT NULL, ALTER COLUMN origin DROP DEFAULT;
  `);
};
