import { UserService } from "../../service/userService.js";
import { connectDB, disconnectDB } from "../../config/db.js";

// Connect DB
connectDB();
const userService = new UserService();

console.log('register');
for (let i = 0; i < 3; i++) {
  const user = await userService.register({ username: `user${i}`, password: "password" });
  console.log(user);
}

console.log('login');
for (let i = 0; i < 2; i++) {
  const user = await userService.login(`user${i}`, "password");
  console.log(user);
}

console.log('update');
const user1 = await userService.updateProfile('691d675f53c5e899be33b49c', {
  username: 'updated'
})
console.log(user1);

console.log('soft delete');
const deleteUser = await userService.softDelete('691d675f53c5e899be33b49c');
console.log(deleteUser);

console.log('end');
disconnectDB();
