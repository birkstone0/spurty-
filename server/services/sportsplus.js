const fetch = require('node-fetch');

const BASE_URL = "https://sportsplus.ph";

const HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "origin": BASE_URL,
    "pragma": "no-cache",
    "sec-ch-ua": '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    "x-user-agent": "Zeta Chrome/155 (WAP Windows/10; */**)",
    "x-requested-with": "XMLHttpRequest"
};

function generatePassword(length = 10) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    let password = '';
    
    // Guarantee at least 1 uppercase, 1 lowercase, and 1 number
    password += letters.charAt(Math.floor(Math.random() * 26)); // Uppercase
    password += letters.charAt(Math.floor(Math.random() * 26) + 26); // Lowercase
    password += numbers.charAt(Math.floor(Math.random() * numbers.length)); // Number
    
    // Fill the rest
    const allChars = letters + numbers;
    for (let i = 3; i < length; i++) {
        password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

async function registerUser(mobile, firstName, lastName, dob, specificBranchId = null) {
    // FORCE QUE01 based on your successful logs
    const selectedBranch = "QUE01"; 
    const password = generatePassword();
    const formattedDob = new Date(dob).toISOString();

    const preparePayload = {
        account: mobile,
        firstName: firstName,
        lastName: lastName,
        accountType: 2,
        birthday: formattedDob,
        branchId: selectedBranch,
        messageChannel: 2,
        password: password
    };

    console.log(`[*] Sending registration payload to SportsPlus:`, preparePayload);

    const prepareResp = await fetch(`${BASE_URL}/portal/api/register/prepare`, {
        method: 'POST',
        headers: { ...HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify(preparePayload)
    });

    const rawText = await prepareResp.text();
    let prepareData;
    
    try { 
        prepareData = JSON.parse(rawText); 
    } catch (e) { 
        console.error("[!] API returned HTML:", rawText.substring(0, 200));
        throw new Error(`Registration failed: Invalid server response.`); 
    }

    if (!prepareResp.ok) {
        console.error("[!] SportsPlus API Error:", JSON.stringify(prepareData));
        
        if (prepareData.errors && prepareData.errors.account) {
            throw new Error(`Invalid mobile number. Please ensure it is a valid 10-digit PH number.`);
        }
        if (prepareData.errors && prepareData.errors.password) {
            throw new Error(`Password does not meet requirements.`);
        }
        throw new Error(prepareData.title || `Registration failed (${prepareResp.status})`);
    }

    console.log("[+] Registration API Response:", JSON.stringify(prepareData));

    // Handle all possible otpFlowId locations
    const otpFlowId = 
        (typeof prepareData.data === 'string' ? prepareData.data : null) || 
        prepareData?.data?.otpFlowId || 
        prepareData?.otpFlowId || 
        prepareData?.data?.data?.otpFlowId;

    if (!otpFlowId) {
        console.error("[!] Could not find OTP ID in response:", rawText);
        throw new Error(`Could not find OTP ID.`);
    }

    const sendResp = await fetch(`${BASE_URL}/portal/api/otp/send`, {
        method: 'POST',
        headers: { ...HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ otpFlowId })
    });

    if (!sendResp.ok) {
        console.error("[!] OTP Send Error:", await sendResp.text());
        throw new Error(`Failed to send SMS OTP.`);
    }

    console.log("[+] OTP SMS Sent Successfully.");
    return { otpFlowId, password, branchUsed: selectedBranch };
}

async function verifyOtp(otpFlowId, otpValue) {
    const resp = await fetch(`${BASE_URL}/portal/api/otp/verify`, {
        method: 'POST',
        headers: { ...HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify({ otpFlowId, otpValue })
    });

    if (!resp.ok) {
        console.error("[!] OTP Verify Error:", await resp.text());
        throw new Error(`OTP Verify failed: Invalid or expired code.`);
    }
    
    const data = await resp.json();
    console.log("[+] OTP Verified Response:", JSON.stringify(data));
    return data;
}

module.exports = { registerUser, verifyOtp };