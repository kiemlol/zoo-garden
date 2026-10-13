# Nghiệm thu giao diện đăng nhập và HUD ZooPet

Ngày kiểm tra: 2026-10-13. Môi trường: Node 24.19.0, Chromium 154, Playwright có sẵn trong môi trường; WebGL chạy bằng SwiftShader. Không deploy hoặc chạy migration. API kiểm thử sử dụng thư mục tài khoản tạm trong `/tmp`, tách khỏi dữ liệu dự án.

## Kiến trúc và nguyên nhân

- Tài khoản hiện có dùng `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`; cookie HttpOnly/SameSite và hồ sơ server. Server băm mật khẩu bằng `scrypt`. API gameplay kiểm tra session; WebSocket kiểm tra session khi nâng cấp kết nối và khi xử lý message. Các cơ chế này được giữ nguyên, không thêm guest multiplayer hoặc hệ thống xác thực khác.
- Màn hình đầu trước đây chỉ mở tiến trình ngoại tuyến; form tài khoản nằm trong menu trực tuyến. Form thiếu xác nhận mật khẩu và hiện/ẩn mật khẩu. Lỗi kết nối làm thay form bằng thẻ báo server offline, mất dữ liệu đang nhập. Đăng nhập thành công chưa tự đóng menu và bắt đầu game.
- Dock menu dùng grid tự thêm cột khi thiếu chiều cao. Chiều rộng của dock làm minimap và những thành phần phụ bị đẩy sang cột trạng thái. Nhiều stylesheet cũ cùng định vị boss, mục tiêu, prompt và điều khiển bằng khoảng cách cố định từ hai cạnh khác nhau.
- Cache viewport chỉ đọc `innerHeight`, bỏ qua chiều cao/offset thực sự của `VisualViewport` khi bàn phím hoặc thanh trình duyệt xuất hiện. Native dialog và các menu có thể bị đặt vào phần màn hình đã bị bàn phím che.
- Các nhiệm vụ, hiệu ứng và thông báo trợ lý tăng chiều cao trong quá trình chơi; những khoảng cách cố định ban đầu không tính đến trường hợp này. Thông báo giao hàng còn tồn tại sau khi rời nhà và có thể che nút chiến đấu/câu cá.

## File source đã sửa

| File | Thay đổi |
| --- | --- |
| `src/online.ts` | Mở form tài khoản khi vào bản multiplayer; đăng nhập/đăng ký trên cùng API; kiểm tra từng trường, xác nhận mật khẩu, hiện/ẩn mật khẩu, chống gửi lặp; giữ form khi lỗi; thông báo 401/409/5xx/mất kết nối; timeout 15 giây cho yêu cầu auth; chọn ngôn ngữ; khôi phục session, đóng form và vào game bằng profile server; yêu cầu đăng nhập lại khi session kết thúc. |
| `src/online.css` | Thẻ ZooPet với logo sẵn có, màu sắc phù hợp thế giới game, nút tối thiểu 44px, input 16px, bố cục form hai cột khi màn hình ngang thấp; dialog cuộn trong vùng nhìn thấy. |
| `src/title-card.ts` | Trạng thái chuẩn bị tài khoản trên nền game; giữ nguyên màn hình và profile ngoại tuyến của bản solo. |
| `src/main.ts` | Đưa lựa chọn bản tài khoản vào title; nối việc vào game với bridge hiện có và tránh bắt đầu lại game đã chạy. |
| `src/game-bridge.ts` | Hook `enterGame` để dùng cùng hàm bắt đầu game. |
| `src/locales/vi-online.ts` | Bổ sung 22 chuỗi tiếng Việt cho form và lỗi. |
| `src/viewport.ts` | Theo dõi resize, orientationchange, VisualViewport resize/scroll; xuất chiều cao/offset nhìn thấy sang CSS; phát một sự kiện resize game khi kích thước layout thật sự đổi. Pinch zoom không làm đổi bố cục HUD. |
| `src/world.ts` | Canvas/camera dùng sự kiện resize đã hợp nhất; chỉ cập nhật kích thước và projection, không tạo lại World hoặc reset người chơi khi xoay. |
| `src/hud-layout.ts` | Dock có cuộn được đo theo khung nhìn của nó; đo chiều cao tracker để chừa hàng cho boss; gộp đo bằng animation frame; trả disposer và hủy observer/listener cũ khi khởi tạo lại. |
| `src/hud-ours.css` | Dock một cột có cuộn trên touch/màn hình hẹp hoặc thấp; safe-area cả bốn cạnh; food dưới minimap ở màn hình ngang thấp; joystick gọn nhưng đủ lớn; tách hàng boss/mục tiêu/prompt; đặt reel và thông báo trợ lý ngoài vùng điều khiển; menu/title/dialog nằm trong viewport thực; tăng vùng chạm của nút tương tác và nhiệm vụ có thể bấm. |
| `src/delivery-ui.ts` | Đóng thông báo giao hàng khi rời vùng nhà để tránh che điều khiển trong chiến đấu. Các chức năng mở rương/nhận đồ được giữ nguyên. |

Không thay schema PostgreSQL, giao thức WebSocket, định dạng tài khoản, cấu hình triển khai, biến môi trường, dependency hoặc cơ chế tính toán chiến đấu.

## Test đã thêm/cập nhật

