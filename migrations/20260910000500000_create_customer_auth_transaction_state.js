exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE customer_oauth_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider text NOT NULL,
      state_hash char(64) NOT NULL UNIQUE,
      browser_binding_hash char(64) NOT NULL,
      pkce_ciphertext jsonb,
      redirect_uri text NOT NULL,
      locale char(2) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
      expires_at timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '10 minutes'),
      consumed_at timestamptz,
      CONSTRAINT customer_oauth_transactions_provider_check CHECK (provider IN ('GOOGLE', 'FACEBOOK')),
      CONSTRAINT customer_oauth_transactions_state_hash_check CHECK (state_hash ~ '^[0-9a-f]{64}$'),
      CONSTRAINT customer_oauth_transactions_browser_binding_hash_check CHECK (browser_binding_hash ~ '^[0-9a-f]{64}$'),
      CONSTRAINT customer_oauth_transactions_pkce_ciphertext_check CHECK (
        pkce_ciphertext IS NULL OR (
          jsonb_typeof(pkce_ciphertext) = 'object' AND
          pkce_ciphertext ? 'iv' AND pkce_ciphertext ? 'tag' AND pkce_ciphertext ? 'data' AND
          jsonb_typeof(pkce_ciphertext->'iv') = 'string' AND
          jsonb_typeof(pkce_ciphertext->'tag') = 'string' AND
          jsonb_typeof(pkce_ciphertext->'data') = 'string'
        )
      ),
      CONSTRAINT customer_oauth_transactions_redirect_uri_check CHECK (
        length(trim(redirect_uri)) > 0 AND
        redirect_uri ~* '^https?://' AND
        redirect_uri !~* '^https?://[^/]*@' AND
        redirect_uri !~ '#'
      ),
      CONSTRAINT customer_oauth_transactions_locale_check CHECK (locale IN ('vi', 'en')),
      CONSTRAINT customer_oauth_transactions_expiry_check CHECK (
        expires_at > created_at AND expires_at <= created_at + interval '10 minutes'
      ),
      CONSTRAINT customer_oauth_transactions_consumed_at_check CHECK (
        consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at <= expires_at)
      )
    );
    CREATE INDEX idx_customer_oauth_transactions_expires_at
      ON customer_oauth_transactions(expires_at);

    CREATE TABLE customer_auth_rate_limits (
      action varchar(64) NOT NULL,
      key_hash char(64) NOT NULL,
      window_started_at timestamptz NOT NULL,
      window_expires_at timestamptz NOT NULL,
      attempt_count integer NOT NULL,
      PRIMARY KEY (action, key_hash, window_started_at),
      CONSTRAINT customer_auth_rate_limits_action_check CHECK (action ~ '^[A-Z][A-Z0-9_]{0,63}$'),
      CONSTRAINT customer_auth_rate_limits_key_hash_check CHECK (key_hash ~ '^[0-9a-f]{64}$'),
      CONSTRAINT customer_auth_rate_limits_attempt_count_check CHECK (attempt_count > 0),
      CONSTRAINT customer_auth_rate_limits_window_check CHECK (window_expires_at > window_started_at)
    );
    CREATE INDEX idx_customer_auth_rate_limits_window_expires_at
      ON customer_auth_rate_limits(window_expires_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    LOCK TABLE customer_oauth_transactions, customer_auth_rate_limits IN ACCESS EXCLUSIVE MODE;
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM customer_oauth_transactions
        WHERE consumed_at IS NULL AND expires_at > clock_timestamp()
      ) THEN
        RAISE EXCEPTION 'Refusing customer auth transaction rollback: active unconsumed OAuth transactions exist.'
          USING HINT = 'Disable OAuth callbacks and wait for transactions to expire before retrying down.';
      END IF;
      IF EXISTS (
        SELECT 1 FROM customer_auth_rate_limits
        WHERE window_expires_at > clock_timestamp()
      ) THEN
        RAISE EXCEPTION 'Refusing customer auth rate-limit rollback: active limiter windows exist.'
          USING HINT = 'Disable customer auth writers and wait for limiter windows to expire before retrying down.';
      END IF;
    END $$;
    DROP TABLE IF EXISTS customer_auth_rate_limits;
    DROP TABLE IF EXISTS customer_oauth_transactions;
  `);
};
