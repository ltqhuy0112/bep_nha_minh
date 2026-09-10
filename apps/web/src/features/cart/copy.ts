import type { CartLocale } from "./types";

const copy = {
  vi: {
    title: "Giỏ hàng", loading: "Đang tải giỏ hàng...", retry: "Thử lại", empty: "Giỏ hàng của bạn đang trống.",
    continueMenu: "Xem thực đơn", quantity: "Số lượng", remove: "Xóa", subtotal: "Tạm tính", items: "món",
    delivery: "Ngày và khung giờ nhận", date: "Ngày nhận", slot: "Chọn khung giờ", slotsLoading: "Đang tải khung giờ...",
    slotsEmpty: "Chưa có khung giờ nhận cho ngày này.", selectedSlot: "Khung giờ đã chọn", noSlot: "Chưa chọn khung giờ.",
    unavailable: "Món này hiện không nhận đơn.", blocked: "Món này tạm thời không thể phục vụ.", available: "Còn {count} phần.",
    checkout: "Thanh toán", soon: "Sắp có", checkoutNote: "Thanh toán sẽ sớm được mở.",
    mergeTitle: "Giỏ hàng trước khi đăng nhập", mergeBody: "Bạn có một giỏ hàng khách. Hãy gộp vào giỏ hàng tài khoản khi bạn sẵn sàng.",
    merge: "Gộp giỏ hàng", chooseSlot: "Chọn khung giờ cần giữ", keepGuest: "Giữ khung giờ giỏ khách", keepAccount: "Giữ khung giờ tài khoản",
    mergeQuota: "Không thể gộp vì vượt giới hạn số lượng. Cả hai giỏ hàng vẫn được giữ nguyên.", conflict: "Giỏ hàng đã thay đổi. Hãy tải lại và thử lại.", limit: "Số lượng đã vượt giới hạn cho phép.", unavailableError: "Món ăn hoặc khung giờ đã chọn không còn khả dụng.", error: "Không thể cập nhật giỏ hàng. Hãy thử lại.",
    cartLabel: "Giỏ hàng", back: "Quay lại thực đơn"
  },
  en: {
    title: "Cart", loading: "Loading your cart...", retry: "Try again", empty: "Your cart is empty.",
    continueMenu: "Browse menu", quantity: "Quantity", remove: "Remove", subtotal: "Subtotal", items: "items",
    delivery: "Delivery date and time", date: "Delivery date", slot: "Choose a time slot", slotsLoading: "Loading time slots...",
    slotsEmpty: "No pickup time slots are available for this date.", selectedSlot: "Selected time slot", noSlot: "No time slot selected.",
    unavailable: "This item is not accepting orders.", blocked: "This item is temporarily unavailable.", available: "{count} portions available.",
    checkout: "Checkout", soon: "Soon", checkoutNote: "Checkout will be available soon.",
    mergeTitle: "Cart from before sign-in", mergeBody: "You have a guest cart. Merge it into your account cart when you are ready.",
    merge: "Merge carts", chooseSlot: "Choose the pickup time to keep", keepGuest: "Keep guest cart time", keepAccount: "Keep account cart time",
    mergeQuota: "The carts cannot be merged because a quantity limit would be exceeded. Both carts are unchanged.", conflict: "Your cart changed. Reload and try again.", limit: "The requested quantity exceeds the allowed limit.", unavailableError: "The selected item or time slot is no longer available.", error: "We could not update your cart. Please try again.",
    cartLabel: "Cart", back: "Back to menu"
  }
} as const;

export function cartCopy(locale: CartLocale) { return copy[locale]; }
