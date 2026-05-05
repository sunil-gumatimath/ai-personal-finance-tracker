const email = "sunilgumatimath38@gmail.com";
const password = "Sunil@081120";

async function test() {
  try {
    const res = await fetch("https://ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    console.log("STATUS:", res.status);
    console.log("BODY:", await res.text());
  } catch(e) {
    console.error(e);
  }
}
test();
