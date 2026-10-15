import {BIRD_SKILLS} from '../bird-skills.ts';
import {BIRD_ITEMS} from '../bird-disguise-content.ts';
export const VI_BIRD_DISGUISES:Record<string,string>={
 'Snow Penguin':'Chim Cánh Cụt Tuyết','Black Explorer Duck':'Vịt Đen Thám Hiểm',
 'Lightning Beak':'Mổ Chớp Nhoáng','Ice Belly Slide':'Trượt Bụng Băng','Penguin Blizzard':'Bão Tuyết Cánh Cụt','Frozen Fish Bombs':'Cá Bom Băng',
 'Hunting Dagger':'Dao Găm Săn Mồi','Explorer Grapple':'Móc Dây Thám Hiểm','Ancient Net Trap':'Bẫy Lưới Cổ Đại','Oil Lantern Toss':'Đèn Dầu Ném',
 [BIRD_ITEMS.dz_penguin.desc]:'Mũ chim cánh cụt mỏ vàng, tóc bob đen, tai nghe trắng, nơ xanh, bụng trắng mềm và chân có màng. Thay cả bốn chiêu chiến đấu.',
 [BIRD_ITEMS.dz_explorer_duck.desc]:'Vịt đen mặc áo choàng khâu chỉ, mỏ cam, huy hiệu la bàn, túi da và giày có khóa. Thay cả bốn chiêu chiến đấu.',
};
const descriptions=[
 ['Mổ liên hoàn 5 hit vào một mục tiêu trong 3,2 m; hit cuối hất tung quái.',
 'Trượt bụng 14 m, húc văng quái trên đường. Vệt băng giảm 50% tốc chạy trong 3 giây.',
 'Xoay tạo bão tuyết theo người trong 4 giây: sát thương vừa mỗi giây trong 4,8 m, giảm 30% sát thương quái gây ra và 50% tốc chạy/tốc đánh, chặn quái lướt vào.',
 'Ném vòng cung 3 cá đông lạnh tới điểm ngắm cách tối đa 15 m. Mỗi cá nổ trong 2,6 m và làm choáng 1,5 giây.'],
 ['Chém dao găm 5 hit trong 3,4 m. Hit cuối đóng dấu la bàn: mục tiêu nhận thêm 20% sát thương trong 4 giây.',
 'Bắn móc tới điểm ngắm cách tối đa 14 m, kéo bản thân bay tới và hất văng mọi quái trên đường.',
 'Đặt lưới bán kính 4,5 m tồn tại 6 giây. Quái bước vào nhận sát thương và bị trói chân 2,5 giây.',
 'Ném đèn dầu vòng cung tối đa 15 m. Vùng lửa bán kính 4 m thiêu đốt mỗi giây trong 4 giây.'],
];
Object.values(BIRD_SKILLS).forEach((skills,i)=>skills.forEach((s,j)=>VI_BIRD_DISGUISES[s.description]=descriptions[i][j]));
