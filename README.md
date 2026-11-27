# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```


## Đồng bộ beFood

Dùng dấu trang (bookmarklet), chạy được trên Chrome, Edge, Firefox và Safari mà không cần cài tiện ích.

1. Đăng nhập Lunch Ledger bằng tài khoản editor, mở **Hóa đơn → beFood** (`/receipts?source=befood`) và kéo nút **Lunch Ledger · beFood** lên thanh dấu trang. Mỗi domain Lunch Ledger (localhost, bản deploy) cần một dấu trang riêng.
2. Mở [food.be.com.vn](https://food.be.com.vn/orders) và đăng nhập nếu beFood yêu cầu.
3. Bấm dấu trang khi đang ở tab beFood. Lunch Ledger mở trong cửa sổ mới, đọc các đơn từ ngày của đơn mới nhất đã lưu đến hôm nay (lần đầu: 30 ngày gần nhất), đối chiếu tổng tiền rồi lưu. Lưu theo mã đơn nên đồng bộ lại không bị trùng. Muốn lấy khoảng khác, chọn ngày trong cửa sổ đó rồi bấm **Đồng bộ beFood**. Nếu trình duyệt chặn cửa sổ bật lên, cho phép `food.be.com.vn` mở cửa sổ rồi bấm lại.

Token và cookie beFood không rời khỏi tab beFood. Dấu trang chỉ trả JSON của danh sách đơn và chi tiết đơn cho đúng domain Lunch Ledger đã tạo nó. Giữ tab beFood mở đến khi đồng bộ xong.

