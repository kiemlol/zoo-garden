# Camera, bảng xếp hạng, thức ăn và hiệu năng ZooPet

## Phạm vi và nguyên nhân

Đã duyệt vòng lặp chính, camera Three.js, chuyển cảnh nhà, các chế độ phụ, HUD, minimap, bảng xếp hạng/News, thức ăn, graphics governor, batching/instancing và các test liên quan. Theo xác nhận của chủ dự án, 87 / 80 / 110 là **phần trăm zoom**, không phải mét trong thế giới 3D.

Camera dùng `cameraOffset` (vector cơ sở `(0,17,13.5)`) nhân với zoom; FOV vẫn 40°. **Đã sửa lại theo phản hồi:** 87% / 80% / 110% là mặc định, không khóa lựa chọn của người chơi. Khôi phục hệ số portrait 1,3× khi aspect < 0,8 như bản gốc để cùng số phần trăm có cùng cách tính khoảng cách; việc bỏ hệ số này trong `b8af119` khiến camera 110% nhìn gần hơn bản cũ.

`defaultCameraZoom(aspect, inside)` trả `.87` trong nhà, `.8` khi width >= height, `1.1` khi width < height. `World.resize()` chỉ áp dụng mặc định lần đầu, khi vào/ra nhà hoặc đổi hướng màn hình; đổi góc nhìn, quality, kích thước cùng hướng và thao tác zoom giữ nguyên mức người chơi đã chọn. Settings ±, con lăn và pinch hai ngón tay được khôi phục đúng giới hạn cũ. Khi ra nhà, mặc định ngoài trời được tính theo hướng hiện tại. Hệ thống nhà hiện có tiếp tục cung cấp `World.interior`; không thêm cơ chế nhận diện nhà.


Bảng xếp hạng trước đây dành quá nhiều chiều cao cho header và bộ lọc trong landscape thấp. Layout mới cho hai nhóm bộ lọc nằm cạnh nhau khi còn chiều rộng, dành row `minmax(0,1fr)` riêng cho danh sách và row riêng cho footer. Danh sách/News cuộn riêng; hàng không shrink và tên dài có thể xuống dòng. Weekly/all-time, loại thống kê và dữ liệu không đổi.

Thức ăn trước đây mở tại `left:100%` của nút, kể cả khi nút được chuyển sát cạnh phải. Popup nay được đo khi mở/resize, giới hạn trong viewport và safe area, tránh dock/map/Home/joystick/skill. Trên viewport rất thấp nó mở bên trái cột map để còn chiều cao cuộn. Stack của popup được nâng khi mở để minimap và banner không phủ lên hàng thức ăn. Tên xuống dòng và danh sách cuộn riêng; mở lại bảng reset scroll về đầu để thấy Auto. Khi cụm skill đổi kích thước/ẩn-hiện, observer cập nhật bounds của popup.

Dock chức năng dùng token riêng `--dock-edge:clamp(4px,.6vw,8px)` cộng safe-right; map và Home đi theo cột này. Các quy tắc định vị, kích thước và hình dạng skill không được chỉnh sửa.

## Tối ưu đã thực hiện

- Coalesce thông báo resize WebGL bằng một RAF; không gán lại kích thước canvas khi width/height không đổi (tránh clear buffer và reset GPU state không cần thiết).
- Tính view footprint một lần thay vì hai lần trong resize.
- Cache bốn ground ray/projection của `houseFocus`, chỉ tính lại khi aspect, zoom hoặc pitch đổi; dùng viewport cache thay vì đọc innerWidth/Height trong frame nhà.
- Tìm entity tương tác gần nhất bằng một vòng lặp, giữ nguyên ưu tiên selection/cửa nhà và thứ tự khi hòa. Test so sánh với thuật toán filter/sort cũ trên 100 bộ dữ liệu, mỗi bộ 200 entity.
- Dataset chẩn đoán trạng thái canvas chỉ được cập nhật trong DEV hoặc khi bật VITE_PERF_HOOK, không ghi JSON chẩn đoán trong bản chơi thông thường.
- Giữ hiệu chỉnh atlas cây trồng ở mức camera cũ trong một hằng số riêng để không đổi kích thước cây khi đổi camera.

