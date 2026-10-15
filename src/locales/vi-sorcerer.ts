import {SORCERER_SKILLS} from '../sorcerer-skills.ts';
import {SORCERER_ITEM} from '../sorcerer-content.ts';
export const VI_SORCERER:Record<string,string>={
 'Exit Portal':'Bước Ra Cổng',
 'Portal Sorcerer':'Pháp Sư Cổng Phép','Mandala Discs':'Đĩa Mandala','Concealment Portal':'Cổng Ẩn Thân','Crimson Bands of Cyttorak':'Dải Băng Đỏ Cyttorak','Meteor Portal':'Cổng Thiên Thạch',
 [SORCERER_ITEM.desc]:'Tóc đen điểm bạc, áo choàng đỏ cổ cao, áo xanh đậm thêu viền vàng và bùa ngọc xanh phát sáng. Thay cả bốn chiêu chiến đấu.',
 [SORCERER_SKILLS[0].description]:'Tạo đĩa phép cam trên hai tay, chém nhanh 5 hit. Hit cuối ném đĩa xuyên mọi quái trên đường thẳng dài 16 m.',
 [SORCERER_SKILLS[1].description]:'Bước vào cổng lửa cố định và biến mất hoàn toàn 2,5 giây: quái mất mục tiêu, đòn đánh hụt. Bấm lại để ra sớm từ cổng cũ. Sau khi ra, tăng 30% sát thương trong 1 giây.',
 [SORCERER_SKILLS[2].description]:'Dải băng đỏ trồi lên quanh chỗ đứng trong 4 giây, gây sát thương mỗi giây. Mỗi quái bước vào vùng 4,5 m bị trói chân 2,5 giây.',
 [SORCERER_SKILLS[3].description]:'Ném vòng sling ring vòng cung tối đa 16 m. Cổng trên cao thả thiên thạch, nổ trong 4,5 m và choáng 1,5 giây.',
};
