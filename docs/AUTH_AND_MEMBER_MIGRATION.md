# Auth và chuyển dữ liệu thành viên

Ứng dụng giữ dashboard, hóa đơn và tổng nợ ở chế độ xem công khai. Chỉ tài khoản có email khớp `EDITOR_EMAIL` mới được ghi dữ liệu hoặc gửi Teams. Đây là link công khai: bất kỳ ai có link đều có thể xem dữ liệu hiển thị trên dashboard.

## Cấu hình development

1. Trên Convex dev, cấu hình các biến sau bằng Dashboard hoặc `npx convex env set`:

   - `EDITOR_EMAIL`: email editor duy nhất.
   - `EDITOR_BOOTSTRAP_CODE`: mã ngẫu nhiên dùng một lần (ví dụ tạo bằng `openssl rand -hex 32`). Không lưu mã trong Git hoặc Vercel.
   - `JWT_PRIVATE_KEY` và `JWKS`: tạo theo bước Manual Setup của [Convex Auth](https://labs.convex.dev/auth/setup/manual), nếu deployment chưa có.

   `CONVEX_SITE_URL` phải là URL `.convex.site` tương ứng. Frontend dùng `VITE_CONVEX_URL`; không cần `VITE_CONVEX_SITE_URL` vì app không đọc biến đó.
3. Chạy `npx convex dev` trên dev deployment. Đây là bước cập nhật schema/functions lên dev; không dùng `--prod` ở giai đoạn này.
4. Mở `/login`, chọn “Khởi tạo editor lần đầu”, nhập đúng `EDITOR_EMAIL`, mật khẩu và `EDITOR_BOOTSTRAP_CODE`. Tài khoản sẽ được đăng nhập ngay sau khi khởi tạo.
5. Sau khi đăng nhập thành công, xóa `EDITOR_BOOTSTRAP_CODE` khỏi Convex dev environment. Bản ghi `auth_bootstrap` cũng làm cho đăng ký tiếp theo bị từ chối, kể cả khi ai đó vô tình đặt lại biến.
6. Thử đăng xuất, đăng nhập lại và xác nhận tài khoản editor có thể thao tác.

## Chuyển users nghiệp vụ sang members

Schema hiện tại được nới để `users` tạm thời chứa được cả thành viên cũ lẫn user của Convex Auth. `members` là bảng thành viên mới; `orderers.member_id` là quan hệ mới. Migration sao chép tên/trạng thái/Teams email, cập nhật orderers rồi xóa từng document thành viên cũ khỏi `users`. Migration có thể tiếp tục sau lỗi và có khóa `legacy_user_id` để tránh tạo member trùng khi chạy lại.

Trên một deployment có dữ liệu, trước hết export backup và thông báo maintenance. Trong lúc chuyển, ngừng mọi thao tác ghi và không khởi tạo account editor cho tới khi migration hoàn tất.

```sh
# Chạy trước trên dev có bản sao dữ liệu tương tự
npx convex run migrations:migrateLegacyMembers '{"dryRun":true}'
npx convex run migrations:migrateLegacyMembers
npx convex run migrations:verifyLegacyMemberMigration
```

Chỉ tiếp tục khi kết quả verify cho thấy `remainingLegacyMembers` và `remainingLegacyOrderers` đều bằng `0`, đồng thời số `members` khớp số thành viên trước migration. Kiểm tra thêm vài hóa đơn cũ và dữ liệu liên hệ. Không xóa backup cho tới khi hoàn tất smoke test.

Migration được gọi bằng CLI, không tự chạy khi deploy. Trên production, chỉ chạy sau backup/maintenance đã được xác nhận:

```sh
npx convex run migrations:migrateLegacyMembers '{"dryRun":true}' --prod
npx convex run migrations:migrateLegacyMembers --prod
npx convex run migrations:verifyLegacyMemberMigration --prod
```

Trước lần deploy functions production, khởi tạo JWT keys bằng `npx @convex-dev/auth --prod` và cấu hình `EDITOR_EMAIL`, `EDITOR_BOOTSTRAP_CODE` trong Convex production environment. Deploy schema/functions tương thích trước, rồi mới chạy migration và verify counts trong thời gian maintenance. Chỉ bỏ maintenance sau khi đăng nhập editor, xem ẩn danh và khóa mutation trực tiếp đều đạt.

## Kiểm tra bảo mật và smoke test

- Mở app ở cửa sổ ẩn danh: dashboard, hóa đơn và tổng nợ đọc được; không hiện email Teams hay thao tác ghi.
- Gọi thử trực tiếp từng public mutation (`features.invoices.mutations.create`, `updateWithOrders`, `deleteInvoice`; `features.orders.mutations.*`; `features.users.mutations.*`; `features.teams.mutations.save`) và `integrations.teams.actions.sendDebtReminder` khi chưa đăng nhập: tất cả phải bị từ chối.
- Đăng nhập bằng email khác `EDITOR_EMAIL`: vẫn không được sửa dữ liệu.
- Editor có thể tạo/sửa hóa đơn, cập nhật thanh toán, quản lý members/cấu hình, gửi Teams; sign-out lập tức bỏ quyền trên UI.

`users.is_active`, `users.teams_email` và `orderers.user_id` hiện được giữ dưới dạng trường migration tương thích. Chỉ gỡ chúng trong một thay đổi schema sau khi đã đối chiếu migration và không cần khả năng chạy lại; không xóa `members.legacy_user_id` trước khi kết thúc giai đoạn xác minh.
