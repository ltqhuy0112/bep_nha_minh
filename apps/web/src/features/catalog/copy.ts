import type { CatalogLocale } from "./types";

export const catalogCopy = {
  vi: {
    title: "Thực đơn", eyebrow: "Bếp Nhà Mình", description: "Các món đang được bếp cập nhật theo từng đợt.",
    backHome: "Về trang chủ", viewDetails: "Xem món", paused: "Tạm ngưng nhận đơn", blocked: "Tạm ngưng phục vụ",
    loading: "Đang tải thực đơn...", retry: "Thử lại", empty: "Hiện chưa có món trong thực đơn.", error: "Không thể tải thực đơn lúc này.",
    detailBack: "Quay lại thực đơn", slotsTitle: "Khung nhận món", dateLabel: "Ngày", slotsLoading: "Đang tải khung nhận món...",
    slotsEmpty: "Chưa có khung nhận món cho ngày này.", slotsError: "Không thể tải khung nhận món.", selectSlot: "Chọn khung giờ", availabilityLoading: "Đang kiểm tra tình trạng...",
    available: "Còn nhận", soldOut: "Đã hết", unavailable: "Chưa thể phục vụ", cutoffPassed: "Đã qua giờ nhận", cutoff: "Chốt nhận", quantity: "Còn {count} phần", inventoryNotSet: "Số lượng sẽ được bếp xác nhận.",
    notFound: "Không tìm thấy món này.", detailError: "Không thể tải thông tin món.", price: "Giá", businessDate: "Ngày theo giờ của bếp"
  },
  en: {
    title: "Menu", eyebrow: "Bếp Nhà Mình", description: "Meals currently published by the kitchen.",
    backHome: "Back home", viewDetails: "View meal", paused: "Orders paused", blocked: "Fulfillment unavailable",
    loading: "Loading menu...", retry: "Try again", empty: "There are no meals on the menu yet.", error: "Unable to load the menu right now.",
    detailBack: "Back to menu", slotsTitle: "Fulfillment slots", dateLabel: "Date", slotsLoading: "Loading fulfillment slots...",
    slotsEmpty: "There are no fulfillment slots for this date.", slotsError: "Unable to load fulfillment slots.", selectSlot: "Select a time slot", availabilityLoading: "Checking availability...",
    available: "Available", soldOut: "Sold out", unavailable: "Unavailable", cutoffPassed: "Cutoff passed", cutoff: "Cutoff", quantity: "{count} portions left", inventoryNotSet: "The kitchen will confirm quantity.",
    notFound: "This meal was not found.", detailError: "Unable to load this meal.", price: "Price", businessDate: "Kitchen local date"
  }
} as const;

export function copyFor(locale: CatalogLocale) {
  return catalogCopy[locale];
}
