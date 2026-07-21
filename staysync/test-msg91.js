const MSG91_TEMPLATE_ID = '6a33f6482ba17fc8e80aa4c0';
const MSG91_AUTH_KEY = '535797A8UoOVTT6a33f2e2P1';
const rawPhone = '9398699430';

async function testMsg91() {
  try {
    console.log("Sending OTP...");
    const sendRes = await fetch(`https://control.msg91.com/api/v5/otp?template_id=${MSG91_TEMPLATE_ID}&mobile=91${rawPhone}`, {
      method: 'POST',
      headers: {
        'authkey': MSG91_AUTH_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    const sendData = await sendRes.json();
    console.log("Send Response:", sendData);
    
    if (sendData.type === 'success' || sendData.type === 'success ') {
      console.log("OTP Sent Successfully! Now waiting a moment before verify test...");
      
      // Attempt to verify with a dummy OTP to see what error it throws
      const verifyRes = await fetch(`https://control.msg91.com/api/v5/otp/verify?otp=111111&mobile=91${rawPhone}`, {
        method: 'GET',
        headers: {
          'authkey': MSG91_AUTH_KEY
        }
      });
      const verifyData = await verifyRes.json();
      console.log("Verify Response:", verifyData);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

testMsg91();
