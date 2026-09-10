const uuid = "uuid NOT NULL DEFAULT gen_random_uuid()";

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE inventory_reservations (
      id ${uuid} PRIMARY KEY, order_item_id uuid NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
      inventory_slot_id uuid NOT NULL REFERENCES inventory_slots(id) ON DELETE RESTRICT, quantity integer NOT NULL,
      status text NOT NULL, expires_at timestamptz, released_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT inventory_reservations_quantity_check CHECK (quantity > 0),
      CONSTRAINT inventory_reservations_status_check CHECK (status IN ('HELD', 'COMMITTED', 'RELEASED')),
      CONSTRAINT inventory_reservations_released_check CHECK ((status = 'RELEASED') = (released_at IS NOT NULL)),
      CONSTRAINT inventory_reservations_cod_expiry_check CHECK (expires_at IS NULL)
    );
    CREATE INDEX idx_inventory_reservations_slot_status ON inventory_reservations(inventory_slot_id, status);
    CREATE INDEX idx_inventory_reservations_held_expires_at ON inventory_reservations(expires_at) WHERE status = 'HELD' AND expires_at IS NOT NULL;
    CREATE TRIGGER trg_inventory_reservations_updated_at BEFORE UPDATE ON inventory_reservations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TABLE payments (
      id ${uuid} PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      method text NOT NULL, amount integer NOT NULL, currency char(3) NOT NULL DEFAULT 'VND',
      status text NOT NULL DEFAULT 'UNPAID', collected_at timestamptz, collected_by_admin_id uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
      voided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(order_id, method), CONSTRAINT payments_method_check CHECK (method = 'COD'),
      CONSTRAINT payments_amount_check CHECK (amount >= 0), CONSTRAINT payments_currency_check CHECK (currency = 'VND'),
      CONSTRAINT payments_status_check CHECK (status IN ('UNPAID', 'PAID', 'VOID')),
      CONSTRAINT payments_paid_metadata_check CHECK (status <> 'PAID' OR (collected_at IS NOT NULL AND collected_by_admin_id IS NOT NULL AND voided_at IS NULL)),
      CONSTRAINT payments_void_metadata_check CHECK (status <> 'VOID' OR (voided_at IS NOT NULL AND collected_at IS NULL AND collected_by_admin_id IS NULL)),
      CONSTRAINT payments_unpaid_metadata_check CHECK (status <> 'UNPAID' OR (collected_at IS NULL AND collected_by_admin_id IS NULL AND voided_at IS NULL))
    );
    CREATE INDEX idx_payments_collected_by_admin_id ON payments(collected_by_admin_id) WHERE collected_by_admin_id IS NOT NULL;
    CREATE INDEX idx_payments_status_created_at ON payments(status, created_at);
    CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TABLE order_access_tokens (
      id ${uuid} PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      purpose text NOT NULL, token_hash text NOT NULL UNIQUE, checkout_proof_hash text NOT NULL,
      expires_at timestamptz NOT NULL, consumed_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT order_access_tokens_purpose_check CHECK (purpose IN ('VIEW', 'CLAIM')),
      CONSTRAINT order_access_tokens_hash_check CHECK (length(trim(token_hash)) > 0 AND length(trim(checkout_proof_hash)) > 0),
      CONSTRAINT order_access_tokens_expiry_check CHECK (expires_at > created_at)
    );
    CREATE INDEX idx_order_access_tokens_order_id ON order_access_tokens(order_id);
    CREATE INDEX idx_order_access_tokens_expires_at ON order_access_tokens(expires_at);
    CREATE TABLE idempotency_requests (
      scope text NOT NULL, key text NOT NULL, request_hash text NOT NULL,
      order_id uuid REFERENCES orders(id) ON DELETE RESTRICT, response_code integer, response_body jsonb,
      expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(scope, key),
      CONSTRAINT idempotency_requests_not_blank CHECK (length(trim(scope)) > 0 AND length(trim(key)) > 0 AND length(trim(request_hash)) > 0),
      CONSTRAINT idempotency_requests_expiry_check CHECK (expires_at > created_at),
      CONSTRAINT idempotency_requests_response_object_check CHECK (response_body IS NULL OR jsonb_typeof(response_body) = 'object')
    );
    CREATE INDEX idx_idempotency_requests_expires_at ON idempotency_requests(expires_at);
    CREATE INDEX idx_idempotency_requests_order_id ON idempotency_requests(order_id) WHERE order_id IS NOT NULL;
    CREATE TABLE order_validation_runs (
      id ${uuid} PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      order_version integer NOT NULL, rule_version text NOT NULL, outcome text NOT NULL,
      error_codes jsonb NOT NULL DEFAULT '[]'::jsonb, diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
      started_at timestamptz NOT NULL, finished_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT order_validation_runs_version_check CHECK (order_version > 0),
      CONSTRAINT order_validation_runs_rule_not_blank CHECK (length(trim(rule_version)) > 0),
      CONSTRAINT order_validation_runs_outcome_check CHECK (outcome IN ('PASSED', 'BUSINESS_FAILED', 'INFRA_FAILED')),
      CONSTRAINT order_validation_runs_json_check CHECK (jsonb_typeof(error_codes) = 'array' AND jsonb_typeof(diagnostics) = 'object'),
      CONSTRAINT order_validation_runs_time_check CHECK (finished_at >= started_at)
    );
    CREATE INDEX idx_order_validation_runs_order_started ON order_validation_runs(order_id, started_at);
    CREATE INDEX idx_order_validation_runs_outcome_started ON order_validation_runs(outcome, started_at);
    ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_validation_run_id_fkey FOREIGN KEY (validation_run_id) REFERENCES order_validation_runs(id) ON DELETE RESTRICT;
    CREATE INDEX idx_order_status_history_changed_by ON order_status_history(changed_by) WHERE changed_by IS NOT NULL;
    CREATE INDEX idx_order_status_history_actor_customer_id ON order_status_history(actor_customer_id) WHERE actor_customer_id IS NOT NULL;
    CREATE INDEX idx_order_status_history_validation_run_id ON order_status_history(validation_run_id) WHERE validation_run_id IS NOT NULL;
    CREATE TABLE admin_alerts (
      id ${uuid} PRIMARY KEY, order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
      entity_type text NOT NULL, entity_id uuid, dedupe_key text NOT NULL, code text NOT NULL, severity text NOT NULL,
      status text NOT NULL DEFAULT 'OPEN', details jsonb NOT NULL DEFAULT '{}'::jsonb,
      acknowledged_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, acknowledged_at timestamptz,
      resolved_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT, resolved_at timestamptz, resolution_reason text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT admin_alerts_not_blank CHECK (length(trim(entity_type)) > 0 AND length(trim(dedupe_key)) > 0 AND length(trim(code)) > 0),
      CONSTRAINT admin_alerts_severity_check CHECK (severity IN ('WARNING', 'URGENT')),
      CONSTRAINT admin_alerts_status_check CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
      CONSTRAINT admin_alerts_details_check CHECK (jsonb_typeof(details) = 'object'),
      CONSTRAINT admin_alerts_resolved_check CHECK (status <> 'RESOLVED' OR (resolved_at IS NOT NULL AND resolution_reason IS NOT NULL AND length(trim(resolution_reason)) > 0))
    );
    CREATE UNIQUE INDEX idx_admin_alerts_open_dedupe_key ON admin_alerts(dedupe_key) WHERE status IN ('OPEN', 'ACKNOWLEDGED');
    CREATE INDEX idx_admin_alerts_status_created_at ON admin_alerts(status, created_at);
    CREATE INDEX idx_admin_alerts_entity ON admin_alerts(entity_type, entity_id) WHERE entity_id IS NOT NULL;
    CREATE INDEX idx_admin_alerts_order_id ON admin_alerts(order_id) WHERE order_id IS NOT NULL;
    CREATE INDEX idx_admin_alerts_acknowledged_by ON admin_alerts(acknowledged_by) WHERE acknowledged_by IS NOT NULL;
    CREATE INDEX idx_admin_alerts_resolved_by ON admin_alerts(resolved_by) WHERE resolved_by IS NOT NULL;
    CREATE TRIGGER trg_admin_alerts_updated_at BEFORE UPDATE ON admin_alerts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TABLE outbox_events (
      event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
      aggregate_version integer NOT NULL, event_type text NOT NULL, schema_version integer NOT NULL, payload jsonb NOT NULL,
      published_at timestamptz, attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
      lease_owner text, lease_until timestamptz, lease_token uuid, last_error text, quarantined_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT outbox_events_not_blank CHECK (length(trim(aggregate_type)) > 0 AND length(trim(event_type)) > 0),
      CONSTRAINT outbox_events_version_check CHECK (aggregate_version > 0 AND schema_version > 0 AND attempts >= 0),
      CONSTRAINT outbox_events_payload_check CHECK (jsonb_typeof(payload) = 'object'),
      CONSTRAINT outbox_events_lease_check CHECK ((lease_owner IS NULL AND lease_until IS NULL AND lease_token IS NULL) OR (lease_owner IS NOT NULL AND lease_until IS NOT NULL AND lease_token IS NOT NULL)),
      CONSTRAINT outbox_events_published_quarantined_check CHECK (NOT (published_at IS NOT NULL AND quarantined_at IS NOT NULL))
    );
    CREATE INDEX idx_outbox_events_pending_due ON outbox_events(next_attempt_at, event_id) WHERE published_at IS NULL AND quarantined_at IS NULL;
    CREATE INDEX idx_outbox_events_lease_until ON outbox_events(lease_until) WHERE lease_until IS NOT NULL;
    CREATE INDEX idx_outbox_events_aggregate ON outbox_events(aggregate_type, aggregate_id, aggregate_version);
    CREATE TABLE processed_events (
      consumer_name text NOT NULL, event_id uuid NOT NULL, processed_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(consumer_name, event_id), CONSTRAINT processed_events_consumer_not_blank CHECK (length(trim(consumer_name)) > 0)
    );
    CREATE INDEX idx_processed_events_processed_at ON processed_events(processed_at);
    CREATE INDEX idx_audit_logs_actor_customer_id ON audit_logs(actor_customer_id) WHERE actor_customer_id IS NOT NULL;
    CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id) WHERE correlation_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM inventory_reservations LIMIT 1) OR EXISTS (SELECT 1 FROM payments LIMIT 1)
        OR EXISTS (SELECT 1 FROM order_access_tokens LIMIT 1) OR EXISTS (SELECT 1 FROM idempotency_requests LIMIT 1)
        OR EXISTS (SELECT 1 FROM order_validation_runs LIMIT 1) OR EXISTS (SELECT 1 FROM admin_alerts LIMIT 1)
        OR EXISTS (SELECT 1 FROM outbox_events LIMIT 1) OR EXISTS (SELECT 1 FROM processed_events LIMIT 1) THEN
        RAISE EXCEPTION 'Refusing commerce execution schema rollback: populated commerce execution tables exist.'
          USING HINT = 'Disable commerce writers and workers, export dependent records, then remove only the disposable verification fixture before retrying down.';
      END IF;
    END $$;
    DROP TABLE IF EXISTS processed_events; DROP TABLE IF EXISTS outbox_events; DROP TABLE IF EXISTS admin_alerts;
    ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_validation_run_id_fkey;
    DROP TABLE IF EXISTS order_validation_runs; DROP TABLE IF EXISTS idempotency_requests;
    DROP TABLE IF EXISTS order_access_tokens; DROP TABLE IF EXISTS payments; DROP TABLE IF EXISTS inventory_reservations;
    DROP INDEX IF EXISTS idx_audit_logs_correlation_id; DROP INDEX IF EXISTS idx_audit_logs_actor_customer_id;
    DROP INDEX IF EXISTS idx_order_status_history_validation_run_id; DROP INDEX IF EXISTS idx_order_status_history_actor_customer_id; DROP INDEX IF EXISTS idx_order_status_history_changed_by;
  `);
};