Vòng lặp đã có delta time, giới hạn số bước simulation, reset thời gian khi tab quay lại và một RAF chính; không thay tốc độ, cooldown hay physics. Render resolution điện thoại đã có cap 1,25× và governor tự động; scenery/crops đã dùng batching/instancing. Không thêm engine, đổi shader hoặc giảm mật độ cảnh/chất lượng hình ảnh.

## Đo trước/sau của lượt sửa HUD/hiệu năng b8af119

Chromium headless tại 844×390, touch/mobile, Graphics Low, cùng save fixture, cùng vị trí, zoom ngoài trời `.8`, trong nhà `.87`, 10 giây mỗi cảnh. Trình duyệt dùng SwiftShader (render phần mềm); đây **không phải** FPS của Android/iPhone thật. NPC/hiệu ứng vẫn chạy nên draw calls và CPU có dao động; không coi một lượt là bằng chứng cải thiện GPU hay FPS tổng thể.

| Chỉ số | Ngoài trời trước → sau | Trong nhà trước → sau |
|---|---:|---:|
| FPS trung bình | 14,95 → 14,45 | 24,12 → 25,12 |
| Frame time trung bình | 66,89 → 69,19 ms | 41,46 → 39,81 ms |
| Frame time p95 | 83,4 → 83,4 ms | 50,1 → 50,1 ms |
| JS World.update / lần gọi | 0,813 → 0,594 ms | 0,353 → 0,322 ms |
| JS World.render / lần gọi | 3,413 → 3,038 ms | 1,066 → 1,008 ms |
| Draw calls cuối cửa sổ | 124 → 121 | 43 → 43 |
| Triangles cuối cửa sổ | 129.399 → 128.421 | 45.320 → 45.320 |

Microbenchmark trong cùng trình duyệt, median của 5 lượt ×10.000 lần gọi: houseFocus tính ray mới **38,8 ms**, bản cache **0,4 ms**. Đây là phép đo helper khi các tham số không đổi, không phải tốc độ toàn game.

FPS ngoài trời chưa tăng trong lần đo này. Đã chứng minh giảm chi phí phép chiếu nhà và loại bỏ công việc dư thừa, nhưng chưa xác định được nguyên nhân chính của khựng trên thiết bị người dùng. Heap đầu/cuối cửa sổ ngắn chịu GC; không đủ kết luận không rò rỉ bộ nhớ khi chơi lâu.

Lượt theo dõi tài nguyên dài hơn: **45 giây ngoài trời + 45 giây trong nhà**, lấy mẫu mỗi 5 giây. Lượt này chạy đồng thời với QA giao diện, nên FPS bị ảnh hưởng bởi tranh chấp CPU/GPU phần mềm và không dùng để so với bảng trên. Textures giữ ở 6; geometries ngoài trời tăng từ 374 lên 383 rồi giữ ổn định, trong nhà giữ ở 407 suốt cửa sổ đo. Heap dao động theo GC (ngoài trời khoảng 77–104 MB, trong nhà khoảng 72–106 MB), không tăng liên tục trong 90 giây quan sát. Chưa đủ chứng minh không có leak khi chơi nhiều phút.

## File thay đổi

- `src/camera-rig.ts`, `src/world.ts`: zoom policy, projection/canvas resize, single-pass interaction.
- `src/house.ts`, `src/house-session.ts`, `src/house-ui.ts`: zoom nhà, cached focus, viewport reads.
- `src/colossus.ts`: bỏ override khoảng cách camera.
- `src/crop-cards.ts`: giữ nguyên art calibration.
- `src/main.ts`: khóa điều chỉnh zoom theo chính sách cố định, popup stack và giới hạn diagnostic writes.
- `src/hud-layout.ts`, `src/hud-ours.css`, `src/quick-eat.css`: popup bounds/stack, safe areas, dock edge.
- `src/ranking.css`: vùng scroll/footer, landscape compact, tên dài.
- `tests/camera-layout.test.ts`, `tests/camera-rig.test.ts`, `tests/camera-panels-browser.test.mjs`, `tests/hud-ours.test.ts`: hành vi camera, phép chiếu, tương tác, viewport/popup và token dock mới.
- `promo/perf-responsive.mjs`: probe độc lập, mặc định không chạy trong game; ghi FPS/frame times, update/render, draw calls, triangles, GPU resource counts, heap/mutations. `PERF_SECONDS` đặt số giây đo mỗi cảnh; đường dẫn output JSON là đối số tùy chọn.

