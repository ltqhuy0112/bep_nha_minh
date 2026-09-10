export const seededAdminId = "10000000-0000-4000-8000-000000000001";
export const seededManagerId = "10000000-0000-4000-8000-000000000002";

export const seedCustomers = [
  ["20000000-0000-4000-8000-000000000001", "Nguyễn Minh Anh", "0901001001", "minhanh@example.com", "12 Nguyễn Đình Chiểu", "Phường Đa Kao", "Quận 1", "TP. Hồ Chí Minh", "Thích ít cay"],
  ["20000000-0000-4000-8000-000000000002", "Trần Hoàng Nam", "0901001002", "hoangnam@example.com", "48 Trần Quốc Toản", "Phường Võ Thị Sáu", "Quận 3", "TP. Hồ Chí Minh", "Giao buổi trưa"],
  ["20000000-0000-4000-8000-000000000003", "Lê Bảo Châu", "0901001003", "baochau@example.com", "22 Lê Văn Sỹ", "Phường 13", "Quận 3", "TP. Hồ Chí Minh", null],
  ["20000000-0000-4000-8000-000000000004", "Phạm Gia Hân", "0901001004", "giahan@example.com", "91 Pasteur", "Phường Bến Nghé", "Quận 1", "TP. Hồ Chí Minh", "Không hành"],
  ["20000000-0000-4000-8000-000000000005", "Đặng Quốc Huy", "0901001005", "quochuy@example.com", "7 Hoa Mai", "Phường 2", "Phú Nhuận", "TP. Hồ Chí Minh", null],
  ["20000000-0000-4000-8000-000000000006", "Võ Thanh Tâm", "0901001006", "thanhtam@example.com", "38 Nguyễn Thị Minh Khai", "Phường 6", "Quận 3", "TP. Hồ Chí Minh", "Ưu tiên cơm gạo lứt"],
  ["20000000-0000-4000-8000-000000000007", "Huỳnh Mai Linh", "0901001007", "mailinh@example.com", "18 Phan Xích Long", "Phường 7", "Phú Nhuận", "TP. Hồ Chí Minh", null],
  ["20000000-0000-4000-8000-000000000008", "Bùi Đức Anh", "0901001008", "ducanh@example.com", "66 Nguyễn Hữu Cảnh", "Phường 22", "Bình Thạnh", "TP. Hồ Chí Minh", "Gọi trước khi giao"],
  ["20000000-0000-4000-8000-000000000009", "Ngô Thu Hà", "0901001009", "thuha@example.com", "11 Lý Chính Thắng", "Phường 8", "Quận 3", "TP. Hồ Chí Minh", null],
  ["20000000-0000-4000-8000-000000000010", "Đỗ Minh Quân", "0901001010", "minhquan@example.com", "101 Cách Mạng Tháng 8", "Phường 5", "Quận 3", "TP. Hồ Chí Minh", "Ăn clean theo tuần"],
  ["20000000-0000-4000-8000-000000000011", "Lý Khánh Vy", "0901001011", "khanhvy@example.com", "29 Nguyễn Trãi", "Phường Bến Thành", "Quận 1", "TP. Hồ Chí Minh", null],
  ["20000000-0000-4000-8000-000000000012", "Cao Nhật Minh", "0901001012", "nhatminh@example.com", "53 Điện Biên Phủ", "Phường 15", "Bình Thạnh", "TP. Hồ Chí Minh", "Không nước sốt ngọt"]
] as const;

export const seedMenuItems = [
  ["Cơm gà xé trứng lòng đào", 65000],
  ["Bò sốt tiêu đen khoai lang", 79000],
  ["Cơm chay lành mạnh", 59000],
  ["Salad ức gà áp chảo", 72000],
  ["Combo 3 ngày", 189000],
  ["Combo 5 ngày", 305000],
  ["Bún gạo lứt thịt nướng", 69000],
  ["Ức gà sốt mè rang", 75000],
  ["Cá hồi áp chảo rau củ", 115000],
  ["Súp bí đỏ hạt chia", 39000],
  ["Combo văn phòng 7 ngày", 429000],
  ["Gói meal prep gia đình", 890000],
  ["Set detox và salad tuần", 520000],
  ["Cá hồi áp chảo premium", 185000],
  ["Bò Úc sốt tiêu đen", 165000]
] as const;

