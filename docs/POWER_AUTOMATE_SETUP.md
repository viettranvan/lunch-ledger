# Power Automate Setup — Gửi nhắc nợ vào Teams

Hướng dẫn tạo flow gửi message có **@mention thật** vào channel Teams được chọn trong app.

Flow đang dùng cần cập nhật schema và các action ở Bước 2 trước khi triển khai bản app này. Ảnh chi tiết tiền cơm được lưu vào SharePoint của Team và hiển thị trực tiếp trong Adaptive Card.

## Thông tin channel

| Tham số | Giá trị |
|---------|---------|
| Team ID | `14545eec-51d2-4898-97df-bba08d5937b7` |
| Channel ID | `19:ZhvU1IFOqBaDvAO6osg0dXI6R-YYDLSWwewzEinFT9M1@thread.tacv2` |
| Channel name | Cơm Chưa |
| Tenant ID | `a132a7f5-19fb-48f8-9ed0-5554d0f7652e` |

| Tham số | Giá trị |
|---------|---------|
| Team ID | `14545eec-51d2-4898-97df-bba08d5937b7` |
| Channel ID | `19:X-ecLJw03EqevcEF8U5dJdktA7ZffBRb33Nf6hGDm-E1@thread.tacv2` |
| Channel name | test_power_automate |
| Tenant ID | `a132a7f5-19fb-48f8-9ed0-5554d0f7652e` |

---

## Bước 1: Tạo Flow

