const email = "sunilgumatimath38@gmail.com";
const password = "Sunil@081120";

async function test() {
  try {
    const res = await fetch("https://personal-finance-tracker-ted.vercel.app/api/auth?action=login", {
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
