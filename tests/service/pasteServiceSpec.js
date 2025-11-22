import { PasteService } from "../../service/pasteService.js";
import Paste from "../../models/TextPaste.js";
import { connectDB, disconnectDB } from "../../config/db.js";

// Kết nối DB
await connectDB();
console.log("Đã kết nối MongoDB\n");
await Paste.deleteMany({});
console.log("Đã dọn sạch dữ liệu cũ\n");

try {
  await Paste.collection.dropIndex("slug_1");
  console.log("Đã xóa index slug_1 cũ (unique không sparse) → FIX duplicate null");
} catch (err) {
  if (err.codeName !== "IndexNotFound") throw err;
  // Nếu không tìm thấy index → bình thường, bỏ qua
}

const pasteService = new PasteService();

// Giả lập 2 user (thay bằng user)
const USER_ID_1 = "691d675f53c5e899be33b498";
const USER_ID_2 = "691d675f53c5e899be33b49c";

console.log("=== BẮT ĐẦU TEST PASTE SERVICE (DÙNG _id THAY pasteId) ===\n");

try {
  // 1. Tạo paste PUBLIC
  console.log("1. Tạo paste PUBLIC");
  const publicPaste = await pasteService.createPaste({
    title: "Hello World Public",
    content: "Đây là paste công khai ai cũng xem được",
    exposure: "public",
  });
  console.log("Public paste _id :", publicPaste._id.toString());
  console.log("Slug           :", publicPaste.slug || "không có");
  console.log("URL            : /p/" + publicPaste._id + "\n");

  // 2. Tạo paste UNLISTED (tự sinh slug)
  console.log("2. Tạo paste UNLISTED");
  const unlistedPaste = await pasteService.createPaste({
    title: "Secret Note Unlisted",
    content: "Chỉ ai có link mới vào được",
    exposure: "unlisted",
  });
  console.log("Unlisted paste _id :", unlistedPaste._id.toString());
  console.log("Slug tự sinh       :", unlistedPaste.slug);
  console.log("URL                : /p/" + unlistedPaste.slug + "\n");

  // 3. Tạo paste với CUSTOM SLUG
  console.log("3. Tạo paste với CUSTOM SLUG");
  const customPaste = await pasteService.createPaste({
    title: "My Nginx Config 2025",
    content: "server { listen 80; }",
    exposure: "unlisted",
    slug: "my-nginx-config-2025",
  });
  console.log("Custom slug paste _id :", customPaste._id.toString());
  console.log("Slug                  :", customPaste.slug);
  console.log("URL                   : /p/" + customPaste.slug + "\n");

  // 4. Tạo paste PASSWORD PROTECTED
  console.log("4. Tạo paste PASSWORD PROTECTED");
  const protectedPaste = await pasteService.createPaste({
    title: "API Key Siêu Bí Mật",
    content: "sk_live_9876543210xyz",
    exposure: "password_protected",
    password: "matkhau123",
    authorId: USER_ID_1,
  });
  console.log("Protected paste _id :", protectedPaste._id.toString() + "\n");

  // 5. Tạo paste PRIVATE
  console.log("5. Tạo paste PRIVATE");
  const privatePaste = await pasteService.createPaste({
    title: "Nhật ký riêng tư",
    content: "Hôm nay tao crush nhỏ lớp trưởng...",
    exposure: "private",
    authorId: USER_ID_1,
  });
  console.log("Private paste _id :", privatePaste._id.toString());
  console.log("Author            :", privatePaste.authorId + "\n");

  // 6. Test increment views
  console.log("6. Tăng view count");
  await pasteService.incrementViews(publicPaste._id);
  await pasteService.incrementViews(publicPaste._id);
  const viewed = await Paste.findById(publicPaste._id);
  console.log("Views hiện tại:", viewed.views); // → 2

  // 7. Test update paste (dùng _id)
  console.log("\n7. Update paste PRIVATE (chủ sở hữu)");
  const updated = await pasteService.updatePaste(
    privatePaste._id,
    {
      title: "Nhật ký đã chỉnh sửa",
      content: "Thật ra nhỏ đó cũng thích tao rồi!",
      expiredAt: new Date(Date.now() + 3600000), // 1 giờ
    },
    USER_ID_1
  );
  console.log("Update thành công →", updated.title);

  // 8. Test đổi mật khẩu
  console.log("\n8. Đổi mật khẩu paste");
  await pasteService.setPassword(protectedPaste._id, "newpass999", USER_ID_1);
  console.log("Đổi mật khẩu thành công → newpass999");

  // 9. Test truy cập có mật khẩu đúng/sai
  console.log("\n9. Test canAccessPaste");
  try {
    await pasteService.canAccessPaste(protectedPaste._id, null, "sai123");
    console.log("LỖI: Không nên cho vào");
  } catch {
    console.log("OK: Từ chối khi sai mật khẩu");
  }
  const ok = await pasteService.canAccessPaste(
    protectedPaste._id,
    null,
    "newpass999"
  );
  console.log("OK: Cho phép truy cập với mật khẩu mới");

  // 10. Test list paste của user
  console.log("\n10. List paste của USER_ID_1");
  const list = await pasteService.listUserPastes(USER_ID_1);
  console.log(`Tìm thấy ${list.length} paste:`);
  list.forEach((p) => console.log(`   → ${p.title} [_id: ${p._id}]`));

  // 11. Test xóa paste
  console.log("\n11. Xóa public paste");
  await pasteService.deletePaste(publicPaste._id, USER_ID_1);
  const deleted = await Paste.findById(publicPaste._id);
  console.log("Sau khi xóa → còn trong DB?", !!deleted); // → false

  console.log("\n\nTẤT CẢ ĐÃ CHẠY HOÀN HẢO!");
  console.log("Bạn có thể vào MongoDB kiểm tra:");
  console.log(`   → Public paste: /p/${publicPaste._id} (đã xóa)`);
  console.log(`   → Unlisted:     /p/${unlistedPaste.slug}`);
  console.log(`   → Custom slug:  /p/${customPaste.slug}`);
  console.log(`   → Private:      /p/${privatePaste._id} (chỉ owner xem được)`);
} catch (error) {
  console.error("\nLỖI TẠI:", error.message);
  console.error(error.stack);
} finally {
  await disconnectDB();
  console.log("\nĐã đóng kết nối DB. Xong!");
  process.exit(0);
}
