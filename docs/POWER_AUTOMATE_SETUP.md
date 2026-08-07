# Power Automate Setup — Gửi nhắc nợ vào Teams

Hướng dẫn tạo flow gửi message có **@mention thật** vào channel **Cơm Chưa**.

## Thông tin channel

| Tham số | Giá trị |
|---------|---------|
| Team ID | `14545eec-51d2-4898-97df-bba08d5937b7` |
| Channel ID | `19:ZhvU1IFOqBaDvAO6osg0dXI6R-YYDLSWwewzEinFT9M1@thread.tacv2` |
| Channel name | Cơm Chưa |
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
  }
}
```

Copy **HTTP POST URL** — dùng cho Convex env var.

---

## Bước 2: Build message với mentions

Thêm các action sau:

### 2a. Initialize variable `MessageBody`

- Action: **Initialize variable**
- Name: `MessageBody`
- Type: String
- Value: `🍔 Tiền Cơm:<br>`

> Chỉ một `<br>` sau dấu `:` — mỗi người sẽ xuống dòng ở bước Append.

### 2b. Apply to each (loop debts)

- Action: **Apply to each**
- Select output: `debts` từ trigger body

**Bên trong loop:**

#### Get @mention token

- Action: **Get an @mention token for a user** (Microsoft Teams)
- User: `email` từ item hiện tại (`items('Apply_to_each')?['email']`)

#### Append to message

- Action: **Append to string variable**
- Name: `MessageBody`
- Value (chọn dynamic content, **không gõ tay** tên field):

```
[mention token]: [line]<br>
```

Dynamic content cần chọn:
1. Output **Get an @mention token for a user**
2. Gõ `: ` (dấu hai chấm + space)
3. **line** (Current item) — đã gồm `35,5 + 33,844 = 99.455đ`
4. Gõ `<br>`

> **Lưu ý:** Dùng **`line`** thay vì ghép `details` + `formatted_total` riêng. Nếu field không có trong trigger schema, Power Automate sẽ để trống sau dấu `=` (lỗi hay gặp).

Kết quả mỗi dòng:
```
@Ryuk: 35,5 + 33,844 + 30,111 = 99.455đ
@Julia: 40,078 + 36,384 = 76.462đ
```

Message hoàn chỉnh:
```
🍔 Tiền Cơm:
@Ryuk — 35,5 + 33,844 + 30,111 = 99.455đ
@Julia — 40,078 + 36,384 = 76.462đ
```

### 2c. Post message

Sau vòng loop, thêm:

- Action: **Post message in a chat or channel** (Microsoft Teams)
- Post as: Flow bot (hoặc User — tùy connector)
- Post in: **Channel**
- Team: team chứa channel **Cơm Chưa**
- Channel: **Cơm Chưa**
- Message: `@{variables('MessageBody')}`

---

## Bước 3: Cấu hình Convex

Set environment variable trên Convex Dashboard:

```bash
npx convex env set POWER_AUTOMATE_WEBHOOK_URL "https://prod-xx.southeastasia.logic.azure.com/workflows/..."
```

Hoặc trong Convex Dashboard → Settings → Environment Variables.

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
3. Kiểm tra channel **Cơm Chưa** — message có @mention thật

### Test webhook thủ công

```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
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
