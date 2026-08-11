// Ứng dụng hiển thị ngày giờ theo múi giờ của người xem, mà người xem là chủ quán
// ở Việt Nam. Ghim múi giờ để bài kiểm thử cho cùng kết quả trên mọi máy — nếu
// không, hóa đơn lúc 23h50 sẽ "đúng" ở máy này và "sai" ở máy khác.
process.env.TZ = 'Asia/Ho_Chi_Minh';
