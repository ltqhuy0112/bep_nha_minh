import type { Pool, PoolClient } from "pg";
import type { Cart, CartItem } from "@bep-nha-minh/shared/types/cart";
import type { CartCommand } from "@bep-nha-minh/shared/schemas/cart";
import { AuthError, tokenHash } from "../customer-auth/security";
import { CustomerAuthService } from "../customer-auth/service";
import type { CustomerAuthConfig } from "../customer-auth/config";

type Row = { id: string; version: number; business_date: string | null; slot_key: string | null };
type Limits = Cart["limits"];
const columns = "id,version,business_date::text,slot_key";
const conflict = (code: string) => new AuthError(409, code, "Refresh the cart and review your selection.");

export class CartService {
  private readonly auth: CustomerAuthService;
  constructor(private readonly pool: Pool, config: CustomerAuthConfig, private readonly limits: Limits) {
    this.auth = new CustomerAuthService(pool, config);
  }

  async execute(session: string | null, guest: string | null, locale: "vi" | "en", command?: CartCommand): Promise<Cart> {
    const operation = async (client: PoolClient, accountId: string | null) => {
      // Account/session locks precede cart locks. Guest-only writes never acquire account locks.
      const row = await this.findCart(client, accountId, guest, command?.action === "initialize");
      if (command && command.action !== "initialize") {
        if (command.action === "set-item" && command.source === "account" && !accountId) throw new AuthError(401, "UNAUTHENTICATED", "Sign in is required.");
        const target = command.action === "set-item" && command.source === "guest" && accountId
          ? await this.findCart(client, null, guest, false) : row;
        if (!target || target.version !== command.expectedVersion) throw conflict("CART_VERSION_CONFLICT");
        if (command.action === "set-item") await this.setItem(client, target, command);
        else if (command.action === "set-slot") await this.setSlot(client, target, command.businessDate, command.slotKey);
        else await this.merge(client, target, accountId, guest, command);
        await client.query("UPDATE carts SET version=version+1 WHERE id=$1", [target.id]);
        target.version++;
      }
      const result = await this.dto(client, row, accountId ? "account" : "guest", locale);
      if (accountId && guest) {
        const other = await this.findCart(client, null, guest, false);
        if (other) result.guestCart = await this.dto(client, other, "guest", locale);
      }
      return result;
    };
    if (session) return this.auth.withSession(session, (client, owner) => operation(client, owner.accountId));
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client, null);
      await client.query("COMMIT"); return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  private async findCart(client: PoolClient, account: string | null, guest: string | null, create: boolean) {
    if (!account && !guest) return null;
    const hash = guest ? tokenHash(guest) : null;
    if (create) {
      if (account) await client.query(`INSERT INTO carts(account_id) VALUES ($1)
        ON CONFLICT(account_id) WHERE status='ACTIVE' AND account_id IS NOT NULL DO NOTHING`, [account]);
      else await client.query(`INSERT INTO carts(guest_token_hash) VALUES ($1)
        ON CONFLICT(guest_token_hash) WHERE guest_token_hash IS NOT NULL DO NOTHING`, [hash]);
    }
    const result = await client.query<Row>(`SELECT ${columns} FROM carts WHERE status='ACTIVE'
      AND (expires_at IS NULL OR expires_at>clock_timestamp()) AND ${account ? "account_id" : "guest_token_hash"}=$1 FOR UPDATE`, [account ?? hash]);
    if (create && !result.rows[0]) throw conflict("CART_EXPIRED");
    return result.rows[0] ?? null;
  }

  private async dto(client: PoolClient, row: Row | null, owner: Cart["owner"], locale: "vi" | "en"): Promise<Cart> {
    const result: Cart = { id: row?.id ?? null, version: row?.version ?? 0, owner,
      businessDate: row?.business_date ?? null, slotKey: row?.slot_key ?? null,
      items: [], totalQuantity: 0, subtotal: 0, limits: this.limits, guestCart: null };
    if (!row) return result;
    const items = await client.query<CartItem>(`SELECT p.slug,COALESCE(t.name,p.slug) AS name,ci.quantity,
      p.unit_price AS "unitPrice",p.currency,p.price_version AS "priceVersion",
      (p.accepting_orders AND p.archived_at IS NULL) AS "acceptingOrders",p.fulfillment_blocked AS "fulfillmentBlocked",
      CASE WHEN $3::date IS NULL THEN NULL ELSE COALESCE(i.capacity-i.reserved-i.committed,0) END AS "availableQuantity"
      FROM cart_items ci JOIN products p ON p.id=ci.product_id
      LEFT JOIN product_translations t ON t.product_id=p.id AND t.locale=$2
      LEFT JOIN inventory_slots i ON i.product_id=p.id AND i.business_date=$3::date AND i.slot_key=$4
      WHERE ci.cart_id=$1 ORDER BY p.slug`, [row.id, locale, row.business_date, row.slot_key]);
    result.items = items.rows;
    for (const item of result.items) { result.totalQuantity += item.quantity; result.subtotal += item.quantity * item.unitPrice; }
    if (!Number.isSafeInteger(result.subtotal)) throw new AuthError(422, "AMOUNT_LIMIT", "Cart amount exceeds supported precision.");
    return result;
  }

