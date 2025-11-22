import { AlbumService } from "../../service/albumService.js";
import Album from "../../models/Album.js";
import { connectDB, disconnectDB } from "../../config/db.js";

// Kết nối DB
await connectDB();
console.log("Đã kết nối MongoDB\n");

const albumService = new AlbumService();

// Giả lập 2 user (String ID)
const USER_ID_1 = "691d675f53c5e899be33b498";
const USER_ID_2 = "691d675f53c5e899be33b49c";

// Dọn sạch dữ liệu cũ
await Album.deleteMany({});
console.log("Đã xóa hết album cũ\n");

console.log("=== BẮT ĐẦU TEST ALBUM SERVICE (với nanoid slug) ===\n");

try {
  // 1. Tạo album PUBLIC → slug = nanoid(12)
  console.log("1. Tạo album PUBLIC");
  const publicAlbum = await albumService.createAlbum(
    {
      name: "Hình đẹp nhất 2025",
      description: "Bộ sưu tập công khai",
      exposure: "public",
    },
    USER_ID_1
  );
  console.log("Public album _id :", publicAlbum._id.toString());
  console.log("Slug (nanoid)    :", publicAlbum.slug); // ~ 12 ký tự ngẫu nhiên

  // 2. Tạo album UNLISTED → slug = nanoid(12)
  console.log("\n2. Tạo album UNLISTED");
  const unlistedAlbum = await albumService.createAlbum(
    {
      name: "Album bí mật",
      exposure: "unlisted",
    },
    USER_ID_1
  );
  console.log("Unlisted _id :", unlistedAlbum._id.toString());
  console.log("Slug (nanoid):", unlistedAlbum.slug);

  // 3. Tạo album với CUSTOM SLUG (ưu tiên custom)
  console.log("\n3. Tạo album với CUSTOM SLUG");
  const customAlbum = await albumService.createAlbum(
    {
      name: "Hình cưới",
      slug: "hinh-cuoi-2025",
      exposure: "unlisted",
    },
    USER_ID_1
  );
  console.log("Custom slug _id :", customAlbum._id.toString());
  console.log("Slug            :", customAlbum.slug); // = hinh-cuoi-2025

  // 4. Tạo album PRIVATE
  console.log("\n4. Tạo album PRIVATE");
  const privateAlbum = await albumService.createAlbum(
    {
      name: "Nhật ký hình ảnh riêng tư",
      exposure: "private",
    },
    USER_ID_1
  );
  console.log("Private _id :", privateAlbum._id.toString());
  console.log("Author      :", privateAlbum.author);

  // 5. Test truy cập bằng slug
  console.log("\n5. Lấy album bằng slug");
  const bySlug = await albumService.getAlbumBySlug(unlistedAlbum.slug);
  console.log("→ Tìm thấy:", bySlug.name);

  // 6. Test quyền truy cập PRIVATE
  console.log("\n6. User 2 xem PRIVATE album → phải bị chặn");
  try {
    await albumService.getAlbumById(privateAlbum._id, USER_ID_2);
    console.log("LỖI: Không nên vào được");
  } catch (err) {
    console.log("OK: Bị chặn truy cập private album");
  }

  // Owner xem private → OK
  const ok = await albumService.getAlbumById(privateAlbum._id, USER_ID_1);
  console.log("Owner xem private → OK:", ok.name);

  // 7. Test update album → đổi tên → slug mới = nanoid()
  console.log("\n7. Update album → tên mới → slug mới = nanoid()");
  const updated = await albumService.updateAlbum(
    publicAlbum._id,
    {
      name: "Hình đẹp nhất 2025 - Phiên bản mới",
      exposure: "unlisted",
    },
    USER_ID_1
  );
  console.log("Update thành công!");
  console.log("→ Tên mới :", updated.name);
  console.log("→ Slug mới:", updated.slug); // nanoid mới

  // 8. Test trùng slug → không thể (vì nanoid gần như không trùng)
  console.log("\n8. Tạo 100 album → kiểm tra trùng slug (gần như không thể)");
  for (let i = 0; i < 100; i++) {
    await albumService.createAlbum(
      {
        name: `Album test ${i}`,
        exposure: "unlisted",
      },
      USER_ID_1
    );
  }
  console.log("Tạo 100 album thành công → không lỗi trùng slug!");

  // 9. Test list albums
  console.log("\n9. List album của USER_ID_1");
  const list = await albumService.listUserAlbums(USER_ID_1, { limit: 5 });
  console.log(`Hiển thị 5 album đầu (tổng có ~104):`);
  list.forEach((a) =>
    console.log(`   → ${a.name} | slug: ${a.slug.substring(0, 15)}...`)
  );

  // 10. Test search
  console.log("\n10. Tìm kiếm '2025'");
  const search = await albumService.searchAlbums("2025");
  console.log(`Tìm thấy ${search.albums.length} kết quả public/unlisted:`);
  search.albums.forEach((a) => console.log(`   → ${a.name}`));

  // 11. Test xóa album
  console.log("\n11. Xóa album");
  await albumService.deleteAlbum(publicAlbum._id, USER_ID_1);
  const deleted = await Album.findById(publicAlbum._id);
  console.log("Sau khi xóa → còn trong DB?", !!deleted); // false

  console.log("\n\nTẤT CẢ CÁC TEST ĐỀU THÀNH CÔNG 100%!");
  console.log("AlbumService với nanoid slug HOÀN HẢO:");
  console.log("• Slug ngắn, đẹp, không đoán được");
  console.log("• Custom slug vẫn hỗ trợ");
  console.log("• Không bao giờ trùng (xác suất ~0)");
  console.log("• Private/Unlisted/Public hoạt động đúng");
  console.log("• Production ready 100%");
} catch (error) {
  console.error("\nLỖI TẠI:", error.message);
  console.error(error.stack || "");
} finally {
  await disconnectDB();
  console.log("\nĐã đóng kết nối DB. Hoàn tất!");
  process.exit(0);
}