1. Mở [make.powerautomate.com](https://make.powerautomate.com)
2. **Create** → **Instant cloud flow**
3. Tên: `Lunch Ledger - Nhắc nợ`
4. Trigger: **When a HTTP request is received**
5. Click **Save** để lấy webhook URL

### JSON Schema cho trigger

Paste vào **Request Body JSON Schema**:

```json
{
  "type": "object",
  "properties": {
    "teamId": { "type": "string" },
    "channelId": { "type": "string" },
    "channelName": { "type": "string" },
    "tenantId": { "type": "string" },
    "qrImageUrl": { "type": "string" },
    "sharePointSiteAddress": { "type": "string" },
    "sharePointFolderPath": { "type": "string" },
    "appUrl": { "type": "string" },
    "screenshotBase64": { "type": "string" },
    "debts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "email": { "type": "string" },
          "amount": { "type": "integer" },
          "formatted_total": { "type": "string" },
          "details": { "type": "string" },
          "line": { "type": "string" }
        },
        "required": ["name", "email", "amount", "line"]
      }
    }
  },
  "required": ["teamId", "channelId", "tenantId", "sharePointSiteAddress", "sharePointFolderPath", "appUrl", "screenshotBase64", "debts"]
}
```

Copy **HTTP POST URL** — dùng cho Convex env var.
Sau khi cập nhật schema, bấm **Save** để Power Automate nạp hai dynamic content mới trước khi sửa các action SharePoint.

---

## Bước 2: Build mentions và lưu ảnh đối chiếu

Thêm các action sau:

### 2a. Initialize variable `MentionBody`

- Action: **Initialize variable**
- Name: `MentionBody`
- Type: String
- Value: `🍔 Tiền cơm — chi tiết từng thành viên:<br>`

Mỗi mention sẽ xuống dòng ở bước Append.

### 2b. Apply to each (loop debts)

- Action: **Apply to each**
- Select output: `debts` từ trigger body

**Bên trong loop:**

#### Get @mention token

- Action: **Get an @mention token for a user** (Microsoft Teams)
- User: `email` từ item hiện tại (`items('Apply_to_each')?['email']`)

#### Append mentions only

- Action: **Append to string variable**
- Name: `MentionBody`
- Value: output **Get an @mention token for a user**, sau đó thêm `<br>`

```
[mention token]<br>
```

Chỉ thêm mention vào `MentionBody`. Ảnh PNG là phần đối chiếu tên và tiền, tránh để client mobile gắn sai một dòng số tiền với mention khác.

### 2c. Lưu ảnh vào SharePoint của Team

- Action: **SharePoint — Create file**
- Site Address: chọn **Enter custom value**, rồi chọn `sharePointSiteAddress` từ dynamic content của HTTP trigger
- Folder Path: chọn `sharePointFolderPath` từ dynamic content của HTTP trigger
- File Name: bấm biểu tượng **fx** → tab **Expression**, nhập công thức, rồi chọn **Add/Update** để chèn expression (không gõ trực tiếp công thức như văn bản):

```text
concat('debt-details-', formatDateTime(utcNow(),'yyyyMMdd-HHmmss'), '-', guid(), '.png')
```

- File Content: bấm **fx** → tab **Expression**, nhập công thức, rồi chọn **Add/Update**:

```text
base64ToBinary(triggerBody()?['screenshotBase64'])
```

Ảnh được lưu trong site của Team và kế thừa quyền của thư mục; không tạo anonymous/“Anyone” link.

Kiểm tra file vừa tạo: tên phải thành dạng `debt-details-<timestamp>-<guid>.png` và nội dung phải mở thành ảnh PNG. Nếu tên file vẫn hiện nguyên `concat(...)` hoặc nội dung file là `base64ToBinary(...)`, công thức đang bị nhập như văn bản; mở lại **Create file** và chèn bằng tab **Expression**.

### 2d. Lấy link ảnh

- Action: **SharePoint — Get file properties**
- Site Address: chọn **Enter custom value**, rồi chọn `sharePointSiteAddress` từ dynamic content của HTTP trigger
- Library Name: chọn đúng thư viện tài liệu từ dropdown của connector. Tên trong dropdown có thể khác đoạn URL như `Shared Documents`; nếu không thấy thư viện, kiểm tra tiêu đề thư viện trong **Site contents** của site rồi chọn tên đó.
- Id: `ItemId` từ bước **Create file**
- Dùng dynamic content **Link to item** làm URL ảnh trong card; file gốc được mở đúng bằng link này.

### 2e. Post Adaptive Card

Sau vòng loop, thêm:

- Action: **Post card in a chat or channel** (Microsoft Teams)
- Post as: Flow bot (hoặc User — tùy connector)
- Post in: **Channel**
- Team: chọn **Enter custom value**, sau đó chọn `teamId` từ dynamic content của HTTP trigger
- Channel: chọn **Enter custom value**, sau đó chọn `channelId` từ dynamic content của HTTP trigger
- Adaptive Card: dán JSON sau. Ảnh tiền cơm luôn hiển thị lớn bằng **Link to item** từ **Get file properties**. `MentionBody`, `qrImageUrl` và `appUrl` được đọc động từ flow:

```json
{
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.4",
  "msteams": { "width": "Full" },
  "body": [
    {
      "type": "TextBlock",
      "text": "🍱 Tiền cơm",
      "weight": "Bolder",
      "size": "Medium",
      "wrap": true
    },
    {
      "type": "TextBlock",
      "text": "@{variables('MentionBody')}",
      "wrap": true
    },
    {
      "type": "Image",
      "url": "@{outputs('Get_file_properties')?['body/{Link}']}",
      "altText": "Chi tiết tiền cơm",
      "size": "Stretch"
    },
    {
      "type": "Image",
      "id": "qrThumb",
      "url": "@{triggerBody()?['qrImageUrl']}",
      "altText": "QR thanh toán",
      "size": "Medium",
      "selectAction": {
        "type": "Action.ToggleVisibility",
        "targetElements": ["qrPreview", "qrCollapse"]
      }
    },
    {
      "type": "Container",
      "id": "qrPreview",
      "isVisible": false,
      "items": [
        {
          "type": "Image",
          "url": "@{triggerBody()?['qrImageUrl']}",
          "altText": "QR thanh toán kích thước lớn",
          "size": "Stretch"
        }
      ]
    },
    {
      "type": "ActionSet",
      "id": "qrCollapse",
      "isVisible": false,
      "actions": [
        {
          "type": "Action.ToggleVisibility",
          "title": "Thu gọn QR",
          "targetElements": ["qrPreview", "qrCollapse"]
        }
      ]
    },
    {
      "type": "ActionSet",
      "actions": [
        {
        "type": "Action.OpenUrl",
        "title": "Xem Chi Tiết",
          "url": "@{triggerBody()?['appUrl']}"
        }
      ]
    }
  ]
}
```

Nếu Power Automate không xử lý expression trong JSON, đặt con trỏ vào các giá trị `text` và `url`, sau đó bấm `/` hoặc lightning bolt để chèn `MentionBody`, `Link to item`, `qrImageUrl` và `appUrl` từ dynamic content. Trong flow thực tế, dùng tên biến nội dung hiện có của bạn (ví dụ `MessageBody`) thay cho `MentionBody` nếu cần.

### 2f. HTTP acknowledgement (tùy chọn)

Flow không có action **Response** vẫn có thể gửi card; HTTP trigger trả `202 Accepted` khi nhận yêu cầu, còn các action tiếp tục chạy. App sẽ báo Flow đã nhận yêu cầu nhưng chưa xác nhận hoàn tất, nên cần kiểm tra **Run history** để xác nhận ảnh và card.

Nếu muốn app nhận xác nhận hoàn tất, thêm action **Response** sau **Post card** và ngoài `Apply to each`:

- Status Code: `200`
- Body: có thể để trống.
- **Asynchronous response** trong **Settings**: Off.

Lưu ý: Microsoft đánh dấu **Response** là action thuộc HTTP Request/Response connector Premium ([tài liệu Microsoft](https://learn.microsoft.com/en-us/power-automate/create-child-flows)). Nếu chưa có quyền Premium, giữ Flow hiện tại; không cần thêm action này để gửi card.

---

## Bước 3: Cấu hình app và Convex

Trong Lunch Ledger → **Configuration** → **Cấu hình kênh Teams**, dùng nút chuyển nhanh **Cơm Chưa** hoặc **test_power_automate** để chọn channel đích. Hai profile dùng chung Team ID và Tenant ID như bảng ở đầu tài liệu. Chọn profile rồi bấm **Lưu cấu hình** để áp dụng. QR được giữ nguyên; SharePoint Site Address được chuyển theo channel:

- **Cơm Chưa**: `https://vinova365.sharepoint.com/sites/VinovaHCM-CmCha`
- **test_power_automate**: `https://vinova365.sharepoint.com/sites/VinovaHCM-test_power_automate`

Cả hai profile dùng Folder Path `/Shared Documents`.

Ở lần cấu hình đầu, điền hai trường SharePoint:

- **SharePoint Site Address**: URL site, ví dụ `https://vinova365.sharepoint.com/sites/VinovaHCM-test_power_automate`. Không dùng URL thư mục `Shared Documents/Forms/AllItems.aspx`.
- **SharePoint Folder Path**: đường dẫn trong thư viện, ví dụ `/Shared Documents`.

Lưu cấu hình. App sẽ gửi hai giá trị này vào HTTP trigger; Flow dùng dynamic content ở cả **Create file** và **Get file properties**.

Set environment variable trên Convex Dashboard:

```bash
npx convex env set POWER_AUTOMATE_WEBHOOK_URL "https://prod-xx.southeastasia.logic.azure.com/workflows/..." --prod
npx convex env set PUBLIC_APP_URL "https://lunch-ledger.vercel.app" --prod
```

Hoặc trong Convex Dashboard → **Production deployment** → Settings → Environment Variables. Với deployment dev, đặt `PUBLIC_APP_URL` thành URL dev nếu muốn thử link ở môi trường đó. Biến này thuộc Convex vì backend thêm URL vào payload gửi Power Automate.

---

## Bước 4: Thêm Teams email cho thành viên

Trong Lunch Ledger → mục **Thành viên** → click từng user → nhập email Teams:

```
julia@vinova.sg
```

Email phải khớp tài khoản Microsoft 365 trong tenant.

---

## Bước 5: Test

1. **Save** flow trong Power Automate
2. Trong Lunch Ledger, bấm **📤 Gửi Teams** ở mục Tổng Nợ
3. Kiểm tra channel đã nhập trong phần **Cấu hình kênh Teams** — message có @mention thật

### Test webhook thủ công

```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "14545eec-51d2-4898-97df-bba08d5937b7",
    "channelId": "19:...@thread.tacv2",
    "channelName": "test_power_automate",
    "tenantId": "a132a7f5-19fb-48f8-9ed0-5554d0f7652e",
    "qrImageUrl": "https://your-cdn.example/qr.jpg",
    "sharePointSiteAddress": "https://vinova365.sharepoint.com/sites/VinovaHCM-test_power_automate",
    "sharePointFolderPath": "/Shared Documents",
    "screenshotBase64": "<thay bằng base64 PNG hợp lệ>",
    "debts": [
      {
        "name": "Julia Pham (Vinova)",
        "email": "julia@vinova.sg",
        "amount": 120000,
        "details": "40 + 35",
        "formatted_total": "120.000đ",
        "line": "40 + 35 = 120.000đ"
      }
    ]
  }'
```

---

## Payload Lunch Ledger gửi

```json
{
    "teamId": "14545eec-51d2-4898-97df-bba08d5937b7",
    "channelId": "19:...@thread.tacv2",
    "channelName": "test_power_automate",
    "tenantId": "a132a7f5-19fb-48f8-9ed0-5554d0f7652e",
    "qrImageUrl": "https://your-cdn.example/qr.jpg",
    "sharePointSiteAddress": "https://vinova365.sharepoint.com/sites/VinovaHCM-test_power_automate",
    "sharePointFolderPath": "/Shared Documents",
    "screenshotBase64": "<base64 PNG được tạo từ preview>",
    "debts": [
    {
      "name": "Julia Pham (Vinova)",
      "email": "julia@vinova.sg",
      "amount": 120000,
      "details": "40 + 35",
      "formatted_total": "120.000đ",
      "line": "40 + 35 = 120.000đ"
    }
  ]
}
```

- `line` = `details` + ` = ` + `formatted_total` — field chính cho Append trong flow
- `teamId` và `channelId` được lấy từ phần **Cấu hình kênh Teams** trong app
- `channelName` là tùy chọn, dùng để hiển thị/đối chiếu; không dùng để route message
- `tenantId` được lấy từ phần **Cấu hình kênh Teams** trong app
- `qrImageUrl` được lấy từ phần **Cấu hình kênh Teams** trong app; để trống nếu không dùng QR
- `sharePointSiteAddress` và `sharePointFolderPath` được lấy từ phần **Cấu hình kênh Teams**; Flow dùng chúng để chọn nơi lưu ảnh
- `screenshotBase64` là raw Base64 PNG (không có tiền tố `data:image/png;base64,`), tạo từ toàn bộ thành viên đang nợ; Power Automate lưu ảnh vào SharePoint của Team và card có nút mở file
- Chỉ gửi người có `direction = owed` (đang nợ tiền)
- Chỉ gửi người đã có `teams_email`
- `amount` tính bằng đồng (120000 = 120.000đ)

---

## Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| Mention không hiện | Kiểm tra email đúng tenant, user có trong team |
| Webhook 401/403 | Re-save flow, copy URL mới |
| Convex báo chưa cấu hình URL | Chạy `npx convex env set POWER_AUTOMATE_WEBHOOK_URL ...` |
| Flow không chạy | Kiểm tra flow đã **Turn on** |
| Premium connector required | HTTP trigger thường cần Power Automate Premium license |
| Tổng nợ trống sau dấu `=` | Cập nhật trigger JSON schema (thêm `line`), **Save** flow, đổi Append dùng chip **line** |

## Tài liệu tham khảo

- [Send a message in Teams - Power Automate](https://learn.microsoft.com/en-us/power-automate/teams/send-a-message-in-teams)
- [Mention users in Teams messages](https://learn.microsoft.com/en-us/power-automate/teams/send-a-message-in-teams#mention-a-user-in-any-message)