export type SeedOrderStatus =
  | "PENDING"
  | "APPROVED"
  | "PREPARING"
  | "READY"
  | "DELIVERING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type SeedOrder = {
  code: string;
  customerIndex: number;
  status: SeedOrderStatus;
  ageHours: number;
  fulfillmentType: "DELIVERY" | "PICKUP";
  items: [number, number][];
  deliveryFee?: number;
  discount?: number;
  note?: string;
  internalNote?: string;
  reason?: string;
};

const baseSeedOrders: SeedOrder[] = [
  { code: "BNM-260723-001", customerIndex: 0, status: "PENDING", ageHours: 1, fulfillmentType: "DELIVERY", items: [[0, 1], [9, 2]], deliveryFee: 15000, note: "Giao trước 12h30" },
  { code: "BNM-260723-002", customerIndex: 1, status: "PENDING", ageHours: 3, fulfillmentType: "PICKUP", items: [[3, 1], [9, 1]], note: "Nhận tại bếp" },
  { code: "BNM-260723-003", customerIndex: 2, status: "APPROVED", ageHours: 6, fulfillmentType: "DELIVERY", items: [[1, 1], [2, 1]], deliveryFee: 15000, internalNote: "Đã gọi xác nhận" },
  { code: "BNM-260723-004", customerIndex: 3, status: "PREPARING", ageHours: 10, fulfillmentType: "DELIVERY", items: [[4, 1]], deliveryFee: 15000 },
  { code: "BNM-260722-001", customerIndex: 4, status: "READY", ageHours: 18, fulfillmentType: "PICKUP", items: [[0, 2]], discount: 10000 },
  { code: "BNM-260722-002", customerIndex: 5, status: "DELIVERING", ageHours: 22, fulfillmentType: "DELIVERY", items: [[7, 1], [9, 1]], deliveryFee: 15000 },
  { code: "BNM-260722-003", customerIndex: 6, status: "COMPLETED", ageHours: 28, fulfillmentType: "DELIVERY", items: [[8, 1]], deliveryFee: 15000 },
  { code: "BNM-260721-001", customerIndex: 7, status: "COMPLETED", ageHours: 36, fulfillmentType: "DELIVERY", items: [[5, 1]], deliveryFee: 0, discount: 15000 },
  { code: "BNM-260721-002", customerIndex: 8, status: "REJECTED", ageHours: 44, fulfillmentType: "DELIVERY", items: [[2, 1]], deliveryFee: 15000, reason: "Khung giờ giao đã kín" },
  { code: "BNM-260721-003", customerIndex: 9, status: "CANCELLED", ageHours: 52, fulfillmentType: "PICKUP", items: [[6, 2]], reason: "Khách đổi lịch" },
  { code: "BNM-260720-001", customerIndex: 10, status: "COMPLETED", ageHours: 62, fulfillmentType: "DELIVERY", items: [[0, 1], [3, 1]], deliveryFee: 15000 },
  { code: "BNM-260720-002", customerIndex: 11, status: "APPROVED", ageHours: 70, fulfillmentType: "DELIVERY", items: [[4, 1]], deliveryFee: 0 },
  { code: "BNM-260719-001", customerIndex: 0, status: "COMPLETED", ageHours: 86, fulfillmentType: "DELIVERY", items: [[1, 1], [9, 2]], deliveryFee: 15000 },
  { code: "BNM-260719-002", customerIndex: 1, status: "PREPARING", ageHours: 94, fulfillmentType: "DELIVERY", items: [[7, 2]], deliveryFee: 15000, discount: 5000 },
  { code: "BNM-260718-001", customerIndex: 2, status: "COMPLETED", ageHours: 112, fulfillmentType: "PICKUP", items: [[5, 1]], discount: 10000 },
  { code: "BNM-260718-002", customerIndex: 3, status: "CANCELLED", ageHours: 124, fulfillmentType: "DELIVERY", items: [[8, 1]], deliveryFee: 15000, reason: "Khách báo vắng nhà" },
  { code: "BNM-260717-001", customerIndex: 4, status: "COMPLETED", ageHours: 144, fulfillmentType: "DELIVERY", items: [[0, 1], [6, 1]], deliveryFee: 15000 },
  { code: "BNM-260717-002", customerIndex: 5, status: "REJECTED", ageHours: 156, fulfillmentType: "PICKUP", items: [[2, 2]], reason: "Hết món chay trong ngày" },
  { code: "BNM-260716-001", customerIndex: 6, status: "COMPLETED", ageHours: 174, fulfillmentType: "DELIVERY", items: [[4, 1]], deliveryFee: 0, discount: 10000 },
  { code: "BNM-260716-002", customerIndex: 7, status: "COMPLETED", ageHours: 190, fulfillmentType: "DELIVERY", items: [[3, 2], [9, 2]], deliveryFee: 15000 },
  { code: "BNM-260715-001", customerIndex: 8, status: "COMPLETED", ageHours: 214, fulfillmentType: "PICKUP", items: [[5, 1]] },
  { code: "BNM-260714-001", customerIndex: 9, status: "COMPLETED", ageHours: 238, fulfillmentType: "DELIVERY", items: [[8, 1], [9, 1]], deliveryFee: 15000 },
  { code: "BNM-260713-001", customerIndex: 10, status: "COMPLETED", ageHours: 262, fulfillmentType: "DELIVERY", items: [[1, 2]], deliveryFee: 15000, discount: 10000 },
  { code: "BNM-260712-001", customerIndex: 11, status: "COMPLETED", ageHours: 286, fulfillmentType: "PICKUP", items: [[4, 1]] }
];

