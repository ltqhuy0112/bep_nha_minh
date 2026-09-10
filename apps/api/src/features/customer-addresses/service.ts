import type { PoolClient } from "pg";
import type { CustomerAddress, CustomerAddressInput } from "@bep-nha-minh/shared/schemas/customer-address";
import { CustomerAuthService } from "../customer-auth/service";
import { AuthError } from "../customer-auth/security";

const columns = `id, recipient_name AS "recipientName", phone, address_line AS "addressLine",
  ward, district, city, province_code AS "provinceCode", ward_code AS "wardCode", location_dataset_id AS "locationDatasetId",
  province_name_en AS "provinceNameEn", ward_name_en AS "wardNameEn", is_default AS "isDefault", created_at AS "createdAt", updated_at AS "updatedAt"`;
type AddressRow = Omit<CustomerAddress, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date };
const dto = (row: AddressRow): CustomerAddress => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });

export class CustomerAddressService {
  constructor(private readonly auth: CustomerAuthService) {}

  list(token: string | null) {
    return this.auth.withSession(token, async (client, owner) => {
      const result = await client.query<AddressRow>(`SELECT ${columns} FROM customer_addresses
        WHERE customer_id=$1 ORDER BY is_default DESC, created_at DESC, id`, [owner.customerId]);
      return { items: result.rows.map(dto) };
    });
  }

  save(token: string | null, input: CustomerAddressInput, id?: string) {
    return this.auth.withSession(token, async (client, owner) => {
      if (id) await this.owned(client, owner.customerId, id);
      if (input.isDefault) await this.clearDefault(client, owner.customerId);
      const values = [owner.customerId, input.recipientName, input.phone, input.addressLine,
        input.provinceCode, input.wardCode, input.isDefault];
      const result = id
        ? await client.query<AddressRow>(`UPDATE customer_addresses SET recipient_name=$2,phone=$3,address_line=$4,
          province_code=$5,ward_code=$6,city='',ward=NULL,district=NULL,is_default=$7 WHERE customer_id=$1 AND id=$8 RETURNING ${columns}`, [...values, id])
        : await client.query<AddressRow>(`INSERT INTO customer_addresses(customer_id,recipient_name,phone,address_line,province_code,ward_code,city,is_default)
          VALUES ($1,$2,$3,$4,$5,$6,'',$7) RETURNING ${columns}`, values);
      await this.audit(client, owner.customerId, result.rows[0].id, id ? "CUSTOMER_ADDRESS_UPDATED" : "CUSTOMER_ADDRESS_CREATED");
      return dto(result.rows[0]);
    });
  }

  setDefault(token: string | null, id: string) {
    return this.auth.withSession(token, async (client, owner) => {
      await this.owned(client, owner.customerId, id);
      await this.clearDefault(client, owner.customerId);
      const result = await client.query<AddressRow>(`UPDATE customer_addresses SET is_default=true
        WHERE customer_id=$1 AND id=$2 RETURNING ${columns}`, [owner.customerId, id]);
      await this.audit(client, owner.customerId, id, "CUSTOMER_ADDRESS_DEFAULT_SET");
      return dto(result.rows[0]);
    });
  }

  remove(token: string | null, id: string) {
    return this.auth.withSession(token, async (client, owner) => {
      await this.owned(client, owner.customerId, id);
      await client.query("DELETE FROM customer_addresses WHERE customer_id=$1 AND id=$2", [owner.customerId, id]);
      await this.audit(client, owner.customerId, id, "CUSTOMER_ADDRESS_DELETED");
      return { accepted: true };
    });
  }

  private async owned(client: PoolClient, customerId: string, id: string) {
    const result = await client.query("SELECT id FROM customer_addresses WHERE customer_id=$1 AND id=$2 FOR UPDATE", [customerId, id]);
    if (!result.rowCount) throw new AuthError(404, "NOT_FOUND", "Address not found.");
  }
  private clearDefault(client: PoolClient, customerId: string) {
    return client.query("UPDATE customer_addresses SET is_default=false WHERE customer_id=$1 AND is_default", [customerId]);
  }
  private audit(client: PoolClient, customerId: string, id: string, action: string) {
    return client.query(`INSERT INTO audit_logs(action,entity_type,entity_id,actor_type,actor_customer_id,metadata)
      VALUES ($1,'CUSTOMER_ADDRESS',$2,'CUSTOMER',$3,'{}')`, [action, id, customerId]);
  }
}
