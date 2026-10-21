const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
puppeteer.use(StealthPlugin());

let activeRegistrationPage = null;
let activeRegistrationBrowser = null;

async function dismissTOSModal(page) {
    await new Promise(r => setTimeout(r, 2000));
    const hasModal = await page.evaluate(() => {
        return document.body.innerText.includes("Please see the information below") || 
               document.body.innerText.includes("I agree to all the above");
    });

    if (hasModal) {
        console.log("[*] TOS Modal found. Clicking checkboxes...");
        await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            const checkboxLabels = labels.filter(l => l.querySelector('input[type="checkbox"]'));
            if (checkboxLabels.length >= 3) {
                checkboxLabels[0].click(); checkboxLabels[1].click(); checkboxLabels[2].click();
            } else { checkboxLabels.forEach(l => l.click()); }
        });
        await new Promise(r => setTimeout(r, 500));
        
        console.log("[*] Clicking Submit on TOS Modal...");
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('submit'));
            if (btn) btn.click();
        });
        
        await page.waitForFunction(() => !document.body.innerText.includes("Please see the information below"), { timeout: 5000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));
    }
}

async function performVisualRegistration(account, firstName, lastName, dob, password) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    const page = (await browser.pages())[0];
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36');

    try {
        console.log("[*] Opening Chrome to register...");
        await page.goto('https://sportsplus.ph/register/by', { waitUntil: 'networkidle2', timeout: 60000 });
        await dismissTOSModal(page);

        console.log("[*] Filling out the registration form...");
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        const inputs = await page.$$('input');

        await inputs[0].click({ clickCount: 3 });
        await inputs[0].type(account, { delay: 50 });
        
        await inputs[1].click({ clickCount: 3 });
        await inputs[1].type(firstName, { delay: 50 });

        await inputs[2].click({ clickCount: 3 });
        await inputs[2].type(lastName, { delay: 50 });

        await page.evaluate((dateStr) => {
            const dateInput = document.querySelector('input[type="date"]');
            if (dateInput) {
                dateInput.value = dateStr; 
                dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                dateInput.dispatchEvent(new Event('change', { bubbles: true }));
                dateInput.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        }, dob);
        await new Promise(r => setTimeout(r, 500));

        await inputs[4].click({ clickCount: 3 });
        await inputs[4].type(password, { delay: 50 });
        
        await inputs[5].click({ clickCount: 3 });
        await inputs[5].type(password, { delay: 50 });

        console.log("[*] Scrolling to Branch Dropdown...");
        await page.evaluate(() => {
            const divs = Array.from(document.querySelectorAll('div'));
            const branchText = divs.find(d => d.innerText.trim() === 'Branch');
            if (branchText) {
                const container = branchText.closest('div[un-position="relative"]');
                if (container) container.scrollIntoView({ block: 'center' });
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        const branchContainer = await page.evaluateHandle(() => {
            const divs = Array.from(document.querySelectorAll('div'));
            const branchText = divs.find(d => d.innerText.trim() === 'Branch');
            return branchText ? branchText.closest('div[un-position="relative"]') : null;
        });

        if (branchContainer) {
            const box = await branchContainer.boundingBox();
            if (box) {
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                await new Promise(r => setTimeout(r, 1500)); 

                const optionBox = await page.evaluate(() => {
                    const divs = Array.from(document.querySelectorAll('div'));
                    const option = divs.find(d => d.innerText.includes('Bingo Paradise Inc. - Quezon City'));
                    if (option) {
                        option.scrollIntoView({ block: 'center' }); 
                        const rect = option.getBoundingClientRect();
                        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                    }
                    return null;
                });

                if (optionBox) {
                    await page.mouse.click(optionBox.x, optionBox.y);
                } else {
                    await page.evaluate(() => {
                        const divs = Array.from(document.querySelectorAll('div'));
                        const option = divs.find(d => d.innerText.includes('Bingo Paradise Inc. - Quezon City'));
                        if (option) option.click();
                    });
                }
            }
        }
        
        await new Promise(r => setTimeout(r, 2000)); 

        console.log("[*] Clicking the 'Start Mobile Verification' button...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.innerText.toLowerCase().includes('start mobile verification'));
            if (btn) btn.scrollIntoView({ block: 'center' });
        });
        await new Promise(r => setTimeout(r, 500));

        const btnBox = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.innerText.toLowerCase().includes('start mobile verification'));
            if (btn) {
                const rect = btn.getBoundingClientRect();
                return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            }
            return null;
        });

        if (btnBox) {
            await page.mouse.click(btnBox.x, btnBox.y);
        }

        await new Promise(r => setTimeout(r, 5000)); 

        const stillOnPage = await page.evaluate(() => {
            return document.body.innerText.includes('Start Mobile Verification');
        });

        if (stillOnPage) {
            throw new Error("Failed to proceed to OTP screen.");
        }

        console.log("[*] Reached SMS Verification screen.");
        
        activeRegistrationPage = page;
        activeRegistrationBrowser = browser;

        return { success: true, message: "Ready for OTP." };

    } catch (error) {
        console.error("[!] Visual Registration Error:", error.message);
        if (activeRegistrationBrowser) await activeRegistrationBrowser.close();
        activeRegistrationPage = null;
        activeRegistrationBrowser = null;
        throw error;
    }
}

