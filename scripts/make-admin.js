// usage: npm run make-admin -- user@example.com [--revoke]
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/shared/models/User');

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error('usage: npm run make-admin -- <email> [--revoke]');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const role = flag === '--revoke' ? 'user' : 'admin';
  const user = await User.findOneAndUpdate({ email: email.toLowerCase() }, { role }, { new: true });

  console.log(user ? `${user.username} is now ${role}` : `No user with email ${email}`);
  await mongoose.disconnect();
  process.exit(user ? 0 : 1);
})();
