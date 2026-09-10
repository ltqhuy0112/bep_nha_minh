export const addressCopy = {
  vi: {
    title: "Địa chỉ giao hàng", account: "Tài khoản", add: "Thêm địa chỉ", edit: "Sửa địa chỉ", remove: "Xóa địa chỉ",
    empty: "Bạn chưa có địa chỉ giao hàng.", name: "Người nhận", phone: "Số điện thoại", line: "Số nhà, tên đường",
    ward: "Phường / Xã", district: "Quận / Huyện", city: "Tỉnh / Thành phố", optional: "không bắt buộc",
    chooseProvince: "Chọn tỉnh / thành phố", chooseWard: "Chọn phường / xã",
    locationError: "Chưa tải được danh mục địa chỉ. Vui lòng thử lại.",
    legacyAddress: "Địa chỉ cũ: vui lòng chọn lại tỉnh/thành phố và phường/xã hiện tại khi lưu.",
    default: "Mặc định", makeDefault: "Đặt làm mặc định", save: "Lưu địa chỉ", cancel: "Hủy", loading: "Đang tải...",
    retry: "Thử lại", failed: "Không thể hoàn tất yêu cầu. Vui lòng thử lại.", invalid: "Vui lòng kiểm tra các trường đã nhập.",
    confirm: "Xóa địa chỉ này?", deleteNote: "Địa chỉ đã lưu trên đơn hàng trước đây không thay đổi.",
    saved: "Đã lưu địa chỉ.", deleted: "Đã xóa địa chỉ.", updated: "Đã đổi địa chỉ mặc định.", rate: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
  },
  en: {
    title: "Delivery addresses", account: "Account", add: "Add address", edit: "Edit address", remove: "Delete address",
    empty: "You have no saved delivery addresses.", name: "Recipient", phone: "Phone number", line: "Street address",
    ward: "Ward / Commune", district: "District", city: "Province / City", optional: "optional",
    chooseProvince: "Select province / city", chooseWard: "Select ward / commune",
    locationError: "Address reference data could not be loaded. Please try again.",
    legacyAddress: "Legacy address: select the current province/city and ward/commune before saving.",
    default: "Default", makeDefault: "Set as default", save: "Save address", cancel: "Cancel", loading: "Loading...",
    retry: "Try again", failed: "Unable to complete the request. Please try again.", invalid: "Please check the fields you entered.",
    confirm: "Delete this address?", deleteNote: "Addresses saved on previous orders will not change.",
    saved: "Address saved.", deleted: "Address deleted.", updated: "Default address updated.", rate: "Too many requests. Please try again later.",
  },
};
export type AddressCopy = typeof addressCopy.vi;