async function verifyVisualOtp(otpValue) {
    if (!activeRegistrationPage) {
        throw new Error("No active registration session found.");
    }

    const page = activeRegistrationPage;

    try {
        console.log(`[*] Entering OTP: ${otpValue}...`);
        
        await page.evaluate((otp) => {
            const input = document.querySelector('input[type="text"]');
            if (input) {
                input.value = otp;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, otpValue);
        
        await new Promise(r => setTimeout(r, 1000));

        console.log("[*] Clicking Verify...");
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('verify'));
            if (btn) btn.click();
        });

        await new Promise(r => setTimeout(r, 5000)); 

        const stillOnPage = await page.evaluate(() => {
            return document.body.innerText.includes('Verification Code');
        });

        if (stillOnPage) {
            throw new Error("Incorrect OTP or verification failed.");
        }

        console.log("[*] OTP Verified successfully.");
        
        await activeRegistrationBrowser.close();
        activeRegistrationPage = null;
        activeRegistrationBrowser = null;

        return { success: true, message: "Account verified." };
    } catch (error) {
        console.error("[!] OTP Verification Error:", error.message);
        throw error;
    }
}

async function performKycVerification(account, password, idImageBuffer, selfieImageBuffer) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    const page = (await browser.pages())[0];
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36');
    page.setDefaultTimeout(20000);

    const tempFrontIdPath = path.join(__dirname, 'temp_front_id.jpg');
    const tempSelfiePath = path.join(__dirname, 'temp_selfie.jpg');
    fs.writeFileSync(tempFrontIdPath, idImageBuffer);
    fs.writeFileSync(tempSelfiePath, selfieImageBuffer);

    try {
        console.log("[*] Waiting 5 seconds for backend sync...");
        await new Promise(r => setTimeout(r, 5000)); 

        console.log("[*] Navigating to login...");
        await page.goto('https://sportsplus.ph/login', { waitUntil: 'networkidle2', timeout: 60000 });
        await dismissTOSModal(page);

        await page.waitForSelector('input[type="password"]', { timeout: 15000 });
        const inputs = await page.$$('input');
        await inputs[0].type(account, { delay: 50 });
        await inputs[1].type(password, { delay: 50 });

        console.log("[*] Clicking Login...");
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('sign in'));
            if (btn) btn.click();
        });
        
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));

        if (page.url().includes('/login')) {
            const errorText = await page.evaluate(() => {
                const el = document.querySelector('.alert, .error-message, [role="alert"]');
                return el ? el.innerText : 'Incorrect Username or Password.';
            });
            throw new Error(`Login Failed: ${errorText}`);
        }
        
        await dismissTOSModal(page);

        console.log("[*] Login Successful! Navigating to KYC form...");
        await page.goto('https://sportsplus.ph/profile/verify-password?redirect=%2Fprofile%2Fkyc%2Fform', { waitUntil: 'networkidle2' });
        
        const pwdInputs = await page.$$('input[type="password"]');
        if (pwdInputs.length > 0) {
            await pwdInputs[0].type(password, { delay: 30 });
            
            console.log("[*] Submitting Verify Password...");
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => 
                    b.innerText.toLowerCase().includes('confirm') || 
                    b.innerText.toLowerCase().includes('submit') || 
                    b.innerText.toLowerCase().includes('verify')
                );
                if (btn) btn.click();
            });
            
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 3000));
        }

        console.log("[*] On KYC Form page. Injecting images...");

        await page.waitForSelector('input[type="file"]', { timeout: 10000 });
        const fileInputs = await page.$$('input[type="file"]');
        
        if (fileInputs.length >= 3) {
            console.log("[*] Uploading Front ID image...");
            await fileInputs[0].uploadFile(tempFrontIdPath);
            await new Promise(r => setTimeout(r, 3000)); 

            console.log("[*] Uploading Selfie image...");
            await fileInputs[2].uploadFile(tempSelfiePath); 
            await new Promise(r => setTimeout(r, 3000)); 
        } else if (fileInputs.length === 2) {
            console.log("[*] Uploading Front ID image...");
            await fileInputs[0].uploadFile(tempFrontIdPath);
            await new Promise(r => setTimeout(r, 3000)); 

            console.log("[*] Uploading Selfie image...");
            await fileInputs[1].uploadFile(tempSelfiePath); 
            await new Promise(r => setTimeout(r, 3000)); 
        } else {
            throw new Error("Could not find the expected file upload inputs on the KYC page.");
        }

        console.log("[*] Clicking the final Submit button...");
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => 
                b.innerText.toLowerCase().includes('submit') || 
                b.innerText.toLowerCase().includes('confirm')
            );
            if (btn) {
                btn.scrollIntoView({ block: 'center' });
                btn.click();
            }
        });

        await new Promise(r => setTimeout(r, 8000)); 

        const isStillOnKyc = await page.evaluate(() => {
            return window.location.href.includes('/profile/kyc/form') && !document.body.innerText.includes('received the ID');
        });

        if (isStillOnKyc) {
            const errorText = await page.evaluate(() => {
                const el = document.querySelector('.alert, .error-message, [role="alert"], .text-red-500');
                return el ? el.innerText : 'Failed to submit KYC. Unknown error.';
            });
            throw new Error(`KYC Submit Failed: ${errorText}`);
        }

        console.log("[*] KYC Submitted successfully.");
        await browser.close();
        
        fs.unlinkSync(tempFrontIdPath);
        fs.unlinkSync(tempSelfiePath);
        
        return { success: true, message: "KYC process completed." };

    } catch (error) {
        console.log(`[!] KYC Error: ${error.message}`);
        await new Promise(r => setTimeout(r, 5000));
        await browser.close();
        
        if (fs.existsSync(tempFrontIdPath)) fs.unlinkSync(tempFrontIdPath);
        if (fs.existsSync(tempSelfiePath)) fs.unlinkSync(tempSelfiePath);
        
        throw error;
    }
}