  private async setItem(client: PoolClient, row: Row, command: Extract<CartCommand, { action: "set-item" }>) {
    const product = (await client.query<{ id: string; accepting_orders: boolean; fulfillment_blocked: boolean; archived_at: Date | null }>(
      "SELECT id,accepting_orders,fulfillment_blocked,archived_at FROM products WHERE slug=$1 FOR SHARE", [command.slug])).rows[0];
    if (!product) throw new AuthError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    if (command.quantity === 0) { await client.query("DELETE FROM cart_items WHERE cart_id=$1 AND product_id=$2", [row.id, product.id]); return; }
    if (!product.accepting_orders || product.fulfillment_blocked || product.archived_at) throw conflict("PRODUCT_UNAVAILABLE");
    const total = (await client.query("SELECT COALESCE(sum(quantity),0)::int AS total FROM cart_items WHERE cart_id=$1 AND product_id<>$2", [row.id, product.id])).rows[0].total;
    if (command.quantity > this.limits.perProduct || total + command.quantity > this.limits.total) throw conflict("CART_QUANTITY_LIMIT");
    await client.query(`INSERT INTO cart_items(cart_id,product_id,quantity) VALUES ($1,$2,$3)
      ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity`, [row.id, product.id, command.quantity]);
  }

  private async setSlot(client: PoolClient, row: Row, date: string, key: string) {
    const valid = await client.query(`SELECT slot_key FROM fulfillment_slots WHERE slot_key=$1 AND enabled
      AND (($2::date+start_local_time) AT TIME ZONE timezone)-make_interval(mins=>cutoff_minutes)>clock_timestamp() FOR SHARE`, [key, date]);
    if (!valid.rowCount) throw conflict("SLOT_UNAVAILABLE");
    await client.query("UPDATE carts SET business_date=$2::date,slot_key=$3 WHERE id=$1", [row.id, date, key]);
    row.business_date = date; row.slot_key = key;
  }

  private async merge(client: PoolClient, target: Row, account: string | null, guest: string | null, command: Extract<CartCommand, { action: "merge" }>) {
    if (!account) throw new AuthError(401, "UNAUTHENTICATED", "Sign in is required.");
    const source = await this.findCart(client, null, guest, false);
    if (!source || source.version !== command.guestVersion) throw conflict("CART_VERSION_CONFLICT");
    const mismatch = source.slot_key && target.slot_key && (source.slot_key !== target.slot_key || source.business_date !== target.business_date);
    if (mismatch && !command.slotSource) throw conflict("CART_SLOT_CONFLICT");
    const merged = await client.query<{ product_id: string; quantity: number }>(`SELECT product_id,sum(quantity)::int AS quantity FROM cart_items
      WHERE cart_id=ANY($1::uuid[]) GROUP BY product_id ORDER BY product_id`, [[source.id, target.id]]);
    if (merged.rows.some((i) => i.quantity > this.limits.perProduct) || merged.rows.reduce((sum, i) => sum + i.quantity, 0) > this.limits.total) throw conflict("CART_QUANTITY_LIMIT");
    // Preserve unavailable items for explicit removal; never silently drop or truncate guest quantities.
    for (const item of merged.rows) await client.query(`INSERT INTO cart_items(cart_id,product_id,quantity) VALUES ($1,$2,$3)
      ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity`, [target.id, item.product_id, item.quantity]);
    const selected = command.slotSource === "guest" || (!target.slot_key && source.slot_key) ? source : target;
    if (selected.business_date && selected.slot_key) await this.setSlot(client, target, selected.business_date, selected.slot_key);
    await client.query("UPDATE carts SET status='MERGED',version=version+1 WHERE id=$1", [source.id]);
  }
}