- Thêm `tests/account-entry.test.mjs`: đăng ký/đăng nhập thực, mật khẩu không khớp, tài khoản trùng, lỗi credential, logout, restore, session kết thúc, chống request lặp, lỗi mạng/5xx/response không có profile, form trên các kích thước và bàn phím mô phỏng, đổi ngôn ngữ.
- Thêm `tests/hud-rotation.test.mjs`: cùng một World/state đi qua 7 kích thước, bình thường/chiến đấu/câu cá, cả hai tay điều khiển, safe-area mô phỏng, từng menu vẫn chạm được sau cuộn; chạm kỹ năng không gửi pointerdown xuống canvas.
- Thêm `tests/viewport-browser.test.mjs`: bàn phím/offset không làm đổi tọa độ layout game; resize trùng không phát hai lần; kiểm tra pinch zoom.
- Bổ sung `tests/server-auth-races.test.mjs`: API gameplay và WebSocket từ chối kết nối ẩn danh và cookie giả mạo ID tài khoản.
- Cập nhật `tests/browser-start.mjs`, `tests/device-qa.test.mjs`, `tests/hud-layout.test.mjs` để fixture chủ động chọn tiến trình ngoại tuyến từ màn hình tài khoản mới.
- Cập nhật `tests/support/hud-measure.mjs` để phân biệt nút nằm trong phần đang nhìn thấy của dock cuộn; test riêng kiểm tra các nút còn lại thực sự truy cập được.
- Cập nhật DOM fixture ở `tests/online-session.test.mjs`, `tests/static-host.test.mjs` cho thao tác form hiện tại; điều chỉnh giới hạn chuỗi mới ở `tests/vi-embedded-tables.test.ts`, vẫn kiểm tra toàn bộ bản dịch cũ không thay đổi.

## Kết quả

- `npm run build`: thành công, bao gồm `tsc --noEmit`, Vite build và chuẩn bị cache ngoại tuyến. Còn cảnh báo bundle trên 500 kB của Vite.
- `npm test`: 1.796 bài, 1.740 qua, 50 skip, 6 lỗi. Chạy checkout gốc riêng cho kết quả 1.790 bài, 1.738 qua, 46 skip, **cùng 6 lỗi có sẵn**. Các test browser được skip khi không đặt `HUD_LAYOUT_URL`; những luồng browser bên dưới đã được chạy riêng.
- Nhóm kiểm tra cuối liên quan session, static host, viewport, server auth, delivery, combat HUD, challenge HUD, camera và bản dịch: **79/79 qua**.
- Browser account entry: **3/3 qua**, dùng tài khoản thật trên server kiểm thử riêng. Các response mạng/5xx/thiếu session chỉ được mô phỏng trong bài test lỗi, không giả lập đăng nhập thành công.
- Browser HUD rotation: **qua** ở 320×568, 430×932, 667×320, 844×390, 768×1024, 1440×900 và quay lại 390×844. World và object state không bị tạo lại; camera aspect đúng. Safe-area được kiểm tra thêm trên 667×320.
- Browser kiểm tra boss/mục tiêu: qua ở 390×844 và 844×390; kiểm tra lại 320×568 sau khi tách hàng prompt/boss: qua.
- Browser kiểm tra vùng chạm của title/HUD và 11 menu chính: **qua** (`tests/device-qa.test.mjs`, bài “every tappable control”).
- Kiểm tra API và WebSocket ẩn danh/giả cookie: qua; server trả 401, không tạo peer multiplayer.
- `git diff --check`: không có lỗi whitespace.

Các lỗi có sẵn: hai bài trong `tests/air-switch.test.ts`, một bài trong `tests/hud-ours.test.ts`, ba bài trong `tests/keyboard-routing.test.mjs`. Chúng kiểm tra markup/định tuyến bàn phím của mã nguồn gốc. Không đổi cơ chế chiến đấu để làm những bài này xanh.

## Giới hạn và kiểm tra thủ công

- URL tham khảo `https://d173ysgpwor2n4.cloudfront.net/` bị proxy môi trường chặn với HTTP 403. Chưa xác minh sự tương đồng trực quan với trang này; giao diện được thiết kế theo yêu cầu và tài sản ZooPet sẵn có.
- Chưa chạy Safari/iOS thật, bàn phím hệ thống thật, tai thỏ thật hoặc split-view iPad. Đã kiểm tra hợp đồng VisualViewport và safe-area bằng mô phỏng Chromium, không coi đó là kiểm thử iOS.
- Chưa dùng PostgreSQL/Railway production hoặc xác minh cookie qua HTTPS production. Test tài khoản dùng server/file tạm; suite hiện có cũng chạy các bài lưu trữ PostgreSQL bằng PGlite.
- Cần kiểm tra thủ công các màn hình trong Vault, Flag Rush, Rescue và bay trong không gian trên thiết bị thật, cùng menu dài khi bàn phím mở. Những chế độ này giữ nguyên logic và không được tuyên bố đã chạy đầy đủ trong browser QA lần này.

Chạy browser QA trên dev server bằng Playwright có sẵn:

```sh
HUD_LAYOUT_URL=http://127.0.0.1:5173/ PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node --test tests/account-entry.test.mjs tests/hud-rotation.test.mjs
```

Ảnh kết quả trong môi trường phiên này: `/tmp/zoopet-login.png`, `/tmp/zoopet-login-desktop.png`, `/tmp/zoopet-keyboard.png`, `/tmp/zoopet-hud-landscape.png`.