async function checkKycStatus(account, password) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36');

    try {
        await page.goto('https://sportsplus.ph/login', { waitUntil: 'networkidle2', timeout: 60000 });
        await dismissTOSModal(page);

        await page.waitForSelector('input[type="password"]', { timeout: 15000 });
        const inputs = await page.$$('input');
        await inputs[0].type(account, { delay: 30 });
        await inputs[1].type(password, { delay: 30 });

        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('sign in'));
            if (btn) btn.click();
        });
        
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));
        await dismissTOSModal(page);

        await page.goto('https://sportsplus.ph/profile', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 3000));

        const kycText = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('p'));
            const statusLabel = elements.find(el => el.innerText.includes('Verification Status'));
            if (statusLabel && statusLabel.nextElementSibling) {
                return statusLabel.nextElementSibling.innerText.trim();
            }
            return null;
        });

        await browser.close();
        
        if (!kycText) return 'pending';
        if (kycText.toLowerCase().includes('verified')) return 'approved';
        if (kycText.toLowerCase().includes('rejected')) return 'rejected';
        
        return 'pending';
    } catch (error) {
        await browser.close();
        throw error;
    }
}

async function performPromoClaim(account, password, promoCode) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    const page = (await browser.pages())[0];
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36');
    
    try {
        console.log("[*] Navigating to login for Promo Claim...");
        await page.goto('https://sportsplus.ph/login', { waitUntil: 'networkidle2', timeout: 60000 });
        await dismissTOSModal(page);

        await page.waitForSelector('input[type="password"]', { timeout: 15000 });
        const inputs = await page.$$('input');
        await inputs[0].type(account, { delay: 50 });
        await inputs[1].type(password, { delay: 50 });

        console.log("[*] Clicking Login...");
        await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('sign in'));
            if (btn) btn.click();
        });
        
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));

        if (page.url().includes('/login')) {
            const errorText = await page.evaluate(() => {
                const el = document.querySelector('.alert, .error-message, [role="alert"]');
                return el ? el.innerText : 'Incorrect Username or Password.';
            });
            throw new Error(`Login Failed: ${errorText}`);
        }
        
        await dismissTOSModal(page);
        console.log("[*] Logged in. Checking preconditions...");

        // 1. Check Precondition
        const preconditionResult = await page.evaluate(async () => {
            const res = await fetch('/portal/api/bonus/check-precondition', {
                method: 'POST',
                headers: { 'accept': 'application/json', 'content-type': 'application/json' },
                body: JSON.stringify({ bonusType: 9, no: "WELCOMESP50" }) 
            });
            return { status: res.status, data: await res.json() };
        });

        if (preconditionResult.status !== 200) {
            throw new Error(`Precondition check failed: ${JSON.stringify(preconditionResult.data)}`);
        }

        console.log("[*] Precondition passed. Claiming promo code...");

        // 2. Claim Promo Code
        const claimResult = await page.evaluate(async (code) => {
            const res = await fetch('/portal/api/bonus/promo-code', {
                method: 'POST',
                headers: { 'accept': 'application/json', 'content-type': 'application/json' },
                body: JSON.stringify({ promoCode: code })
            });
            return { status: res.status, data: await res.json() };
        }, promoCode);

        if (claimResult.status !== 200) {
            throw new Error(`Promo Claim failed: ${JSON.stringify(claimResult.data)}`);
        }

        console.log("[*] Promo claimed successfully. Fetching new balance...");

        // 3. Fetch Updated Balance
        const balanceResult = await page.evaluate(async () => {
            const res = await fetch('/portal/api/balance', {
                method: 'GET',
                headers: { 'accept': 'application/json' }
            });
            return { status: res.status, data: await res.json() };
        });

        await browser.close();
        
        return { 
            success: true, 
            message: "Promo code claimed successfully.", 
            balance: balanceResult.data?.data?.balance || 0 
        };

    } catch (error) {
        console.log(`[!] Promo Claim Error: ${error.message}`);
        await browser.close();
        throw error;
    }
}

module.exports = { performVisualRegistration, verifyVisualOtp, performKycVerification, checkKycStatus, performPromoClaim };