const generatedStatuses: SeedOrderStatus[] = [
  "PENDING",
  "APPROVED",
  "PREPARING",
  "READY",
  "DELIVERING",
  "COMPLETED",
  "COMPLETED",
  "COMPLETED",
  "COMPLETED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED"
];

const generatedOrderTemplates: Pick<
  SeedOrder,
  "fulfillmentType" | "items" | "deliveryFee" | "discount" | "note" | "internalNote"
>[] = [
  {
    fulfillmentType: "DELIVERY",
    items: [[10, 1], [13, 2], [9, 4]],
    deliveryFee: 0,
    discount: 20000,
    note: "Gói văn phòng giao trước 11h30",
    internalNote: "Khách đặt theo tuần"
  },
  {
    fulfillmentType: "DELIVERY",
    items: [[11, 1], [4, 2], [14, 2]],
    deliveryFee: 0,
    discount: 50000,
    note: "Giao cho nhóm gia đình",
    internalNote: "Đơn giá trị cao"
  },
  {
    fulfillmentType: "PICKUP",
    items: [[12, 1], [8, 2], [9, 3]],
    discount: 30000,
    note: "Khách ghé nhận tại bếp"
  },
  {
    fulfillmentType: "DELIVERY",
    items: [[5, 2], [13, 1], [7, 3]],
    deliveryFee: 0,
    discount: 25000,
    note: "Công ty đặt bữa trưa"
  },
  {
    fulfillmentType: "DELIVERY",
    items: [[10, 2], [14, 2], [0, 4]],
    deliveryFee: 0,
    discount: 40000,
    internalNote: "Ưu tiên đóng gói riêng từng phần"
  },
  {
    fulfillmentType: "PICKUP",
    items: [[11, 1], [12, 1], [13, 2]],
    discount: 60000,
    note: "Đơn chuẩn bị cho cuối ngày"
  }
];

function generatedReason(status: SeedOrderStatus, index: number) {
  if (status === "REJECTED") {
    return index % 2 === 0 ? "Khung giờ giao đã kín" : "Một món trong set đã hết";
  }

  if (status === "CANCELLED") {
    return index % 2 === 0 ? "Khách đổi lịch giao" : "Khách muốn chuyển sang ngày khác";
  }

  return undefined;
}

const generatedSeedOrders: SeedOrder[] = Array.from({ length: 72 }, (_, index) => {
  const status = generatedStatuses[index % generatedStatuses.length];
  const template = generatedOrderTemplates[index % generatedOrderTemplates.length];

  return {
    code: `BNM-DEMO-${String(index + 1).padStart(3, "0")}`,
    customerIndex: index % seedCustomers.length,
    status,
    ageHours: 2 + index * 4,
    fulfillmentType: template.fulfillmentType,
    items: template.items,
    deliveryFee: template.deliveryFee,
    discount: template.discount,
    note: template.note,
    internalNote: template.internalNote,
    reason: generatedReason(status, index)
  };
});

export const seedOrders: SeedOrder[] = [
  ...baseSeedOrders,
  ...generatedSeedOrders
];
