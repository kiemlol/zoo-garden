# Cấp khu vực, HUD ngang, camera cự thần và chi tiết túi đồ

## Thay đổi

- Quái thường: Rừng Nấm cấp 4, Đồng Cỏ cấp 1, Đầm Lầy cấp 7, Hẻm Núi Đỏ cấp 10. Dùng chung `ZONE_DIFFICULTY` trong boss-patterns cho client, server enemyRoster và HUD. Giữ công thức sẵn có (level = difficulty × 3 − 2); hệ số HP/sát thương tương ứng 1,7 / 1 / 2,6 / 3,6, trước các modifier difficulty/player/party hiện có. Boss giữ cơ chế cộng cấp/hệ số riêng. ID, số lượng, vị trí spawn, vật phẩm rơi và dữ liệu tài khoản không đổi. CAGES vẫn gắn với Treant/Bear/Robot; không chuyển lồng khi thứ tự sức mạnh boss thay đổi.
- Banner cự thạch chỉ được bật trên `planet === 'home'` (Hành Tinh Mầm Xanh); sang hành tinh khác thì ẩn. Giữ điều kiện level/guide hiện có. Màn hình ngang dùng dải gọn sát safe-area trên cùng; boss bar và banner chia dải khi cùng hiện để không chồng nhau. Portrait giữ layout hiện có.
- Khung máu quái được thu gọn trên landscape, neo trái và nằm trên joystick. Khoảng trống được đo từ bounding boxes HUD/joystick, tránh dùng 100vh cố định gây lệch theo thanh địa chỉ Safari. Khi đổi tay joystick, khung trái nằm trên cụm điều khiển trái.
- Khôi phục camera tự kéo xa 1,4× khi ở ngoài trời trên home và đứng trong 48 đơn vị của cự thần sống. Camera chuyển mượt như cơ chế cũ; hệ số arena không ghi vào zoom người chơi. View reach/shadow bounds được fit theo khoảng cách thực, không resize lại canvas cùng kích thước. Trong nhà hoặc ngoài hành tinh home không áp dụng hệ số này.
- `inventory()` tạo HTML chi tiết một lần và truyền `after` tùy chọn cho `groupedHtml`. Chi tiết được chèn sau section của `groupOf(selectedItem)`; nếu group không hiện thì append sau toàn bộ nhóm. Shop/craft/sell/chest không truyền after nên hành vi không đổi. Bag/wardrobe dùng chung đường render. Chọn lại món đang chọn hoặc đóng túi sẽ bỏ chọn. Đồ đang mặc nhưng không có trong bag vẫn inspect được qua fallback. Không sửa CSS/style túi đồ.

## File sửa

Source: `src/boss-patterns.ts`, `src/world.ts`, `src/hud-combat.ts`, `src/colossus.ts`, `src/hud-layout.ts`, `src/hud-ours.css`, `src/item-groups.ts`, `src/main.ts`; `src/friends.ts` chỉ cập nhật comment mô tả lồng sau rebalance.

Tests: `tests/zone-levels.test.ts`, `tests/biomes-bag-hud-browser.test.mjs`, `tests/boss-patterns.test.ts`, `tests/hud-combat.test.ts`, `tests/w21-item-groups.test.mjs`, `tests/forest-hunting.test.ts`, `tests/friends.test.ts`. Các assertion cấp/HP cũ được cập nhật; kiểm tra ID spawn và boss gắn với lồng vẫn được giữ.

## Kiểm tra thực tế

- `npm run build`: pass (tsc + Vite + offline cache); cảnh báo chunk >500 kB có sẵn.
- Nhóm boss/HUD/groups/world/Colossus/combat authority/zone levels: 107/107 pass.
- Friends/forest hunting: 16/16 pass.
- Toàn bộ `npm test`: 1.804 test, 1.744 pass, 53 skip, 7 fail. Các lỗi có sẵn: 3 air-switch, 1 HUD markup, 3 keyboard-routing; không thêm lỗi bag.
- Chromium browser: pass. Kiểm tra chọn/bỏ chọn từng nhóm hiển thị, chuyển nhóm, đóng/mở lại, wardrobe, inspect đồ đang mặc không thuộc group hiện tại; chi tiết đúng vị trí và không nhân đôi.
- Kiểm tra landscape 844×390, 667×320, 1280×720: boss/banner sát top, nằm trong viewport, không chồng nhau; khung quái ở trái và không chạm joystick. Kiểm tra thêm safe insets 28/30/12/20 px.
- Camera gần cự thần tiến tới 1,4× trong khi zoom gốc vẫn 95%; vào nhà trở về offset của 87%. Chuyển world.planet ra/vào home: banner ẩn/hiện đúng. Không có pageerror.

Browser test dùng fixture solo, renderer phần mềm với pixel ratio 0,4 để QA layout; không dùng làm phép đo FPS/GPU thật. Chưa kiểm tra Safari/iOS hoặc multiplayer production; server authority và roster được kiểm tra bằng test hiện có. Không thực hiện migration hay thao tác trực tiếp production.
