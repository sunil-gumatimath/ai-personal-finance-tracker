const dns = require('dns');

dns.resolve('ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech', (err, addresses) => {
  if (err) {
    console.error("DNS Error:", err.message);
  } else {
    console.log("Resolved Addresses:", addresses);
  }
});