## Lệnh kiểm tra

```sh
npm run build
npm test
HUD_LAYOUT_URL=http://127.0.0.1:5173 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node --test tests/camera-panels-browser.test.mjs tests/hud-rotation.test.mjs
HUD_LAYOUT_URL=http://127.0.0.1:5173 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs PERF_SECONDS=45 node promo/perf-responsive.mjs /tmp/zoo-perf.json
```

## Kết quả build và test của lượt sửa b8af119

`npm run build` thành công (typecheck + Vite + offline cache); vẫn có cảnh báo chunk >500 kB đã có trước đó. Suite cuối: **1.800 test, 1.742 pass, 51 skip, 7 fail**. Bảy lỗi được tái hiện trực tiếp trên worktree ở commit `ad9b642`: 3 air-switch, 1 HUD markup, 3 keyboard-routing; không sửa combat để né các assertion này.

Nhóm camera/house/world/crops/interaction/ranking/food/creature/Colossus: **109 pass, 25 skip, 0 fail**. Các test bị skip là browser test chưa bật URL hoặc capability theo thiết kế suite. Kiểm thử HUD rotation riêng đã pass: 7 kích thước, cả hai tay joystick, safe areas, dock scroll và skill tap không truyền xuống canvas.

Browser camera/panels cuối **pass**: 320×568, 390×844, 430×932, 667×320, 844×390, 768×1024, 1440×900 và quay lại 844×390. Đã kiểm tra vào/ra nhà, xoay khi ở trong nhà, identity của World, aspect/offset thực, danh sách tới hàng cuối, từng hàng thức ăn nhận được hit-test, safe area, dock tiến sát mép mà skill giữ nguyên tọa độ, di chuyển và tap skill không truyền xuống canvas. Không ghi nhận `pageerror`. Fixture này giảm pixel ratio canvas xuống 0,5 để QA bằng renderer phần mềm chạy được; CSS HUD và kích thước viewport/camera vẫn là kích thước thật. Các phép đo FPS ở trên dùng Graphics Low với ratio 0,85 như bản baseline, không dùng ratio của fixture UI.

Smoke test mở/đóng/mở lại bảng thức ăn đã pass; scroll trở về 0.

Ảnh chụp kiểm tra: `/tmp/zoopet-ranking-fixed.png`, `/tmp/zoopet-food-fixed.png`.

## Kiểm tra bổ sung khi khôi phục zoom thủ công

- Build/typecheck thành công.
- 19/19 test camera, ray projection, zoom defaults/manual refresh và nhà thành công.
- Browser test `tests/camera-zoom-browser.test.mjs` pass: Settings ± hoạt động; wheel đổi zoom; touch thật bằng Chromium CDP kiểm tra hai ngón tay mở rộng/thu lại; portrait 110% có offset bằng `hypot(17,13.5) × 1.1 × 1.3`; refresh giữ zoom tự chọn; vào nhà mặc định 87%, zoom trong nhà được phép; xoay và ra nhà áp dụng mặc định tương ứng. Không có pageerror.
- Đã cập nhật assertion trong camera/panels test để phản ánh calibration cũ. Không chạy lại toàn bộ suite hoặc đo lại FPS cho bản sửa zoom; số đo phía trên thuộc lượt sửa b8af119.

## Phần còn cần kiểm tra trên thiết bị thật

iOS Safari/Android Chrome có notch, GPU thật, nhiệt độ khi chơi lâu, multiplayer nhiều người và FPS/memory khi chơi nhiều phút ở cảnh đông. Các luật Rescue/Flag Rush vẫn qua suite; cần chơi thủ công các arena này để đánh giá tầm nhìn với chính sách camera mới. Không kiểm thử production và không deploy.
