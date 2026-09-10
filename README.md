# Trưa Nay Ăn Gì — bản cá nhân

Đây là bản tĩnh dành cho GitHub Pages. Dữ liệu món ăn, bộ lọc và số lượt quay được lưu trong cookie của từng trình duyệt; không có tài khoản, backend hoặc đồng bộ giữa các thiết bị.

## Đưa lên GitHub Pages

1. Tạo một repository mới trên GitHub. Có thể đặt tên bất kỳ, ví dụ `trua-nay-an-gi`.
2. Đẩy toàn bộ thư mục này lên nhánh `main` của repository đó.
3. Mở **Settings → Pages**.
4. Trong **Build and deployment → Source**, chọn **GitHub Actions**.
5. Mở thẻ **Actions** và chờ quy trình **Deploy to GitHub Pages** hoàn tất.

Website sẽ có địa chỉ dạng:

```text
https://TEN-TAI-KHOAN.github.io/TEN-REPOSITORY/
```

Nếu repository được đặt đúng tên `TEN-TAI-KHOAN.github.io`, địa chỉ website sẽ là:

```text
https://TEN-TAI-KHOAN.github.io/
```

GitHub Pages thông thường là website công khai. Thẻ `noindex` hiện có giúp hạn chế công cụ tìm kiếm lập chỉ mục, nhưng không phải cơ chế bảo mật: bất kỳ ai biết URL vẫn có thể mở trang.

## Chạy trên máy

Cần Node.js 22.12 trở lên và pnpm 12.3.4.

```sh
pnpm install --frozen-lockfile
pnpm start
```

Sau đó mở <http://127.0.0.1:5173>.

## Ghi công

Nguồn gốc tác giả và tài nguyên được giữ tại [ATTRIBUTION.md](ATTRIBUTION.md). Việc tái xuất bản bản này dựa trên xác nhận của người sử dụng rằng họ đã có sự cho phép cần thiết từ chủ sở hữu quyền.
